import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { DatabaseModule } from '@app/common/database';
import { LoggerModule } from '@app/common/logger/logger.module';
import { KafkaModule } from '@app/common/kafka';
import { AUTH_SERVICE, PAYMENTS_SERVICE } from '@app/common/constants/service';
import { AUTHENTICATE, CREATE_CHARGE } from '@app/common/constants/patterns';
import { ReservationService } from './reservation.service';
import { ReservationController } from './reservation.controller';
import { ReservationRepo } from './reservation.repo';
import {
  ReservationDocument,
  ReservationSchema,
} from './entities/reservation.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: './apps/reservations/.env',
      validationSchema: Joi.object({
        MONGODB_URI: Joi.string().required(),
        PORT: Joi.number().required(),
        KAFKA_BROKERS: Joi.string().required(),
      }),
    }),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: ReservationDocument.name, schema: ReservationSchema },
    ]),
    LoggerModule,
    KafkaModule.register([
      {
        name: AUTH_SERVICE,
        clientId: 'reservations-auth',
        groupId: 'reservations-auth',
        responseOf: [AUTHENTICATE],
      },
      {
        name: PAYMENTS_SERVICE,
        clientId: 'reservations-payments',
        groupId: 'reservations-payments',
        responseOf: [CREATE_CHARGE],
      },
    ]),
  ],
  controllers: [ReservationController],
  providers: [ReservationService, ReservationRepo],
})
export class ReservationModule {}
