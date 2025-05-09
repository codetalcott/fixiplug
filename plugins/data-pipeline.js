/**
 * Data Pipeline Plugin for Fixiplug
 * Provides ability to process data without DOM updates when needed
 * 
 * @module plugins/data-pipeline
 */

/**
 * Creates a data pipeline plugin
 * @param {Object} [options] - Configuration options
 * @returns {Object} Plugin instance
 */
export default function createDataPipeline(options = {}) {
  // Default configuration
  const config = {
    swapByDefault: true,       // Whether to swap by default
    processorsEnabled: true,   // Whether data processors are enabled
    responseCache: {},         // Cache for responses
    cacheResponses: false,     // Whether to cache responses
    processors: {},            // Custom data processors
    errorHandling: 'silent',   // 'silent', 'console', or 'throw'
    retryCount: 0,             // Number of automatic retries on failure
    ...options
  };

  // Data processors registry
  const processors = {
    // Default processors
    json: (text) => {
      try {
        return JSON.parse(text);
      } catch (e) {
        handleError('Failed to parse JSON', e);
        return null;
      }
    },
    xml: (text) => {
      try {
        const parser = new DOMParser();
        return parser.parseFromString(text, 'text/xml');
      } catch (e) {
        handleError('Failed to parse XML', e);
        return null;
      }
    },
    csv: (text) => {
      try {
        return text.split('\n').map(line => line.split(','));
      } catch (e) {
        handleError('Failed to parse CSV', e);
        return null;
      }
    },
    yaml: (text) => {
      try {
        // Simple YAML parser for basic structures
        // For complex YAML, a dedicated library would be better
        const lines = text.split('\n');
        const result = {};
        let currentKey = null;
        let inArray = false;
        let currentArray = [];
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          
          if (trimmed.endsWith(':')) {
            // New section
            currentKey = trimmed.slice(0, -1).trim();
            result[currentKey] = {};
            inArray = false;
          } else if (trimmed.startsWith('-')) {
            // Array item
            if (!inArray) {
              inArray = true;
              currentArray = [];
              if (currentKey) {
                result[currentKey] = currentArray;
              }
            }
            currentArray.push(trimmed.slice(1).trim());
          } else if (trimmed.includes(':')) {
            // Key-value pair
            const [key, value] = trimmed.split(':').map(s => s.trim());
            if (currentKey && result[currentKey]) {
              result[currentKey][key] = value;
            } else {
              result[key] = value;
            }
            inArray = false;
          }
        }
        
        return result;
      } catch (e) {
        handleError('Failed to parse YAML', e);
        return null;
      }
    },
    html: (text) => {
      try {
        const parser = new DOMParser();
        return parser.parseFromString(text, 'text/html');
      } catch (e) {
        handleError('Failed to parse HTML', e);
        return null;
      }
    },
    text: (text) => text,
    
    // Add custom processors from config
    ...config.processors
  };

  // Error handling function
  function handleError(message, error) {
    const fullMessage = `${message}: ${error.message}`;
    
    switch (config.errorHandling) {
      case 'throw':
        throw new Error(fullMessage);
      case 'console':
        console.error(fullMessage, error);
        break;
      case 'silent':
      default:
        // Do nothing
        break;
    }
  }

  // Process the response text with appropriate processor
  function processData(text, contentType) {
    if (!config.processorsEnabled) return text;
    
    // Determine processor based on content type
    let processor = 'text'; // default
    
    if (contentType) {
      if (contentType.includes('application/json')) {
        processor = 'json';
      } else if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
        processor = 'xml';
      } else if (contentType.includes('text/csv')) {
        processor = 'csv';
      } else if (contentType.includes('text/yaml') || contentType.includes('application/yaml') || contentType.includes('application/x-yaml')) {
        processor = 'yaml';
      } else if (contentType.includes('text/html')) {
        processor = 'html';
      }
    }
    
    // Get the processor function
    const processorFn = processors[processor];
    
    if (processorFn) {
      return processorFn(text);
    }
    
    return text;
  }
  
  // Plugin event handlers
  return {
    name: 'fixiplug-data-pipeline',
    setup(ctx) {
      // Register custom attribute to opt out of swap
      ctx.on('fx:config', (event) => {
        if (!event.detail || !event.detail.cfg) return event;
        
        const cfg = event.detail.cfg;
        const element = event.target;
        
        // Check for fx-swap-mode attribute
        const swapMode = element.getAttribute('fx-swap-mode');
        
        // Skip swap if swap mode is "none" or "data-only"
        if (swapMode === 'none' || swapMode === 'data-only') {
          // Set a custom flag to skip swap later
          cfg.skipSwap = true;
        }
        
        // Process data based on explicit data type or content negotiation
        const dataType = element.getAttribute('fx-data-type');
        if (dataType) {
          // Set content type for request
          if (!cfg.headers) cfg.headers = {};
          
          switch (dataType) {
            case 'json':
              cfg.headers['Accept'] = 'application/json';
              break;
            case 'xml':
              cfg.headers['Accept'] = 'application/xml, text/xml';
              break;
            case 'csv':
              cfg.headers['Accept'] = 'text/csv';
              break;
            case 'yaml':
              cfg.headers['Accept'] = 'application/yaml, text/yaml';
              break;
            case 'html':
              cfg.headers['Accept'] = 'text/html';
              break;
          }
        }
        
        return event;
      });
      
      // Process response data after fetch
      ctx.on('fx:after', (event) => {
        if (!event.detail || !event.detail.cfg) return event;
        
        const cfg = event.detail.cfg;
        
        // Cache the response if caching is enabled
        if (config.cacheResponses && cfg.action) {
          config.responseCache[cfg.action] = {
            text: cfg.text,
            contentType: cfg.response.headers.get('Content-Type'),
            timestamp: Date.now()
          };
        }
        
        // Process the response data
        const contentType = cfg.response.headers.get('Content-Type');
        cfg.processedData = processData(cfg.text, contentType);
        
        // Dispatch processed data event for custom handlers
        const dataEvent = new CustomEvent('fx:data', {
          bubbles: true,
          cancelable: true,
          detail: {
            data: cfg.processedData,
            contentType,
            cfg
          }
        });
        
        event.target.dispatchEvent(dataEvent);
        
        return event;
      });
      
      // Skip swap if necessary
      ctx.on('fx:after', (event) => {
        if (!event.detail || !event.detail.cfg) return event;
        
        const cfg = event.detail.cfg;
        
        // Check if we should skip the swap
        if (cfg.skipSwap === true) {
          // Replace the swap function with a no-op
          cfg.swap = () => {
            // Do nothing - no DOM update
            console.log('Swap skipped for data-only operation');
            return null;
          };
        }
        
        return event;
      });
      
      // Handle errors in data processing
      ctx.on('fx:error', (event) => {
        if (!event.detail || !event.detail.cfg || !event.detail.error) return event;
        
        const cfg = event.detail.cfg;
        const error = event.detail.error;
        
        handleError('Data pipeline error', error);
        
        // Implement retry logic if configured
        if (config.retryCount > 0 && (!cfg.retryCount || cfg.retryCount < config.retryCount)) {
          // Set or increment retry count
          cfg.retryCount = (cfg.retryCount || 0) + 1;
          
          // Create a new event to retry
          setTimeout(() => {
            console.log(`Retrying request (${cfg.retryCount}/${config.retryCount})...`);
            const retryEvent = new Event(event.target.__fixi.evt);
            event.target.dispatchEvent(retryEvent);
          }, 1000); // 1 second delay between retries
        }
        
        return event;
      });
    }
  };
}

/**
 * Helper function to get processed data from an event
 * @param {Event} event - The event object
 * @returns {any} Processed data
 */
export function getProcessedData(event) {
  if (event && event.detail && event.detail.data) {
    return event.detail.data;
  }
  return null;
}

/**
 * Helper function to enable/disable swapping for a pipeline request
 * @param {HTMLElement} element - The element with fx-action
 * @param {boolean} enableSwap - Whether to enable or disable swapping
 */
export function setSwapMode(element, enableSwap) {
  if (!element) return;
  
  if (enableSwap) {
    element.removeAttribute('fx-swap-mode');
  } else {
    element.setAttribute('fx-swap-mode', 'data-only');
  }
}

/**
 * Creates a data pipeline request element
 * @param {Object} options - Pipeline options
 * @param {string} options.action - The URL to fetch
 * @param {string} [options.method='GET'] - HTTP method
 * @param {string} [options.dataType='json'] - Data type to request
 * @param {boolean} [options.swap=false] - Whether to enable DOM swapping
 * @param {string} [options.target] - CSS selector for target element (if swap=true)
 * @returns {HTMLElement} Button element configured for data pipeline
 */
export function createPipelineRequest(options) {
  const button = document.createElement('button');
  button.setAttribute('fx-action', options.action);
  
  if (options.method) {
    button.setAttribute('fx-method', options.method);
  }
  
  if (options.dataType) {
    button.setAttribute('fx-data-type', options.dataType);
  }
  
  if (!options.swap) {
    button.setAttribute('fx-swap-mode', 'data-only');
  } else if (options.target) {
    button.setAttribute('fx-target', options.target);
  }
  
  // Hide the button visually but keep it in the DOM
  button.style.position = 'absolute';
  button.style.opacity = '0';
  button.style.pointerEvents = 'none';
  
  return button;
}
