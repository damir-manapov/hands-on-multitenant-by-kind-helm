#!/bin/bash

set -euo pipefail

echo "=========================================="
echo "MAIN APP CHECKS"
echo "=========================================="
echo ""

echo "Formatting code with Prettier..."
pnpm format

echo ""
echo "Running ESLint..."
pnpm lint

echo ""
echo "Checking for secret leaks with gitleaks..."
if ! command -v gitleaks &> /dev/null; then
  echo "Error: gitleaks not found in PATH"
  echo "Please install gitleaks: https://github.com/gitleaks/gitleaks#installation"
  exit 1
fi
gitleaks detect --source . --verbose --no-banner

echo ""
echo "Running TypeScript type check (no emit)..."
pnpm type-check

echo ""
echo "=========================================="
echo "All checks passed"
echo "=========================================="

