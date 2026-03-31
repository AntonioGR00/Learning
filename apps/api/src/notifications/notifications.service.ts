import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CreateNotificationInput = {
  recipientIds: number[];
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(input: CreateNotificationInput) {
    const recipientIds = [...new Set(input.recipientIds)].filter((id) =>
      Number.isInteger(id),
    );
    if (recipientIds.length === 0) {
      return { count: 0 };
    }

    return this.prisma.notification.createMany({
      data: recipientIds.map((recipientId) => ({
        recipientId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
      })),
    });
  }

  listForUser(userId: number) {
    return this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
      take: 30,
    });
  }

  async markRead(notificationId: number, userId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.recipientId !== userId) {
      throw new ForbiddenException(
        'Notification does not belong to current user',
      );
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: notification.readAt ?? new Date() },
    });
  }

  async markAllRead(userId: number) {
    const result = await this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  }
}
