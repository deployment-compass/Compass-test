# Compass — Kubernetes manifests

Kustomize-based translation of the Compose stack. Layout:

```
k8s-compass/
├── namespace.yaml
├── prometheus.yaml        # PVC + Deployment + Service
├── loki.yaml               # PVC + Deployment + Service
├── alertmanager.yaml
├── server.yaml
├── compass.yaml
├── redis.yaml
├── rabbitmq.yaml
├── cadvisor-daemonset.yaml
├── node-exporter-daemonset.yaml
└── kustomization.yaml
```

## 1. Build and push the two custom images

Compose built these from local Dockerfiles — Kubernetes can't do that, so they
need to be built and pushed to a registry your cluster can pull from first:

```bash
docker build -t <registry>/compass-server:latest .
docker push <registry>/compass-server:latest

docker build -t <registry>/compass:latest ./compass
docker push <registry>/compass:latest
```

Then either edit `server.yaml` / `compass.yaml` directly, or uncomment the
`images:` block at the bottom of `kustomization.yaml` and run
`kustomize edit set image your-registry/compass-server=<registry>/compass-server:v1`.

## 2. Wire up your real monitoring config

`kustomization.yaml` generates the Prometheus/Loki/Alertmanager ConfigMaps
straight from files, the same way you already have them locally. Copy your
`./monitoring/` folder next to `kustomization.yaml` (same relative paths used
in the compose file), then:

```bash
kubectl apply -k .
```

## 3. Private registry images (dhi.io)

`prometheus`, `redis`, and `rabbitmq` pull from `dhi.io` (Docker Hardened
Images), which is typically a private/authenticated registry. If your cluster
isn't already authorized, create a pull secret and add
`imagePullSecrets:` to each of those three Deployments' `spec.template.spec`:

```bash
kubectl create secret docker-registry dhi-creds \
  --docker-server=dhi.io --docker-username=... --docker-password=... \
  -n compass
```

## Notes on what changed vs. the Compose file

- **`depends_on` has no equivalent.** Kubernetes doesn't sequence container
  startup. `server` and `compass` will start immediately even if `loki`,
  `redis`, or `rabbitmq` aren't ready yet — their apps need to retry/backoff
  on connection failure, or you add an `initContainer` that polls the
  dependency before the main container starts.
- **`cadvisor` and `node-exporter` became DaemonSets, not Deployments.**
  They scrape host-level metrics (cgroups, disk, `/proc`), so they need to
  run on *every* node, not just wherever the scheduler happens to place a
  single replica. `node-exporter` also uses `hostNetwork`/`hostPID`, and
  `cadvisor` stays `privileged: true` — check that your cluster's Pod
  Security admission level allows privileged pods in the `compass`
  namespace, or put these in their own namespace with a looser policy.
- **Alertmanager config path bug fixed.** The original compose mounted
  `alertmanager.yml` to `/etc/alertmanager.yml`, but the command pointed at
  `/etc/alertmanager/alertmanager.yml` — those don't match, so the original
  container likely fell back to defaults. Fixed here via `subPath`.
- **`develop.watch` (compass hot-rebuild) has no k8s equivalent** — that's a
  Compose dev-mode feature. For live-reload against a cluster, look at a
  tool like Skaffold or Tilt instead.
- **Service names double as DNS hostnames**, so `redis://redis:6379/0` and
  `amqp://guest:guest@rabbitmq:5672/` in `compass.yaml`'s env vars keep
  working unchanged — no compose-to-k8s translation needed there.
- **Storage**: `prom_data` and `loki-data` became PVCs (10Gi default, no
  `storageClassName` set — uses your cluster's default). Bump the size or
  set a class as needed.

## Production alternative worth considering

Hand-writing Prometheus/Alertmanager/node-exporter manifests works but is a
lot to maintain yourself. If this is going into a real cluster long-term,
the **kube-prometheus-stack** and **loki-stack** Helm charts cover this same
footprint (plus CRDs, dashboards, and upgrades) with far less YAML to own.
