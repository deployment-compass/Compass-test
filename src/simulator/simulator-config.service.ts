// src/simulator/simulator-config.service.ts
//
// in-memory
// source of truth for default response-simulation behavior, mutable at
// runtime via GET/PUT /config.

import { BadRequestException, Injectable } from '@nestjs/common';

export type EndpointConfig = {
  success_chance: number; // % of requests returning 2xx
  fast_chance: number; // % of requests faster than fast_duration_ms
  fast_duration_ms: number; // threshold separating "fast" from "slow"
};

const DEFAULT_CONFIG: EndpointConfig = {
  success_chance: 90,
  fast_chance: 95,
  fast_duration_ms: 300,
};

@Injectable()
export class SimulatorConfigService {
  private config: EndpointConfig = { ...DEFAULT_CONFIG };

  get(): EndpointConfig {
    return { ...this.config };
  }

  set(next: EndpointConfig): EndpointConfig {
    this.validate(next);
    this.config = { ...next };
    return this.get();
  }

  private validate(c: EndpointConfig) {
    if (!inRange(c.success_chance) || !inRange(c.fast_chance)) {
      throw new BadRequestException(
        'success_chance and fast_chance must be 0-100',
      );
    }
    if (!Number.isFinite(c.fast_duration_ms) || c.fast_duration_ms < 1) {
      throw new BadRequestException('fast_duration_ms must be >= 1');
    }
  }
}

function inRange(pct: number): boolean {
  return Number.isFinite(pct) && pct >= 0 && pct <= 100;
}
