import { Controller, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import type { Response } from 'express';
import { AUTHENTICATE } from '@app/common/constants/patterns';
import { CurrentUser } from '@app/common/decorators/current-decorator';
import type { UserDto } from '@app/common/dto/user.dto';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtPayload } from './interfaces/token-payload.interface';
import { UserDocument } from './users/models/user.schema';
import { UsersService } from './users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(200)
  login(
    @CurrentUser() user: UserDocument,
    @Res({ passthrough: true }) res: Response,
  ): UserDto {
    this.authService.login(user, res);
    return UsersService.toPublicUser(user);
  }

  @MessagePattern(AUTHENTICATE)
  async authenticate(
    @Payload() data: { Authentication?: string },
  ): Promise<UserDto> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(
        data?.Authentication ?? '',
      );
    } catch {
      throw new RpcException('Invalid or expired token');
    }

    try {
      const user = await this.usersService.findById(
        payload.tokenPayload.userId,
      );
      return UsersService.toPublicUser(user);
    } catch {
      throw new RpcException('User not found');
    }
  }
}
