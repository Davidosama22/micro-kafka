import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { Types } from 'mongoose';
import { AuthService } from './auth.service';
import { UserDocument } from './users/models/user.schema';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: new JwtService({ secret: 'test-secret' }) },
        { provide: ConfigService, useValue: { get: () => '3600' } },
      ],
    }).compile();

    service = module.get(AuthService);
    jwtService = module.get(JwtService);
  });

  it('signs a JWT with the user id and sets it as an httpOnly cookie', () => {
    const userId = new Types.ObjectId();
    const res = { cookie: jest.fn() } as unknown as Response;

    const token = service.login({ _id: userId } as UserDocument, res);

    expect(res.cookie).toHaveBeenCalledWith('Authentication', token, {
      httpOnly: true,
      maxAge: 3600 * 1000,
    });
    expect(jwtService.verify(token)).toMatchObject({
      tokenPayload: { userId: userId.toHexString() },
    });
  });
});
