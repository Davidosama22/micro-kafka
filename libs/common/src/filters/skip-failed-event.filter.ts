import { ArgumentsHost, Catch, Logger, RpcExceptionFilter } from '@nestjs/common';
import { KafkaContext, RpcException } from '@nestjs/microservices';
import { Observable, of } from 'rxjs';

// Nest's Kafka server rethrows event-handler errors to kafkajs, which retries the same
// message forever and blocks the partition. Log the poison message and move on instead;
// throw KafkaRetriableException from the handler when a retry is actually wanted.
@Catch()
export class SkipFailedEventFilter implements RpcExceptionFilter<unknown> {
  private readonly logger = new Logger(SkipFailedEventFilter.name);

  catch(exception: unknown, host: ArgumentsHost): Observable<undefined> {
    const context = host.switchToRpc().getContext<KafkaContext>();
    const reason =
      exception instanceof RpcException
        ? exception.getError()
        : (exception as Error)?.message ?? exception;

    this.logger.error(
      `Skipping message ${context.getTopic()}[${context.getPartition()}]@${context.getMessage().offset}: ${JSON.stringify(reason)}`,
    );
    return of(undefined);
  }
}
