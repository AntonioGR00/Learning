import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGradeDto } from './dto/create-grade.dto';

@Injectable()
export class GradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

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

    const grade = await this.prisma.grade.upsert({
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

    const familyLinks = await this.prisma.familyStudentLink.findMany({
      where: { studentId: submission.studentId },
      select: { familyUserId: true },
    });

    await this.notificationsService.createMany({
      recipientIds: [
        submission.studentId,
        ...familyLinks.map((link) => link.familyUserId),
      ],
      type: 'GRADE_PUBLISHED',
      title: `Nueva calificación en ${submission.assignment.title}`,
      body: `Tu tarea ha sido calificada con un ${dto.score}.`,
      link: `/dashboard/curso/${submission.assignment.courseId}?tab=grades`,
    });

    return grade;
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
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });
      if (!course || course.teacherId !== user.sub) {
        throw new ForbiddenException();
      }
    }

    const whereClause =
      user.role === Role.STUDENT
        ? { assignment: { courseId }, studentId: user.sub }
        : { assignment: { courseId } };

    return this.prisma.submission.findMany({
      where: whereClause,
      include: {
        student: { select: { id: true, fullName: true } },
        assignment: { select: { id: true, title: true } },
        grade: true,
      },
      orderBy: { submittedAt: 'desc' },
    });
  }
}
