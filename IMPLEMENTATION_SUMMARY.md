"""
COMPASS OBSERVABILITY LAYER - IMPLEMENTATION SUMMARY

This document summarizes the minimal set of changes made to support both
local (Node Exporter) and Kubernetes environments without duplicating code
or creating separate architecture paths.
"""

# ============================================================================

# CHANGES MADE

# ============================================================================

PHASE 1: EXTENDED DATA MODELS (prom_models.py)
==============================================

1. LabelSchema (added K8s-optional labels):
   - namespace_label: Optional[str] = None
   - pod_label: Optional[str] = None
   - container_label: Optional[str] = None

   These fields are None in local/Node Exporter environments and populated
   in Kubernetes environments. No breaking changes — all fields are optional.

2. MetricSample (added K8s enrichment):
   - namespace: Optional[str] = None
   - pod: Optional[str] = None
   - container: Optional[str] = None

   When PrometheusAdaptor collects metrics, it extracts these labels from
   the Prometheus response and includes them in the sample. Downstream code
   can use these for detailed debugging, but it's optional.

3. MetricsContext (NEW):
   A clean, normalized schema for the anomaly-detection model:
   - service: str (primary identity)
   - environment: str (deployment environment)
   - request_rate, error_rate, p95_latency, cpu_usage, memory_usage: Optional[float]
   - namespace, pod, container: Optional[str] (K8s enrichment)
   - architecture: ArchitectureMode (MONOLITH vs MICROSERVICE)
   - collected_at: datetime

   This is what Layer 3 (AI reasoning) consumes. By separating from
   PrometheusAdaptor's internal MetricSample structure, we can iterate
   on discovery without breaking downstream code.

PHASE 2: EXTENDED DISCOVERY (prom_label_discovery.py)
=====================================================

1. Added K8s label candidate lists:
   - _K8S_NAMESPACE_LABEL_CANDIDATES = ["namespace", "kube_namespace"]
   - _K8S_POD_LABEL_CANDIDATES = ["pod", "pod_name", "kube_pod"]
   - _K8S_CONTAINER_LABEL_CANDIDATES = ["container", "container_name"]

2. Extended LabelDiscovery.discover() to probe for K8s labels:
   - namespace_label = await self._first_populated_label(_K8S_NAMESPACE_LABEL_CANDIDATES)
   - pod_label = await self._first_populated_label(_K8S_POD_LABEL_CANDIDATES)
   - container_label = await self._first_populated_label(_K8S_CONTAINER_LABEL_CANDIDATES)

   These are optional — if not found, they're None. No performance impact in
   non-K8s environments (just a few extra label queries that return empty).

3. Updated schema construction to include K8s labels.

Impact: Non-breaking. Local Docker Compose users won't even notice these
fields are in the schema — they'll just be None.

PHASE 3: ADAPTER ENHANCEMENTS (prometheous.py)
==============================================

1. Updated _collect_one() to pass schema to _run_instant_vector().

2. Updated _run_instant_vector() to extract K8s labels:
   - namespace = labels.get(schema.namespace_label) if schema.namespace_label else None
   - pod = labels.get(schema.pod_label) if schema.pod_label else None
   - container = labels.get(schema.container_label) if schema.container_label else None

   Then includes these in each MetricSample.

3. No changes to public interface (query() signature unchanged).
   Internal metrics (MetricSample) now carry K8s context when available.

Impact: PrometheusAdaptor.query() still returns dict[str, Optional[float]].
Downstream code that only uses query() is unaffected. Code that calls
collect() or accesses MetricSample gets the bonus K8s enrichment.

PHASE 4: NEW - CONTEXT BUILDER (context_builder.py)
==================================================

A new module that orchestrates metrics + logs collection for Layer 3.

Key responsibilities:

- Takes PrometheusAdaptor + LokiAdaptor as dependencies (dependency injection)
- Calls prometheus.query(service, environment, window_seconds)
- Calls loki.query(service, environment, window_seconds) if available
- Normalizes metrics into MetricsContext
- Returns BuilderResult with metrics + logs + error flags

Public interface:
async def build(service, environment, window_seconds) -> BuilderResult
async def build_with_k8s_enrichment(service, environment, window_seconds) -> BuilderResult

This is the module Layer 3 should call to get all the context it needs for
the anomaly-detection model.

Impact: New module, no impact on existing code. Used by Layer 3 when
building context for the AI reasoning step.

PHASE 5: DOCUMENTATION & EXAMPLES
=================================

Created three new files:

1. compass/docs/observability_architecture.md
   - Comprehensive design document
   - Explains how discovery works in both environments
   - Shows example PromQL queries for each environment
   - Includes migration path from local to Kubernetes

2. compass/src/compass/ingestion/examples_environment_flexibility.py
   - Runnable examples for:
     - Local Node Exporter (Docker Compose)
     - Kubernetes cluster
     - Using ContextBuilder in both environments
   - Shows how the same code adapts to different environments

3. compass/test_observability_architecture.py
   - Unit tests for discovery in both environments
   - Tests for MetricsContext normalization
   - Tests for ContextBuilder orchestration
   - Demonstrates correct behavior end-to-end

# ============================================================================

# HOW IT WORKS

# ============================================================================

LOCAL DOCKER COMPOSE (Node Exporter):

1. LabelDiscovery probes Prometheus
2. Finds: process_cpu_seconds_total (not container_*), no K8s labels
3. Sets: architecture=MONOLITH, cpu_metric="process_cpu_seconds_total", namespace_label=None
4. PrometheusAdaptor.query() builds PromQL without container filters
5. MetricsContext has: service, environment, metrics, NO namespace/pod/container
6. Layer 3 receives: generic metrics only

KUBERNETES:

1. LabelDiscovery probes Prometheus
2. Finds: container_cpu_usage_seconds_total, namespace/pod labels populated
3. Sets: architecture=MICROSERVICE, cpu_metric="container_cpu_usage_seconds_total", namespace_label="namespace"
4. PrometheusAdaptor.query() builds PromQL with container filters + K8s matchers
5. MetricsContext has: service, environment, metrics, PLUS namespace/pod/container
6. Layer 3 receives: metrics + K8s enrichment

SAME CODE RUNS IN BOTH CASES. No branching, no environment checks.

# ============================================================================

# BACKWARD COMPATIBILITY

# ============================================================================

✓ No breaking changes to existing public interfaces
✓ PrometheusAdaptor.query() returns same shape (dict[str, Optional[float]])
✓ PrometheusAdaptor.collect() enhanced (added optional K8s fields to MetricSample)
✓ ContextBuilder is new (doesn't affect existing code)
✓ LabelSchema is extended with optional fields (no impact if not used)

Existing code that calls query() will continue to work unchanged.
Code that needs K8s enrichment can use collect() or ContextBuilder.build().

# ============================================================================

# DESIGN PRINCIPLES HONORED

# ============================================================================

1. ✓ Single adaptor for all environments
   - PrometheusAdaptor works with Node Exporter, Docker Compose, Kubernetes

2. ✓ No separate adapters for Monolith vs Microservices
   - Discovery determines architecture; adaptor adapts queries

3. ✓ No separate CPU/Memory adapters for Docker/VM/Kubernetes
   - PromQLBuilder generates correct queries based on discovered metrics

4. ✓ Service/environment as primary identity
   - K8s context (namespace, pod, container) is optional enrichment only

5. ✓ Configuration/discovery over hardcoded assumptions
   - LabelDiscovery probes Prometheus to find what's actually available

6. ✓ Keep existing PrometheusAdaptor simple
   - No new complexity; just optional K8s fields

7. ✓ Normalize collected data for anomaly-detection model
   - MetricsContext provides clean, environment-agnostic schema for Layer 3

8. ✓ Separate K8s signals from generic metrics
   - PrometheusAdaptor: CPU, memory, latency, errors
   - KubernetesAdaptor: pod status, rollout progress, restarts
   - LokiAdaptor: logs

9. ✓ Preserve current public interfaces
   - PrometheusAdaptor.query() unchanged
   - LokiAdaptor unchanged

10. ✓ Ready for Kubernetes later without rework
    - K8s labels already discovered and available
    - KubernetesAdaptor can be enabled independently

# ============================================================================

# TESTING

# ============================================================================

Run tests with:
pytest compass/test_observability_architecture.py -v

Tests cover:

- LabelDiscovery for Node Exporter (finds process_* metrics)
- LabelDiscovery for Kubernetes (finds container_* metrics + K8s labels)
- PrometheusAdaptor.query() in local environment
- MetricsContext creation with/without K8s enrichment
- ContextBuilder in both environments

# ============================================================================

# NEXT STEPS

# ============================================================================

1. Integration
   - Wire ContextBuilder into Layer 3 code (the AI reasoning step)
   - Layer 3 calls: result = await builder.build(service, environment)
   - Passes result.metrics to the anomaly-detection model
   - Uses result.log_lines for additional context

2. Kubernetes enablement (when ready)
   - Deploy KubernetesAdaptor to watch pod events
   - Layer 3 receives K8s signals (CrashLoopBackOff, OOMKilled, restarts)
   - Correlates with metrics for root-cause analysis
   - No changes to PrometheusAdaptor or ContextBuilder needed

3. Production hardening
   - Add configuration for recording rule overrides (already supported via RecordingRuleResolver)
   - Monitor discovery performance (cached with TTL, should be fine)
   - Add observability/logging to ContextBuilder failures

4. Dashboard/CLI
   - Use adaptor.collect() to fetch all services at once
   - Populate monitoring dashboards showing architecture detection
   - Show K8s context when available

# ============================================================================

# SUMMARY

# ============================================================================

Compass observability layer is now flexible enough to work seamlessly with:

✓ Local Node Exporter (Docker Compose, bare metal, VM)
✓ Kubernetes with container metrics + K8s labels
✓ Hybrid deployments (mix of VM and K8s)

No code branching, no separate adapters, no environment configuration needed.
Just deploy Prometheus with the appropriate metrics and discovery does the rest.

Layer 3 (AI reasoning) consumes a clean MetricsContext schema that works
identically in all environments, with optional K8s enrichment when available.
