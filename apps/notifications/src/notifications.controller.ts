import { Controller, Logger, UseFilters, UsePipes } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NOTIFY_EMAIL } from '@app/common/constants/patterns';
import { SkipFailedEventFilter } from '@app/common/filters/skip-failed-event.filter';
import { createRpcValidationPipe } from '@app/common/pipes/rpc-validation.pipe';
import { NotifyEmailDto } from './dto/notify-email.dto';
import { NotificationsService } from './notifications.service';

@Controller()
@UseFilters(SkipFailedEventFilter)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @UsePipes(createRpcValidationPipe())
  @EventPattern(NOTIFY_EMAIL)
  async notifyEmail(@Payload() data: NotifyEmailDto) {
    this.logger.log(`${NOTIFY_EMAIL} received for ${data.email}`);
    try {
      await this.notificationsService.notifyEmail(data);
      this.logger.log(`${NOTIFY_EMAIL} sent to ${data.email}`);
    } catch (error) {
      this.logger.error(
        `${NOTIFY_EMAIL} failed for ${data.email}: ${(error as Error).message}`,
      );
    }
  }
}
