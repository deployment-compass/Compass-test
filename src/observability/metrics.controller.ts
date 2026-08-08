// src/observability/metrics.controller.ts
//
// GET /metrics — what Prometheus's "compass-app" scrape job in
// prometheus.yml actually pulls from.

import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  async getMetrics(): Promise<string> {
    return this.metrics.metrics();
  }
}
