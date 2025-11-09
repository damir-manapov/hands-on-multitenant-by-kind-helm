#!/bin/bash

set -euo pipefail

SKIP_RESET="${1:-}"

# Timeout for tenant creation requests (in seconds)
# Helm chart installation can take time, especially with --wait flag
TENANT_CREATION_TIMEOUT=60

echo "=========================================="
echo "Starting Multitenant Demo"
echo "=========================================="
echo ""

# Setup kind cluster (includes ingress controller)
./setup-kind.sh "$SKIP_RESET"

# Build and load API image
echo ""
echo "Building API image..."
./build-api.sh

# Deploy API to Kubernetes
echo ""
echo "Deploying API to Kubernetes..."
# Ensure kubectl context is set correctly
kubectl config use-context kind-multitenant-research 2>/dev/null || true
# Verify kubectl can connect to the cluster
echo "Verifying kubectl connection..."
if ! timeout 5 kubectl cluster-info > /dev/null 2>&1; then
  echo "Error: kubectl cannot connect to the cluster"
  echo "Current context: $(kubectl config current-context 2>/dev/null || echo 'none')"
  echo "Available contexts:"
  kubectl config get-contexts || true
  echo "Attempting to set correct context..."
  kubectl config use-context kind-multitenant-research
  sleep 2
fi
# Wait for API server to be ready
echo "Waiting for Kubernetes API server to be ready..."
for i in {1..30}; do
  if timeout 5 kubectl cluster-info > /dev/null 2>&1; then
    echo "Kubernetes API server is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "Error: Kubernetes API server is not ready after 30 seconds"
    echo "Attempting to apply deployment anyway..."
  fi
  sleep 1
done
timeout 30 kubectl apply -f k8s/api-deployment.yaml --validate=false

echo "Waiting for API deployment to be ready..."
timeout 90 kubectl wait --for=condition=available --timeout=90s deployment/multitenant-api || echo "Warning: API deployment may not be ready yet"

echo "Waiting for ingress to be ready..."
for i in {1..30}; do
  if kubectl get ingress -n default multitenant-api > /dev/null 2>&1; then
    INGRESS_READY=$(kubectl get ingress -n default multitenant-api -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
    if [ -n "$INGRESS_READY" ] || [ "$i" -gt 10 ]; then
      echo "Ingress is ready"
      break
    fi
  fi
  if [ $i -eq 30 ]; then
    echo "Warning: Ingress may not be ready yet"
  fi
  sleep 1
done
# Give ingress a moment to propagate routes
sleep 3

echo "Waiting for API to be ready..."
for i in {1..60}; do
  RESPONSE=$(timeout 5 curl -s http://api.localhost:8080/tenants 2>&1)
  if echo "$RESPONSE" | jq . > /dev/null 2>&1; then
    echo "API is ready!"
    break
  fi
  if echo "$RESPONSE" | grep -q "502\|503\|504"; then
    echo "API pod may still be starting (attempt $i/60)..."
  elif echo "$RESPONSE" | grep -q "404"; then
    echo "Ingress may not be ready yet (attempt $i/60)..."
  fi
  if [ $i -eq 60 ]; then
    echo "Warning: API may not be ready after 2 minutes. Check with: kubectl logs -n default deployment/multitenant-api"
    echo "Checking ingress controller status..."
    kubectl get pods -n ingress-nginx || true
    echo "Checking API pod status..."
    kubectl get pods -n default -l app=multitenant-api || true
  fi
  sleep 2
done

echo ""
echo "Creating tenant 1: acme"
TENANT1_RESPONSE=$(timeout "$TENANT_CREATION_TIMEOUT" curl -s -X POST http://api.localhost:8080/tenants \
  -H "Content-Type: application/json" \
  -d '{"id": "acme", "name": "Acme Corporation"}') || TIMEOUT_EXIT=$?
if [ "${TIMEOUT_EXIT:-0}" -eq 124 ]; then
  echo "❌ Error: Request to create tenant 1 (acme) timed out after ${TENANT_CREATION_TIMEOUT} seconds"
  echo "The API may be slow or the Helm chart installation is taking longer than expected."
  echo "You can check the API logs with: kubectl logs -n default deployment/multitenant-api"
  echo "You can check Helm status with: helm list -n tenant-acme"
  exit 1
fi
if ! echo "$TENANT1_RESPONSE" | jq . > /dev/null 2>&1; then
  echo "❌ Error: Invalid JSON response from API:"
  echo "$TENANT1_RESPONSE"
  exit 1
fi
# Check for error status code
STATUS_CODE=$(echo "$TENANT1_RESPONSE" | jq -r '.statusCode // 201')
if [ "$STATUS_CODE" != "201" ] && [ "$STATUS_CODE" != "200" ]; then
  echo "❌ Error creating tenant 1 (acme):"
  echo "$TENANT1_RESPONSE" | jq .
  echo ""
  echo "Error details:"
  echo "$TENANT1_RESPONSE" | jq -r '.message // "Unknown error"' || echo "$TENANT1_RESPONSE"
  exit 1
fi
echo "$TENANT1_RESPONSE" | jq .

echo ""
echo "Creating tenant 2: globex"
TENANT2_RESPONSE=$(timeout "$TENANT_CREATION_TIMEOUT" curl -s -X POST http://api.localhost:8080/tenants \
  -H "Content-Type: application/json" \
  -d '{"id": "globex", "name": "Globex Corporation"}') || TIMEOUT_EXIT=$?
if [ "${TIMEOUT_EXIT:-0}" -eq 124 ]; then
  echo "❌ Error: Request to create tenant 2 (globex) timed out after ${TENANT_CREATION_TIMEOUT} seconds"
  echo "The API may be slow or the Helm chart installation is taking longer than expected."
  echo "You can check the API logs with: kubectl logs -n default deployment/multitenant-api"
  echo "You can check Helm status with: helm list -n tenant-globex"
  exit 1
fi
if ! echo "$TENANT2_RESPONSE" | jq . > /dev/null 2>&1; then
  echo "❌ Error: Invalid JSON response from API:"
  echo "$TENANT2_RESPONSE"
  exit 1
fi
# Check for error status code
STATUS_CODE=$(echo "$TENANT2_RESPONSE" | jq -r '.statusCode // 201')
if [ "$STATUS_CODE" != "201" ] && [ "$STATUS_CODE" != "200" ]; then
  echo "❌ Error creating tenant 2 (globex):"
  echo "$TENANT2_RESPONSE" | jq .
  echo ""
  echo "Error details:"
  echo "$TENANT2_RESPONSE" | jq -r '.message // "Unknown error"' || echo "$TENANT2_RESPONSE"
  exit 1
fi
echo "$TENANT2_RESPONSE" | jq .

echo ""
echo "Waiting for instances to be ready..."
echo "Checking pod status..."
for i in {1..60}; do
  ACME_READY=$(timeout 5 kubectl get pods -n tenant-acme -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "Pending")
  GLOBEX_READY=$(timeout 5 kubectl get pods -n tenant-globex -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "Pending")
  if [ "$ACME_READY" = "Running" ] && [ "$GLOBEX_READY" = "Running" ]; then
    echo "Pods are running!"
    break
  fi
  if [ $i -eq 60 ]; then
    echo "Warning: Pods may not be ready yet. Check with: kubectl get pods -n tenant-acme"
  fi
  sleep 2
done

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""

# Wait a moment for ingress to be ready
echo "Waiting for ingress to be ready..."
sleep 5

echo ""
echo "Checking /etc/hosts configuration..."

# Check if /etc/hosts has the required entries
HOSTS_OK=true
if ! grep -q "127.0.0.1.*api.localhost" /etc/hosts 2>/dev/null; then
  echo "  ⚠️  Missing: api.localhost"
  HOSTS_OK=false
fi

if ! grep -q "127.0.0.1.*acme.localhost" /etc/hosts 2>/dev/null; then
  echo "  ⚠️  Missing: acme.localhost"
  HOSTS_OK=false
fi

if ! grep -q "127.0.0.1.*globex.localhost" /etc/hosts 2>/dev/null; then
  echo "  ⚠️  Missing: globex.localhost"
  HOSTS_OK=false
fi

if [ "$HOSTS_OK" = true ]; then
  echo "  ✅ /etc/hosts is configured correctly"
else
  echo ""
  echo "  ❌ /etc/hosts is missing required entries"
  echo ""
  echo "  Please add the following to /etc/hosts:"
  echo "    127.0.0.1 api.localhost"
  echo "    127.0.0.1 acme.localhost"
  echo "    127.0.0.1 globex.localhost"
  echo ""
  echo "  You can do this with:"
  echo "    sudo bash -c 'echo \"127.0.0.1 api.localhost\" >> /etc/hosts'"
  echo "    sudo bash -c 'echo \"127.0.0.1 acme.localhost\" >> /etc/hosts'"
  echo "    sudo bash -c 'echo \"127.0.0.1 globex.localhost\" >> /etc/hosts'"
  echo ""
  echo "  Or edit /etc/hosts manually and add the entries above."
fi

echo ""
echo "✅ API and tenants are accessible via subdomains:"
echo ""
echo "  - API: http://api.localhost:8080"
echo "  - Acme tenant: http://acme.localhost:8080/"
echo "  - Globex tenant: http://globex.localhost:8080/"
echo ""
echo "Test with curl:"
echo "  curl http://api.localhost:8080/tenants"
echo "  curl http://acme.localhost:8080/"
echo "  curl http://globex.localhost:8080/"
echo ""
echo "API endpoints:"
echo "  - List tenants: curl http://api.localhost:8080/tenants"
echo "  - Get tenant: curl http://api.localhost:8080/tenants/acme"
echo ""
echo "To view API logs:"
echo "  kubectl logs -n default deployment/multitenant-api"
echo ""
echo "To delete API deployment:"
echo "  kubectl delete -f k8s/api-deployment.yaml"


