import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { NotificationMetric, ProcessEvent, ReceptionProcess } from './entities';
import { ReceptionProcessController } from './reception-process.controller';
import { ReceptionProcessService } from './reception-process.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReceptionProcess,
      ProcessEvent,
      NotificationMetric,
    ]),
  ],
  controllers: [ReceptionProcessController],
  providers: [ReceptionProcessService],
})
export class ReceptionProcessModule {}
