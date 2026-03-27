import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { SubmissionStatus } from '../common/enums/submission-status.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAssignmentDto, user: { sub: number; role: Role }, attachmentUrl?: string) {
    if (user.role === Role.TEACHER) {
      const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
      if (!course || course.teacherId !== user.sub) {
        throw new ForbiddenException('Only assigned teacher can create assignments');
      }
    }

    return this.prisma.assignment.create({
      data: {
        courseId: dto.courseId,
        createdById: user.sub,
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        attachmentUrl: attachmentUrl ?? null,
      },
    });
  }

  list(user: { sub: number; role: Role }, courseId?: number) {
    const courseFilter = courseId ? { courseId } : {};

    if (user.role === Role.ADMIN) {
      return this.prisma.assignment.findMany({
        where: courseFilter,
        orderBy: { id: 'desc' },
      });
    }

    if (user.role === Role.TEACHER) {
      return this.prisma.assignment.findMany({
        where: { course: { teacherId: user.sub }, ...courseFilter },
        orderBy: { id: 'desc' },
      });
    }

    return this.prisma.assignment.findMany({
      where: {
        course: {
          enrollments: { some: { studentId: user.sub } },
        },
        ...courseFilter,
      },
      orderBy: { id: 'desc' },
    });
  }

  async submit(assignmentId: number, dto: SubmitAssignmentDto, user: { sub: number }) {
    const assignment = await this.prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return this.prisma.submission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: user.sub,
        },
      },
      create: {
        assignmentId,
        studentId: user.sub,
        content: dto.content,
        status: SubmissionStatus.SUBMITTED as any,
        submittedAt: new Date(),
      },
      update: {
        content: dto.content,
        status: SubmissionStatus.SUBMITTED as any,
        submittedAt: new Date(),
      },
    });
  }
}
