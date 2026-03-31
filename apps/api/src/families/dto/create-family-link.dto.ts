import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateFamilyLinkDto {
  @Type(() => Number)
  @IsInt()
  familyUserId: number;

  @Type(() => Number)
  @IsInt()
  studentId: number;

  @IsOptional()
  @IsString()
  relationship?: string;
}
