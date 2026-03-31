import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Registry } from 'prom-client';

@Injectable()
export class AppService {
  private static readonly registry = new Registry();

  private static metricsInitialized = false;

  constructor() {
    if (!AppService.metricsInitialized) {
      collectDefaultMetrics({
        register: AppService.registry,
        prefix: 'school_',
      });
      AppService.metricsInitialized = true;
    }
  }

  health() {
    return {
      status: 'ok',
      service: 'school-api',
      version: process.env.npm_package_version ?? '0.0.1',
      environment: process.env.NODE_ENV ?? 'development',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async metrics() {
    return AppService.registry.metrics();
  }

  metricsContentType() {
    return AppService.registry.contentType;
  }
}
