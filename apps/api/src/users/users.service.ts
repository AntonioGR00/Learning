import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    return this.prisma.user.create({
      data: {
        email: createUserDto.email,
        fullName: createUserDto.fullName,
        passwordHash,
        role: createUserDto.role,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    if (
      existingUser.role === 'ADMIN' &&
      updateUserDto.role &&
      updateUserDto.role !== 'ADMIN'
    ) {
      throw new ConflictException('Admin role is immutable');
    }

    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });
      if (emailTaken) {
        throw new ConflictException('Email already exists');
      }
    }

    const passwordHash = updateUserDto.password
      ? await bcrypt.hash(updateUserDto.password, 10)
      : undefined;

    return this.prisma.user.update({
      where: { id },
      data: {
        email: updateUserDto.email,
        fullName: updateUserDto.fullName,
        role: updateUserDto.role,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async remove(id: number, requester: { sub: number; role: string }) {
    const existingUser = await this.prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    if (existingUser.role === 'ADMIN') {
      throw new ConflictException('Admin users cannot be deleted');
    }

    if (requester.sub === id) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const [taughtCoursesCount, createdAssignmentsCount, authoredAnnouncementsCount] =
      await Promise.all([
        this.prisma.course.count({ where: { teacherId: id } }),
        this.prisma.assignment.count({ where: { createdById: id } }),
        this.prisma.announcement.count({ where: { authorId: id } }),
      ]);

    if (taughtCoursesCount > 0) {
      throw new ConflictException(
        'Cannot delete user with assigned courses. Reassign courses first.',
      );
    }

    if (createdAssignmentsCount > 0) {
      throw new ConflictException(
        'Cannot delete user with created assignments.',
      );
    }

    if (authoredAnnouncementsCount > 0) {
      throw new ConflictException(
        'Cannot delete user with published announcements.',
      );
    }

    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }
}
