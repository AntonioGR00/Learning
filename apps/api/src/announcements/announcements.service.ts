import { ForbiddenException, Injectable } from '@nestjs/common';
import { AnnouncementAudience } from '../common/enums/announcement-audience.enum';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAnnouncementDto, user: { sub: number; role: Role }) {
    if (user.role === Role.TEACHER && dto.courseId) {
      const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
      if (!course || course.teacherId !== user.sub) {
        throw new ForbiddenException('Only assigned teacher can post on this course');
      }
    }

    return this.prisma.announcement.create({
      data: {
        title: dto.title,
        body: dto.body,
        courseId: dto.courseId,
        audience: (dto.audience ?? AnnouncementAudience.ALL) as any,
        authorId: user.sub,
      },
    });
  }

  list(user: { sub: number; role: Role }) {
    if (user.role === Role.ADMIN) {
      return this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
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
