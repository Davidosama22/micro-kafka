import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { LoggerModule } from '@app/common/logger/logger.module';
import { KafkaModule } from '@app/common/kafka';
import { NOTIFICATIONS_SERVICE } from '@app/common/constants/service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: './apps/payments/.env',
      validationSchema: Joi.object({
        STRIPE_SECRET_KEY: Joi.string().required(),
        STRIPE_PUBLISHABLE_KEY: Joi.string().required(),
        KAFKA_BROKERS: Joi.string().required(),
      }),
    }),
    LoggerModule,
    KafkaModule.register([
      {
        name: NOTIFICATIONS_SERVICE,
        clientId: 'payments-notifications',
        producerOnly: true,
      },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
