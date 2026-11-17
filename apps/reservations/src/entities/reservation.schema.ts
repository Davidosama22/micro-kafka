import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { abstractDocument } from '@app/common/database/abstract.schema';

@Schema({ versionKey: false })
export class ReservationDocument extends abstractDocument {
  @Prop({ required: true })
  timestamp!: Date;

  @Prop({ required: true })
  startDate!: Date;

  @Prop({ required: true })
  endDate!: Date;

  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  invoiceId!: string;
}

export const ReservationSchema =
  SchemaFactory.createForClass(ReservationDocument);
