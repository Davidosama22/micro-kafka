import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: { notifyEmail: jest.Mock };

  beforeEach(async () => {
    notificationsService = { notifyEmail: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: notificationsService }],
    }).compile();

    controller = module.get(NotificationsController);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('sends the email for a notify_email event', async () => {
    const data = { email: 'john@example.com', text: '10' };

    await controller.notifyEmail(data);

    expect(notificationsService.notifyEmail).toHaveBeenCalledWith(data);
  });

  it('logs and swallows mail errors so the consumer keeps running', async () => {
    notificationsService.notifyEmail.mockRejectedValue(new Error('SMTP down'));

    await expect(controller.notifyEmail({ email: 'john@example.com' })).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('SMTP down'));
  });
});
