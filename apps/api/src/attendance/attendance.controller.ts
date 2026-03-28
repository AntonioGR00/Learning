import { Body, Controller, Get, Param, ParseIntPipe, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { JustifyAttendanceDto } from './dto/justify-attendance.dto';
import { ReviewAttendanceJustificationDto } from './dto/review-attendance-justification.dto';

const ALLOWED_EXT = /\.(pdf|png|jpg|jpeg)$/i;

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

  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  @Get('course/:courseId')
  byCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
    @CurrentUser() user: { sub: number; role: Role },
  ) {
    return this.attendanceService.byCourse(courseId, user);
  }

  @Roles(Role.STUDENT)
  @Post(':id/justify')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_EXT.test(file.originalname)) {
          cb(null, true);
        } else {
          cb(new Error('Tipo de archivo no permitido'), false);
        }
      },
    }),
  )
  justify(
    @Param('id', ParseIntPipe) attendanceId: number,
    @Body() dto: JustifyAttendanceDto,
    @CurrentUser() user: { sub: number },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const fileUrl = file ? `/uploads/${file.filename}` : undefined;
    return this.attendanceService.justify(attendanceId, dto, user.sub, fileUrl);
  }

  @Roles(Role.TEACHER)
  @Post(':id/justification/review')
  reviewJustification(
    @Param('id', ParseIntPipe) attendanceId: number,
    @Body() dto: ReviewAttendanceJustificationDto,
    @CurrentUser() user: { sub: number; role: Role },
  ) {
    return this.attendanceService.reviewJustification(attendanceId, dto, user);
  }
}
