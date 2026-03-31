import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createCourseDto: CreateCourseDto,
    requester: { sub: number; role: Role },
  ) {
    let teacherId = createCourseDto.teacherId;

    if (requester.role === Role.TEACHER) {
      teacherId = requester.sub;
    }

    if (!teacherId) {
      throw new ForbiddenException('teacherId is required for admin creation');
    }

    return this.prisma.course.create({
      data: {
        code: createCourseDto.code,
        title: createCourseDto.title,
        description: createCourseDto.description,
        teacherId,
      },
    });
  }

  async list(requester: { sub: number; role: Role }) {
    if (requester.role === Role.ADMIN) {
      return this.prisma.course.findMany({
        include: { teacher: true },
        orderBy: { id: 'asc' },
      });
    }

    if (requester.role === Role.TEACHER) {
      return this.prisma.course.findMany({
        where: { teacherId: requester.sub },
        include: { teacher: true },
        orderBy: { id: 'asc' },
      });
    }

    return this.prisma.course.findMany({
      where: {
        enrollments: {
          some: { studentId: requester.sub },
        },
      },
      include: { teacher: true },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number, requester: { sub: number; role: Role }) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        teacher: { select: { id: true, fullName: true, email: true } },
        enrollments: {
          include: {
            student: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });

    if (!course) throw new NotFoundException('Course not found');

    if (requester.role === Role.TEACHER && course.teacherId !== requester.sub) {
      throw new ForbiddenException();
    }

    if (requester.role === Role.STUDENT) {
      const enrolled = course.enrollments.some(
        (enrollment) => enrollment.student.id === requester.sub,
      );
      if (!enrolled) {
        throw new ForbiddenException('Student is not enrolled in this course');
      }
    }

    return course;
  }

  async enroll(
    enrollDto: EnrollStudentDto,
    requester: { sub: number; role: Role },
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id: enrollDto.courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (requester.role === Role.TEACHER && course.teacherId !== requester.sub) {
      throw new ForbiddenException(
        'Only the assigned teacher can enroll students',
      );
    }

    return this.prisma.enrollment.upsert({
      where: {
        courseId_studentId: {
          courseId: enrollDto.courseId,
          studentId: enrollDto.studentId,
        },
      },
      create: {
        courseId: enrollDto.courseId,
        studentId: enrollDto.studentId,
      },
      update: {},
    });
  }

  async availableStudents(
    courseId: number,
    requester: { sub: number; role: Role },
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (requester.role === Role.TEACHER && course.teacherId !== requester.sub) {
      throw new ForbiddenException(
        'Only the assigned teacher can view available students',
      );
    }

    return this.prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        enrollments: {
          none: { courseId },
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async update(
    id: number,
    updateDto: UpdateCourseDto,
    requester: { sub: number; role: Role },
  ) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (requester.role === Role.TEACHER && course.teacherId !== requester.sub) {
      throw new ForbiddenException(
        'Only the assigned teacher can update this course',
      );
    }

    if (
      requester.role === Role.TEACHER &&
      updateDto.teacherId &&
      updateDto.teacherId !== requester.sub
    ) {
      throw new ForbiddenException('Teachers cannot reassign courses');
    }

    if (updateDto.teacherId) {
      const teacher = await this.prisma.user.findUnique({
        where: { id: updateDto.teacherId },
        select: { id: true, role: true },
      });

      if (!teacher || teacher.role !== Role.TEACHER) {
        throw new NotFoundException('Teacher not found');
      }
    }

    return this.prisma.course.update({
      where: { id },
      data: {
        code: updateDto.code,
        title: updateDto.title,
        description: updateDto.description,
        teacherId:
          requester.role === Role.TEACHER ? requester.sub : updateDto.teacherId,
      },
      include: { teacher: true },
    });
  }
}
