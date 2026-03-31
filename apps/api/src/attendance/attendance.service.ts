import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceJustificationStatus } from '@prisma/client';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { JustifyAttendanceDto } from './dto/justify-attendance.dto';
import {
  ReviewAttendanceJustificationDto,
  ReviewAttendanceJustificationStatusDto,
} from './dto/review-attendance-justification.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async mark(dto: CreateAttendanceDto, user: { sub: number; role: Role }) {
    if (user.role === Role.TEACHER) {
      const course = await this.prisma.course.findUnique({
        where: { id: dto.courseId },
      });
      if (!course || course.teacherId !== user.sub) {
        throw new ForbiddenException(
          'Only assigned teacher can mark attendance',
        );
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
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });
      if (!course || course.teacherId !== user.sub) {
        throw new ForbiddenException();
      }
    }

    const whereClause =
      user.role === Role.STUDENT
        ? { courseId, studentId: user.sub }
        : { courseId };

    return this.prisma.attendance.findMany({
      where: whereClause,
      include: { student: { select: { id: true, fullName: true } } },
      orderBy: [{ date: 'desc' }, { studentId: 'asc' }],
    });
  }

  async justify(
    attendanceId: number,
    dto: JustifyAttendanceDto,
    studentId: number,
    fileUrl?: string,
  ) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id: attendanceId },
    });
    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }
    if (attendance.studentId !== studentId) {
      throw new ForbiddenException(
        'Attendance record does not belong to current student',
      );
    }
    if (attendance.status === 'PRESENT') {
      throw new BadRequestException(
        'No se puede justificar una asistencia marcada como presente',
      );
    }
    if (!fileUrl) {
      throw new BadRequestException('Debes adjuntar un justificante');
    }

    return this.prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        justificationUrl: fileUrl,
        justificationMessage: dto.message?.trim() || null,
        justificationStatus: AttendanceJustificationStatus.PENDING,
        justificationReviewComment: null,
        justificationReviewedAt: null,
      },
    });
  }

  async reviewJustification(
    attendanceId: number,
    dto: ReviewAttendanceJustificationDto,
    user: { sub: number; role: Role },
  ) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: { course: true },
    });
    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }
    if (attendance.course.teacherId !== user.sub) {
      throw new ForbiddenException(
        'Only assigned teacher can review justifications',
      );
    }

    return this.prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        justificationStatus:
          dto.status === ReviewAttendanceJustificationStatusDto.APPROVED
            ? AttendanceJustificationStatus.APPROVED
            : AttendanceJustificationStatus.REJECTED,
        justificationReviewComment: dto.comment?.trim() || null,
        justificationReviewedAt: new Date(),
      },
    });
  }
}
