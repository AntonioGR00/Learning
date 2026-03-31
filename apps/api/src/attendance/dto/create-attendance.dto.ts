import { AttendanceStatus } from '../../common/enums/attendance-status.enum';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAttendanceDto {
  @Type(() => Number)
  @IsInt()
  courseId: number;

  @Type(() => Number)
  @IsInt()
  studentId: number;

  @IsDateString()
  date: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
