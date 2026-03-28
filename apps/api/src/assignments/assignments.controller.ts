import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';

const ALLOWED_EXT = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|zip|png|jpg|jpeg)$/i;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Roles(Role.TEACHER)
  @Post()
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
  create(
    @Body() dto: CreateAssignmentDto,
    @CurrentUser() user: { sub: number; role: Role },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const attachmentUrl = file ? `/uploads/${file.filename}` : undefined;
    return this.assignmentsService.create(dto, user, attachmentUrl, file?.path);
  }

  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  @Get()
  list(
    @CurrentUser() user: { sub: number; role: Role },
    @Query('courseId') courseIdRaw?: string,
  ) {
    const courseId = courseIdRaw ? parseInt(courseIdRaw, 10) : undefined;
    return this.assignmentsService.list(user, courseId);
  }

  @Roles(Role.STUDENT)
  @Post(':id/submissions')
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
  submit(
    @Param('id', ParseIntPipe) assignmentId: number,
    @Body() dto: SubmitAssignmentDto,
    @CurrentUser() user: { sub: number },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const fileUrl = file ? `/uploads/${file.filename}` : undefined;
    return this.assignmentsService.submit(assignmentId, dto, user, fileUrl);
  }
}
