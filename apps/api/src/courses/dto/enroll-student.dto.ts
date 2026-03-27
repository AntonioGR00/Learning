import { IsInt } from 'class-validator';

export class EnrollStudentDto {
  @IsInt()
  courseId: number;

  @IsInt()
  studentId: number;
}
