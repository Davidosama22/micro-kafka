import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { getKafkaBrokers, kafkaServerOptions } from '@app/common/kafka';
import { AuthModule } from './auth.module';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  app.connectMicroservice(
    kafkaServerOptions(getKafkaBrokers(configService), 'auth'),
  );

  await app.startAllMicroservices();
  await app.listen(configService.get('HTTP_PORT') ?? 3001);
}
void bootstrap();
