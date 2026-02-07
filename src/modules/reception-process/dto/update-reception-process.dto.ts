import { PartialType } from '@nestjs/mapped-types';
import { CreateReceptionProcessDto } from './create-reception-process.dto';

export class UpdateReceptionProcessDto extends PartialType(CreateReceptionProcessDto) {}
