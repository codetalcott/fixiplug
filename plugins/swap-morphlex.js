/**
 * Morphlex Swap Plugin for Fixiplug
 * Experimental plugin using Morphlex library as idiomorph alternative
 * @module plugins/swap-morphlex
 */

/**
 * Creates a morphlex swap plugin with idiomorph-compatible API
 * @param {Object} [options] - Configuration options (idiomorph-compatible)
 * @returns {Object} Plugin instance
 */
export default function createMorphlexSwap(options = {}) {
  // Default configuration (idiomorph-style)
  const config = {
    morphStyle: 'innerHTML',
    ignoreActiveValue: true,
    morphCallbacks: {},
    ...options
  };

  /**
   * Adapter to translate idiomorph API to morphlex API
   * @param {HTMLElement} existingNode - Target element
   * @param {HTMLElement} newNode - New content element
   * @param {Object} idiomorphConfig - Idiomorph-style configuration
   * @param {Function} morphFn - The morphlex morph function
   */
  function idiomorphToMorphlexAdapter(existingNode, newNode, idiomorphConfig, morphFn) {
    // Map idiomorph options to morphlex options
    const morphlexOptions = {
      // Map ignoreActiveValue to preserveChanges
      preserveChanges: idiomorphConfig.ignoreActiveValue || false,

      // Map callbacks
      beforeNodeAdded: (node) => {
        if (idiomorphConfig.morphCallbacks?.beforeNodeAdded) {
          return idiomorphConfig.morphCallbacks.beforeNodeAdded(node);
        }
        return true;
      },

      afterNodeVisited: (oldNode, newNode) => {
        if (idiomorphConfig.morphCallbacks?.afterNodeMorphed) {
          idiomorphConfig.morphCallbacks.afterNodeMorphed(oldNode, newNode);
        }
      },

      beforeAttributeUpdated: (attributeName, node, mutationType) => {
        if (idiomorphConfig.morphCallbacks?.beforeAttributeUpdated) {
          return idiomorphConfig.morphCallbacks.beforeAttributeUpdated(
            attributeName,
            node,
            mutationType
          );
        }
        return true;
      }
    };

    // Handle morphStyle - morphlex uses morphInner for innerHTML style
    if (idiomorphConfig.morphStyle === 'innerHTML') {
      // For innerHTML style, morph the children only
      return morphFn(existingNode, newNode.innerHTML, morphlexOptions);
    } else {
      // For outerHTML or default, morph the whole element
      return morphFn(existingNode, newNode, morphlexOptions);
    }
  }

  return {
    name: 'fixiplug-morphlex-swap',
    setup(ctx) {
      // Store loaded morphlex instance
      let morphlexModule = null;

      // Load morphlex from CDN
      const loadMorphlex = async () => {
        if (morphlexModule) {
          return morphlexModule;
        }

        if (typeof window.morphlex !== 'undefined') {
          morphlexModule = window.morphlex;
          return morphlexModule;
        }

        // Try to load from CDN
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          // Using unpkg CDN for morphlex
          script.src = 'https://unpkg.com/morphlex@1.0.1/dist/morphlex.umd.js';
          script.onload = () => {
            morphlexModule = window.morphlex;
            if (!morphlexModule) {
              reject(new Error('Morphlex failed to load'));
              return;
            }
            resolve(morphlexModule);
          };
          script.onerror = () => reject(new Error('Failed to load morphlex from CDN'));
          document.head.appendChild(script);
        });
      };

      // Register for swap events
      ctx.on('fx:config', async (event) => {
        // Add custom swap mode for morphlex
        if (event.detail && event.detail.headers) {
          event.detail.headers['X-Swap-Mode'] = 'morphlex';
        }
        return event;
      });

      ctx.on('fx:after', async (event) => {
        const startTime = performance.now();

        try {
          // Only handle if we have a target element and content
          if (!event.detail || !event.detail.target || !event.detail.content) {
            return event;
          }

          // Load Morphlex if needed
          const morphlexLib = await loadMorphlex();

          if (!morphlexLib || !morphlexLib.morph) {
            console.error('Morphlex library not properly loaded');
            return event;
          }

          // Get the content as a document fragment
          const contentStr = event.detail.content;
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = contentStr;

          // Apply the morphing using adapter
          idiomorphToMorphlexAdapter(
            event.detail.target,
            tempDiv,
            config,
            morphlexLib.morph
          );

          // Prevent default swap behavior
          event.detail.shouldSwap = false;

          // Log performance
          const endTime = performance.now();
          const duration = endTime - startTime;

          // Store performance data on the event
          if (!event.detail.performance) {
            event.detail.performance = {};
          }
          event.detail.performance.morphlexSwapTime = duration;

          if (ctx.debug) {
            console.log(`[Morphlex] Swap completed in ${duration.toFixed(2)}ms`);
          }

        } catch (error) {
          console.error('Morphlex swap error:', error);
          // Log the error but don't prevent other plugins from running
          if (event.detail.errors) {
            event.detail.errors.push({
              plugin: 'fixiplug-morphlex-swap',
              error: error.message,
              stack: error.stack
            });
          }
        }

        return event;
      });

      // Register cleanup
      ctx.registerCleanup(() => {
        morphlexModule = null;
      });
    }
  };
}
