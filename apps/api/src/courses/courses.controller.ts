import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateCourseDto } from './dto/create-course.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CoursesService } from './courses.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Roles(Role.ADMIN, Role.TEACHER)
  @Post()
  create(
    @Body() createCourseDto: CreateCourseDto,
    @CurrentUser() user: { sub: number; role: Role },
  ) {
    return this.coursesService.create(createCourseDto, user);
  }

  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  @Get()
  list(@CurrentUser() user: { sub: number; role: Role }) {
    return this.coursesService.list(user);
  }

  @Roles(Role.ADMIN, Role.TEACHER)
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { sub: number; role: Role },
  ) {
    return this.coursesService.findOne(id, user);
  }

  @Roles(Role.TEACHER)
  @Get(':id/available-students')
  availableStudents(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { sub: number; role: Role },
  ) {
    return this.coursesService.availableStudents(id, user);
  }

  @Roles(Role.TEACHER)
  @Post('enrollments')
  enroll(
    @Body() enrollDto: EnrollStudentDto,
    @CurrentUser() user: { sub: number; role: Role },
  ) {
    return this.coursesService.enroll(enrollDto, user);
  }

  @Roles(Role.ADMIN, Role.TEACHER)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCourseDto: UpdateCourseDto,
    @CurrentUser() user: { sub: number; role: Role },
  ) {
    return this.coursesService.update(id, updateCourseDto, user);
  }
}
