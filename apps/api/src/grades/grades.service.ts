import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGradeDto } from './dto/create-grade.dto';

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGradeDto, user: { sub: number; role: Role }) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: dto.submissionId },
      include: { assignment: { include: { course: true } } },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (
      user.role === Role.TEACHER &&
      submission.assignment.course.teacherId !== user.sub
    ) {
      throw new ForbiddenException('Only the assigned teacher can grade');
    }

    return this.prisma.grade.upsert({
      where: { submissionId: dto.submissionId },
      create: {
        submissionId: dto.submissionId,
        score: dto.score,
        feedback: dto.feedback,
      },
      update: {
        score: dto.score,
        feedback: dto.feedback,
        gradedAt: new Date(),
      },
    });
  }

  myGrades(userId: number) {
    return this.prisma.grade.findMany({
      where: { submission: { studentId: userId } },
      include: {
        submission: {
          include: {
            assignment: true,
          },
        },
      },
      orderBy: { gradedAt: 'desc' },
    });
  }

  async byCourse(courseId: number, user: { sub: number; role: Role }) {
    if (user.role === Role.TEACHER) {
      const course = await this.prisma.course.findUnique({ where: { id: courseId } });
      if (!course || course.teacherId !== user.sub) {
        throw new ForbiddenException();
      }
    }

    return this.prisma.submission.findMany({
      where: { assignment: { courseId } },
      include: {
        student: { select: { id: true, fullName: true } },
        assignment: { select: { id: true, title: true } },
        grade: true,
      },
      orderBy: { submittedAt: 'desc' },
    });
  }
}
