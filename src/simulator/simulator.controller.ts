// src/simulator/simulator.controller.ts
//
// customization paths :
//   1. GET/PUT /config — shared runtime defaults, changeable without a
//      restart (dial success_chance to 0 mid-demo to trigger
//      CompassHighErrorRate on purpose).
//   2. Per-request query overrides — ?success_chance=0&fast_chance=0 —
//      forces one specific outcome without touching what concurrent
//      requests get.
//
// Depends on:
//   - CorrelationIdMiddleware (req.correlationId)
//   - MetricsInterceptor (already recording http_requests_total /
//     http_request_duration_seconds globally — nothing extra needed here)
//   - the Winston/Loki logger from logger.config.ts

import { Controller, Get, Put, Query, Req, Res, Body } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import type { Request, Response } from 'express';
import {
  type EndpointConfig,
  SimulatorConfigService,
} from './simulator-config.service';

const FAILURE_CODES = [400, 504];
export type queryConfig = {
  success_chance?: number;
  fast_chance?: number;
  fast_duration_ms?: number;
};

@Controller()
export class SimulatorController {
  constructor(
    private readonly configService: SimulatorConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Get('config')
  getConfig(): EndpointConfig {
    return this.configService.get();
  }

  @Put('config')
  updateConfig(@Body() body: EndpointConfig): EndpointConfig {
    return this.configService.set(body);
  }

  @Get('ping/:id/status')
  async status(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: queryConfig,
  ) {
    await this.simulate(req, res, query);
  }

  @Get('ping/:id/info')
  async info(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: queryConfig,
  ) {
    await this.simulate(req, res, query);
  }

  private async simulate(req: Request, res: Response, query: queryConfig) {
    const { config, overridden } = this.resolveConfig(query);

    const fastRoll = randInt(1, 100);
    const isFast = fastRoll <= config.fast_chance;
    const latencyMs = isFast
      ? randInt(1, config.fast_duration_ms)
      : randInt(config.fast_duration_ms + 1, 1000);

    await sleep(latencyMs);

    const status = this.rollStatusCode(config.success_chance);

    this.logger.info('simulated response generated', {
      correlation_id: req.correlationId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      path: req.route?.path ?? req.path,
      status,
      simulated_latency_ms: latencyMs,
      success_chance: config.success_chance,
      fast_chance: config.fast_chance,
      fast_duration_ms: config.fast_duration_ms,
      config_overridden: overridden,
    });

    res.status(status).json({ response: 'pong' });
  }

  // Layers query-param overrides on top of the shared default config —
  // same precedence as the Go version's resolveConfig().
  private resolveConfig(query: queryConfig): {
    config: EndpointConfig;
    overridden: boolean;
  } {
    const config = this.configService.get();
    let overridden = false;

    const successChance = parseIntOrNull(query.success_chance);
    if (successChance !== null && inRange(successChance)) {
      config.success_chance = successChance;
      overridden = true;
    }

    const fastChance = parseIntOrNull(query.fast_chance);
    if (fastChance !== null && inRange(fastChance)) {
      config.fast_chance = fastChance;
      overridden = true;
    }

    const fastDurationMs = parseIntOrNull(query.fast_duration_ms);
    if (fastDurationMs !== null && fastDurationMs >= 1) {
      config.fast_duration_ms = fastDurationMs;
      overridden = true;
    }

    return { config, overridden };
  }

  private rollStatusCode(successChancePct: number): number {
    const roll = randInt(1, 100);
    if (roll <= successChancePct) return 200;
    return FAILURE_CODES[randInt(0, FAILURE_CODES.length - 1)];
  }
}

function randInt(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseIntOrNull(v: unknown): number | null {
  if (typeof v !== 'string' || v === '') return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function inRange(pct: number): boolean {
  return pct >= 0 && pct <= 100;
}
