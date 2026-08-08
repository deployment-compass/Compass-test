// src/observability/metrics.service.ts
//
// Defines the same metrics as the Python version: http_requests_total /
// http_request_duration_seconds (what compass_prometheus_rules.yml's
// recording rules query), plus Compass-specific counters/gauges.
//
// npm install prom-client

import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService {
  public readonly registry: client.Registry;

  public readonly httpRequestsTotal: client.Counter<string>;
  public readonly httpRequestDuration: client.Histogram<string>;

  public readonly incidentsOpenedTotal: client.Counter<string>;
  public readonly incidentsOpenGauge: client.Gauge<string>;
  public readonly layer3CallsTotal: client.Counter<string>;
  public readonly layer3Latency: client.Histogram<string>;
  public readonly soakWindowsOpen: client.Gauge<string>;

  constructor() {
    this.registry = new client.Registry();

    // Optional: default process metrics (event loop lag, heap, fds, etc.)
    client.collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests handled',
      labelNames: ['service', 'method', 'path', 'status'],
      registers: [this.registry],
    });

    // Buckets tuned for a p95 SLO around 1.5s (matches CompassHighP95Latency)
    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['service', 'method', 'path'],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 1.5, 2.5, 5.0, 10.0],
      registers: [this.registry],
    });

    this.incidentsOpenedTotal = new client.Counter({
      name: 'compass_incidents_opened_total',
      help: 'Incidents opened by the Incident Manager',
      labelNames: ['service', 'layer_triggered'],
      registers: [this.registry],
    });

    this.incidentsOpenGauge = new client.Gauge({
      name: 'compass_incidents_open',
      help: 'Currently open incidents',
      labelNames: ['service'],
      registers: [this.registry],
    });

    this.layer3CallsTotal = new client.Counter({
      name: 'compass_layer3_calls_total',
      help: 'Layer 3 model invocations',
      labelNames: ['stage', 'outcome'], // stage=triage|deep_rca, outcome=real_issue|false_alarm|success|error
      registers: [this.registry],
    });

    this.layer3Latency = new client.Histogram({
      name: 'compass_layer3_latency_seconds',
      help: 'Layer 3 model call latency',
      labelNames: ['stage'],
      buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
      registers: [this.registry],
    });

    this.soakWindowsOpen = new client.Gauge({
      name: 'compass_soak_windows_open',
      help: 'Currently open soak windows',
      labelNames: ['service'],
      registers: [this.registry],
    });
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
