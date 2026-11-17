import { BadRequestException, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { lastValueFrom, of, throwError } from 'rxjs';
import { PAYMENTS_SERVICE } from '@app/common/constants/service';
import { CREATE_CHARGE } from '@app/common/constants/patterns';
import { ReservationService } from './reservation.service';
import { ReservationRepo } from './reservation.repo';

describe('ReservationService', () => {
  let service: ReservationService;
  let paymentsClient: { send: jest.Mock };
  let repo: Record<
    'create' | 'find' | 'findOne' | 'findOneAndUpdate' | 'findOneAndDelete',
    jest.Mock
  >;

  const user = { _id: 'user-1', email: 'john@example.com' };
  const dto = {
    startDate: new Date('2026-10-01'),
    endDate: new Date('2026-10-05'),
    charge: {
      amount: 20,
      card: { number: '4242424242424242', exp_month: 12, exp_year: 2030, cvc: '123' },
    },
  };

  beforeEach(async () => {
    paymentsClient = { send: jest.fn() };
    repo = {
      create: jest.fn((doc: object) => Promise.resolve({ _id: 'res-1', ...doc })),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationService,
        { provide: ReservationRepo, useValue: repo },
        { provide: PAYMENTS_SERVICE, useValue: paymentsClient },
      ],
    }).compile();

    service = module.get(ReservationService);
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('create', () => {
    it('charges the user over Kafka and saves the reservation with the invoice id', async () => {
      paymentsClient.send.mockReturnValue(of({ id: 'pi_123' }));

      const reservation = await lastValueFrom(service.create(dto, user));

      expect(paymentsClient.send).toHaveBeenCalledWith(CREATE_CHARGE, {
        ...dto.charge,
        email: 'john@example.com',
      });
      expect(repo.create).toHaveBeenCalledWith({
        startDate: dto.startDate,
        endDate: dto.endDate,
        invoiceId: 'pi_123',
        userId: 'user-1',
        timestamp: expect.any(Date),
      });
      expect(reservation).toMatchObject({ _id: 'res-1', invoiceId: 'pi_123' });
    });

    it('returns 400 and saves nothing when the payment fails', async () => {
      paymentsClient.send.mockReturnValue(
        throwError(() => ({ statusCode: 402, message: 'Your card was declined' })),
      );

      const error = await lastValueFrom(service.create(dto, user)).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe('Your card was declined');
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('does not call Kafka until the observable is subscribed', () => {
      paymentsClient.send.mockReturnValue(of({ id: 'pi_1' }));

      service.create(dto, user);

      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  it('findAll returns every reservation', async () => {
    repo.find.mockResolvedValue([{ _id: '1' }]);
    await expect(service.findAll()).resolves.toEqual([{ _id: '1' }]);
    expect(repo.find).toHaveBeenCalledWith({});
  });

  it('findOne looks up by id', async () => {
    await service.findOne('abc');
    expect(repo.findOne).toHaveBeenCalledWith({ _id: 'abc' });
  });

  it('update only sets the provided fields', async () => {
    const endDate = new Date('2026-10-10');
    await service.update('abc', { endDate });
    expect(repo.findOneAndUpdate).toHaveBeenCalledWith({ _id: 'abc' }, { $set: { endDate } });
  });

  it('remove deletes by id', async () => {
    await service.remove('abc');
    expect(repo.findOneAndDelete).toHaveBeenCalledWith({ _id: 'abc' });
  });
});
