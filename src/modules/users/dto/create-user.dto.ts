import { IsEmail, IsEnum, IsString } from 'class-validator';

import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  readonly name: string;

  @IsEmail()
  readonly email: string;

  @IsString()
  readonly password: string;

  @IsEnum(UserRole)
  readonly role: UserRole;
}
