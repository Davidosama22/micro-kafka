import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let paymentsService: { createCharge: jest.Mock };

  beforeEach(async () => {
    paymentsService = { createCharge: jest.fn().mockResolvedValue({ id: 'pi_1' }) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: paymentsService }],
    }).compile();

    controller = module.get(PaymentsController);
  });

  it('delegates create_charge messages to the service', async () => {
    const data = {
      email: 'john@example.com',
      amount: 5,
      card: { number: '4242424242424242', exp_month: 1, exp_year: 2030, cvc: '1' },
    };

    await expect(controller.createCharge(data)).resolves.toEqual({ id: 'pi_1' });
    expect(paymentsService.createCharge).toHaveBeenCalledWith(data);
  });
});
