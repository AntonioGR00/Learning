import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return health payload', () => {
      expect(appController.health()).toMatchObject({
        status: 'ok',
        service: 'school-api',
        version: '0.0.1',
        environment: 'test',
      });
      expect(typeof appController.health().uptimeSeconds).toBe('number');
      expect(typeof appController.health().timestamp).toBe('string');
    });
  });
});
