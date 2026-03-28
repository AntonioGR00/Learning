import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ReviewAttendanceJustificationStatusDto {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class ReviewAttendanceJustificationDto {
  @IsEnum(ReviewAttendanceJustificationStatusDto)
  status: ReviewAttendanceJustificationStatusDto;

  @IsOptional()
  @IsString()
  comment?: string;
}