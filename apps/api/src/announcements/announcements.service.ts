import { ForbiddenException, Injectable } from '@nestjs/common';
import { AnnouncementAudience } from '../common/enums/announcement-audience.enum';
import { Role } from '../common/enums/role.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateAnnouncementDto, user: { sub: number; role: Role }) {
    if (user.role === Role.TEACHER && dto.courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: dto.courseId },
      });
      if (!course || course.teacherId !== user.sub) {
        throw new ForbiddenException(
          'Only assigned teacher can post on this course',
        );
      }
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        body: dto.body,
        courseId: dto.courseId,
        audience: (dto.audience ?? AnnouncementAudience.ALL) as any,
        authorId: user.sub,
      },
    });

    const recipients = await this.resolveRecipients(dto, user.sub);
    await this.notificationsService.createMany({
      recipientIds: recipients,
      type: 'ANNOUNCEMENT_CREATED',
      title: `Nuevo anuncio: ${dto.title}`,
      body: dto.body,
      link: dto.courseId
        ? `/dashboard/curso/${dto.courseId}?tab=calendar`
        : '/dashboard',
    });

    return announcement;
  }

  private async resolveRecipients(
    dto: CreateAnnouncementDto,
    authorId: number,
  ) {
    if (dto.courseId) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { courseId: dto.courseId },
        select: { studentId: true },
      });
      const familyLinks = await this.prisma.familyStudentLink.findMany({
        where: {
          studentId: {
            in: enrollments.map((enrollment) => enrollment.studentId),
          },
        },
        select: { familyUserId: true },
      });
      const course = await this.prisma.course.findUnique({
        where: { id: dto.courseId },
        select: { teacherId: true },
      });

      const recipients = [
        ...enrollments.map((enrollment) => enrollment.studentId),
        ...familyLinks.map((link) => link.familyUserId),
        course?.teacherId,
      ].filter((id): id is number => Boolean(id) && id !== authorId);

      return recipients;
    }

    const where =
      dto.audience === AnnouncementAudience.TEACHERS
        ? { role: Role.TEACHER }
        : dto.audience === AnnouncementAudience.STUDENTS
          ? { role: Role.STUDENT }
          : {};

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    return users.map((user) => user.id).filter((id) => id !== authorId);
  }

  list(user: { sub: number; role: Role }) {
    if (user.role === Role.ADMIN) {
      return this.prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === Role.TEACHER) {
      return this.prisma.announcement.findMany({
        where: {
          OR: [
            { course: { teacherId: user.sub } },
            { audience: AnnouncementAudience.TEACHERS as any },
            { audience: AnnouncementAudience.ALL as any },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.announcement.findMany({
      where: {
        OR: [
          { audience: AnnouncementAudience.STUDENTS as any },
          { audience: AnnouncementAudience.ALL as any },
          {
            course: {
              enrollments: {
                some: {
                  studentId: user.sub,
                },
              },
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
