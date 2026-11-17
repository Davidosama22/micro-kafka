import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { getKafkaBrokers, kafkaServerOptions } from '@app/common/kafka';
import { PaymentsModule } from './payments.module';

async function bootstrap() {
  const app = await NestFactory.create(PaymentsModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  app.connectMicroservice(
    kafkaServerOptions(getKafkaBrokers(configService), 'payments'),
  );

  await app.init();
  await app.startAllMicroservices();
}
void bootstrap();
