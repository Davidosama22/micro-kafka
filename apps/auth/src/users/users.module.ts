import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/common/database';
import { KafkaModule } from '@app/common/kafka';
import { AUTH_SERVICE } from '@app/common/constants/service';
import { AUTHENTICATE } from '@app/common/constants/patterns';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRepo } from './user.repo';
import { UserDocument, UserSchema } from './models/user.schema';

@Module({
  imports: [
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: UserDocument.name, schema: UserSchema },
    ]),
    KafkaModule.register([
      {
        name: AUTH_SERVICE,
        clientId: 'auth-users',
        groupId: 'auth-users',
        responseOf: [AUTHENTICATE],
      },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, UserRepo],
  exports: [UsersService, UserRepo],
})
export class UsersModule {}
