#!/bin/bash
# Build script for @fixiplug/core package
# Copies core files, bundled plugins, and adjusts import paths

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
sed -i "s|from '../core/|from './|g" "$SCRIPT_DIR/fixiplug-factory.js"
# Fix plugin import paths (static and dynamic)
sed -i "s|from '../plugins/|from './plugins/|g" "$SCRIPT_DIR/fixiplug-factory.js"
sed -i "s|import('../plugins/|import('./plugins/|g" "$SCRIPT_DIR/fixiplug-factory.js"

# Copy bundled plugins
mkdir -p "$SCRIPT_DIR/plugins"
CORE_PLUGINS=(
  logger
  hook-visualizer
  performance
  security
  error-reporter
  testing
  offline
  data-pipeline
  content-modifier
  swap-idiomorph
  swap-morphlex
)

for plugin in "${CORE_PLUGINS[@]}"; do
  cp "$ROOT_DIR/plugins/${plugin}.js" "$SCRIPT_DIR/plugins/"
done

echo "Copied ${#CORE_PLUGINS[@]} bundled plugins"

# Create entry points
cat > "$SCRIPT_DIR/index.js" << 'EOF'
// @fixiplug/core - Minimal plugin framework
// Zero dependencies, ~30KB unminified

export { createFixiplug, FEATURES, FEATURE_SETS } from './fixiplug-factory.js';
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
export { createFixiplug, FEATURES, FEATURE_SETS } from './fixiplug-factory.js';
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
find "$SCRIPT_DIR" -name "*.js" -exec ls -lh {} \; | awk '{print $5, $9}'

TOTAL=$(find "$SCRIPT_DIR" -name "*.js" -exec cat {} + | wc -c | tr -d ' ')
echo ""
echo "Total size: ${TOTAL} bytes (~$((TOTAL / 1024)) KB)"
echo ""
echo "Done! Run 'npm pack' to create tarball or 'npm publish' to publish."
