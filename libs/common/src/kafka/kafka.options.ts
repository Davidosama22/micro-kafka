import { ConfigService } from '@nestjs/config';
import { KafkaOptions, Transport } from '@nestjs/microservices';

export const getKafkaBrokers = (configService: ConfigService): string[] =>
  configService
    .getOrThrow<string>('KAFKA_BROKERS')
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);

export const kafkaServerOptions = (
  brokers: string[],
  serviceName: string,
  groupId: string = serviceName,
): KafkaOptions => ({
  transport: Transport.KAFKA,
  options: {
    client: { clientId: serviceName, brokers },
    consumer: { groupId },
  },
});
