import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as nodemailer from 'nodemailer';
import { NotificationsService } from './notifications.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('NotificationsService', () => {
  let service: NotificationsService;
  const sendMail = jest.fn();

  beforeEach(async () => {
    sendMail.mockReset().mockResolvedValue({ messageId: '1' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    const config: Record<string, string> = {
      SMTP_USER: 'sender@example.com',
      GOOGLE_OAUTH_CLIENT_ID: 'id',
      GOOGLE_OAUTH_CLIENT_SECRET: 'secret',
      GOOGLE_OAUTH_REFRESH_TOKEN: 'refresh',
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  it('creates a Gmail OAuth2 transport from config', () => {
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: 'sender@example.com',
        clientId: 'id',
        clientSecret: 'secret',
        refreshToken: 'refresh',
      },
    });
  });

  it('sends the payment confirmation email', async () => {
    await service.notifyEmail({ email: 'john@example.com', text: '25' });

    expect(sendMail).toHaveBeenCalledWith({
      from: 'sender@example.com',
      to: 'john@example.com',
      subject: 'Hello from Nest.js',
      text: 'Your payment of 25 has completed successfully',
    });
  });
});
