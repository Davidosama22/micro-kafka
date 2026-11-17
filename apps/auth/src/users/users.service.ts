import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import type { UserDto } from '@app/common/dto/user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { GetUserDto } from './dto/get-user.dto';
import { UserDocument } from './models/user.schema';
import { UserRepo } from './user.repo';

@Injectable()
export class UsersService {
  constructor(private readonly userRepo: UserRepo) {}

  static toPublicUser(user: Pick<UserDocument, '_id' | 'email'>): UserDto {
    return { _id: user._id.toString(), email: user.email };
  }

  async createUser(createUserDto: CreateUserDto) {
    await this.validateCreateUserDto(createUserDto);
    return this.userRepo.create({
      ...createUserDto,
      password: await hash(createUserDto.password, 10),
    });
  }

  private async validateCreateUserDto({ email }: CreateUserDto) {
    const user = await this.userRepo.findOneOptional({ email });
    if (user) {
      throw new ConflictException('User already exists');
    }
  }

  async verifyUser(email: string, password: string) {
    const user = await this.userRepo.findOneOptional({ email });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Wrong password');
    }
    return user;
  }

  async getUser(getUserDto: GetUserDto) {
    return this.userRepo.findOne(getUserDto);
  }

  async findById(id: string) {
    return this.userRepo.findOne({ _id: id });
  }
}
