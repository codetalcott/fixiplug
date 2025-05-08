// security.js - Essential security protection for fixiplug
export default function fixiplugSecurity(ctx) {
  const MAX_EXECUTION_TIME = 100; // ms
  const MAX_OBJECT_DEPTH = 10;
  const DANGEROUS_PROPS = ['__proto__', 'constructor', 'prototype'];
  
  // Store reference to original dispatch
  const originalDispatch = fixiplug.dispatch;
  
  // Intercept all dispatches to validate inputs
  fixiplug.dispatch = async function(hookName, event) {
    // Sanitize the event object to prevent prototype pollution
    const sanitizedEvent = sanitizeObject(event);
    
    // Continue with dispatch using sanitized event
    return originalDispatch.call(this, hookName, sanitizedEvent);
  };
  
  // Add execution guard to all hooks
  for (const hookName of Object.keys(fixiplug.hooks)) {
    ctx.beforeAll(hookName, guardExecution);
  }
  
  // Function to guard execution
  function guardExecution(event) {
    // Flag to track execution status
    const execGuard = { timeoutId: null, completed: false };
    
    // Set up timeout to prevent long-running operations
    execGuard.timeoutId = setTimeout(() => {
      if (!execGuard.completed) {
        console.error(`Security warning: Hook execution exceeded ${MAX_EXECUTION_TIME}ms`);
        throw new Error('Security timeout - execution aborted');
      }
    }, MAX_EXECUTION_TIME);
    
    // Mark execution guard to clean up
    ctx.registerCleanup(() => {
      clearTimeout(execGuard.timeoutId);
      execGuard.completed = true;
    });
    
    return event;
  }
  
  // Sanitize objects recursively
  function sanitizeObject(obj, depth = 0) {
    // Prevent deep recursion
    if (depth > MAX_OBJECT_DEPTH) {
      return '[Max Depth Exceeded]';
    }
    
    // Handle primitives and nulls
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item, depth + 1));
    }
    
    // For objects, create a fresh object and copy safe properties
    const cleanObj = {};
    
    for (const key in obj) {
      // Skip dangerous properties
      if (DANGEROUS_PROPS.includes(key)) {
        console.warn(`Security: Removing dangerous property "${key}"`);
        continue;
      }
      
      // Recursively sanitize values
      cleanObj[key] = sanitizeObject(obj[key], depth + 1);
    }
    
    return cleanObj;
  }
  
  // Add DOM event sanitizer
  ctx.on('before', sanitizeDomEvents);
  
  // Sanitize DOM events for XSS prevention
  function sanitizeDomEvents(event) {
    // Only process DOM events with targets
    if (!event || !event.target) return event;
    
    // Add security attributes to any dynamic content
    if (event.type === 'innerHTML' || event.type === 'content') {
      // Basic HTML sanitization
      if (typeof event.content === 'string') {
        event.content = event.content
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, 'void:')
          .replace(/on\w+=/gi, 'data-blocked-handler=');
      }
    }
    
    return event;
  }
  
  // Add warning for potentially unsafe operations
  function warnUnsafeOperation(operation) {
    console.warn(`Security: Potentially unsafe operation detected: ${operation}`);
    // Could expand this to log to a security endpoint
  }
  
  // Monitor for malicious patterns
  ctx.on('before', event => {
    // Check for suspicious strings
    const eventString = JSON.stringify(event).toLowerCase();
    
    if (eventString.includes('eval(') || 
        eventString.includes('new function') ||
        eventString.includes('settimeout(') && eventString.includes('function')) {
      warnUnsafeOperation('Potential code execution');
    }
    
    return event;
  });
  
  // Register cleanup
  ctx.registerCleanup(() => {
    fixiplug.dispatch = originalDispatch;
  });
  
  // Add security audit log
  ctx.on('pluginError', event => {
    console.error(`SECURITY ALERT: Plugin "${event.plugin}" error in "${event.hookName}": ${event.error}`);
  });
  
  // Export security utilities
  ctx.utils.sanitize = sanitizeObject;
  
  console.log('Security plugin active - core protections enabled');
}