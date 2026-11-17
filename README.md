# micro-kafka

The same NestJS microservices as `micro rabbit/micro` (auth, reservations, payments, notifications),
but communicating over **Apache Kafka** instead of RabbitMQ.

```
               HTTP :3021                    HTTP :3023
                  │                              │
             ┌────▼────┐   authenticate    ┌─────▼────────┐
             │  auth   │◄──────────────────┤ reservations │
             └─────────┘  (request/reply)  └─────┬────────┘
                                                 │ create_charge (request/reply)
                                           ┌─────▼────┐
                                           │ payments │── Stripe
                                           └─────┬────┘
                                                 │ notify_email (event)
                                         ┌───────▼───────┐
                                         │ notifications │── Gmail
                                         └───────────────┘
```

| Kafka topic           | Type          | Producer                    | Consumer       |
| --------------------- | ------------- | --------------------------- | -------------- |
| `authenticate`        | request/reply | reservations, auth (users)  | auth           |
| `create_charge`       | request/reply | reservations                | payments       |
| `notify_email`        | event         | payments                    | notifications  |

Replies travel on `<topic>.reply`. All topics are created up front by the `kafka-init` container.

## Run

```bash
npm install
docker compose up -d --build
```

| Service      | URL                                  |
| ------------ | ------------------------------------ |
| auth         | http://localhost:3021                |
| reservations | http://localhost:3023                |
| Kafka (host) | localhost:29092                      |
| MongoDB      | mongodb://localhost:27018            |

Host ports differ from the RabbitMQ project so both stacks can run side by side.

Example flow:

```bash
curl -X POST localhost:3021/users -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"Str0ng!Passw0rd"}'

curl -X POST localhost:3021/auth/login -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"Str0ng!Passw0rd"}'

curl -X POST localhost:3023/reservation -b cookies.txt -H "Content-Type: application/json" \
  -d '{"startDate":"2026-12-01","endDate":"2026-12-05","charge":{"amount":25,"card":{"number":"4242 4242 4242 4242","exp_month":12,"exp_year":2030,"cvc":"123"}}}'
```

Each service reads `apps/<service>/.env` (see `.env.example` next to it).

## Tests

| Command              | What it tests                                                                                   | Needs                    |
| -------------------- | ----------------------------------------------------------------------------------------------- | ------------------------ |
| `npm test`           | Unit tests; Kafka clients, Mongo, Stripe and nodemailer are mocked                              | nothing                  |
| `npm run test:kafka` | Real controllers/services/guard talking through a **real Kafka broker** (Stripe, DB, mail mocked) | Docker                   |
| `npm run test:e2e`   | HTTP against the running stack: register, login, auth guard, Stripe charge, CRUD, email event   | `docker compose up`      |
| `npm run test:all`   | All of the above                                                                                | Docker + running stack   |
| `npm run test:cov`   | Unit tests with coverage report                                                                 | nothing                  |

`test:kafka` starts its own throw-away broker from `docker-compose.test.yml` on port 39092 and removes it
afterwards (`KEEP_KAFKA=1` keeps it, `KAFKA_BROKERS=host:port` uses an existing broker instead).

`test:e2e` uses `AUTH_URL` / `RESERVATIONS_URL` (defaults `http://localhost:3021` / `http://localhost:3023`)
and waits up to 5 minutes for the services to come up.

## Kafka-specific notes

- `libs/common/src/kafka/kafka.module.ts` creates each `ClientKafka`, subscribes to reply topics
  **before** connecting (otherwise `send()` never resolves) and connects at startup.
- Each client that expects replies has its own consumer group (`reservations-auth`, `reservations-payments`, `auth-users`).
- Validation errors in message handlers are returned to the caller as `{ statusCode: 400, message: [...] }`
  (`createRpcValidationPipe`), instead of Nest's generic "Internal server error".
- Event handlers use `SkipFailedEventFilter`: Nest's Kafka server otherwise rethrows event errors to kafkajs,
  which retries the same message forever and blocks the partition.
