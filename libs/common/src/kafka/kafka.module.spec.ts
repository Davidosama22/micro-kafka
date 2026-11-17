import { ConfigService } from '@nestjs/config';
import { ClientKafka, Transport } from '@nestjs/microservices';
import { createKafkaClient } from './kafka.module';
import { getKafkaBrokers, kafkaServerOptions } from './kafka.options';

describe('Kafka helpers', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('getKafkaBrokers', () => {
    it('splits a comma separated KAFKA_BROKERS value', () => {
      const config = {
        getOrThrow: () => 'kafka-1:9092, kafka-2:9092 ,',
      } as unknown as ConfigService;

      expect(getKafkaBrokers(config)).toEqual(['kafka-1:9092', 'kafka-2:9092']);
    });
  });

  describe('kafkaServerOptions', () => {
    it('uses the service name as client id and consumer group by default', () => {
      expect(kafkaServerOptions(['localhost:9092'], 'auth')).toEqual({
        transport: Transport.KAFKA,
        options: {
          client: { clientId: 'auth', brokers: ['localhost:9092'] },
          consumer: { groupId: 'auth' },
        },
      });
    });

    it('accepts a custom consumer group', () => {
      const options = kafkaServerOptions(['b:9092'], 'auth', 'auth-test');
      expect(options.options?.consumer?.groupId).toBe('auth-test');
    });
  });

  describe('createKafkaClient', () => {
    it('subscribes to reply topics before connecting', async () => {
      const subscribe = jest.spyOn(ClientKafka.prototype, 'subscribeToResponseOf');
      const connect = jest
        .spyOn(ClientKafka.prototype, 'connect')
        .mockResolvedValue({} as never);

      await createKafkaClient(['localhost:9092'], {
        name: 'TEST',
        clientId: 'test',
        responseOf: ['authenticate', 'create_charge'],
      });

      expect(subscribe.mock.calls.map(([pattern]) => pattern)).toEqual([
        'authenticate',
        'create_charge',
      ]);
      expect(subscribe.mock.invocationCallOrder[1]).toBeLessThan(
        connect.mock.invocationCallOrder[0],
      );
    });

    it('closes the client on application shutdown', async () => {
      jest.spyOn(ClientKafka.prototype, 'connect').mockResolvedValue({} as never);
      const close = jest
        .spyOn(ClientKafka.prototype, 'close')
        .mockResolvedValue(undefined);

      const client = (await createKafkaClient(['localhost:9092'], {
        name: 'TEST',
        clientId: 'test',
        producerOnly: true,
      })) as ClientKafka & { onApplicationShutdown: () => Promise<void> };
      await client.onApplicationShutdown();

      expect(close).toHaveBeenCalled();
    });
  });
});
