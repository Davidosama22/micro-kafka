import { RpcException } from '@nestjs/microservices';
import { CreateChargeDto } from '../dto/create-charge.dto';
import { createRpcValidationPipe } from './rpc-validation.pipe';

describe('createRpcValidationPipe', () => {
  const pipe = createRpcValidationPipe();
  const metadata = { type: 'body' as const, metatype: CreateChargeDto };

  it('passes a valid payload through and converts it to the DTO class', async () => {
    const payload = {
      amount: 10,
      card: {
        number: '4242 4242 4242 4242',
        exp_month: 12,
        exp_year: 2030,
        cvc: '123',
      },
    };

    const result = await pipe.transform(payload, metadata);

    expect(result).toBeInstanceOf(CreateChargeDto);
    expect(result.card.number).toBe('4242424242424242');
  });

  it('throws an RpcException listing nested validation errors', async () => {
    const error = await pipe
      .transform({ amount: -5, card: { number: '123' } }, metadata)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RpcException);
    const body = (error as RpcException).getError() as {
      statusCode: number;
      message: string[];
    };
    expect(body.statusCode).toBe(400);
    expect(body.message).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^amount: /),
        expect.stringMatching(/^card\.number: /),
        expect.stringMatching(/^card\.cvc: /),
      ]),
    );
  });
});
