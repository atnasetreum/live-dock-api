import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';

import { ReceptionProcessService } from './reception-process.service';
import { CurrentUser } from 'src/common';
import { User } from '../users/entities/user.entity';
import {
  CreateChangeOfStatusDto,
  CreateNotificationMetricDto,
  CreateReceptionProcessDto,
  UpdateReceptionProcessDto,
} from './dto';

@Controller('reception-process')
export class ReceptionProcessController {
  constructor(
    private readonly receptionProcessService: ReceptionProcessService,
  ) {}

  @Post()
  create(
    @Body() createReceptionProcessDto: CreateReceptionProcessDto,
    @CurrentUser() user: User,
  ) {
    return this.receptionProcessService.create(createReceptionProcessDto, user);
  }

  @Post('notify-metric')
  createMetric(
    @Body() createNotificationMetricDto: CreateNotificationMetricDto,
  ) {
    return this.receptionProcessService.createMetric(
      createNotificationMetricDto,
    );
  }

  @Post('change-of-status')
  changeOfStatus(
    @Body() createChangeOfStatusDto: CreateChangeOfStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.receptionProcessService.changeOfStatus(
      createChangeOfStatusDto,
      user,
    );
  }

  @Get()
  findAll(@Query('startDate') startDate?: string) {
    return this.receptionProcessService.findAll({ startDate });
  }

  @Get('priority-alerts')
  findPriorityAlerts(
    @CurrentUser() user: User,
    @Query('startDate') startDate?: string,
  ) {
    return this.receptionProcessService.findPriorityAlerts(user, startDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.receptionProcessService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateReceptionProcessDto: UpdateReceptionProcessDto,
  ) {
    return this.receptionProcessService.update(+id, updateReceptionProcessDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.receptionProcessService.remove(+id);
  }
}
