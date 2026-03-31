import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health() {
    return this.appService.health();
  }

  @Get('metrics')
  async metrics(@Res() response: Response) {
    response.setHeader('Content-Type', this.appService.metricsContentType());
    response.send(await this.appService.metrics());
  }
}
