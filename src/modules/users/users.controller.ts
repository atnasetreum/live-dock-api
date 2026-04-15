import {
  ForbiddenException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';

import { CurrentUser } from 'src/common';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private validateAdminAccess(currentUser: User) {
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Solo los usuarios ADMIN pueden gestionar usuarios',
      );
    }
  }

  @Post()
  create(
    @CurrentUser() currentUser: User,
    @Body() createUserDto: CreateUserDto,
  ) {
    this.validateAdminAccess(currentUser);
    return this.usersService.create(createUserDto);
  }

  @Post('seed')
  seed() {
    return this.usersService.seed();
  }

  @Get()
  findAll(@CurrentUser() currentUser: User) {
    this.validateAdminAccess(currentUser);
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@CurrentUser() currentUser: User, @Param('id') id: string) {
    this.validateAdminAccess(currentUser);
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  update(
    @CurrentUser() currentUser: User,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    this.validateAdminAccess(currentUser);
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@CurrentUser() currentUser: User, @Param('id') id: string) {
    this.validateAdminAccess(currentUser);
    return this.usersService.remove(+id);
  }
}
