import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';

import { ReceptionProcessService } from './reception-process.service';
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
  create(@Body() createReceptionProcessDto: CreateReceptionProcessDto) {
    return this.receptionProcessService.create(createReceptionProcessDto);
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
  changeOfStatus(@Body() createChangeOfStatusDto: CreateChangeOfStatusDto) {
    return this.receptionProcessService.changeOfStatus(createChangeOfStatusDto);
  }

  @Get()
  findAll() {
    return this.receptionProcessService.findAll();
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
