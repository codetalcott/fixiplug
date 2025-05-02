/**
 * Fixi Plugin System Core Types
 * 
 * This file contains the core types and interfaces for the Fixi plugin system.
 */

import { Fixi, RequestConfig, FxResponse } from '../../core/fixi';

/**
 * Interface for logger used throughout the plugin system
 */
export interface PluginLogger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug?(message: string, ...args: any[]): void;
}

/** Lifecycle hook points where plugins can register functionality */
export enum PluginHook {
  BEFORE_REQUEST = 'beforeRequest',
  AFTER_RESPONSE = 'afterResponse',
  DOM_MUTATED = 'domMutated',
  INITIALIZE = 'initialize',
  DESTROY = 'destroy',
  ERROR = 'error'
}

/** Base context provided to plugin hooks */
export interface PluginContext {
  fixi: Fixi;
  /**
   * Internal control flags for plugin execution flow
   * @internal
   */
  _control?: {
    /** Signal to stop further plugin hook execution in the chain */
    stopIteration?: boolean;
    [key: string]: any;
  };
  [key: string]: any;
}

/** Context for request-related hooks */
export interface RequestPluginContext extends PluginContext {
  config: RequestConfig;
  response?: FxResponse;
  error?: Error;
}

/** Context for DOM-related hooks */
export interface DomPluginContext extends PluginContext {
  mutations: MutationRecord[];
  target?: Element;
}

export interface FixiPlugs {
  /** Unique plugin name */
  name: string;
  
  /** Plugin version */
  version: string;
  
  /** 
   * Execution priority (higher numbers execute first) 
   * Default: 0
   */
  priority?: number;
  
  /** 
   * Conditions that determine whether a hook should execute
   * Return false to skip this plugin's hook
   */
  conditions?: {
    [key in PluginHook]?: (context: any) => boolean;
  };
  
  /** 
   * Timeouts for each hook in milliseconds
   * If a hook takes longer than the specified time, it will be aborted
   */
  timeouts?: {
    [key in PluginHook]?: number;
  };
  
  /** 
   * Fallback functions for when a hook throws an error
   * These allow the plugin to recover and provide alternative behavior
   */
  fallbacks?: {
    [key in PluginHook]?: (context: any, error: Error) => any;
  };
  
  /** 
   * Circuit breaker configuration to prevent repeated failures
   */
  circuitBreaker?: {
    /** Number of consecutive failures before the circuit opens */
    failureThreshold: number;
    
    /** Milliseconds to wait before attempting to close the circuit */
    resetTimeout: number;
  };
  
  // Hook methods
  beforeRequest?(context: RequestPluginContext): Promise<RequestConfig> | RequestConfig;
  afterResponse?(context: RequestPluginContext): Promise<FxResponse> | FxResponse;
  onDomMutated?(context: DomPluginContext): void;
  onInitialize?(context: PluginContext): void;
  onDestroy?(context: PluginContext): void;
  onError?(context: RequestPluginContext): void;
  
  // Optional plugin metadata
  dependencies?: string[];
  description?: string;
  author?: string;
  
  // Allow plugins to have additional methods/properties
  [key: string]: any;
}

/** Plugin definition for lazy loading */
export interface PluginDefinition {
  name: string;
  dependencies?: string[];
  load: () => Promise<FixiPlugs>;
}

/** Plugin health metrics */
export interface PluginHealthMetrics {
  totalCalls: number;
  errors: number;
  totalDuration: number;
  avgDuration: number;
  lastError?: Error;
  lastExecuted?: number;
  circuit?: {
    isOpen: boolean;
    failures: number;
    lastFailure: number;
  };
}

/**
 * Plugin manager extension interface
 * Extensions can hook into various parts of the plugin lifecycle
 */
export interface PluginManagerExtension {
  /** Initialize the extension with the plugin manager */
  init(manager: any): void;
  
  /** Called before plugin registration */
  beforeRegister?(plugin: FixiPlugs): boolean | void;
  
  /** Called after plugin registration */
  afterRegister?(plugin: FixiPlugs): void;
  
  /** Called before plugin unregistration */
  beforeUnregister?(name: string, plugin: FixiPlugs): boolean | void;
  
  /** Called after plugin unregistration */
  afterUnregister?(name: string, plugin: FixiPlugs): void;
  
  /** Called before executing hooks */
  beforeExecute?<T extends PluginContext>(hookType: PluginHook, context: T): T | void;
  
  /** Called after executing hooks */
  afterExecute?<T extends PluginContext>(hookType: PluginHook, context: T): T | void;
  
  /** Called before executing an individual hook */
  beforeHook?<T extends PluginContext>(plugin: FixiPlugs, hookType: PluginHook, context: T): boolean | void;
  
  /** Called after executing an individual hook */
  afterHook?<T extends PluginContext>(plugin: FixiPlugs, hookType: PluginHook, context: T, error: Error | null): void;
  
  /** Called when a hook throws an error */
  onHookError?<T extends PluginContext>(plugin: FixiPlugs, hookType: PluginHook, context: T, error: Error): boolean | void;
}

/**
 * Configuration options for the plugin system
 */
export interface PluginSystemOptions {
  /**
   * Initial plugins to register
   */
  plugins?: FixiPlugs[];
  
  /**
   * Initial plugin definitions to register for lazy loading
   */
  lazyPlugins?: PluginDefinition[];
}