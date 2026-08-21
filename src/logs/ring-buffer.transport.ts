// src/logs/ring-buffer.transport.ts
//
// Custom Winston transport that captures every log line into a shared
// in-memory ring buffer (max MAX_ENTRIES entries, oldest evicted first).
//
// This lets the anomaly-detector pull a recent log snapshot over HTTP
// without needing direct Loki access.
//
// Usage: add `new RingBufferTransport()` to the transports array in
// logger.config.ts — no other call sites need to change.

import Transport from 'winston-transport';

export type LogEntry = {
  timestamp: string;
  level: string;
  message: string;
  [key: string]: unknown;
};

const MAX_ENTRIES = 500;

// Exported so the LogsController can read from it directly.
// It's a simple array used as a ring-buffer (shift from front, push to back).
export const logRingBuffer: LogEntry[] = [];

// Keys we extract explicitly — everything else is spread in as metadata
const RESERVED_KEYS = new Set(['level', 'message', 'timestamp', 'splat']);

export class RingBufferTransport extends Transport {
  constructor(opts?: Transport.TransportStreamOptions) {
    super(opts);
  }

  log(info: Record<string, unknown>, callback: () => void): void {
    setImmediate(() => this.emit('logged', info));

    const entry: LogEntry = {
      timestamp:
        typeof info['timestamp'] === 'string'
          ? info['timestamp']
          : new Date().toISOString(),
      level: String(info['level'] ?? 'info'),
      message: String(info['message'] ?? ''),
      // Spread any extra metadata fields (correlation_id, path, etc.)
      ...Object.fromEntries(
        Object.entries(info).filter(([k]) => !RESERVED_KEYS.has(k)),
      ),
    };

    logRingBuffer.push(entry);
    if (logRingBuffer.length > MAX_ENTRIES) {
      logRingBuffer.shift(); // evict oldest
    }

    callback();
  }
}
