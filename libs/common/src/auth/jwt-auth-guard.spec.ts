import { ExecutionContext } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable, NEVER, lastValueFrom, of, throwError } from 'rxjs';
import { AUTHENTICATE } from '../constants/patterns';
import { AUTH_TIMEOUT_MS, JwtAuthGuard } from './jwt-auth-guard';

const createContext = (request: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  let authClient: { send: jest.Mock };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    authClient = { send: jest.fn() };
    guard = new JwtAuthGuard(authClient as unknown as ClientProxy);
  });

  it('rejects requests without an Authentication cookie and never calls Kafka', () => {
    expect(guard.canActivate(createContext({ cookies: {} }))).toBe(false);
    expect(authClient.send).not.toHaveBeenCalled();
  });

  it('sends the JWT on the authenticate topic and attaches the user', async () => {
    const user = { _id: 'user-1', email: 'john@example.com' };
    authClient.send.mockReturnValue(of(user));
    const request: Record<string, unknown> = {
      cookies: { Authentication: 'jwt-token' },
    };

    const result = guard.canActivate(createContext(request));

    await expect(lastValueFrom(result as Observable<boolean>)).resolves.toBe(
      true,
    );
    expect(authClient.send).toHaveBeenCalledWith(AUTHENTICATE, {
      Authentication: 'jwt-token',
    });
    expect(request.user).toEqual(user);
  });

  it('denies access when the auth service replies with an error', async () => {
    authClient.send.mockReturnValue(
      throwError(() => ({ status: 'error', message: 'Invalid token' })),
    );
    const request: Record<string, unknown> = {
      cookies: { Authentication: 'bad-token' },
    };

    const result = guard.canActivate(createContext(request));

    await expect(lastValueFrom(result as Observable<boolean>)).resolves.toBe(
      false,
    );
    expect(request.user).toBeUndefined();
  });

  it('denies access when the auth service does not reply in time', async () => {
    jest.useFakeTimers();
    try {
      authClient.send.mockReturnValue(NEVER);
      const result = guard.canActivate(
        createContext({ cookies: { Authentication: 'jwt-token' } }),
      ) as Observable<boolean>;

      const promise = lastValueFrom(result);
      jest.advanceTimersByTime(AUTH_TIMEOUT_MS + 1);

      await expect(promise).resolves.toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});
