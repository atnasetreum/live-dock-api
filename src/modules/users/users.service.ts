import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';

import { Repository } from 'typeorm';
import * as argon2 from 'argon2';

import { CreateUserDto, UpdateUserDto } from './dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  create(createUserDto: CreateUserDto) {
    return this.userRepository.save(this.userRepository.create(createUserDto));
  }

  findAll() {
    return this.userRepository.find({
      where: { isActive: true },
    });
  }

  findOne(id: number) {
    return this.userRepository.findOne({
      where: { id, isActive: true },
    });
  }

  findOneByEmail(email: string) {
    return this.userRepository.findOne({
      where: { email, isActive: true },
    });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return this.userRepository.update(id, updateUserDto);
  }

  remove(id: number) {
    return this.userRepository.update(id, { isActive: false });
  }

  async seed() {
    const email = 'eduardo-266@hotmail.com';

    const userExists = await this.findOneByEmail(email);

    if (userExists) {
      return { message: 'User already exists' };
    }

    const user = {
      name: 'Eduardo Domínguez',
      password: await argon2.hash('123'),
      email,
    };

    await this.userRepository.upsert(user, ['email']);

    return { message: 'Seed completed' };
  }
}
