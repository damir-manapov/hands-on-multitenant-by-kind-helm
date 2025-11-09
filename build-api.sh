#!/bin/bash

set -euo pipefail

echo "Building multitenant-api Docker image..."
docker build -t multitenant-api:latest .

echo "Loading image into kind cluster..."
kind load docker-image multitenant-api:latest --name multitenant-research

echo "API image built and loaded successfully"

