import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { abstractDocument } from '@app/common/database/abstract.schema';

@Schema({ versionKey: false })
export class UserDocument extends abstractDocument {
  @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ required: true })
  password!: string;
}

export const UserSchema = SchemaFactory.createForClass(UserDocument);
