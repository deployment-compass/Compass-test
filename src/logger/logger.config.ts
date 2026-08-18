// src/observability/logger.config.ts
//
// Structured JSON logging shipped straight to Loki via winston-loki.
// Every log line carries `service` + `correlation_id` as labels/fields so
// the Context Builder's on-demand LogQL pulls (Section 4 / the Loki
// adaptor) can filter to exactly one incident's logs — matching the
// `correlation_id` that's stamped once at ingestion and carried through
// every bus message (Section 9).
//

import { WinstonModule, utilities as nestWinstonUtils } from 'nest-winston';
import LokiTransport from 'winston-loki';
import * as winston from 'winston';

const SERVICE_NAME = process.env.SERVICE_NAME ?? 'compass';
const LOKI_URL = process.env.LOKI_URL ?? 'http://loki:3100';

export const winstonOptions: winston.LoggerOptions = {
  transports: [
    // Console output — human-readable in dev, still JSON in prod
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            )
          : winston.format.combine(
              winston.format.timestamp(),
              nestWinstonUtils.format.nestLike(SERVICE_NAME, { colors: true }),
            ),
    }),

    // Direct push to Loki. Labels stay LOW-cardinality (service, level,
    // component) — anything per-request (correlation_id, incident_id)
    // goes in the log line/meta, not a label, or you'll blow up Loki's
    // index with a stream per incident.
    new LokiTransport({
      host: LOKI_URL,
      labels: { service: SERVICE_NAME, env: 'prod' },
      json: true,
      format: winston.format.json(),
      replaceTimestamp: true,
      onConnectionError: (err) => console.error('Loki connection error:', err),
      batching: true,
      interval: 5, // seconds — batch flush interval
    }),
  ],
};


// For NestFactory.create(AppModule, { logger: ... }) — Nest-shaped wrapper
export const loggerConfig = WinstonModule.createLogger(winstonOptions);

// For DI injection via WINSTON_MODULE_PROVIDER — raw winston instance
export const winstonInstance = winston.createLogger(winstonOptions);