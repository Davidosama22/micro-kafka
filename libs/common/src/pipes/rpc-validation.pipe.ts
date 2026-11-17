import { ValidationError, ValidationPipe } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

const flattenErrors = (errors: ValidationError[], parent = ''): string[] =>
  errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map(
      (message) => `${path}: ${message}`,
    );
    return [...own, ...flattenErrors(error.children ?? [], path)];
  });

// Plain ValidationPipe throws BadRequestException, which Kafka transport turns into "Internal server error".
export const createRpcValidationPipe = () =>
  new ValidationPipe({
    transform: true,
    exceptionFactory: (errors) =>
      new RpcException({ statusCode: 400, message: flattenErrors(errors) }),
  });
