import { IsEmail } from 'class-validator';
import { CreateChargeDto } from '@app/common/dto/create-charge.dto';

export class PaymentsCreateChargeDto extends CreateChargeDto {
  @IsEmail()
  email!: string;
}
