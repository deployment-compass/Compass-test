#!/usr/bin/env bash
# Trigger a training run on the Compass API

set -euo pipefail

API_URL="http://localhost:8000/training/trigger"

echo "Triggering training pipeline via Compass API..."
echo "Target: ${API_URL}"

curl -X POST -s -w "\nHTTP Status: %{http_code}\n" "${API_URL}"

echo "Done."
