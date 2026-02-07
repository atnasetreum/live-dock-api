import { Injectable } from '@nestjs/common';

import { CreateReceptionProcessDto, UpdateReceptionProcessDto } from './dto';

@Injectable()
export class ReceptionProcessService {
  create(createReceptionProcessDto: CreateReceptionProcessDto) {
    return createReceptionProcessDto;
  }

  findAll() {
    return `This action returns all receptionProcess`;
  }

  findOne(id: number) {
    return `This action returns a #${id} receptionProcess`;
  }

  update(id: number, updateReceptionProcessDto: UpdateReceptionProcessDto) {
    return { id, updateReceptionProcessDto };
  }

  remove(id: number) {
    return `This action removes a #${id} receptionProcess`;
  }
}
