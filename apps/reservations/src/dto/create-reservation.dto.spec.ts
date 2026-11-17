import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateReservationDto } from './create-reservation.dto';
import { UpdateReservationDto } from './update-reservation.dto';

const validBody = {
  startDate: '2026-10-01',
  endDate: '2026-10-05',
  charge: {
    amount: 20,
    card: { number: '4242 4242 4242 4242', exp_month: 12, exp_year: 2030, cvc: '123' },
  },
};

const errorsFor = async (body: object) =>
  (await validate(plainToInstance(CreateReservationDto, body))).map((e) => e.property);

describe('CreateReservationDto', () => {
  it('accepts a valid reservation and parses the dates', async () => {
    const dto = plainToInstance(CreateReservationDto, validBody);

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.startDate).toBeInstanceOf(Date);
  });

  it('requires a charge', async () => {
    await expect(errorsFor({ ...validBody, charge: undefined })).resolves.toContain('charge');
  });

  it('rejects an invalid card number', async () => {
    const body = {
      ...validBody,
      charge: { ...validBody.charge, card: { ...validBody.charge.card, number: '1234' } },
    };
    await expect(errorsFor(body)).resolves.toContain('charge');
  });

  it('rejects invalid dates', async () => {
    await expect(errorsFor({ ...validBody, startDate: 'not-a-date' })).resolves.toContain(
      'startDate',
    );
  });
});

describe('UpdateReservationDto', () => {
  it('allows partial updates and does not accept a charge', async () => {
    const dto = plainToInstance(UpdateReservationDto, { endDate: '2026-10-09' });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(
      await validate(plainToInstance(UpdateReservationDto, { charge: {} }), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    ).not.toHaveLength(0);
  });
});
