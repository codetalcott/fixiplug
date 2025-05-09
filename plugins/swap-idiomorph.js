/**
 * Idiomorph Swap Plugin for Fixiplug
 * Provides enhanced DOM morphing using Idiomorph library
 * @module plugins/swap-idiomorph
 */

/**
 * Creates an idiomorph swap plugin
 * @param {Object} [options] - Configuration options
 * @returns {Object} Plugin instance
 */
export default function createIdiomorphSwap(options = {}) {
  // Default configuration
  const config = {
    morphStyle: 'innerHTML',
    ignoreActiveValue: true,
    morphCallbacks: {},
    ...options
  };

  return {
    name: 'fixiplug-idiomorph-swap',
    setup(ctx) {
      // Load idiomorph if not already available
      const loadIdiomorph = async () => {
        if (typeof window.Idiomorph === 'undefined') {
          // Try to load from CDN
          return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/idiomorph@0.1.0/dist/idiomorph.min.js';
            script.onload = () => resolve(window.Idiomorph);
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        return window.Idiomorph;
      };

      // Register for swap events
      ctx.on('fx:config', async (event) => {
        // Add custom swap mode for idiomorph
        if (event.detail && event.detail.headers) {
          event.detail.headers['X-Swap-Mode'] = 'idiomorph';
        }
        return event;
      });

      ctx.on('fx:after', async (event) => {
        try {
          // Only handle if we have a target element and content
          if (!event.detail || !event.detail.target || !event.detail.content) {
            return event;
          }

          // Load Idiomorph if needed
          const Idiomorph = await loadIdiomorph();
          
          // Get the content as a document fragment
          const contentStr = event.detail.content;
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = contentStr;
          
          // Apply the morphing
          Idiomorph.morph(event.detail.target, tempDiv, config);
          
          // Prevent default swap behavior
          event.detail.shouldSwap = false;
          
        } catch (error) {
          console.error('Idiomorph swap error:', error);
        }
        
        return event;
      });

      // Register cleanup
      ctx.registerCleanup(() => {
        // Nothing to clean up
      });
    }
  };
}
