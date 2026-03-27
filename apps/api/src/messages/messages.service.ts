import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesGateway } from './messages.gateway';

@Injectable()
export class MessagesService {
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

    const senderTeacherRecipientStudent =
      sender.role === Role.TEACHER && recipient.role === Role.STUDENT;
    const senderStudentRecipientTeacher =
      sender.role === Role.STUDENT && recipient.role === Role.TEACHER;

    if (!senderTeacherRecipientStudent && !senderStudentRecipientTeacher) {
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

    const linked = await this.prisma.enrollment.findFirst({
      where: {
        studentId: senderId,
        course: { teacherId: recipientId },
      },
    });
    return Boolean(linked);
  }

  async contacts(user: { sub: number; role: Role }) {
    const unreadMessages = await (this.prisma as any).message.findMany({
      where: {
        recipientId: user.sub,
        readAt: null,
      },
      select: { senderId: true },
    });

    const unreadBySender = new Map<number, number>();
    unreadMessages.forEach((m: { senderId: number }) => {
      unreadBySender.set(m.senderId, (unreadBySender.get(m.senderId) ?? 0) + 1);
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

      return Array.from(byId.values())
        .map((contact) => ({
          ...contact,
          unreadCount: unreadBySender.get(contact.id) ?? 0,
        }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
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

    return Array.from(byId.values())
      .map((contact) => ({
        ...contact,
        unreadCount: unreadBySender.get(contact.id) ?? 0,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
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

    this.messagesGateway.emitMessageToUsers([user.sub, dto.recipientId], created);

    return created;
  }
}
