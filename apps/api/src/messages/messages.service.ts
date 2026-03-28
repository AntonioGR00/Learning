import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesGateway } from './messages.gateway';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  private async canMessageEachOther(senderId: number, recipientId: number) {
    const [sender, recipient] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: senderId } }),
      this.prisma.user.findUnique({ where: { id: recipientId } }),
    ]);

    if (!sender || !recipient) {
      throw new NotFoundException('User not found');
    }

    const senderTeacherRecipientStudent = sender.role === Role.TEACHER && recipient.role === Role.STUDENT;
    const senderStudentRecipientTeacher = sender.role === Role.STUDENT && recipient.role === Role.TEACHER;
    const senderTeacherRecipientFamily = sender.role === Role.TEACHER && recipient.role === Role.FAMILY;
    const senderFamilyRecipientTeacher = sender.role === Role.FAMILY && recipient.role === Role.TEACHER;

    if (!senderTeacherRecipientStudent && !senderStudentRecipientTeacher && !senderTeacherRecipientFamily && !senderFamilyRecipientTeacher) {
      return false;
    }

    if (senderTeacherRecipientStudent) {
      const linked = await this.prisma.enrollment.findFirst({
        where: {
          studentId: recipientId,
          course: { teacherId: senderId },
        },
      });
      return Boolean(linked);
    }

    if (senderTeacherRecipientFamily) {
      const linked = await this.prisma.familyStudentLink.findFirst({
        where: {
          familyUserId: recipientId,
          student: {
            enrollments: {
              some: {
                course: { teacherId: senderId },
              },
            },
          },
        },
      });
      return Boolean(linked);
    }

    if (senderFamilyRecipientTeacher) {
      const linked = await this.prisma.familyStudentLink.findFirst({
        where: {
          familyUserId: senderId,
          student: {
            enrollments: {
              some: {
                course: { teacherId: recipientId },
              },
            },
          },
        },
      });
      return Boolean(linked);
    }

    const linked = await this.prisma.enrollment.findFirst({
      where: {
        studentId: senderId,
        course: { teacherId: recipientId },
      },
    });
    return Boolean(linked);
  }

  async contacts(user: { sub: number; role: Role }) {
    const [unreadMessages, allLastMessages] = await Promise.all([
      (this.prisma as any).message.findMany({
        where: { recipientId: user.sub, readAt: null },
        select: { senderId: true },
      }),
      (this.prisma as any).message.findMany({
        where: { OR: [{ senderId: user.sub }, { recipientId: user.sub }] },
        orderBy: { createdAt: 'desc' },
        select: { senderId: true, recipientId: true, createdAt: true },
      }),
    ]);

    const unreadBySender = new Map<number, number>();
    unreadMessages.forEach((m: { senderId: number }) => {
      unreadBySender.set(m.senderId, (unreadBySender.get(m.senderId) ?? 0) + 1);
    });

    const lastMessageByPeer = new Map<number, Date>();
    for (const msg of allLastMessages as Array<{
      senderId: number;
      recipientId: number;
      createdAt: Date;
    }>) {
      const peerId = msg.senderId === user.sub ? msg.recipientId : msg.senderId;
      if (!lastMessageByPeer.has(peerId)) {
        lastMessageByPeer.set(peerId, msg.createdAt);
      }
    }

    type ContactBase = { id: number; fullName: string; unreadCount: number; lastMessageAt: string | null };
    const sortByLastMessage = (contacts: ContactBase[]) =>
      contacts.sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) {
          return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        }
        if (a.lastMessageAt) return -1;
        if (b.lastMessageAt) return 1;
        return a.fullName.localeCompare(b.fullName);
      });

    if (user.role === Role.TEACHER) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { course: { teacherId: user.sub } },
        select: {
          student: {
            select: { id: true, fullName: true, email: true, role: true },
          },
        },
      });

      const byId = new Map<number, { id: number; fullName: string; email: string; role: Role }>();
      enrollments.forEach((e) => byId.set(e.student.id, e.student as any));

      const familyLinks = await this.prisma.familyStudentLink.findMany({
        where: {
          student: {
            enrollments: {
              some: { course: { teacherId: user.sub } },
            },
          },
        },
        select: {
          familyUser: {
            select: { id: true, fullName: true, email: true, role: true },
          },
        },
      });
      familyLinks.forEach((link) => byId.set(link.familyUser.id, link.familyUser as any));

      return sortByLastMessage(
        Array.from(byId.values()).map((contact) => ({
          ...contact,
          unreadCount: unreadBySender.get(contact.id) ?? 0,
          lastMessageAt: lastMessageByPeer.get(contact.id)?.toISOString() ?? null,
        })),
      );
    }

    if (user.role === Role.FAMILY) {
      const links = await this.prisma.familyStudentLink.findMany({
        where: { familyUserId: user.sub },
        select: {
          student: {
            select: {
              enrollments: {
                select: {
                  course: {
                    select: {
                      teacher: {
                        select: { id: true, fullName: true, email: true, role: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const byId = new Map<number, { id: number; fullName: string; email: string; role: Role }>();
      links.forEach((link) => {
        link.student.enrollments.forEach((enrollment) => {
          byId.set(enrollment.course.teacher.id, enrollment.course.teacher as any);
        });
      });

      return sortByLastMessage(
        Array.from(byId.values()).map((contact) => ({
          ...contact,
          unreadCount: unreadBySender.get(contact.id) ?? 0,
          lastMessageAt: lastMessageByPeer.get(contact.id)?.toISOString() ?? null,
        })),
      );
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: user.sub },
      select: {
        course: {
          select: {
            teacher: {
              select: { id: true, fullName: true, email: true, role: true },
            },
          },
        },
      },
    });

    const byId = new Map<number, { id: number; fullName: string; email: string; role: Role }>();
    enrollments.forEach((e) => byId.set(e.course.teacher.id, e.course.teacher as any));

    return sortByLastMessage(
      Array.from(byId.values()).map((contact) => ({
        ...contact,
        unreadCount: unreadBySender.get(contact.id) ?? 0,
        lastMessageAt: lastMessageByPeer.get(contact.id)?.toISOString() ?? null,
      })),
    );
  }

  async thread(otherUserId: number, user: { sub: number; role: Role }) {
    if (otherUserId === user.sub) {
      throw new BadRequestException('Cannot open thread with yourself');
    }

    const allowed = await this.canMessageEachOther(user.sub, otherUserId);
    if (!allowed) {
      throw new ForbiddenException('Messaging is only allowed between linked teacher and student');
    }

    return (this.prisma as any).message.findMany({
      where: {
        OR: [
          { senderId: user.sub, recipientId: otherUserId },
          { senderId: otherUserId, recipientId: user.sub },
        ],
      },
      include: {
        sender: { select: { id: true, fullName: true, role: true } },
        recipient: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markAsRead(otherUserId: number, user: { sub: number; role: Role }) {
    const allowed = await this.canMessageEachOther(user.sub, otherUserId);
    if (!allowed) {
      throw new ForbiddenException('Messaging is only allowed between linked teacher and student');
    }

    const result = await (this.prisma as any).message.updateMany({
      where: {
        senderId: otherUserId,
        recipientId: user.sub,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    this.logger.log(
      `[AUDIT] User ${user.sub} marked ${result.count} messages from ${otherUserId} as read`,
    );
    return { updated: result.count };
  }

  async create(dto: CreateMessageDto, user: { sub: number; role: Role }) {
    if (dto.recipientId === user.sub) {
      throw new BadRequestException('Cannot send message to yourself');
    }

    const allowed = await this.canMessageEachOther(user.sub, dto.recipientId);
    if (!allowed) {
      throw new ForbiddenException('Messaging is only allowed between linked teacher and student');
    }

    const created = await (this.prisma as any).message.create({
      data: {
        senderId: user.sub,
        recipientId: dto.recipientId,
        content: dto.content.trim(),
      },
      include: {
        sender: { select: { id: true, fullName: true, role: true } },
        recipient: { select: { id: true, fullName: true, role: true } },
      },
    });

    this.logger.log(
      `[AUDIT] Message created: id=${created.id} from=${user.sub} to=${dto.recipientId} length=${dto.content.trim().length}`,
    );
    this.messagesGateway.emitMessageToUsers([user.sub, dto.recipientId], created);

    return created;
  }
}
