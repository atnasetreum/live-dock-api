import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { JwtService } from 'src/auth';
import { NotificationMetric } from 'src/modules/reception-process/entities';
import { User } from 'src/modules/users/entities/user.entity';
import { UsersModule } from 'src/modules/users/users.module';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, NotificationMetric]), UsersModule],
  controllers: [McpController],
  providers: [McpService, JwtService],
})
export class McpModule {}
