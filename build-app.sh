#!/bin/bash

set -euo pipefail

echo "Building tenant-app Docker image..."
cd app
docker build -t tenant-app:latest .

echo "Loading image into kind cluster..."
kind load docker-image tenant-app:latest --name multitenant-research

echo "Tenant app image built and loaded successfully"

