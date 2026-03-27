import { Type } from 'class-transformer';
import { IsInt, IsString, MinLength } from 'class-validator';

export class CreateMessageDto {
  @Type(() => Number)
  @IsInt()
  recipientId: number;

  @IsString()
  @MinLength(1)
  content: string;
}
