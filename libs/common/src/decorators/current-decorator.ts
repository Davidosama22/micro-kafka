import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const getCurrentUserByContext = (context: ExecutionContext): unknown =>
  context.switchToHttp().getRequest<{ user?: unknown }>().user;

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    getCurrentUserByContext(context),
);
