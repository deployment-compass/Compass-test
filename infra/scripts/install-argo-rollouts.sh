#!/usr/bin/env bash
# Installs the Argo Rollouts controller (free, OSS) for canary deployments.
set -euo pipefail

kubectl create namespace argo-rollouts --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

echo "Waiting for Argo Rollouts controller to be ready..."
kubectl -n argo-rollouts rollout status deployment/argo-rollouts-controller-manager --timeout=120s

echo ""
echo "Argo Rollouts installed. Optional: install the kubectl plugin for a nicer CLI:"
echo "  brew install argoproj/tap/kubectl-argo-rollouts"
