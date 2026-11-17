import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { AUTH_SERVICE } from '@app/common/constants/service';
import { ReservationController } from './reservation.controller';
import { ReservationService } from './reservation.service';

describe('ReservationController', () => {
  let controller: ReservationController;
  let service: Record<'create' | 'findAll' | 'findOne' | 'update' | 'remove', jest.Mock>;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationController],
      providers: [
        { provide: ReservationService, useValue: service },
        { provide: AUTH_SERVICE, useValue: {} },
      ],
    }).compile();

    controller = module.get(ReservationController);
  });

  it('create passes the body and the current user to the service', () => {
    const user = { _id: 'u1', email: 'john@example.com' };
    const dto = { startDate: new Date(), endDate: new Date(), charge: {} } as never;
    const result$ = of({ _id: 'r1' });
    service.create.mockReturnValue(result$);

    expect(controller.create(dto, user)).toBe(result$);
    expect(service.create).toHaveBeenCalledWith(dto, user);
  });

  it('findAll, findOne, update and remove delegate to the service', async () => {
    await controller.findAll();
    await controller.findOne('1');
    await controller.update('1', { endDate: new Date('2026-01-01') });
    await controller.remove('1');

    expect(service.findAll).toHaveBeenCalled();
    expect(service.findOne).toHaveBeenCalledWith('1');
    expect(service.update).toHaveBeenCalledWith('1', { endDate: new Date('2026-01-01') });
    expect(service.remove).toHaveBeenCalledWith('1');
  });
});
