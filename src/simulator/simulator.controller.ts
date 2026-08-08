// src/simulator/simulator.controller.ts
//
// customization paths :
//   1. GET/PUT /config — shared runtime defaults, changeable without a
//      restart (dial success_chance to 0 mid-demo to trigger
//      CompassHighErrorRate on purpose; dial exception_chance/fatal_chance/
//      oom_chance/conn_error_chance to trigger the Loki-side alerts the
//      same way).
//   2. Per-request query overrides — ?success_chance=0&fast_chance=0, or
//      ?exception_chance=100&storm_flag=1 — forces one specific outcome
//      without touching what concurrent requests get.
//
// Depends on:
//   - CorrelationIdMiddleware (req.correlationId)
//   - MetricsInterceptor (already recording http_requests_total /
//     http_request_duration_seconds globally — nothing extra needed here)
//   - the Winston/Loki logger from logger.config.ts
//   - log-noise.ts — independent probabilistic log-pattern injection,
//     matching test-compass_loki_rules.yml so you can trigger those
//     alerts (and generate labeled training data) on demand

import { Controller, Get, Put, Query, Req, Res, Body } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import type { Request, Response } from 'express';
import {
  type EndpointConfig,
  SimulatorConfigService,
} from './simulator-config.service';
import {
  DEFAULT_LOG_NOISE_CONFIG,
  injectLogNoise,
  parseBoolOrNull,
  parseChanceOrNull,
  type LogNoiseConfig,
} from './log-noise';

const FAILURE_CODES = [400, 504];

export type queryConfig = {
  success_chance?: number;
  fast_chance?: number;
  fast_duration_ms?: number;
  exception_chance?: number;
  fatal_chance?: number;
  oom_chance?: number;
  conn_error_chance?: number;
  storm_flag?: number | boolean;
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
    const { logNoiseConfig, logNoiseOverridden } =
      this.resolveLogNoiseConfig(query);

    const fastRoll = randInt(1, 100);
    const isFast = fastRoll <= config.fast_chance;
    const latencyMs = isFast
      ? randInt(1, config.fast_duration_ms)
      : randInt(config.fast_duration_ms + 1, 1000);

    await sleep(latencyMs);

    const status = this.rollStatusCode(config.success_chance);

    // Independent of status/latency — a "successful" 200 can still emit a
    // fatal/OOM/exception line, and a 504 can be noise-free. That
    // independence is what makes this useful for training: the model
    // shouldn't learn "log noise == failed request", it should learn to
    // key off the actual log content.
    const firedPatterns = injectLogNoise(this.logger, logNoiseConfig, {
      correlation_id: req.correlationId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      path: req.route?.path ?? req.path,
    });

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

      log_noise_fired: firedPatterns,
      log_noise_overridden: logNoiseOverridden,
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

  // Same layering pattern as resolveConfig(), but for the log-noise knobs.
  // Defaults come from SimulatorConfigService (extend EndpointConfig with
  // the LogNoiseConfig fields — see note below), query params override
  // per-request.
  private resolveLogNoiseConfig(query: queryConfig): {
    logNoiseConfig: LogNoiseConfig;
    logNoiseOverridden: boolean;
  } {
    const stored = this.configService.get() as EndpointConfig &
      Partial<LogNoiseConfig>;
    const logNoiseConfig: LogNoiseConfig = {
      exception_chance:
        stored.exception_chance ?? DEFAULT_LOG_NOISE_CONFIG.exception_chance,
      fatal_chance:
        stored.fatal_chance ?? DEFAULT_LOG_NOISE_CONFIG.fatal_chance,
      oom_chance: stored.oom_chance ?? DEFAULT_LOG_NOISE_CONFIG.oom_chance,
      conn_error_chance:
        stored.conn_error_chance ?? DEFAULT_LOG_NOISE_CONFIG.conn_error_chance,
      storm_flag: stored.storm_flag ?? DEFAULT_LOG_NOISE_CONFIG.storm_flag,
    };
    let overridden = false;

    const exceptionChance = parseChanceOrNull(query.exception_chance);
    if (exceptionChance !== null) {
      logNoiseConfig.exception_chance = exceptionChance;
      overridden = true;
    }

    const fatalChance = parseChanceOrNull(query.fatal_chance);
    if (fatalChance !== null) {
      logNoiseConfig.fatal_chance = fatalChance;
      overridden = true;
    }

    const oomChance = parseChanceOrNull(query.oom_chance);
    if (oomChance !== null) {
      logNoiseConfig.oom_chance = oomChance;
      overridden = true;
    }

    const connErrorChance = parseChanceOrNull(query.conn_error_chance);
    if (connErrorChance !== null) {
      logNoiseConfig.conn_error_chance = connErrorChance;
      overridden = true;
    }

    const stormFlag = parseBoolOrNull(query.storm_flag);
    if (stormFlag !== null) {
      logNoiseConfig.storm_flag = stormFlag;
      overridden = true;
    }

    return { logNoiseConfig, logNoiseOverridden: overridden };
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
