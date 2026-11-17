import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientKafka } from '@nestjs/microservices';
import { getKafkaBrokers } from './kafka.options';

export interface KafkaClientRegistration {
  name: string | symbol;
  clientId: string;
  // Every client that expects replies must have a consumer group that no other app shares.
  groupId?: string;
  responseOf?: string[];
  producerOnly?: boolean;
}

export async function createKafkaClient(
  brokers: string[],
  registration: KafkaClientRegistration,
): Promise<ClientKafka> {
  const client = new ClientKafka({
    client: { clientId: registration.clientId, brokers },
    consumer: { groupId: registration.groupId ?? registration.clientId },
    // A fresh group would otherwise start at "latest" and can miss a reply sent right after connect.
    // Stale replies are harmless: their correlation ids match no pending request.
    subscribe: { fromBeginning: true },
    producerOnlyMode: registration.producerOnly ?? false,
  });

  // Reply topics must be subscribed before connect(), otherwise send() never resolves.
  registration.responseOf?.forEach((pattern) =>
    client.subscribeToResponseOf(pattern),
  );
  await client.connect();

  return Object.assign(client, {
    onApplicationShutdown: () => client.close(),
  });
}

@Module({})
export class KafkaModule {
  static register(clients: KafkaClientRegistration[]): DynamicModule {
    const providers: Provider[] = clients.map((registration) => ({
      provide: registration.name,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createKafkaClient(getKafkaBrokers(configService), registration),
    }));

    return {
      module: KafkaModule,
      providers,
      exports: clients.map(({ name }) => name),
    };
  }
}
