import { IsNotEmpty, IsString } from 'class-validator';

export class McpLoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
