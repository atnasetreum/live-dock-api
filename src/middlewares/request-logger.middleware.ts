import { Injectable, NestMiddleware } from '@nestjs/common';

import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction) {
    /* const requestId = Array.isArray(req.headers['x-request-id'])
      ? req.headers['x-request-id'][0]
      : (req.headers['x-request-id'] as string) || 'NO-ID'; */

    //console.log({ requestId });

    /* console.info(`[Backend] Request ${requestId}`, {
      method: req.method,
      url: req.originalUrl,
      body: (req.body as unknown) ?? null,
      timestamp: new Date().toISOString(),
    });

    res.on('finish', () => {
      console.info(`[Backend] Response ${requestId}`, {
        statusCode: res.statusCode,
        timestamp: new Date().toISOString(),
      });
    }); */

    next();
  }
}
