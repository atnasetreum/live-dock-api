import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { type Request } from 'express';
import * as CryptoJS from 'crypto-js';
import { Repository } from 'typeorm';
import { serialize } from 'cookie';
import * as argon2 from 'argon2';

import { User } from 'src/modules/users/entities/user.entity';
import { LoginAuthDto } from './dto/login-auth.dto';
import { ENV_PRODUCTION } from 'src/constants';
import { StringifyOptions } from 'querystring';
import { UserSession } from 'src/middlewares';
import { JwtService } from './jwt.service';

@Injectable()
export class AuthService {
  nameCookie: string;
  environment: string;
  appKey: string;

  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    @Inject(REQUEST) private readonly request: Request,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.get<string>('environment')!;
    this.appKey = this.configService.get<string>('appKey')!;
    this.nameCookie = 'token';
  }

  get optsSerialize() {
    return {
      httpOnly: true,
      secure: this.environment === ENV_PRODUCTION,
      sameSite: this.environment === ENV_PRODUCTION ? 'none' : 'strict',
      path: '/',
      domain:
        this.environment === ENV_PRODUCTION ? 'comportarte.com' : 'localhost',
    } as StringifyOptions;
  }

  async login(loginAuthDto: LoginAuthDto): Promise<string> {
    const { email: emailEncrypted, password: passwordEncrypted } = loginAuthDto;

    const email = CryptoJS.AES.decrypt(emailEncrypted, this.appKey).toString(
      CryptoJS.enc.Utf8,
    );

    const password = CryptoJS.AES.decrypt(
      passwordEncrypted,
      this.appKey,
    ).toString(CryptoJS.enc.Utf8);

    const user = await this.userRepository.findOne({
      where: {
        email,
        isActive: true,
      },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    if (!(await argon2.verify(user.password, password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.create(user.id);

    const serialized = serialize(this.nameCookie, token, {
      ...this.optsSerialize,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    });

    return serialized;
  }

  logout() {
    const { token } = this.request['user'] as UserSession;
    const serialized = serialize(this.nameCookie, token, {
      ...this.optsSerialize,
      maxAge: 0,
    });
    return serialized;
  }

  checkToken() {
    const authorization = this.request.headers['authorization'];

    if (!authorization) {
      throw new UnauthorizedException('Authorization header missing');
    }

    const token = authorization.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Token not found');
    }
    try {
      this.jwtService.verify(token);
      return { message: 'Token válido.' };
    } catch (error) {
      this.logger.debug(`JWT Error: ${error}`);
      throw new UnauthorizedException(`Invalid token`);
    }
  }
}
