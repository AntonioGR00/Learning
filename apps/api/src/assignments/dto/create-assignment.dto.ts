import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export enum AssignmentDeliveryModeDto {
  PLATFORM = 'PLATFORM',
  FILE_UPLOAD = 'FILE_UPLOAD',
}

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

  @IsOptional()
  @IsEnum(AssignmentDeliveryModeDto)
  deliveryMode?: AssignmentDeliveryModeDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  secureMode?: boolean;
}
