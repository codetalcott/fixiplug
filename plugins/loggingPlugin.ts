import { createPlugin, PluginHook, RequestPluginContext } from '../plugin';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const LoggingPlugin = createPlugin({
  name: 'logging',
  version: '1.0.0',
  
  priority: 100, // Highest priority to capture everything
  description: 'Provides comprehensive logging and metrics',
  author: 'Team Fixi',
  
  // Logging configuration
  config: {
    level: 'info' as LogLevel,
    includeTimestamps: true,
    logToConsole: true,
    captureMetrics: true,
    logNetwork: true,
    logErrors: true
  },
  
  // Metrics storage
  metrics: {
    totalRequests: 0,
    successRequests: 0,
    errorRequests: 0,
    totalDuration: 0,
    requestsByEndpoint: new Map<string, {
      count: number,
      success: number,
      error: number,
      totalDuration: number
    }>()
  },
  
  // Request timing data
  requestTimes: new Map<string, number>(),
  
  // Initialize the plugin
  onInitialize() {
    this.resetMetrics();
  },
  
  // Reset all metrics
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successRequests: 0,
      errorRequests: 0,
      totalDuration: 0,
      requestsByEndpoint: new Map()
    };
    this.requestTimes.clear();
  },
  
  // Log request start
  beforeRequest(context: RequestPluginContext) {
    if (this.config.logNetwork) {
      this.log('info', `Request: ${context.config.method || 'GET'} ${context.config.url}`);
      this.log('debug', 'Request config:', context.config);
    }
    
    if (this.config.captureMetrics) {
      const requestId = this.getRequestId(context.config);
      context.config._requestId = requestId;  // store ID for later hooks
      this.requestTimes.set(requestId, performance.now());
      this.metrics.totalRequests++;
      
      // Track by endpoint
      const endpoint = this.getEndpointName(context.config.url);
      const endpointMetrics = this.metrics.requestsByEndpoint.get(endpoint) || {
        count: 0,
        success: 0,
        error: 0,
        totalDuration: 0
      };
      
      endpointMetrics.count++;
      this.metrics.requestsByEndpoint.set(endpoint, endpointMetrics);
    }
    
    return context.config;
  },
  
  // Log response
  afterResponse(context: RequestPluginContext) {
    if (this.config.captureMetrics) {
      const requestId = this.getRequestId(context.config);
      const startTime = this.requestTimes.get(requestId);
      
      if (startTime) {
        const duration = performance.now() - startTime;
        this.requestTimes.delete(requestId);
        
        this.metrics.totalDuration += duration;
        
        if (context.response?.ok) {
          this.metrics.successRequests++;
        } else {
          this.metrics.errorRequests++;
        }
        
        // Update endpoint metrics
        const endpoint = this.getEndpointName(context.config.url);
        const endpointMetrics = this.metrics.requestsByEndpoint.get(endpoint)!;
        
        endpointMetrics.totalDuration += duration;
        if (context.response?.ok) {
          endpointMetrics.success++;
        } else {
          endpointMetrics.error++;
        }
      }
    }
    
    if (this.config.logNetwork) {
      const status = context.response?.status || 0;
      const method = context.config.method || 'GET';
      
      if (context.response?.ok) {
        this.log('info', `Response: ${method} ${context.config.url} - ${status}`);
        this.log('debug', 'Response data:', context.response);
      } else if (this.config.logErrors) {
        this.log('error', `Error: ${method} ${context.config.url} - ${status}`);
        this.log('debug', 'Error response:', context.response);
      }
    }
    
    return context.response!;
  },
  
  // Log errors
  onError(context: RequestPluginContext) {
    if (this.config.logErrors) {
      this.log('error', `Request failed: ${context.config.method || 'GET'} ${context.config.url}`);
      this.log('error', context.error?.message || String(context.error), context.error);
    }
    
    if (this.config.captureMetrics) {
      const requestId = this.getRequestId(context.config);
      this.requestTimes.delete(requestId);
      
      this.metrics.errorRequests++;
      
      // Update endpoint metrics
      const endpoint = this.getEndpointName(context.config.url);
      const endpointMetrics = this.metrics.requestsByEndpoint.get(endpoint);
      
      if (endpointMetrics) {
        endpointMetrics.error++;
      }
    }
  },
  
  // Log to console and capture logs
  log(level: LogLevel, message: string, ...args: any[]) {
    const logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (logLevels[level] < logLevels[this.config.level]) {
      return;
    }
    
    const timestamp = this.config.includeTimestamps ? `[${new Date().toISOString()}] ` : '';
    const formattedMessage = `${timestamp}[Fixi] ${message}`;
    
    if (this.config.logToConsole) {
      console[level](formattedMessage, ...args);
    }
  },
  
  // Generate a unique ID for each request
  getRequestId(config: any): string {
    if ((config as any)._requestId) {
      return (config as any)._requestId;
    }
    const id = `${config.method || 'GET'}-${config.url}-${Date.now()}`;
    (config as any)._requestId = id;
    return id;
  },
  
  // Extract endpoint name from URL for grouping
  getEndpointName(url: string): string {
    try {
      const parsedUrl = new URL(url, window.location.origin);
      return parsedUrl.pathname.replace(/\/(\d+)($|\/)/g, '/:id$2');
    } catch (e) {
      return url.split('?')[0].split('#')[0];
    }
  },
  
  // Get metrics for analysis
  getMetrics() {
    return {
      ...this.metrics,
      averageDuration: this.metrics.totalRequests > 0
        ? this.metrics.totalDuration / this.metrics.totalRequests
        : 0,
      successRate: this.metrics.totalRequests > 0
        ? this.metrics.successRequests / this.metrics.totalRequests
        : 0,
      requestsByEndpoint: Object.fromEntries(this.metrics.requestsByEndpoint)
    };
  },
  
  // Configure the plugin
  configure(options: Partial<typeof this.config>) {
    this.config = { ...this.config, ...options };
    return this;
  }
});