import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';

import { CreateReceptionProcessDto, UpdateReceptionProcessDto } from './dto';
import { ReceptionProcessService } from './reception-process.service';

@Controller('reception-process')
export class ReceptionProcessController {
  constructor(
    private readonly receptionProcessService: ReceptionProcessService,
  ) {}

  @Post()
  create(@Body() createReceptionProcessDto: CreateReceptionProcessDto) {
    return this.receptionProcessService.create(createReceptionProcessDto);
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
