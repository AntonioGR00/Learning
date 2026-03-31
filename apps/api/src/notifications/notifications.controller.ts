import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: { sub: number }) {
    return this.notificationsService.listForUser(user.sub);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: { sub: number }) {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Post(':id/read')
  markRead(
    @Param('id', ParseIntPipe) notificationId: number,
    @CurrentUser() user: { sub: number },
  ) {
    return this.notificationsService.markRead(notificationId, user.sub);
  }
}
