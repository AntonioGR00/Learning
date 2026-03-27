import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async mark(dto: CreateAttendanceDto, user: { sub: number; role: Role }) {
    if (user.role === Role.TEACHER) {
      const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
      if (!course || course.teacherId !== user.sub) {
        throw new ForbiddenException('Only assigned teacher can mark attendance');
      }
    }

    return this.prisma.attendance.upsert({
      where: {
        courseId_studentId_date: {
          courseId: dto.courseId,
          studentId: dto.studentId,
          date: new Date(dto.date),
        },
      },
      create: {
        courseId: dto.courseId,
        studentId: dto.studentId,
        date: new Date(dto.date),
        status: dto.status as any,
        notes: dto.notes,
      },
      update: {
        status: dto.status as any,
        notes: dto.notes,
      },
    });
  }

  myAttendance(userId: number) {
    return this.prisma.attendance.findMany({
      where: { studentId: userId },
      include: { course: true },
      orderBy: { date: 'desc' },
    });
  }

  async byCourse(courseId: number, user: { sub: number; role: Role }) {
    if (user.role === Role.TEACHER) {
      const course = await this.prisma.course.findUnique({ where: { id: courseId } });
      if (!course || course.teacherId !== user.sub) {
        throw new ForbiddenException();
      }
    }

    return this.prisma.attendance.findMany({
      where: { courseId },
      include: { student: { select: { id: true, fullName: true } } },
      orderBy: [{ date: 'desc' }, { studentId: 'asc' }],
    });
  }
}
