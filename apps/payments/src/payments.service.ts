import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import Stripe from 'stripe';
import { NOTIFICATIONS_SERVICE } from '@app/common/constants/service';
import { NOTIFY_EMAIL } from '@app/common/constants/patterns';
import { PaymentsCreateChargeDto } from './dto/create-payment-charge.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsService: ClientProxy,
  ) {
    this.stripe = new Stripe(
      this.configService.getOrThrow<string>('STRIPE_SECRET_KEY'),
    );
  }

  async createCharge({ amount, email }: PaymentsCreateChargeDto) {
    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        confirm: true,
        currency: 'usd',
        payment_method: 'pm_card_visa',
        payment_method_types: ['card'],
      });
    } catch (error) {
      const message = (error as Error)?.message ?? 'Payment failed';
      this.logger.error(`Stripe charge failed for ${email}: ${message}`);
      throw new RpcException({ statusCode: 402, message });
    }

    this.logger.log(`Stripe payment ${paymentIntent.id} created for ${email}`);
    this.notificationsService.emit(NOTIFY_EMAIL, { email, text: `${amount}` });

    return paymentIntent;
  }
}
