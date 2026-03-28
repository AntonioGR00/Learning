import { IsOptional, IsString } from 'class-validator';

export class JustifyAttendanceDto {
  @IsOptional()
  @IsString()
  message?: string;
}