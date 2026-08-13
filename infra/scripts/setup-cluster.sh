#!/usr/bin/env bash
# Creates a local, free Kubernetes cluster using kind.
# Prereqs: docker, kind, kubectl, helm (all free, installable via brew/apt).
set -euo pipefail

CLUSTER_NAME="compass-demo"

if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
  echo "Cluster '${CLUSTER_NAME}' already exists. Skipping creation."
else
  echo "Creating kind cluster '${CLUSTER_NAME}'..."
  kind create cluster --name "${CLUSTER_NAME}" --config ../kind-config.yaml
fi

kubectl cluster-info --context "kind-${CLUSTER_NAME}"
echo "Cluster ready."
