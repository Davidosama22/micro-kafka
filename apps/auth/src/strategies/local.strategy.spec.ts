import { UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { LocalStrategy } from './local.strategy';

describe('LocalStrategy', () => {
  it('returns the user for valid credentials', async () => {
    const user = { email: 'john@example.com' };
    const usersService = { verifyUser: jest.fn().mockResolvedValue(user) };
    const strategy = new LocalStrategy(usersService as unknown as UsersService);

    await expect(strategy.validate('john@example.com', 'pw')).resolves.toBe(user);
  });

  it('hides the failure reason behind a generic Unauthorized error', async () => {
    const usersService = {
      verifyUser: jest.fn().mockRejectedValue(new UnauthorizedException('Wrong password')),
    };
    const strategy = new LocalStrategy(usersService as unknown as UsersService);

    await expect(strategy.validate('john@example.com', 'bad')).rejects.toThrow(
      'Invalid credentials',
    );
  });
});
