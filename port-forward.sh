#!/bin/bash

set -euo pipefail

TENANT="${1:-acme}"
PORT="${2:-9090}"

if [ "$TENANT" = "acme" ]; then
  PORT=9090
elif [ "$TENANT" = "globex" ]; then
  PORT=9091
fi

echo "Setting up port forwarding for tenant: $TENANT"
echo "Forwarding port $PORT to service $TENANT in namespace tenant-$TENANT"
echo ""
echo "Press Ctrl+C to stop port forwarding"
echo ""

kubectl port-forward -n "tenant-$TENANT" service/"$TENANT" "$PORT:9090"

