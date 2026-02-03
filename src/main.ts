import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('APP-SERVICE');

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: `${process.env.WHITE_LIST_DOMAINS}`.split(','),
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

  //app.use(cookieParser());

  app.setGlobalPrefix('/api/v1');

  const PORT = process.env.PORT || 3030;

  await app.listen(PORT);

  logger.debug(
    `Running on port: [${PORT}], environment: [${process.env.NODE_ENV}]`,
  );
}
bootstrap().catch((err) => {
  console.error('Error during application bootstrap:', err);
  process.exit(1);
});
