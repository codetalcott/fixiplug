/**
 * FixiPlug Capability Registry Plugin
 *
 * Auto-registers Django endpoints, tables, forms, and actions for LLM agent discovery.
 * This plugin enables autonomous agents to discover what's possible in a FixiPlug app
 * without needing to read HTML or source code.
 *
 * @module plugins/capability-registry
 *
 * API Hooks Exposed:
 * - api:getCapabilities - List all registered capabilities (tables, forms, endpoints)
 * - api:registerCapability - Manually register a capability
 * - api:discoverEndpoints - Scan DOM for all fx-action endpoints
 * - api:getCapability - Get details for a specific capability
 * - api:getActionSchema - Get schema for an endpoint action
 *
 * Events Emitted:
 * - capability:registered - Fired when new capability is registered
 *
 * @example
 * // Agent discovers all capabilities
 * const result = await fixiplug.dispatch('api:getCapabilities');
 * result.capabilities.forEach(cap => {
 *   console.log(`${cap.type}: ${cap.endpoint}`);
 * });
 *
 * @example
 * // Auto-registration when Django table loads
 * // (happens automatically via fx:data event)
 */

export default function capabilityRegistry(ctx) {
  // Registry: Map<endpoint, capability>
  const capabilities = new Map();

  // ========================================
  // Auto-Registration: Django Tables
  // ========================================
  ctx.on('fx:data', (event) => {
    if (!event.detail || !event.target) return event;

    const element = event.target;
    const { data, djangoTable } = event.detail;

    // Auto-register Django tables
    if (djangoTable && data.data && data.columns) {
      const endpoint = element.getAttribute('fx-action') || 'unknown';
      const meta = data.meta || {};

      const capability = {
        type: 'table',
        endpoint,
        model: meta.model || meta.viewPrefix,
        features: extractTableFeatures(element),
        columns: data.columns.map(col => ({
          key: col.key,
          label: col.label,
          type: col.type || 'string',
          sortable: col.sortable !== false,
          editable: col.editable || false,
          inputType: col.inputType
        })),
        actions: meta.actions || [],
        editable: meta.editable || false,
        searchable: element.hasAttribute('fx-table-search'),
        paginated: element.hasAttribute('fx-table-paginate'),
        exportable: element.hasAttribute('fx-table-export')
      };

      capabilities.set(endpoint, capability);

      // Emit registration event
      ctx.emit('capability:registered', {
        type: 'table',
        endpoint,
        capability
      });
    }

    return event;
  });

  // ========================================
  // Auto-Registration: Forms
  // ========================================
  ctx.on('fx:before', (event) => {
    const element = event.target;

    // Check if this is a form submission
    if (element.tagName === 'FORM') {
      const endpoint = element.getAttribute('fx-action') || element.action;
      const method = (element.getAttribute('fx-method') || element.method || 'POST').toUpperCase();

      if (endpoint && !capabilities.has(endpoint)) {
        const capability = {
          type: 'form',
          endpoint,
          method,
          fields: extractFormFields(element),
          submitButton: element.querySelector('button[type="submit"]')?.textContent || 'Submit',
          hasFileUpload: element.querySelector('input[type="file"]') !== null
        };

        capabilities.set(endpoint, capability);

        ctx.emit('capability:registered', {
          type: 'form',
          endpoint,
          capability
        });
      }
    }

    return event;
  });

  // ========================================
  // API: Get All Capabilities
  // ========================================
  ctx.on('api:getCapabilities', () => {
    return {
      capabilities: Array.from(capabilities.values()),
      count: capabilities.size,
      types: getCapabilityTypes()
    };
  });

  // ========================================
  // API: Register Capability Manually
  // ========================================
  ctx.on('api:registerCapability', (event) => {
    const { type, endpoint, ...details } = event;

    if (!type || !endpoint) {
      return { error: 'type and endpoint required' };
    }

    const capability = {
      type,
      endpoint,
      ...details,
      registeredAt: new Date().toISOString(),
      manual: true
    };

    capabilities.set(endpoint, capability);

    ctx.emit('capability:registered', {
      type,
      endpoint,
      capability
    });

    return {
      success: true,
      endpoint,
      capability
    };
  });

  // ========================================
  // API: Discover Endpoints
  // ========================================
  ctx.on('api:discoverEndpoints', () => {
    const endpoints = [];

    // Scan DOM for fx-action attributes
    document.querySelectorAll('[fx-action]').forEach(el => {
      const endpoint = el.getAttribute('fx-action');
      const type = determineEndpointType(el);

      endpoints.push({
        url: endpoint,
        type,
        method: el.getAttribute('fx-method') || 'GET',
        element: el.tagName.toLowerCase(),
        registered: capabilities.has(endpoint)
      });
    });

    return {
      endpoints,
      count: endpoints.length,
      registered: endpoints.filter(e => e.registered).length,
      unregistered: endpoints.filter(e => !e.registered).length
    };
  });

  // ========================================
  // API: Get Specific Capability
  // ========================================
  ctx.on('api:getCapability', (event) => {
    const { endpoint } = event;

    if (!endpoint) {
      return { error: 'endpoint parameter required' };
    }

    const capability = capabilities.get(endpoint);

    if (!capability) {
      return {
        error: `No capability registered for endpoint: ${endpoint}`,
        available: Array.from(capabilities.keys())
      };
    }

    return {
      success: true,
      capability
    };
  });

  // ========================================
  // API: Get Action Schema
  // ========================================
  ctx.on('api:getActionSchema', (event) => {
    const { endpoint, action } = event;

    if (!endpoint) {
      return { error: 'endpoint parameter required' };
    }

    const capability = capabilities.get(endpoint);

    if (!capability) {
      return { error: `Endpoint not found: ${endpoint}` };
    }

    // Build schema based on capability type
    const schema = buildActionSchema(capability, action);

    return {
      success: true,
      endpoint,
      action,
      schema
    };
  });

  // ========================================
  // Helper Functions
  // ========================================

  /**
   * Extract table features from element attributes
   */
  function extractTableFeatures(element) {
    const features = [];

    if (element.hasAttribute('fx-table-search')) features.push('search');
    if (element.hasAttribute('fx-table-sortable')) features.push('sort');
    if (element.hasAttribute('fx-table-paginate')) features.push('paginate');
    if (element.hasAttribute('fx-table-export')) features.push('export');
    if (element.hasAttribute('fx-table-editable')) features.push('edit');
    if (element.hasAttribute('fx-table-server-side')) features.push('server-side');

    return features;
  }

  /**
   * Extract form fields from form element
   */
  function extractFormFields(form) {
    const fields = [];

    form.querySelectorAll('input, select, textarea').forEach(input => {
      if (!input.name) return;

      fields.push({
        name: input.name,
        type: input.type || 'text',
        label: getLabelForInput(input),
        required: input.hasAttribute('required'),
        placeholder: input.placeholder,
        pattern: input.pattern,
        min: input.min,
        max: input.max,
        maxLength: input.maxLength > 0 ? input.maxLength : undefined
      });
    });

    return fields;
  }

  /**
   * Get label text for input element
   */
  function getLabelForInput(input) {
    // Try to find label by for attribute
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.textContent.trim();

    // Try parent label
    const parentLabel = input.closest('label');
    if (parentLabel) {
      // Get text excluding input element
      return Array.from(parentLabel.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent.trim())
        .join(' ');
    }

    // Fallback to placeholder or name
    return input.placeholder || input.name;
  }

  /**
   * Determine endpoint type from element
   */
  function determineEndpointType(element) {
    if (element.hasAttribute('fx-table')) return 'table';
    if (element.tagName === 'FORM') return 'form';
    if (element.hasAttribute('fx-chart')) return 'chart';
    if (element.hasAttribute('fx-render')) return element.getAttribute('fx-render');
    return 'unknown';
  }

  /**
   * Get unique capability types
   */
  function getCapabilityTypes() {
    const types = new Set();
    capabilities.forEach(cap => types.add(cap.type));
    return Array.from(types);
  }

  /**
   * Build action schema for capability
   */
  function buildActionSchema(capability, action) {
    const schema = {
      endpoint: capability.endpoint,
      type: capability.type,
      method: capability.method || 'GET'
    };

    if (capability.type === 'table') {
      schema.parameters = {
        search: capability.searchable ? 'Query string for filtering rows' : undefined,
        sort: capability.features?.includes('sort') ? 'Column name to sort by' : undefined,
        dir: capability.features?.includes('sort') ? 'Sort direction (asc/desc)' : undefined,
        page: capability.paginated ? 'Page number (1-indexed)' : undefined,
        limit: capability.paginated ? 'Rows per page' : undefined
      };

      schema.response = {
        data: 'Array of row objects',
        columns: 'Column definitions',
        meta: 'Metadata (optional)'
      };
    }

    if (capability.type === 'form') {
      schema.method = capability.method;
      schema.fields = capability.fields;
      schema.contentType = capability.hasFileUpload ? 'multipart/form-data' : 'application/json';
    }

    return schema;
  }

  // ========================================
  // Cleanup
  // ========================================
  ctx.registerCleanup(() => {
    capabilities.clear();
  });
}
