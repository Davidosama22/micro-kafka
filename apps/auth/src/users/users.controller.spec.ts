import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AUTH_SERVICE } from '@app/common/constants/service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: { createUser: jest.Mock };

  beforeEach(async () => {
    usersService = { createUser: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: AUTH_SERVICE, useValue: {} },
      ],
    }).compile();

    controller = module.get(UsersController);
  });

  it('creates a user and never returns the password hash', async () => {
    const _id = new Types.ObjectId();
    usersService.createUser.mockResolvedValue({
      _id,
      email: 'john@example.com',
      password: 'hash',
    });
    const dto = { email: 'john@example.com', password: 'Str0ng!Pass' };

    await expect(controller.createUser(dto)).resolves.toEqual({
      _id: _id.toHexString(),
      email: 'john@example.com',
    });
    expect(usersService.createUser).toHaveBeenCalledWith(dto);
  });

  it('returns the current user', () => {
    const user = { _id: '1', email: 'john@example.com' };
    expect(controller.getUser(user)).toBe(user);
  });
});
