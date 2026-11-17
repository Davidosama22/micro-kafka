import { IsCreditCard, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CardDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\s+/g, '') : value,
  )
  @IsCreditCard()
  @IsNotEmpty()
  number!: string;

  @IsNumber()
  @IsNotEmpty()
  exp_month!: number;

  @IsNumber()
  @IsNotEmpty()
  exp_year!: number;

  @IsString()
  @IsNotEmpty()
  cvc!: string;
}
