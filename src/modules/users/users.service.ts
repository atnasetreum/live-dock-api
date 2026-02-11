import { InjectRepository } from '@nestjs/typeorm';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { In, Repository } from 'typeorm';
import * as argon2 from 'argon2';

import { User, UserRole } from './entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email, isActive: true },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const user = this.userRepository.create({
      ...createUserDto,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return this.userRepository.save(user);
  }

  findAll() {
    return this.userRepository.find({
      where: { isActive: true },
    });
  }

  findAllByIds(ids: number[]) {
    return this.userRepository.find({
      where: { id: In(ids), isActive: true },
    });
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOne({
      where: { id, isActive: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);

    const { password, ...rest } = updateUserDto;

    if (password) {
      user.password = await argon2.hash(password);
    }

    const userUpdated = this.userRepository.merge(user, rest);

    await this.userRepository.update(id, userUpdated);

    // @ts-expect-error Removing password from the returned user object
    delete userUpdated.password;

    return userUpdated;
  }

  remove(id: number) {
    return this.update(id, { isActive: false } as UpdateUserDto);
  }

  async findAllByRole(role: UserRole) {
    return this.userRepository.find({
      where: { role, isActive: true },
    });
  }

  async seed() {
    /* const email = 'eduardo-266@hotmail.com';

    const userExists = await this.userRepository.findOne({
      where: { email },
    });

    if (userExists) {
      throw new ConflictException('User with this email (seed) already exists');
    }

    const user = {
      name: 'Eduardo Domínguez',
      password: await argon2.hash('123'),
      email,
      role: UserRole.ADMIN,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.userRepository.upsert(user, ['email']);

    return { message: 'Seed completed' }; */

    for (const role of [
      UserRole.VIGILANCIA,
      UserRole.LOGISTICA,
      UserRole.CALIDAD,
      UserRole.PRODUCCION,
      UserRole.ADMIN,
      UserRole.GENERAL,
    ]) {
      const email = `user-${role.toLocaleLowerCase()}@example.com`;

      const userExists = await this.userRepository.findOne({
        where: { email },
      });

      if (userExists) {
        continue;
      }

      const user = {
        name: `User ${role}`,
        password: await argon2.hash('123'),
        email,
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.userRepository.upsert(user, ['email']);
    }
  }
}
