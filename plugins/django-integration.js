/**
 * Django Integration Plugin for FixiPlug
 *
 * Bridges Django (dj-fixi) with FixiPlug for seamless server-side/client-side collaboration.
 *
 * Features:
 * - Auto-adds Django CSRF tokens to state-changing requests
 * - Adds FX-Request header for Django middleware detection
 * - Handles Django form validation errors (422 responses)
 * - Supports Django's preserved query parameters pattern
 * - Integrates with dj-fixi table rendering
 *
 * @module plugins/django-integration
 */

/**
 * Creates Django integration plugin
 * @param {Object} [options] - Configuration options
 * @param {string} [options.csrfCookieName='csrftoken'] - Name of CSRF cookie
 * @param {string} [options.csrfHeaderName='X-CSRFToken'] - CSRF header name
 * @param {boolean} [options.autoAddHeaders=true] - Auto-add FX-Request header
 * @param {boolean} [options.handleFormErrors=true] - Auto-handle Django form errors
 * @returns {Object} Plugin instance
 */
export default function createDjangoIntegration(options = {}) {
  const config = {
    csrfCookieName: 'csrftoken',
    csrfHeaderName: 'X-CSRFToken',
    autoAddHeaders: true,
    handleFormErrors: true,
    preserveParams: true,  // Preserve query params across requests
    ...options
  };

  /**
   * Get CSRF token from cookie
   * @returns {string|null} CSRF token or null
   */
  function getCsrfToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === config.csrfCookieName) {
        return decodeURIComponent(value);
      }
    }
    return null;
  }

  /**
   * Extract preserved parameters from element or URL
   * @param {HTMLElement} element - Element with fx-preserve-params
   * @returns {URLSearchParams} Preserved parameters
   */
  function getPreservedParams(element) {
    const params = new URLSearchParams();

    // Get preserved param names from attribute
    const preserveAttr = element.getAttribute('fx-preserve-params');
    if (!preserveAttr) return params;

    const preserveKeys = preserveAttr.split(',').map(k => k.trim());
    const currentParams = new URLSearchParams(window.location.search);

    // Copy preserved params from current URL
    preserveKeys.forEach(key => {
      const value = currentParams.get(key);
      if (value) {
        params.set(key, value);
      }
    });

    return params;
  }

  /**
   * Merge preserved params into URL
   * @param {string} url - Target URL
   * @param {URLSearchParams} params - Params to merge
   * @returns {string} URL with merged params
   */
  function mergeParams(url, params) {
    const urlObj = new URL(url, window.location.origin);
    params.forEach((value, key) => {
      if (!urlObj.searchParams.has(key)) {
        urlObj.searchParams.set(key, value);
      }
    });
    return urlObj.toString();
  }

  // Plugin implementation
  return {
    name: 'fixiplug-django-integration',

    setup(ctx) {
      console.log('Django integration plugin initialized');

      // Add Django-specific headers to all requests
      ctx.on('fx:config', (event) => {
        if (!event.detail || !event.detail.cfg) return event;

        const cfg = event.detail.cfg;
        const element = event.target;

        if (!cfg.headers) cfg.headers = {};

        // Add FX-Request header for Django middleware
        if (config.autoAddHeaders) {
          cfg.headers['FX-Request'] = 'true';
        }

        // Add CSRF token for state-changing requests
        const method = (cfg.method || 'GET').toUpperCase();
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          const csrfToken = getCsrfToken();
          if (csrfToken) {
            cfg.headers[config.csrfHeaderName] = csrfToken;
          }
        }

        // Preserve query parameters if enabled
        if (config.preserveParams && cfg.action) {
          const preserved = getPreservedParams(element);
          if (preserved.toString()) {
            cfg.action = mergeParams(cfg.action, preserved);
          }
        }

        return event;
      });

      // Handle Django form validation errors (422 status)
      ctx.on('fx:after', async (event) => {
        if (!config.handleFormErrors) return event;
        if (!event.detail || !event.detail.response) return event;

        const response = event.detail.response;

        // Django form errors come as 422 status with JSON
        if (response.status === 422) {
          try {
            const contentType = response.headers.get('Content-Type');
            if (contentType && contentType.includes('application/json')) {
              const errorData = JSON.parse(event.detail.cfg.text);

              // Dispatch Django form error event
              const errorEvent = new CustomEvent('django:formErrors', {
                bubbles: true,
                cancelable: true,
                detail: {
                  errors: errorData.errors || errorData,
                  element: event.target,
                  response
                }
              });

              event.target.dispatchEvent(errorEvent);
            }
          } catch (e) {
            console.warn('Failed to parse Django form errors:', e);
          }
        }

        return event;
      });

      // Handle Django success messages from FX-Trigger header
      ctx.on('fx:after', (event) => {
        if (!event.detail || !event.detail.response) return event;

        const response = event.detail.response;
        const fxTrigger = response.headers.get('FX-Trigger');

        if (fxTrigger) {
          try {
            // Parse trigger data (could be JSON or simple string)
            let triggerData;
            try {
              triggerData = JSON.parse(fxTrigger);
            } catch {
              triggerData = { event: fxTrigger };
            }

            // Dispatch Django trigger events
            Object.entries(triggerData).forEach(([eventName, detail]) => {
              const customEvent = new CustomEvent(`django:${eventName}`, {
                bubbles: true,
                detail: detail
              });
              event.target.dispatchEvent(customEvent);
            });
          } catch (e) {
            console.warn('Failed to parse FX-Trigger header:', e);
          }
        }

        return event;
      });

      // Parse Django table metadata for FixiPlug table plugin
      ctx.on('fx:data', (event) => {
        if (!event.detail || !event.detail.data) return event;

        const { data, contentType } = event.detail;

        // Check if this is Django table data
        if (contentType && contentType.includes('application/json')) {
          // Django dj-fixi tables send: { data: [...], columns: [...], meta: {...} }
          if (data.columns && Array.isArray(data.data)) {
            // Mark as Django table data
            event.detail.djangoTable = true;
            event.detail.tableConfig = {
              columns: data.columns,
              meta: data.meta || {}
            };
          }
        }

        return event;
      });

      // Helper: Render Django form errors in UI
      ctx.on('django:formErrors', (event) => {
        const { errors, element } = event.detail;

        // Find or create error container
        let errorContainer = element.querySelector('.fx-django-errors');
        if (!errorContainer) {
          errorContainer = document.createElement('div');
          errorContainer.className = 'fx-django-errors';
          element.insertBefore(errorContainer, element.firstChild);
        }

        // Render errors
        const errorHtml = Object.entries(errors).map(([field, messages]) => {
          const messageArray = Array.isArray(messages) ? messages : [messages];
          return `
            <div class="fx-error fx-error-${field}">
              <strong>${field}:</strong> ${messageArray.join(', ')}
            </div>
          `;
        }).join('');

        errorContainer.innerHTML = errorHtml;
      });

      // Clear errors on successful submit
      ctx.on('fx:before', (event) => {
        const errorContainer = event.target.querySelector('.fx-django-errors');
        if (errorContainer) {
          errorContainer.innerHTML = '';
        }
      });
    }
  };
}

/**
 * Helper utilities for Django integration
 */
export const DjangoUtils = {
  /**
   * Get Django context data from page (if embedded in script tag)
   * @returns {Object} Django context or empty object
   */
  getContext() {
    const contextScript = document.getElementById('django-context');
    if (contextScript) {
      try {
        return JSON.parse(contextScript.textContent);
      } catch (e) {
        console.warn('Failed to parse Django context:', e);
      }
    }
    return {};
  },

  /**
   * Get CSRF token from cookie
   * @param {string} [cookieName='csrftoken'] - CSRF cookie name
   * @returns {string|null} CSRF token
   */
  getCsrfToken(cookieName = 'csrftoken') {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === cookieName) {
        return decodeURIComponent(value);
      }
    }
    return null;
  },

  /**
   * Render Django form errors as HTML
   * @param {Object} errors - Django form errors
   * @returns {string} HTML string
   */
  renderErrors(errors) {
    return Object.entries(errors).map(([field, messages]) => {
      const messageArray = Array.isArray(messages) ? messages : [messages];
      return `
        <div class="fx-error fx-error-${field}">
          <strong>${field}:</strong> ${messageArray.join(', ')}
        </div>
      `;
    }).join('');
  }
};
