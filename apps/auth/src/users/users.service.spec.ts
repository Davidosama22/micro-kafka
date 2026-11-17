import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { compare, hash } from 'bcryptjs';
import { Types } from 'mongoose';
import { UsersService } from './users.service';
import { UserRepo } from './user.repo';

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: {
    create: jest.Mock;
    findOne: jest.Mock;
    findOneOptional: jest.Mock;
  };

  beforeEach(async () => {
    userRepo = {
      create: jest.fn((doc: object) => ({ _id: new Types.ObjectId(), ...doc })),
      findOne: jest.fn(),
      findOneOptional: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: UserRepo, useValue: userRepo }],
    }).compile();

    service = module.get(UsersService);
  });

  describe('createUser', () => {
    it('stores a bcrypt hash instead of the plain password', async () => {
      userRepo.findOneOptional.mockResolvedValue(null);

      const user = await service.createUser({
        email: 'john@example.com',
        password: 'Str0ng!Pass',
      });

      expect(user.password).not.toBe('Str0ng!Pass');
      await expect(compare('Str0ng!Pass', user.password)).resolves.toBe(true);
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'john@example.com' }),
      );
    });

    it('rejects an email that is already registered', async () => {
      userRepo.findOneOptional.mockResolvedValue({ email: 'john@example.com' });

      await expect(
        service.createUser({ email: 'john@example.com', password: 'Str0ng!Pass' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(userRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyUser', () => {
    it('returns the user when the password matches', async () => {
      const stored = { email: 'john@example.com', password: await hash('Str0ng!Pass', 4) };
      userRepo.findOneOptional.mockResolvedValue(stored);

      await expect(service.verifyUser('john@example.com', 'Str0ng!Pass')).resolves.toBe(stored);
    });

    it('throws Unauthorized for a wrong password', async () => {
      userRepo.findOneOptional.mockResolvedValue({
        email: 'john@example.com',
        password: await hash('Str0ng!Pass', 4),
      });

      await expect(service.verifyUser('john@example.com', 'wrong')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws Unauthorized for an unknown email', async () => {
      userRepo.findOneOptional.mockResolvedValue(null);

      await expect(service.verifyUser('nobody@example.com', 'x')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  it('findById looks the user up by _id', async () => {
    userRepo.findOne.mockResolvedValue({ email: 'john@example.com' });

    await service.findById('abc');

    expect(userRepo.findOne).toHaveBeenCalledWith({ _id: 'abc' });
  });

  it('toPublicUser strips the password and stringifies the id', () => {
    const _id = new Types.ObjectId();

    expect(
      UsersService.toPublicUser({ _id, email: 'john@example.com', password: 'hash' } as never),
    ).toEqual({ _id: _id.toHexString(), email: 'john@example.com' });
  });
});
