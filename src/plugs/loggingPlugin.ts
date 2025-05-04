import type { FixiPlugs, RequestPluginContext } from '../hub/types';
import { PluginHook } from '../hub/types';

// Log levels for controlling output verbosity
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

// Configuration options for the logging plugin
export interface LoggingPluginOptions {
  logLevel?: LogLevel;
  enableConsole?: boolean;
  formatter?: (hookType: string, data: any) => string;
  destinations?: LogDestination[];
}

// Interface for log destinations
export interface LogDestination {
  log(level: LogLevel, message: string, data: any): void;
}

// Default console log destination
class ConsoleLogDestination implements LogDestination {
  log(level: LogLevel, message: string, data: any): void {
    switch (level) {
      case LogLevel.DEBUG: console.debug(message, data); break;
      case LogLevel.INFO: console.log(message, data); break;
      case LogLevel.WARN: console.warn(message, data); break;
      case LogLevel.ERROR: console.error(message, data); break;
    }
  }
}

// Main plugin implementation
class LoggingPluginImpl implements FixiPlugs {
  public readonly name = 'logging-plugin';
  public readonly version = '1.0.0';
  private logLevel: LogLevel;
  private formatter: (hookType: string, data: any) => string;
  private destinations: LogDestination[];
  
  constructor(options: LoggingPluginOptions = {}) {
    this.logLevel = options.logLevel ?? LogLevel.INFO;
    this.formatter = options.formatter ?? this.defaultFormatter;
    this.destinations = options.destinations ?? 
      (options.enableConsole !== false ? [new ConsoleLogDestination()] : []);
  }
  
  // Default formatter function
  private defaultFormatter(hookType: string, data: any): string {
    return `[${this.name}] [${hookType}]`;
  }
  
  // Log a message at the specified level
  private logMessage(level: LogLevel, hookType: string, data: any): void {
    if (level >= this.logLevel && this.destinations.length > 0) {
      const message = this.formatter(hookType, data);
      for (const destination of this.destinations) {
        destination.log(level, message, data);
      }
    }
  }
  
  // Hook implementation: Before request
  beforeRequest(ctx: RequestPluginContext) {
    this.logMessage(LogLevel.INFO, PluginHook.BEFORE_REQUEST, ctx.config);
    return ctx.config;
  }
  
  // Hook implementation: After response
  afterResponse(ctx: RequestPluginContext) {
    this.logMessage(LogLevel.INFO, PluginHook.AFTER_RESPONSE, ctx.response);
    return ctx.response!;
  }
  
  // Hook implementation: On error
  onError(ctx: RequestPluginContext) {
    this.logMessage(LogLevel.ERROR, PluginHook.ERROR, ctx.error);
  }
  
  // Add additional methods for external control
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
  
  addDestination(destination: LogDestination): void {
    this.destinations.push(destination);
  }
  
  clearDestinations(): void {
    this.destinations = [];
  }
}

// Factory function for creating plugin instances
export function createLoggingPlugin(options?: LoggingPluginOptions): FixiPlugs {
  return new LoggingPluginImpl(options);
}

// Export singleton instance for backward compatibility
export const LoggingPlugin: FixiPlugs = createLoggingPlugin();