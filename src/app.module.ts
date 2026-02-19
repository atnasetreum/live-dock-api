import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { EnvConfiguration, JoiValidationSchema } from './config';
import { AppKeyMiddleware, JwtMiddleware } from './middlewares';
import { AuthModule, JwtService } from './auth';

import { PushNotificationsModule } from './modules/push-notifications/push-notifications.module';
import { ReceptionProcessModule } from './modules/reception-process/reception-process.module';
import { RequestLoggerMiddleware } from './middlewares/request-logger.middleware';
import { SessionsModule } from './modules/sessions/sessions.module';
import { UsersModule } from './modules/users/users.module';

const ENV = process.env.NODE_ENV;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: !ENV ? '.env.development' : `.env.${ENV}`,
      load: [EnvConfiguration],
      validationSchema: JoiValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    SessionsModule,
    PushNotificationsModule,
    ReceptionProcessModule,
  ],
  controllers: [],
  providers: [JwtService],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
    consumer.apply(AppKeyMiddleware).forRoutes('*');
    consumer
      .apply(JwtMiddleware)
      .exclude(
        {
          path: 'reception-process/notify-metric',
          method: RequestMethod.POST,
        },
        { path: 'users/seed', method: RequestMethod.POST },
        { path: 'auth/check-token', method: RequestMethod.POST },
        {
          path: 'auth/check-token-restore-password',
          method: RequestMethod.POST,
        },
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/login-restore-password', method: RequestMethod.POST },
        { path: 'auth/forgot-password', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
