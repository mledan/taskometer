#!/usr/bin/env bash
#
# Phase 2 — provision the 6 Cosmos containers the v2 API uses.
#
# Run once. Idempotent: re-running just verifies each container exists
# (Cosmos returns the existing one if you call create twice).
#
# Prereqs:
#   - az cli, logged in (`az login`)
#   - The Cosmos account from SETUP.md §5b already exists
#   - You know your account name + resource group (set below)
#
# Usage:
#   COSMOS_NAME=taskometer-comments-mle \
#   COSMOS_RG=taskometer-comments-rg \
#   bash scripts/setup-cosmos-v2.sh
#
# After running:
#   - The existing COSMOS_ENDPOINT / COSMOS_KEY / COSMOS_DATABASE
#     env vars in Vercel already point at the right account, so
#     nothing to add — the v2 dispatcher picks up Cosmos automatically.

set -euo pipefail

: "${COSMOS_NAME:?Set COSMOS_NAME (e.g. taskometer-comments-mle)}"
: "${COSMOS_RG:?Set COSMOS_RG (e.g. taskometer-comments-rg)}"
COSMOS_DB="${COSMOS_DB:-taskometer}"

CONTAINERS=(
  "blocks"
  "recurring-blocks"
  "routines"
  "tasks"
  "day-assignments"
  "exceptions"
)

echo "Provisioning v2 containers in ${COSMOS_NAME}/${COSMOS_DB}…"

for name in "${CONTAINERS[@]}"; do
  echo "  • ${name} (partition key /ownerId)"
  az cosmosdb sql container create \
    --account-name  "$COSMOS_NAME" \
    --resource-group "$COSMOS_RG" \
    --database-name "$COSMOS_DB" \
    --name "$name" \
    --partition-key-path /ownerId \
    --output none
done

echo
echo "✓ All 6 containers ready in ${COSMOS_DB}:"
az cosmosdb sql container list \
  --account-name "$COSMOS_NAME" \
  --resource-group "$COSMOS_RG" \
  --database-name "$COSMOS_DB" \
  --query "[].name" -o tsv
