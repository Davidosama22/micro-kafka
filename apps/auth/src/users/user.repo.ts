import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { abstractRepo } from '@app/common/database/abstract.repo';
import { UserDocument } from './models/user.schema';

@Injectable()
export class UserRepo extends abstractRepo<UserDocument> {
  protected readonly logger = new Logger(UserRepo.name);

  constructor(
    @InjectModel(UserDocument.name) userModel: Model<UserDocument>,
  ) {
    super(userModel);
  }
}
