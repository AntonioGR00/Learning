import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesService } from './messages.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.STUDENT)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('contacts')
  contacts(@CurrentUser() user: { sub: number; role: Role }) {
    return this.messagesService.contacts(user);
  }

  @Get(':userId')
  thread(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: { sub: number; role: Role },
  ) {
    return this.messagesService.thread(userId, user);
  }

  @Post(':userId/read')
  markAsRead(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: { sub: number; role: Role },
  ) {
    return this.messagesService.markAsRead(userId, user);
  }

  @Post()
  create(
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: { sub: number; role: Role },
  ) {
    return this.messagesService.create(dto, user);
  }
}
