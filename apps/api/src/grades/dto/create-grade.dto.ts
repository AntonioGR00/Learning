import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateGradeDto {
  @Type(() => Number)
  @IsInt()
  submissionId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  score: number;

  @IsOptional()
  @IsString()
  feedback?: string;
}
