import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import mammoth from 'mammoth';
import { extname } from 'path';
import { AssignmentDeliveryMode } from '@prisma/client';
import { Role } from '../common/enums/role.enum';
import { SubmissionStatus } from '../common/enums/submission-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentDeliveryModeDto, CreateAssignmentDto } from './dto/create-assignment.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private normalizeQuestions(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((q): q is string => typeof q === 'string')
      .map((q) => q.trim())
      .filter((q) => q.length > 0);
  }

  private serializeAssignment<T extends { questions?: unknown }>(assignment: T): T & { questions: string[] } {
    return {
      ...assignment,
      questions: this.normalizeQuestions(assignment.questions),
    };
  }

  private extractQuestionsFromText(rawText: string): string[] {
    const lines = rawText
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line.length > 0);

    const startsQuestion = (line: string) => {
      const normalized = line.toLowerCase();
      if (/^(pregunta\s*\d+[:.)-]?|question\s*\d+[:.)-]?)/i.test(line)) return true;
      if (/^\d+\s*[).:-]\s+/.test(line)) return true;
      if (/^[ivxlcdm]+\s*[).:-]\s+/i.test(line)) return true;
      if (/\?$/.test(line) && line.length >= 10) return true;
      if (/^\d+\s+/.test(line) && (normalized.includes('que ') || normalized.includes('cuál') || normalized.includes('como '))) return true;
      return false;
    };

    const isOptionLine = (line: string) => /^[a-d]\s*[).:-]\s+/i.test(line);

    const questions: string[] = [];
    let current = '';

    for (const line of lines) {
      if (isOptionLine(line)) continue;

      if (startsQuestion(line)) {
        if (current) questions.push(current.trim());
        current = line;
        continue;
      }

      if (current) {
        current = `${current} ${line}`.trim();
      }
    }

    if (current) questions.push(current.trim());

    const fallback = lines.filter((line) => /\?$/.test(line) && line.length >= 10);
    const unique = (questions.length > 0 ? questions : fallback)
      .map((q) => q.replace(/\s+/g, ' ').trim())
      .filter((q, idx, arr) => q.length >= 8 && arr.indexOf(q) === idx)
      .slice(0, 40);

    return unique;
  }

  private async extractQuestionsFromDocx(uploadedFilePath?: string): Promise<string[] | null> {
    if (!uploadedFilePath) return null;
    if (extname(uploadedFilePath).toLowerCase() !== '.docx') return null;

    try {
      const { value } = await mammoth.extractRawText({ path: uploadedFilePath });
      const questions = this.extractQuestionsFromText(value || '');
      return questions.length > 0 ? questions : null;
    } catch {
      return null;
    }
  }

  async create(
    dto: CreateAssignmentDto,
    user: { sub: number; role: Role },
    attachmentUrl?: string,
    uploadedFilePath?: string,
  ) {
    if (user.role === Role.TEACHER) {
      const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
      if (!course || course.teacherId !== user.sub) {
        throw new ForbiddenException('Only assigned teacher can create assignments');
      }
    }

    const deliveryMode = dto.deliveryMode ?? AssignmentDeliveryModeDto.PLATFORM;
    const questions = deliveryMode === AssignmentDeliveryModeDto.PLATFORM
      ? await this.extractQuestionsFromDocx(uploadedFilePath)
      : null;
    const secureMode = deliveryMode === AssignmentDeliveryModeDto.PLATFORM && (dto.secureMode ?? false);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId: dto.courseId },
      select: { studentId: true },
    });
    const familyLinks = await this.prisma.familyStudentLink.findMany({
      where: { studentId: { in: enrollments.map((enrollment) => enrollment.studentId) } },
      select: { familyUserId: true },
    });

    const created = await this.prisma.assignment.create({
      data: {
        courseId: dto.courseId,
        createdById: user.sub,
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        deliveryMode,
        durationMinutes: deliveryMode === AssignmentDeliveryModeDto.PLATFORM ? dto.durationMinutes ?? null : null,
        secureMode,
        attachmentUrl: attachmentUrl ?? null,
        questions: questions ?? undefined,
      },
    });

    await this.notificationsService.createMany({
      recipientIds: [
        ...enrollments.map((enrollment) => enrollment.studentId),
        ...familyLinks.map((link) => link.familyUserId),
      ],
      type: 'ASSIGNMENT_CREATED',
      title: 'Nueva tarea publicada',
      body: `${dto.title} ya está disponible en tu asignatura.`,
      link: `/dashboard/curso/${dto.courseId}?tab=assignments`,
    });

    return this.serializeAssignment(created);
  }

  async list(user: { sub: number; role: Role }, courseId?: number) {
    const courseFilter = courseId ? { courseId } : {};

    if (user.role === Role.ADMIN) {
      const assignments = await this.prisma.assignment.findMany({
        where: courseFilter,
        orderBy: { id: 'desc' },
      });
      return assignments.map((a) => this.serializeAssignment(a));
    }

    if (user.role === Role.TEACHER) {
      const assignments = await this.prisma.assignment.findMany({
        where: { course: { teacherId: user.sub }, ...courseFilter },
        orderBy: { id: 'desc' },
      });
      return assignments.map((a) => this.serializeAssignment(a));
    }

    const assignments = await this.prisma.assignment.findMany({
      where: {
        course: {
          enrollments: { some: { studentId: user.sub } },
        },
        ...courseFilter,
      },
      orderBy: { id: 'desc' },
    });

    return assignments.map((a) => this.serializeAssignment(a));
  }

  async submit(
    assignmentId: number,
    dto: SubmitAssignmentDto,
    user: { sub: number },
    fileUrl?: string,
  ) {
    const assignment = await this.prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { courseId: assignment.courseId, studentId: user.sub },
      select: { id: true },
    });
    if (!enrollment) {
      throw new ForbiddenException('Student is not enrolled in this course');
    }

    const existing = await this.prisma.submission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: user.sub,
        },
      },
    });

    if (existing?.status === SubmissionStatus.DISQUALIFIED) {
      throw new ForbiddenException('Submission locked due to focus loss');
    }

    const terminatedByFocusLoss = Boolean(dto.terminatedByFocusLoss);
    const terminationReason = dto.terminationReason?.trim() || 'TAB_OR_FOCUS_CHANGE';
    const content = dto.content?.trim();

    if (!terminatedByFocusLoss) {
      if (assignment.deliveryMode === AssignmentDeliveryMode.FILE_UPLOAD && !fileUrl) {
        throw new BadRequestException('Esta tarea requiere entrega por archivo');
      }
      if (assignment.deliveryMode === AssignmentDeliveryMode.PLATFORM && !content) {
        throw new BadRequestException('Esta tarea requiere respuesta en la plataforma');
      }
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
        content: terminatedByFocusLoss ? null : assignment.deliveryMode === AssignmentDeliveryMode.PLATFORM ? content : null,
        fileUrl: terminatedByFocusLoss ? null : assignment.deliveryMode === AssignmentDeliveryMode.FILE_UPLOAD ? fileUrl ?? null : null,
        status: terminatedByFocusLoss
          ? (SubmissionStatus.DISQUALIFIED as any)
          : (SubmissionStatus.SUBMITTED as any),
        submittedAt: new Date(),
        terminatedAt: terminatedByFocusLoss ? new Date() : null,
        terminationReason: terminatedByFocusLoss ? terminationReason : null,
      },
      update: {
        content: terminatedByFocusLoss ? null : assignment.deliveryMode === AssignmentDeliveryMode.PLATFORM ? content : null,
        fileUrl: terminatedByFocusLoss ? null : assignment.deliveryMode === AssignmentDeliveryMode.FILE_UPLOAD ? fileUrl ?? null : null,
        status: terminatedByFocusLoss
          ? (SubmissionStatus.DISQUALIFIED as any)
          : (SubmissionStatus.SUBMITTED as any),
        submittedAt: new Date(),
        terminatedAt: terminatedByFocusLoss ? new Date() : null,
        terminationReason: terminatedByFocusLoss ? terminationReason : null,
      },
    });
  }
}
