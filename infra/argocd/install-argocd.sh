#!/usr/bin/env bash
# Installs Argo CD itself into the EKS cluster. Argo CD is free/OSS --
# the only cost involved anywhere in this repo is the EKS cluster and
# its supporting AWS resources (load balancer, nodes), never the
# software running on top.
set -euo pipefail

kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

echo "Waiting for Argo CD server to be ready..."
kubectl -n argocd rollout status deployment/argocd-server --timeout=180s

echo ""
echo "Getting the initial admin password..."
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
echo ""
echo ""
echo "Log in (in a separate terminal):"
echo "  kubectl -n argocd port-forward svc/argocd-server 8080:443"
echo "  open https://localhost:8080  (username: admin)"
echo ""
echo "Next: kubectl apply -f application-demo-app.yaml -f application-compass-core.yaml"
