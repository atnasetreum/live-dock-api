import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';

import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AppKeyMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, _: Response, next: NextFunction) {
    const appKeyHeader = req.headers['x-app-key'];
    const appKey = this.configService.get<string>('appKey');

    if (!appKeyHeader) {
      throw new BadRequestException('Se requiere API Key');
    }

    if (appKeyHeader !== appKey) {
      throw new BadRequestException('API Key invalida');
    }

    next();
  }
}
