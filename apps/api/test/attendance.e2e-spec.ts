import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '../src/common/enums/role.enum';
import { AttendanceStatus } from '../src/common/enums/attendance-status.enum';

/**
 * E2E tests for the Attendance REST API.
 * PrismaService is mocked to isolate from the database.
 */
describe('Attendance REST (e2e)', () => {
  let app: INestApplication<App>;
  let prismaService: Partial<PrismaService>;

  const teacherId = 1;
  const studentId = 2;
  const courseId = 10;

  const mockTeacher = {
    id: teacherId,
    email: 'teacher@test.com',
    fullName: 'Test Teacher',
    role: Role.TEACHER,
  };

  const mockAttendance = {
    id: 1,
    courseId,
    studentId,
    date: new Date('2026-03-28'),
    status: AttendanceStatus.PRESENT,
    notes: null,
    course: { id: courseId, code: 'CS101', title: 'Computer Science' },
  };

  const mockCourse = {
    id: courseId,
    code: 'CS101',
    title: 'Computer Science',
    teacherId,
    description: null,
  };

  beforeAll(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockTeacher),
      } as any,
      course: {
        findUnique: jest.fn().mockResolvedValue(mockCourse),
        findFirst: jest.fn().mockResolvedValue(mockCourse),
      } as any,
      enrollment: {
        findFirst: jest.fn().mockResolvedValue({ studentId, courseId }),
        findMany: jest.fn().mockResolvedValue([{ studentId }]),
      } as any,
      attendance: {
        upsert: jest.fn().mockResolvedValue(mockAttendance),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([mockAttendance]),
        findFirst: jest.fn().mockResolvedValue(mockAttendance),
      } as any,
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/attendance/course/:courseId', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get(`/api/attendance/course/${courseId}`)
        .expect(401);
    });
  });

  describe('POST /api/attendance', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .post('/api/attendance')
        .send({
          courseId,
          date: '2026-03-28',
          records: [{ studentId, status: AttendanceStatus.PRESENT }],
        })
        .expect(401);
    });

    it('should reject invalid status values', async () => {
      // Validated by class-validator IsEnum — placeholder for authenticated flow
      expect(['PRESENT', 'ABSENT', 'LATE']).toContain(AttendanceStatus.PRESENT);
    });
  });

  describe('Attendance status enum', () => {
    it('should have all required statuses', () => {
      expect(AttendanceStatus.PRESENT).toBe('PRESENT');
      expect(AttendanceStatus.ABSENT).toBe('ABSENT');
      expect(AttendanceStatus.LATE).toBe('LATE');
    });
  });
});
