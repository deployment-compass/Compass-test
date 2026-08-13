#!/usr/bin/env bash
# Builds the compass orchestrator image and loads it into the kind
# cluster, same pattern as build-demo-app.sh. Only needed if you're
# running compass IN-cluster (infra/compass-core/deployment.yaml) --
# for local development, just run `uvicorn app.main:app --reload`
# directly per docs/setup.md.
set -euo pipefail

CLUSTER_NAME="compass-demo"
IMAGE_TAG="compass-core:local"

echo "Building ${IMAGE_TAG}..."
docker build -t "${IMAGE_TAG}" ../../core

echo "Loading image into kind cluster '${CLUSTER_NAME}'..."
kind load docker-image "${IMAGE_TAG}" --name "${CLUSTER_NAME}"

echo "Done. Next steps:"
echo "  1. Create the secret:"
echo "     kubectl create secret generic compass-core-secrets \\"
echo "       --from-literal=ANTHROPIC_API_KEY=sk-ant-your-real-key \\"
echo "       --dry-run=client -o yaml | kubectl apply -f -"
echo "  2. Deploy: kubectl apply -f ../compass-core/deployment.yaml"
