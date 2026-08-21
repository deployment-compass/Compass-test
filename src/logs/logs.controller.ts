// src/logs/logs.controller.ts
//
// GET /logs/recent — returns a recent window of structured log entries
// captured by the RingBufferTransport.
//
// Query parameters:
//   limit    (number, default 100, max 500) — how many entries to return
//   level    (string, optional)             — filter by log level (e.g. "error", "warn")
//   since_ms (number, optional)             — only return entries after this unix ms timestamp
//
// Response:
//   { count: number, logs: LogEntry[] }   — newest entries first

import { Controller, Get, Query } from '@nestjs/common';
import {
  logRingBuffer,
  type LogEntry,
} from './ring-buffer.transport';

@Controller('logs')
export class LogsController {
  /**
   * Returns recent log entries from the in-memory ring buffer.
   * Useful for the anomaly-detector to pull a log snapshot when escalating
   * an anomaly to the LLM agent for investigation.
   */
  @Get('recent')
  getRecentLogs(
    @Query('limit') rawLimit?: string,
    @Query('level') level?: string,
    @Query('since_ms') sinceMs?: string,
  ): { count: number; logs: LogEntry[] } {
    // Work on a reversed copy (newest first) without mutating the buffer
    let entries: LogEntry[] = [...logRingBuffer].reverse();

    // Filter by log level if requested
    if (level && level.trim() !== '') {
      const normalizedLevel = level.trim().toLowerCase();
      entries = entries.filter(
        (e) => String(e.level).toLowerCase() === normalizedLevel,
      );
    }

    // Filter to entries after a given timestamp (unix ms)
    if (sinceMs !== undefined && sinceMs !== '') {
      const since = Number(sinceMs);
      if (Number.isFinite(since)) {
        entries = entries.filter(
          (e) => new Date(e.timestamp).getTime() >= since,
        );
      }
    }

    // Cap to requested limit (max 500, default 100)
    const limit = Math.min(
      Math.max(1, Number.isFinite(Number(rawLimit)) ? Number(rawLimit) : 100),
      500,
    );

    const sliced = entries.slice(0, limit);
    return { count: sliced.length, logs: sliced };
  }
}
