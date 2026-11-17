import { execSync } from 'child_process';
import { join } from 'path';
import request from 'supertest';
import { AUTH_URL, RESERVATIONS_URL } from './config';

const email = `e2e-${Date.now()}@example.com`;
const password = 'Str0ng!Passw0rd';
const reservationBody = {
  startDate: '2026-12-01',
  endDate: '2026-12-05',
  charge: {
    amount: 25,
    card: { number: '4242 4242 4242 4242', exp_month: 12, exp_year: 2030, cvc: '123' },
  },
};

const notificationLogs = () =>
  execSync('docker compose logs notifications --no-color --since 10m', {
    cwd: join(__dirname, '..', '..'),
    encoding: 'utf8',
  });

describe('Full stack over Kafka (auth, reservations, payments, notifications)', () => {
  let cookie: string;
  let userId: string;
  let reservationId: string;

  describe('auth service', () => {
    it('rejects a weak password (400)', async () => {
      await request(AUTH_URL).post('/users').send({ email, password: '123' }).expect(400);
    });

    it('registers a user without leaking the password hash (201)', async () => {
      const res = await request(AUTH_URL).post('/users').send({ email, password }).expect(201);

      expect(res.body).toEqual({ _id: expect.any(String), email });
      userId = res.body._id;
    });

    it('refuses to register the same email twice (409)', async () => {
      await request(AUTH_URL).post('/users').send({ email, password }).expect(409);
    });

    it('rejects a wrong password (401)', async () => {
      await request(AUTH_URL)
        .post('/auth/login')
        .send({ email, password: 'Wr0ng!Password' })
        .expect(401);
    });

    it('logs in and sets the Authentication cookie (200)', async () => {
      const res = await request(AUTH_URL).post('/auth/login').send({ email, password }).expect(200);

      expect(res.body).toEqual({ _id: userId, email });
      const setCookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
      const authCookie = setCookie.find((c) => c.startsWith('Authentication='));
      expect(authCookie).toMatch(/HttpOnly/i);
      cookie = authCookie!.split(';')[0];
    });

    it('GET /users returns the current user via the Kafka authenticate call', async () => {
      const res = await request(AUTH_URL).get('/users').set('Cookie', cookie).expect(200);

      expect(res.body).toEqual({ _id: userId, email });
    });

    it('GET /users without a cookie is forbidden (403)', async () => {
      await request(AUTH_URL).get('/users').expect(403);
    });
  });

  describe('reservations service', () => {
    it('is forbidden without a cookie (403)', async () => {
      await request(RESERVATIONS_URL).get('/reservation').expect(403);
    });

    it('is forbidden with a forged JWT (403)', async () => {
      await request(RESERVATIONS_URL)
        .get('/reservation')
        .set('Cookie', 'Authentication=forged.jwt.token')
        .expect(403);
    });

    it('validates the reservation body (400)', async () => {
      const res = await request(RESERVATIONS_URL)
        .post('/reservation')
        .set('Cookie', cookie)
        .send({ ...reservationBody, charge: { amount: 25, card: { number: '1234' } } })
        .expect(400);

      expect(JSON.stringify(res.body.message)).toContain('charge.card');
    });

    it('creates a reservation after charging the card via payments (201)', async () => {
      const res = await request(RESERVATIONS_URL)
        .post('/reservation')
        .set('Cookie', cookie)
        .send(reservationBody)
        .expect(201);

      expect(res.body).toMatchObject({
        _id: expect.any(String),
        userId,
        invoiceId: expect.stringMatching(/^pi_/),
        startDate: '2026-12-01T00:00:00.000Z',
        endDate: '2026-12-05T00:00:00.000Z',
      });
      reservationId = res.body._id;
    });

    it('payments emitted notify_email and notifications consumed it', async () => {
      const deadline = Date.now() + 20_000;
      let logs = '';
      while (Date.now() < deadline) {
        logs = notificationLogs();
        if (logs.includes(`notify_email received for ${email}`)) break;
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      expect(logs).toContain(`notify_email received for ${email}`);
    });

    it('reads the reservation back (GET /reservation/:id and list)', async () => {
      const one = await request(RESERVATIONS_URL)
        .get(`/reservation/${reservationId}`)
        .set('Cookie', cookie)
        .expect(200);
      expect(one.body._id).toBe(reservationId);

      const all = await request(RESERVATIONS_URL)
        .get('/reservation')
        .set('Cookie', cookie)
        .expect(200);
      expect(all.body.map((r: { _id: string }) => r._id)).toContain(reservationId);
    });

    it('updates the reservation dates (PATCH)', async () => {
      const res = await request(RESERVATIONS_URL)
        .patch(`/reservation/${reservationId}`)
        .set('Cookie', cookie)
        .send({ endDate: '2026-12-10' })
        .expect(200);

      expect(res.body.endDate).toBe('2026-12-10T00:00:00.000Z');
      expect(res.body.invoiceId).toMatch(/^pi_/);
    });

    it('deletes the reservation, then returns 404 for it', async () => {
      await request(RESERVATIONS_URL)
        .delete(`/reservation/${reservationId}`)
        .set('Cookie', cookie)
        .expect(200);

      await request(RESERVATIONS_URL)
        .get(`/reservation/${reservationId}`)
        .set('Cookie', cookie)
        .expect(404);
    });
  });
});
