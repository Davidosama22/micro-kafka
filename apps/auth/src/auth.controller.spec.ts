import { NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { Types } from 'mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from './users/users.service';

describe('AuthController', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  let controller: AuthController;
  let authService: { login: jest.Mock };
  let usersService: { findById: jest.Mock };

  beforeEach(async () => {
    authService = { login: jest.fn() };
    usersService = { findById: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: JwtService, useValue: jwtService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  describe('login', () => {
    it('sets the cookie and returns the user without the password', () => {
      const user = {
        _id: new Types.ObjectId(),
        email: 'john@example.com',
        password: 'hash',
      };
      const res = {} as Response;

      const result = controller.login(user, res);

      expect(authService.login).toHaveBeenCalledWith(user, res);
      expect(result).toEqual({ _id: user._id.toHexString(), email: user.email });
    });
  });

  describe('authenticate (Kafka message handler)', () => {
    it('returns the public user for a valid token', async () => {
      const userId = new Types.ObjectId();
      usersService.findById.mockResolvedValue({
        _id: userId,
        email: 'john@example.com',
        password: 'hash',
      });
      const token = jwtService.sign({ tokenPayload: { userId: userId.toHexString() } });

      await expect(controller.authenticate({ Authentication: token })).resolves.toEqual({
        _id: userId.toHexString(),
        email: 'john@example.com',
      });
      expect(usersService.findById).toHaveBeenCalledWith(userId.toHexString());
    });

    it('throws an RpcException for an invalid token', async () => {
      await expect(
        controller.authenticate({ Authentication: 'not-a-jwt' }),
      ).rejects.toBeInstanceOf(RpcException);
      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it('throws an RpcException for a token signed with another secret', async () => {
      const token = new JwtService({ secret: 'other' }).sign({
        tokenPayload: { userId: 'x' },
      });

      await expect(controller.authenticate({ Authentication: token })).rejects.toBeInstanceOf(
        RpcException,
      );
    });

    it('throws an RpcException when the user no longer exists', async () => {
      usersService.findById.mockRejectedValue(new NotFoundException());
      const token = jwtService.sign({ tokenPayload: { userId: 'deleted' } });

      await expect(controller.authenticate({ Authentication: token })).rejects.toThrow(
        'User not found',
      );
    });
  });
});
