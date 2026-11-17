import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable, catchError, map, of, tap, timeout } from 'rxjs';
import { AUTH_SERVICE } from '../constants/service';
import { AUTHENTICATE } from '../constants/patterns';
import { UserDto } from '../dto/user.dto';

interface AuthenticatedRequest {
  cookies?: {
    Authentication?: string;
  };
  user?: unknown;
}

export const AUTH_TIMEOUT_MS = 10_000;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(@Inject(AUTH_SERVICE) private readonly authClient: ClientProxy) {}

  canActivate(context: ExecutionContext): boolean | Observable<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const jwt = request.cookies?.Authentication;

    if (!jwt) {
      return false;
    }

    return this.authClient
      .send<UserDto>(AUTHENTICATE, { Authentication: jwt })
      .pipe(
        timeout(AUTH_TIMEOUT_MS),
        tap((user) => {
          request.user = user;
        }),
        map(() => true),
        catchError((error: { message?: unknown }) => {
          this.logger.warn(
            `Authentication failed: ${JSON.stringify(error?.message ?? error)}`,
          );
          return of(false);
        }),
      );
  }
}
