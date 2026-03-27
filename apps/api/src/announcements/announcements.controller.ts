import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Roles(Role.ADMIN, Role.TEACHER)
  @Post()
  create(
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() user: { sub: number; role: Role },
  ) {
    return this.announcementsService.create(dto, user);
  }

  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  @Get()
  list(@CurrentUser() user: { sub: number; role: Role }) {
    return this.announcementsService.list(user);
  }
}
