import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitAssignmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  content?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  terminatedByFocusLoss?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  terminationReason?: string;
}
