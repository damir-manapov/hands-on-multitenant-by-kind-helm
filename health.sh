#!/bin/bash

set -euo pipefail

echo "=========================================="
echo "MAIN APP HEALTH CHECK"
echo "=========================================="
echo ""

echo "Checking for vulnerabilities in packages (moderate severity and above)..."
AUDIT_OUTPUT=$(timeout 30 pnpm audit --audit-level=moderate 2>&1)
AUDIT_EXIT=$?
echo "$AUDIT_OUTPUT"
if [ $AUDIT_EXIT -eq 124 ]; then
  echo ""
  echo "Error: Audit check timed out after 30 seconds"
  exit 1
fi
if [ $AUDIT_EXIT -ne 0 ] && [ $AUDIT_EXIT -ne 124 ]; then
  echo ""
  echo "Error: Failed to check vulnerabilities (exit code: $AUDIT_EXIT)"
  exit 1
fi
if echo "$AUDIT_OUTPUT" | grep -q "No known vulnerabilities found"; then
  echo ""
  echo "Summary: No vulnerabilities found."
else
  echo ""
  echo "Summary: Vulnerabilities detected. Run 'pnpm audit --fix' to attempt automatic fixes."
  VULNERABILITIES_FOUND=1
fi

echo ""
echo "Checking for outdated dependencies..."
set +e
OUTDATED_OUTPUT=$(timeout 30 pnpm outdated 2>&1)
OUTDATED_EXIT=$?
set -e
if [ $OUTDATED_EXIT -eq 124 ]; then
  echo "Error: Outdated check timed out after 30 seconds"
  exit 1
fi
echo "$OUTDATED_OUTPUT"
# pnpm outdated returns 1 when outdated packages are found (not an error)
# Exit code 0 means all up to date, 1 means outdated found, other codes are errors
if [ $OUTDATED_EXIT -ne 0 ] && [ $OUTDATED_EXIT -ne 1 ] && [ $OUTDATED_EXIT -ne 124 ]; then
  echo ""
  echo "Error: Failed to check outdated dependencies (exit code: $OUTDATED_EXIT)"
  exit 1
fi
if echo "$OUTDATED_OUTPUT" | grep -q "Package.*Current.*Latest" || [ $OUTDATED_EXIT -eq 1 ]; then
  OUTDATED_COUNT=$(echo "$OUTDATED_OUTPUT" | grep -E "^\s+\w|│\s+\w" | grep -v "Package\|Current\|Latest\|─" | wc -l)
  echo ""
  echo "Summary: Found $OUTDATED_COUNT outdated package(s)."
  echo "  Run 'pnpm update' to update all packages, or"
  echo "  run 'pnpm update <package-name>' to update specific packages."
  OUTDATED_FOUND=1
else
  echo ""
  echo "Summary: All dependencies are up to date."
fi

echo ""
echo "=========================================="
if [ "${VULNERABILITIES_FOUND:-0}" -eq 1 ] || [ "${OUTDATED_FOUND:-0}" -eq 1 ]; then
  echo "HEALTH CHECK FAILED"
  echo "=========================================="
  echo ""
  echo "Issues found:"
  [ "${VULNERABILITIES_FOUND:-0}" -eq 1 ] && echo "  - Vulnerabilities in main app"
  [ "${OUTDATED_FOUND:-0}" -eq 1 ] && echo "  - Outdated packages in main app"
  exit 1
else
  echo "HEALTH CHECK PASSED"
  echo "=========================================="
  exit 0
fi

