import { ArgumentsHost, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { SkipFailedEventFilter } from './skip-failed-event.filter';

const kafkaHost = () =>
  ({
    switchToRpc: () => ({
      getContext: () => ({
        getTopic: () => 'notify_email',
        getPartition: () => 0,
        getMessage: () => ({ offset: '7' }),
      }),
    }),
  }) as unknown as ArgumentsHost;

describe('SkipFailedEventFilter', () => {
  const filter = new SkipFailedEventFilter();

  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation());
  afterEach(() => jest.restoreAllMocks());

  it('completes with a value so Nest commits the offset instead of retrying', async () => {
    const result = filter.catch(new RpcException({ statusCode: 400 }), kafkaHost());

    await expect(lastValueFrom(result)).resolves.toBeUndefined();
  });

  it('logs where the skipped message came from and why', () => {
    filter.catch(new Error('boom'), kafkaHost());

    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('notify_email[0]@7: "boom"'),
    );
  });
});
