import {
  Injectable,
  Logger,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';

import { NextFunction, Request, Response } from 'express';

import { JwtService } from 'src/auth';
import { UsersService } from 'src/modules/users/users.service';

@Injectable()
export class McpAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(McpAuthMiddleware.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async use(req: Request, _: Response, next: NextFunction) {
    const authorization = req.headers.authorization ?? '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer token requerido');
    }

    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.usersService.findOne(decoded.userId);
      req['user'] = user;
      next();
    } catch (error) {
      this.logger.debug(`MCP JWT Error: ${error}`);
      throw new UnauthorizedException('Token MCP invalido');
    }
  }
}
