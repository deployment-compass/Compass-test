#!/usr/bin/env bash
# Builds the demo app image locally and loads it directly into the kind
# cluster's node -- no registry (Docker Hub/ECR/GCR) needed, so this is
# completely free and works offline once the base image is cached.
set -euo pipefail

CLUSTER_NAME="compass-demo"
IMAGE_TAG="demo-app:local"

echo "Building ${IMAGE_TAG}..."
docker build -t "${IMAGE_TAG}" ../demo-app/app

echo "Loading image into kind cluster '${CLUSTER_NAME}'..."
kind load docker-image "${IMAGE_TAG}" --name "${CLUSTER_NAME}"

echo "Done. Deploy with: kubectl apply -f ../demo-app/rollout.yaml -f ../demo-app/servicemonitor.yaml"
