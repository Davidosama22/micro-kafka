import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { NOTIFICATIONS_SERVICE } from '@app/common/constants/service';
import { NOTIFY_EMAIL } from '@app/common/constants/patterns';
import { PaymentsService } from './payments.service';

const mockPaymentIntentsCreate = jest.fn();
jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    paymentIntents: { create: mockPaymentIntentsCreate },
  })),
);

describe('PaymentsService', () => {
  let service: PaymentsService;
  let notificationsClient: { emit: jest.Mock };

  const charge = {
    email: 'john@example.com',
    amount: 12.5,
    card: { number: '4242424242424242', exp_month: 12, exp_year: 2030, cvc: '123' },
  };

  beforeEach(async () => {
    mockPaymentIntentsCreate.mockReset();
    notificationsClient = { emit: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: ConfigService, useValue: { getOrThrow: () => 'sk_test_123' } },
        { provide: NOTIFICATIONS_SERVICE, useValue: notificationsClient },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  it('charges Stripe in cents and emits a notify_email event', async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: 'pi_123', status: 'succeeded' });

    const result = await service.createCharge(charge);

    expect(result).toEqual({ id: 'pi_123', status: 'succeeded' });
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1250, currency: 'usd', confirm: true }),
    );
    expect(notificationsClient.emit).toHaveBeenCalledWith(NOTIFY_EMAIL, {
      email: 'john@example.com',
      text: '12.5',
    });
  });

  it('throws an RpcException and sends no email when Stripe fails', async () => {
    mockPaymentIntentsCreate.mockRejectedValue(new Error('Your card was declined'));

    const error = await service.createCharge(charge).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RpcException);
    expect((error as RpcException).getError()).toEqual({
      statusCode: 402,
      message: 'Your card was declined',
    });
    expect(notificationsClient.emit).not.toHaveBeenCalled();
  });
});
