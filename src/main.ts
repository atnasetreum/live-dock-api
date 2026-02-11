import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';

import cookieParser from 'cookie-parser';

import { GlobalExceptionFilter } from './common';
import { AppModule } from './app.module';

const PORT = process.env.PORT!;
const NODE_ENV = process.env.NODE_ENV!;
const ACCEPT_CH_HEADER_VALUE =
  process.env.ACCEPT_CH_HINTS ??
  [
    'Sec-CH-UA',
    'Sec-CH-UA-Mobile',
    'Sec-CH-UA-Platform',
    'Sec-CH-UA-Platform-Version',
    'Sec-CH-UA-Model',
    'Sec-CH-UA-Arch',
    'Sec-CH-UA-Bitness',
    'Sec-CH-UA-Platform-Version',
  ].join(', ');
const ACCEPT_CH_HINTS = ACCEPT_CH_HEADER_VALUE.split(',')
  .map((hint) => hint.trim())
  .filter(Boolean);

const ACCEPT_CH_LIFETIME = process.env.ACCEPT_CH_LIFETIME ?? '86400';

const mergeVaryHeader = (
  current: number | string | string[] | undefined,
  hints: string[],
) => {
  const varyValues = new Set<string>();

  if (typeof current === 'number') {
    varyValues.add(String(current));
  } else if (typeof current === 'string') {
    current
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => varyValues.add(value));
  } else if (Array.isArray(current)) {
    current
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => varyValues.add(value));
  }

  hints.forEach((hint) => varyValues.add(hint));

  return Array.from(varyValues).join(', ');
};

async function bootstrap() {
  const logger = new Logger('APP-SERVICE');

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.WHITE_LIST_DOMAINS!.split(','),
      credentials: true,
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.use(cookieParser());

  if (ACCEPT_CH_HINTS.length) {
    // Request Client Hints so the browser exposes user-agent metadata on follow-up calls.
    app.use((_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Accept-CH', ACCEPT_CH_HEADER_VALUE);
      res.setHeader('Accept-CH-Lifetime', ACCEPT_CH_LIFETIME);
      const currentVary = res.getHeader('Vary');
      res.setHeader('Vary', mergeVaryHeader(currentVary, ACCEPT_CH_HINTS));
      next();
    });
  }

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(PORT);

  logger.debug(`Running on port: [${PORT}], environment: [${NODE_ENV}]`);
}
bootstrap().catch((err) => {
  console.error('Error during application bootstrap:', err);
  process.exit(1);
});
