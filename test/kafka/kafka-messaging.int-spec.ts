import {
  BadRequestException,
  ExecutionContext,
  INestMicroservice,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ClientKafka } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Observable, firstValueFrom, lastValueFrom } from 'rxjs';
import { AUTH_TIMEOUT_MS, JwtAuthGuard } from '@app/common/auth';
import { NOTIFICATIONS_SERVICE } from '@app/common/constants/service';
import {
  AUTHENTICATE,
  CREATE_CHARGE,
  NOTIFY_EMAIL,
} from '@app/common/constants/patterns';
import { createKafkaClient, kafkaServerOptions } from '@app/common/kafka';
import { AuthController } from '../../apps/auth/src/auth.controller';
import { AuthService } from '../../apps/auth/src/auth.service';
import { UsersService } from '../../apps/auth/src/users/users.service';
import { PaymentsController } from '../../apps/payments/src/payments.controller';
import { PaymentsService } from '../../apps/payments/src/payments.service';
import { NotificationsController } from '../../apps/notifications/src/notifications.controller';
import { NotificationsService } from '../../apps/notifications/src/notifications.service';
import { ReservationService } from '../../apps/reservations/src/reservation.service';
import { ReservationRepo } from '../../apps/reservations/src/reservation.repo';
import { TEST_BROKERS, ensureTopics, waitFor } from './helpers';

const mockStripeCreate = jest.fn();
jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    paymentIntents: { create: mockStripeCreate },
  })),
);

const runId = `${Date.now()}`;
const httpContext = (request: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('Kafka messaging between services (real broker)', () => {
  const jwtService = new JwtService({ secret: 'kafka-integration' });
  const usersService = { findById: jest.fn() };
  const notificationsService = { notifyEmail: jest.fn() };
  const reservationRepo = {
    create: jest.fn((doc: object) =>
      Promise.resolve({ _id: new Types.ObjectId().toHexString(), ...doc }),
    ),
  };

  let moduleRef: TestingModule;
  let server: INestMicroservice;
  let authClient: ClientKafka;
  let paymentsClient: ClientKafka;
  let eventsProducer: ClientKafka;
  let guard: JwtAuthGuard;
  let reservationService: ReservationService;

  beforeAll(async () => {
    Logger.overrideLogger(['error']);
    await ensureTopics(TEST_BROKERS);

    // Hosts the real auth, payments and notifications message handlers on one Kafka consumer.
    moduleRef = await Test.createTestingModule({
      controllers: [AuthController, PaymentsController, NotificationsController],
      providers: [
        PaymentsService,
        { provide: ConfigService, useValue: { getOrThrow: () => 'sk_test_fake' } },
        {
          provide: NOTIFICATIONS_SERVICE,
          useFactory: () =>
            createKafkaClient(TEST_BROKERS, {
              name: NOTIFICATIONS_SERVICE,
              clientId: `it-payments-notifications-${runId}`,
              producerOnly: true,
            }),
        },
        { provide: AuthService, useValue: {} },
        { provide: JwtService, useValue: jwtService },
        { provide: UsersService, useValue: usersService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    const serverOptions = kafkaServerOptions(TEST_BROKERS, 'it-server', `it-server-${runId}`);
    serverOptions.options!.subscribe = { fromBeginning: true };
    server = moduleRef.createNestMicroservice(serverOptions);
    await server.listen();

    [authClient, paymentsClient, eventsProducer] = await Promise.all([
      createKafkaClient(TEST_BROKERS, {
        name: 'AUTH',
        clientId: `it-reservations-auth-${runId}`,
        responseOf: [AUTHENTICATE],
      }),
      createKafkaClient(TEST_BROKERS, {
        name: 'PAYMENTS',
        clientId: `it-reservations-payments-${runId}`,
        responseOf: [CREATE_CHARGE],
      }),
      createKafkaClient(TEST_BROKERS, {
        name: 'EVENTS',
        clientId: `it-events-${runId}`,
        producerOnly: true,
      }),
    ]);

    guard = new JwtAuthGuard(authClient);
    reservationService = new ReservationService(
      reservationRepo as unknown as ReservationRepo,
      paymentsClient,
    );
  });

  afterAll(async () => {
    await Promise.all([authClient?.close(), paymentsClient?.close(), eventsProducer?.close()]);
    await server?.close();
    Logger.overrideLogger(['log', 'error', 'warn', 'debug', 'verbose']);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate (reservations/auth guard -> auth service)', () => {
    it('lets a request through and attaches the user for a valid JWT', async () => {
      const userId = new Types.ObjectId();
      usersService.findById.mockResolvedValue({
        _id: userId,
        email: 'john@example.com',
        password: 'hash',
      });
      const token = jwtService.sign({ tokenPayload: { userId: userId.toHexString() } });
      const request: Record<string, unknown> = { cookies: { Authentication: token } };

      const allowed = await lastValueFrom(
        guard.canActivate(httpContext(request)) as Observable<boolean>,
      );

      expect(allowed).toBe(true);
      expect(request.user).toEqual({ _id: userId.toHexString(), email: 'john@example.com' });
      expect(usersService.findById).toHaveBeenCalledWith(userId.toHexString());
    });

    it('rejects an invalid JWT with a reply, not a timeout', async () => {
      const startedAt = Date.now();

      const allowed = await lastValueFrom(
        guard.canActivate(
          httpContext({ cookies: { Authentication: 'forged.jwt.token' } }),
        ) as Observable<boolean>,
      );

      expect(allowed).toBe(false);
      expect(Date.now() - startedAt).toBeLessThan(AUTH_TIMEOUT_MS);
      expect(usersService.findById).not.toHaveBeenCalled();
    });
  });

  describe('create reservation (reservations -> payments -> notifications)', () => {
    const dto = {
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-05'),
      charge: {
        amount: 42,
        card: { number: '4242424242424242', exp_month: 12, exp_year: 2030, cvc: '123' },
      },
    };
    const user = { _id: 'user-1', email: 'john@example.com' };

    it('charges the card, stores the invoice id and emails the user', async () => {
      mockStripeCreate.mockResolvedValue({ id: 'pi_kafka_test', status: 'succeeded' });

      const reservation = await lastValueFrom(reservationService.create(dto, user));

      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 4200, currency: 'usd' }),
      );
      expect(reservation).toMatchObject({
        invoiceId: 'pi_kafka_test',
        userId: 'user-1',
      });
      await waitFor(() =>
        expect(notificationsService.notifyEmail).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'john@example.com', text: '42' }),
        ),
      );
    });

    it('turns a declined card into 400 Bad Request and sends no email', async () => {
      mockStripeCreate.mockRejectedValue(new Error('Your card was declined.'));

      const error = await lastValueFrom(reservationService.create(dto, user)).catch(
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe('Your card was declined.');
      expect(reservationRepo.create).not.toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      expect(notificationsService.notifyEmail).not.toHaveBeenCalled();
    });
  });

  describe('payload validation across Kafka', () => {
    it('create_charge replies with readable validation errors', async () => {
      const error = await firstValueFrom(
        paymentsClient.send(CREATE_CHARGE, { email: 'not-an-email', amount: -1 }),
      ).catch((e: unknown) => e);

      expect(error).toMatchObject({
        statusCode: 400,
        message: expect.arrayContaining([
          expect.stringMatching(/^email: /),
          expect.stringMatching(/^amount: /),
          expect.stringMatching(/^card: /),
        ]),
      });
      expect(mockStripeCreate).not.toHaveBeenCalled();
    });

    it('notify_email ignores invalid events and keeps consuming', async () => {
      await lastValueFrom(eventsProducer.emit(NOTIFY_EMAIL, { email: 'broken' }));
      await lastValueFrom(
        eventsProducer.emit(NOTIFY_EMAIL, { email: 'valid@example.com', text: '7' }),
      );

      await waitFor(() =>
        expect(notificationsService.notifyEmail).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'valid@example.com' }),
        ),
      );
      expect(notificationsService.notifyEmail).toHaveBeenCalledTimes(1);
    });
  });
});
