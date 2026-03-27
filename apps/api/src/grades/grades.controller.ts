import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateGradeDto } from './dto/create-grade.dto';
import { GradesService } from './grades.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Roles(Role.TEACHER)
  @Post()
  create(
    @Body() dto: CreateGradeDto,
    @CurrentUser() user: { sub: number; role: Role },
  ) {
    return this.gradesService.create(dto, user);
  }

  @Roles(Role.STUDENT)
  @Get('me')
  myGrades(@CurrentUser() user: { sub: number }) {
    return this.gradesService.myGrades(user.sub);
  }

  @Roles(Role.ADMIN, Role.TEACHER)
  @Get('course/:courseId')
  byCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
    @CurrentUser() user: { sub: number; role: Role },
  ) {
    return this.gradesService.byCourse(courseId, user);
  }
}
