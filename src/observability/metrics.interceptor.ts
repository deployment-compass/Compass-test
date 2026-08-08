// src/observability/metrics.interceptor.ts
//
// Global interceptor — times every request and records it. Uses the
// matched route pattern (not the raw URL) for the `path` label so
// cardinality stays bounded (e.g. /incidents/:id, not /incidents/abc123).

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';
import { Request, Response } from 'express';

const SERVICE_NAME = process.env.COMPASS_SERVICE_NAME ?? 'compass';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req: Request = context.switchToHttp().getRequest();
    const res: Response = context.switchToHttp().getResponse();
    const start = process.hrtime.bigint();

    // req.route.path gives the matched pattern; fall back to req.path

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const path: string = req.route?.path ?? req.path ?? 'unknown';
    const method = req.method;

    return next.handle().pipe(
      tap({
        next: () => this.record(start, method, path, res.statusCode),
        error: () => this.record(start, method, path, res.statusCode || 500),
      }),
    );
  }

  private record(
    startNs: bigint,
    method: string,
    path: string,
    status: number,
  ) {
    const durationSeconds = Number(process.hrtime.bigint() - startNs) / 1e9;

    this.metrics.httpRequestsTotal
      .labels(SERVICE_NAME, method, path, String(status))
      .inc();

    this.metrics.httpRequestDuration
      .labels(SERVICE_NAME, method, path)
      .observe(durationSeconds);
  }
}
