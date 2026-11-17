import { Controller, Logger, UsePipes } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CREATE_CHARGE } from '@app/common/constants/patterns';
import { createRpcValidationPipe } from '@app/common/pipes/rpc-validation.pipe';
import { PaymentsCreateChargeDto } from './dto/create-payment-charge.dto';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @MessagePattern(CREATE_CHARGE)
  @UsePipes(createRpcValidationPipe())
  async createCharge(@Payload() data: PaymentsCreateChargeDto) {
    this.logger.log(
      `${CREATE_CHARGE} received for ${data.email}, amount ${data.amount}`,
    );
    return this.paymentsService.createCharge(data);
  }
}
