#!/bin/bash
# Build script for @fixiplug/agent-sdk package
# Copies SDK files and adjusts import paths

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Building @fixiplug/agent-sdk..."

# Copy SDK files
cp "$ROOT_DIR/sdk/agent-client.js" "$SCRIPT_DIR/"
cp "$ROOT_DIR/sdk/workflow-builder.js" "$SCRIPT_DIR/"
cp "$ROOT_DIR/sdk/types.d.ts" "$SCRIPT_DIR/"

# Copy adapters
mkdir -p "$SCRIPT_DIR/adapters"
cp "$ROOT_DIR/sdk/adapters/base-adapter.js" "$SCRIPT_DIR/adapters/"
cp "$ROOT_DIR/sdk/adapters/openai-adapter.js" "$SCRIPT_DIR/adapters/"
cp "$ROOT_DIR/sdk/adapters/anthropic-adapter.js" "$SCRIPT_DIR/adapters/"
cp "$ROOT_DIR/sdk/adapters/tool-definitions.js" "$SCRIPT_DIR/adapters/"

# Fix import paths (adapters reference ../agent-client -> ../agent-client)
# These are already relative within sdk/, so paths should be correct

# Get sizes
echo ""
echo "Package contents:"
find "$SCRIPT_DIR" -name "*.js" -exec ls -lh {} \; | awk '{print $5, $9}'

TOTAL=$(find "$SCRIPT_DIR" -name "*.js" -exec cat {} + | wc -c | tr -d ' ')
echo ""
echo "Total size: ${TOTAL} bytes (~$((TOTAL / 1024)) KB)"
echo ""
echo "Done! Run 'npm pack' to create tarball or 'npm publish' to publish."
