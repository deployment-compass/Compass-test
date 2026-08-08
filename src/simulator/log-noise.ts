// src/simulator/log-noise.ts
//
// Independently rolls a chance to emit a log line matching each pattern
// the Loki ruler is watching for (test-compass_loki_rules.yml), so you can
// trigger those alerts — and generate labeled training data for whatever
// you're training on top of the alert-storm/dedup/triage pipeline —
// without touching the HTTP status-code path at all.
//
// Each pattern rolls independently (not mutually exclusive with the
// others, or with the real response status) — same "one knob per outcome"
// shape as success_chance/fast_chance in the controller.

import type { Logger } from 'winston';

export type LogNoiseConfig = {
  exception_chance: number; // 0-100 — matches |= "Traceback"
  fatal_chance: number; // 0-100 — matches |~ "(?i)fatal|panic"
  oom_chance: number; // 0-100 — matches |~ "(?i)out of memory|oom"
  conn_error_chance: number; // 0-100 — matches connection refused/reset/could not connect
  storm_flag: boolean; // when true, always emits the synthetic storm-test line
};

export const DEFAULT_LOG_NOISE_CONFIG: LogNoiseConfig = {
  exception_chance: 0,
  fatal_chance: 0,
  oom_chance: 0,
  conn_error_chance: 0,
  storm_flag: false,
};

type NoisePattern = {
  key: keyof Omit<LogNoiseConfig, 'storm_flag'>;
  trigger: string; // test-compass_trigger label this matches in the Loki rules
  messages: string[]; // varied wording so log lines aren't all identical
};

const PATTERNS: NoisePattern[] = [
  {
    key: 'exception_chance',
    trigger: 'log_exception_pattern',
    messages: [
      'Unhandled exception in request handler\nTraceback (most recent call last):\n  File "handler.py", line 42, in process\nRuntimeError: simulated failure',
      'Traceback (most recent call last):\n  File "worker.py", line 17, in run\nValueError: simulated failure',
    ],
  },
  {
    key: 'fatal_chance',
    trigger: 'log_fatal_burst',
    messages: [
      'FATAL: unrecoverable state detected, process exiting',
      'panic: simulated panic — runtime invariant violated',
    ],
  },
  {
    key: 'oom_chance',
    trigger: 'oom_log_signal',
    messages: [
      'Out of memory: heap allocation failed after 3 retries',
      'oom: process exceeded memory limit, killing worker',
    ],
  },
  {
    key: 'conn_error_chance',
    trigger: 'dependency_connection_errors',
    messages: [
      'connect ECONNREFUSED — connection refused by downstream service',
      'connection reset by peer while reading response',
      'could not connect to database: timeout after 5000ms',
    ],
  },
];

function randInt(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: T[]): T {
  return items[randInt(0, items.length - 1)];
}

/**
 * Rolls each pattern independently against its configured chance and logs
 * the ones that hit. Returns the list of triggers that fired, so the
 * caller can attach it to the response-generation log line for easy
 * correlation/labeling when you go train on the output.
 */
export function injectLogNoise(
  logger: Logger,
  config: LogNoiseConfig,
  context: { correlation_id?: string; service?: string; path?: string },
): string[] {
  const fired: string[] = [];

  for (const pattern of PATTERNS) {
    const chance = config[pattern.key] ?? 0;
    if (chance <= 0) continue;
    const roll = randInt(1, 100);
    if (roll > chance) continue;

    logger.error(pick(pattern.messages), {
      correlation_id: context.correlation_id,
      path: context.path,
      simulated: true,
      test_compass_trigger: pattern.trigger,
    });
    fired.push(pattern.trigger);
  }

  if (config.storm_flag) {
    logger.warn('test-compass_test_storm_flag=1', {
      correlation_id: context.correlation_id,
      path: context.path,
      simulated: true,
      test_compass_trigger: 'synthetic_storm_test',
    });
    fired.push('synthetic_storm_test');
  }

  return fired;
}

export function parseChanceOrNull(v: unknown): number | null {
  if (typeof v !== 'string' || v === '') return null;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

export function parseBoolOrNull(v: unknown): boolean | null {
  if (typeof v !== 'string' || v === '') return null;
  if (v === '1' || v.toLowerCase() === 'true') return true;
  if (v === '0' || v.toLowerCase() === 'false') return false;
  return null;
}
