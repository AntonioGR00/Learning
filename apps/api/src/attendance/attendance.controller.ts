import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Roles(Role.TEACHER)
  @Post()
  mark(
    @Body() dto: CreateAttendanceDto,
    @CurrentUser() user: { sub: number; role: Role },
  ) {
    return this.attendanceService.mark(dto, user);
  }

  @Roles(Role.STUDENT)
  @Get('me')
  myAttendance(@CurrentUser() user: { sub: number }) {
    return this.attendanceService.myAttendance(user.sub);
  }

  @Roles(Role.ADMIN, Role.TEACHER)
  @Get('course/:courseId')
  byCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
    @CurrentUser() user: { sub: number; role: Role },
  ) {
    return this.attendanceService.byCourse(courseId, user);
  }
}
