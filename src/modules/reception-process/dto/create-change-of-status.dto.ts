import { IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateChangeOfStatusDto {
  @IsPositive()
  id: number;

  @IsString()
  actionRole: string;

  @IsOptional()
  @IsString()
  rejectionNotes: string;
}
