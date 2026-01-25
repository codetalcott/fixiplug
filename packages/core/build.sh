#!/bin/bash
# Build script for @fixiplug/core package
# Copies core files and adjusts import paths

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Building @fixiplug/core..."

# Copy core files
cp "$ROOT_DIR/core/hooks.js" "$SCRIPT_DIR/"
cp "$ROOT_DIR/core/fixi-core.js" "$SCRIPT_DIR/"
cp "$ROOT_DIR/core/fixi-dom.js" "$SCRIPT_DIR/"
cp "$ROOT_DIR/builder/fixiplug-factory.js" "$SCRIPT_DIR/"

# Fix import paths in fixiplug-factory.js (was ../core/, now ./)
sed -i '' "s|from '../core/|from './|g" "$SCRIPT_DIR/fixiplug-factory.js"

# Create entry points
cat > "$SCRIPT_DIR/index.js" << 'EOF'
// @fixiplug/core - Minimal plugin framework
// Zero dependencies, ~30KB unminified

export { createFixiplug, FEATURES } from './fixiplug-factory.js';
export { Fixi } from './fixi-core.js';
export {
  on, off, dispatch,
  registerPlugin, unregisterPlugin,
  enablePlugin, disablePlugin,
  registerSkill, unregisterSkill, getSkill, getAllSkills,
  PRIORITY
} from './hooks.js';
EOF

cat > "$SCRIPT_DIR/dom.js" << 'EOF'
// @fixiplug/core/dom - With DOM integration
// Adds MutationObserver, event handling, fx-action elements

import './fixi-dom.js';
export { createFixiplug, FEATURES } from './fixiplug-factory.js';
export { Fixi } from './fixi-core.js';
export {
  on, off, dispatch,
  registerPlugin, unregisterPlugin,
  enablePlugin, disablePlugin,
  registerSkill, unregisterSkill, getSkill, getAllSkills,
  PRIORITY
} from './hooks.js';
EOF

# Get sizes
echo ""
echo "Package contents:"
ls -lh "$SCRIPT_DIR"/*.js | awk '{print $5, $9}'

TOTAL=$(cat "$SCRIPT_DIR"/*.js | wc -c | tr -d ' ')
echo ""
echo "Total size: ${TOTAL} bytes (~$((TOTAL / 1024)) KB)"
echo ""
echo "Done! Run 'npm pack' to create tarball or 'npm publish' to publish."
