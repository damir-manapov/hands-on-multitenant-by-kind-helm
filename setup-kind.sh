#!/bin/bash

set -euo pipefail

SKIP_RESET="${1:-}"

echo "=========================================="
echo "Setting up kind cluster"
echo "=========================================="
echo ""

# Handle cluster reset (default behavior)
if [ "$SKIP_RESET" = "--no-reset" ] || [ "$SKIP_RESET" = "-n" ]; then
  if ! kind get clusters | grep -q "multitenant-research"; then
    echo "Creating kind cluster..."
    kind create cluster --config kind-config.yaml
  else
    echo "Kind cluster already exists"
    echo "  (Use './setup-kind.sh' without flags to reset the cluster)"
    exit 0
  fi
else
  echo "Resetting kind cluster..."
  if kind get clusters | grep -q "multitenant-research"; then
    kind delete cluster --name multitenant-research
    echo "Cluster deleted"
  fi
  echo "Creating new kind cluster..."
  kind create cluster --config kind-config.yaml
fi

# Install nginx-ingress controller
echo ""
echo "Installing nginx-ingress controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
echo "Waiting for ingress controller to be ready..."
for i in {1..30}; do
  if kubectl wait --namespace ingress-nginx \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/component=controller \
    --timeout=10s > /dev/null 2>&1; then
    echo "Ingress controller is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "Warning: Ingress controller may not be ready yet"
  fi
  sleep 2
done
# Give ingress controller a moment to fully initialize
echo "Waiting for ingress controller to fully initialize..."
sleep 5

echo ""
echo "=========================================="
echo "Kind cluster setup complete"
echo "=========================================="

