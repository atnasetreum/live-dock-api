import { Module } from '@nestjs/common';

import { SessionsGateway } from './sessions.gateway';
import { SessionsService } from './sessions.service';
import { UsersModule } from '../users/users.module';
import { AuthModule } from 'src/auth';

@Module({
  imports: [AuthModule, UsersModule],
  providers: [SessionsGateway, SessionsService],
  exports: [SessionsGateway, SessionsService],
})
export class SessionsModule {}
