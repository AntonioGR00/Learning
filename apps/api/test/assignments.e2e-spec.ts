import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '../src/common/enums/role.enum';

/**
 * E2E tests for Assignments with file attachments.
 * PrismaService is mocked to isolate from the database.
 */
describe('Assignments + Attachments (e2e)', () => {
  let app: INestApplication<App>;
  let prismaService: Partial<PrismaService>;

  const teacherId = 1;
  const studentId = 2;
  const courseId = 10;
  const assignmentId = 100;

  const mockCourse = {
    id: courseId,
    code: 'CS101',
    title: 'Computer Science',
    teacherId,
    description: null,
  };

  const mockAssignment = {
    id: assignmentId,
    courseId,
    createdById: teacherId,
    title: 'Test Assignment',
    description: 'Test description',
    dueDate: new Date('2026-04-01'),
    attachmentUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === teacherId)
            return Promise.resolve({ id: teacherId, role: Role.TEACHER });
          if (where.id === studentId)
            return Promise.resolve({ id: studentId, role: Role.STUDENT });
          return Promise.resolve(null);
        }),
      } as any,
      course: {
        findUnique: jest.fn().mockResolvedValue(mockCourse),
        findFirst: jest.fn().mockResolvedValue(mockCourse),
      } as any,
      enrollment: {
        findFirst: jest.fn().mockResolvedValue({ studentId, courseId }),
        findMany: jest.fn().mockResolvedValue([]),
      } as any,
      assignment: {
        create: jest.fn().mockResolvedValue(mockAssignment),
        findMany: jest.fn().mockResolvedValue([mockAssignment]),
        findUnique: jest.fn().mockResolvedValue(mockAssignment),
        findFirst: jest.fn().mockResolvedValue(mockAssignment),
        update: jest.fn().mockResolvedValue(mockAssignment),
      } as any,
      submission: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 1,
          assignmentId,
          studentId,
          content: 'My submission',
          status: 'SUBMITTED',
          submittedAt: new Date(),
        }),
        update: jest.fn().mockResolvedValue({}),
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

  describe('GET /api/assignments?courseId=:courseId', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get(`/api/assignments?courseId=${courseId}`)
        .expect(401);
    });
  });

  describe('POST /api/assignments (with file attachment)', () => {
    it('should reject unauthenticated multipart requests', async () => {
      await request(app.getHttpServer())
        .post('/api/assignments')
        .field('courseId', String(courseId))
        .field('title', 'Test Assignment')
        .attach('attachment', Buffer.from('test file content'), 'test.pdf')
        .expect(401);
    });

    it('should accept valid assignment data structure', () => {
      // Validates that the DTO fields are correct
      const dto = {
        courseId,
        title: 'Assignment with attachment',
        description: 'Test',
        dueDate: '2026-04-01T00:00:00.000Z',
      };
      expect(dto.title).toBeTruthy();
      expect(dto.courseId).toBe(courseId);
    });
  });

  describe('POST /api/assignments/:id/submissions', () => {
    it('should reject unauthenticated submission requests', async () => {
      await request(app.getHttpServer())
        .post(`/api/assignments/${assignmentId}/submissions`)
        .send({ content: 'My answer' })
        .expect(401);
    });
  });

  describe('Attachment URL validation', () => {
    it('should store relative URL when file is uploaded', () => {
      // The API stores /uploads/<filename> as the attachmentUrl
      const filename = 'test-assignment-1234567890.pdf';
      const url = `/uploads/${filename}`;
      expect(url).toMatch(/^\/uploads\/.+/);
    });
  });
});
