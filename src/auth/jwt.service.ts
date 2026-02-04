import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

import * as jwt from 'jsonwebtoken';

interface JwtPayload {
  userId: number;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtService {
  secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('jwt.secretKey')!;
  }

  get expiresIn(): number {
    const expireTime = 60 * 60 * 24 * 30; // 30 days in seconds

    const expiresIn = () => {
      return Math.floor(Date.now() / 1000) + expireTime;
    };

    return expiresIn();
  }

  create(userId: number): string {
    const token = jwt.sign({ userId }, this.secretKey, {
      expiresIn: this.expiresIn,
    });
    return token;
  }

  verify(token: string): JwtPayload {
    const decoded = jwt.verify(token, this.secretKey);
    if (typeof decoded === 'string') {
      throw new Error('Invalid token payload');
    }
    return decoded as JwtPayload;
  }
}
