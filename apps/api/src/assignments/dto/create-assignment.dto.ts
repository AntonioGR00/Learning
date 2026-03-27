import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAssignmentDto {
  @Type(() => Number)
  @IsInt()
  courseId: number;

  @IsString()
  @MinLength(3)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
