import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { JwtPayload } from './interfaces/token-payload.interface';
import { UserDocument } from './users/models/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  login(user: UserDocument, res: Response): string {
    const payload: JwtPayload = {
      tokenPayload: { userId: user._id.toHexString() },
    };
    const token = this.jwtService.sign(payload);

    res.cookie('Authentication', token, {
      httpOnly: true,
      maxAge: Number(this.configService.get('JWT_EXPIRATION') ?? 3600) * 1000,
    });

    return token;
  }
}
