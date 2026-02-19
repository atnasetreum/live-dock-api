import {
  Injectable,
  Logger,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';

import { Request, Response, NextFunction } from 'express';

import { UsersService } from 'src/modules/users/users.service';
import { User } from 'src/modules/users/entities/user.entity';
import { JwtService } from 'src/auth';

export interface UserSession extends User {
  token: string;
}

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  private readonly logger = new Logger(JwtMiddleware.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async use(req: Request, _: Response, next: NextFunction) {
    const cookies = req.cookies as
      | Record<string, string | undefined>
      | undefined;

    const token = cookies?.token ?? '';

    if (!token) {
      throw new UnauthorizedException('Token no encontrado');
    }

    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.usersService.findOne(decoded.userId);
      req['user'] = { ...user, token } as UserSession;
      next();
    } catch (error) {
      this.logger.debug(`JWT Error: ${error}`);
      throw new UnauthorizedException('Token invalido');
    }
  }
}
