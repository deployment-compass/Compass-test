#!/usr/bin/env bash
# Installs Prometheus + Grafana + Loki into the cluster. All free/OSS.
set -euo pipefail

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
helm repo add grafana https://grafana.github.io/helm-charts >/dev/null 2>&1 || true
helm repo update

kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

echo "Installing kube-prometheus-stack (Prometheus + Grafana + Alertmanager)..."
# serviceMonitorSelectorNilUsesHelmValues=false is the key setting here:
# by default kube-prometheus-stack's Prometheus instance ONLY scrapes
# ServiceMonitor objects that carry its own Helm release label. Setting
# this to false tells it to pick up ANY ServiceMonitor in the cluster --
# which is what lets it discover infra/demo-app/servicemonitor.yaml
# without needing exact release-label matching. Fine for a single-team
# demo cluster; in a shared/multi-tenant cluster you'd leave this true
# and label your ServiceMonitors to match instead.
helm upgrade --install kube-prometheus prometheus-community/kube-prometheus-stack \
  -n monitoring \
  --set grafana.adminPassword=admin \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false \
  --wait

echo "Installing Loki (log aggregation)..."
helm upgrade --install loki grafana/loki-stack -n monitoring --wait

echo "Wiring Grafana to Loki + loading the demo-app dashboard..."
# These ConfigMaps are picked up automatically by Grafana's built-in
# sidecar (enabled by default in kube-prometheus-stack) -- no manual
# clicking through the Grafana UI required.
kubectl apply -f ../monitoring/grafana-datasource-loki.yaml
kubectl apply -f ../monitoring/dashboard-configmap.yaml

echo ""
echo "Monitoring stack installed: Prometheus + Grafana + Loki, all connected."
echo "Port-forward Prometheus:  kubectl -n monitoring port-forward svc/kube-prometheus-kube-prome-prometheus 9090:9090"
echo "Port-forward Grafana:     kubectl -n monitoring port-forward svc/kube-prometheus-grafana 3000:80  (user: admin / pass: admin)"
echo "Port-forward Loki:        kubectl -n monitoring port-forward svc/loki 3100:3100"
echo ""
echo "Open Grafana at http://localhost:3000 -> Dashboards -> 'compass — demo-app'"
