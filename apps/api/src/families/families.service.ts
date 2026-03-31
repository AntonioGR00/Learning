import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EducationStage } from '../common/enums/education-stage.enum';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { CreateFamilyLinkDto } from './dto/create-family-link.dto';

@Injectable()
export class FamiliesService {
  constructor(private readonly prisma: PrismaService) {}

  list(stage?: EducationStage) {
    return this.prisma.trainingFamily.findMany({
      where: stage ? { stage: stage as any } : undefined,
      orderBy: [{ stage: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateFamilyDto) {
    try {
      return await this.prisma.trainingFamily.create({
        data: {
          name: dto.name.trim(),
          stage: dto.stage as any,
        },
      });
    } catch {
      throw new ConflictException('Family already exists for this stage');
    }
  }

  async remove(id: number) {
    await this.prisma.trainingFamily.delete({ where: { id } });
    return { success: true };
  }

  listLinks() {
    return this.prisma.familyStudentLink.findMany({
      include: {
        familyUser: {
          select: { id: true, fullName: true, email: true },
        },
        student: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: [{ familyUserId: 'asc' }, { studentId: 'asc' }],
    });
  }

  async createLink(dto: CreateFamilyLinkDto) {
    const [familyUser, student] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.familyUserId } }),
      this.prisma.user.findUnique({ where: { id: dto.studentId } }),
    ]);

    if (!familyUser || familyUser.role !== Role.FAMILY) {
      throw new NotFoundException('Family user not found');
    }

    if (!student || student.role !== Role.STUDENT) {
      throw new NotFoundException('Student user not found');
    }

    try {
      return await this.prisma.familyStudentLink.create({
        data: {
          familyUserId: dto.familyUserId,
          studentId: dto.studentId,
          relationship: dto.relationship?.trim() || null,
        },
        include: {
          familyUser: {
            select: { id: true, fullName: true, email: true },
          },
          student: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });
    } catch {
      throw new ConflictException(
        'This family user is already linked to the student',
      );
    }
  }

  async removeLink(id: number) {
    await this.prisma.familyStudentLink.delete({ where: { id } });
    return { success: true };
  }

  async portal(familyUserId: number) {
    const links = await this.prisma.familyStudentLink.findMany({
      where: { familyUserId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
            enrollments: {
              include: {
                course: {
                  include: {
                    teacher: {
                      select: { id: true, fullName: true, email: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const studentIds = links.map((link) => link.studentId);
    if (studentIds.length === 0) {
      return { students: [] };
    }

    const [
      submissions,
      attendances,
      assignments,
      announcements,
      notifications,
    ] = await Promise.all([
      this.prisma.submission.findMany({
        where: { studentId: { in: studentIds } },
        include: {
          assignment: {
            select: { id: true, courseId: true, title: true, dueDate: true },
          },
          grade: true,
        },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.attendance.findMany({
        where: { studentId: { in: studentIds } },
        include: { course: { select: { id: true, title: true, code: true } } },
        orderBy: { date: 'desc' },
      }),
      this.prisma.assignment.findMany({
        where: {
          course: {
            enrollments: { some: { studentId: { in: studentIds } } },
          },
        },
        select: {
          id: true,
          courseId: true,
          title: true,
          description: true,
          dueDate: true,
          attachmentUrl: true,
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.announcement.findMany({
        where: {
          OR: [
            { audience: 'ALL' as any },
            { audience: 'STUDENTS' as any },
            {
              course: {
                enrollments: {
                  some: { studentId: { in: studentIds } },
                },
              },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.notification.findMany({
        where: { recipientId: { in: studentIds } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      students: links.map((link) => {
        const courseIds = link.student.enrollments.map(
          (enrollment) => enrollment.course.id,
        );
        return {
          relationship: link.relationship,
          student: link.student,
          submissions: submissions.filter(
            (submission) => submission.studentId === link.studentId,
          ),
          attendance: attendances.filter(
            (attendance) => attendance.studentId === link.studentId,
          ),
          assignments: assignments.filter((assignment) =>
            courseIds.includes(assignment.courseId),
          ),
          announcements: announcements.filter(
            (announcement) =>
              announcement.courseId === null ||
              (announcement.courseId
                ? courseIds.includes(announcement.courseId)
                : true),
          ),
          notifications: notifications.filter(
            (notification) => notification.recipientId === link.studentId,
          ),
        };
      }),
    };
  }
}
