/**
 * TypeScript definitions for FixiPlug Agent SDK
 * @module sdk/types
 */

/**
 * Configuration options for FixiPlugAgent
 */
export interface AgentOptions {
  /**
   * Cache introspection results to reduce API calls
   * @default true
   */
  enableCaching?: boolean;

  /**
   * Cache time-to-live in milliseconds
   * @default 300000 (5 minutes)
   */
  cacheTTL?: number;

  /**
   * Track performance metrics for all API calls
   * @default false
   */
  trackPerformance?: boolean;

  /**
   * Default timeout for state waiting operations (milliseconds)
   * @default 5000
   */
  defaultTimeout?: number;

  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Initial retry delay in milliseconds
   * @default 100
   */
  retryDelay?: number;

  /**
   * Exponential backoff multiplier
   * @default 2
   */
  retryBackoff?: number;

  /**
   * Hooks that should be retried on error
   * Empty array means all hooks are retryable
   * @default []
   */
  retryableHooks?: string[];
}

/**
 * Discovery options for capability introspection
 */
export interface DiscoveryOptions {
  /**
   * Force refresh of cached capabilities
   * @default false
   */
  refresh?: boolean;
}

/**
 * Plugin metadata from introspection
 */
export interface PluginMetadata {
  /**
   * Plugin name
   */
  name: string;

  /**
   * Plugin version (if provided)
   */
  version?: string;

  /**
   * Whether plugin is currently enabled
   */
  enabled: boolean;

  /**
   * Hooks registered by this plugin
   */
  hooks?: string[];

  /**
   * Plugin capabilities
   */
  capabilities?: string[];
}

/**
 * Hook metadata from introspection
 */
export interface HookMetadata {
  /**
   * Number of handlers registered for this hook
   */
  handlers: number;

  /**
   * Plugins that registered handlers for this hook
   */
  plugins: string[];

  /**
   * Auto-inferred schema for the hook
   */
  schema?: {
    type: string;
    returns: string;
    description?: string;
    parameters?: any;
  };
}

/**
 * Capabilities discovered from introspection
 */
export interface Capabilities {
  /**
   * FixiPlug version
   */
  version: string;

  /**
   * Enabled features
   */
  features: string[];

  /**
   * Registered plugins
   */
  plugins: PluginMetadata[];

  /**
   * Available hooks
   */
  hooks: Record<string, HookMetadata>;

  /**
   * Available methods
   */
  methods: string[];

  /**
   * Timestamp of discovery
   */
  timestamp: number;
}

/**
 * Current state information
 */
export interface StateInfo {
  /**
   * Current state name
   */
  state: string;

  /**
   * State timestamp
   */
  timestamp: number;

  /**
   * Age since state was set (milliseconds)
   */
  age: number;
}

/**
 * State transition options
 */
export interface StateOptions {
  /**
   * Additional metadata for state transition
   */
  [key: string]: any;
}

/**
 * Wait for state options
 */
export interface WaitOptions {
  /**
   * Timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Result from waiting for state
 */
export interface WaitResult {
  /**
   * Target state that was reached
   */
  state: string;

  /**
   * Time waited in milliseconds
   */
  waited: number;

  /**
   * State timestamp
   */
  timestamp: number;
}

/**
 * Options for withState execution
 */
export interface WithStateOptions {
  /**
   * State to set on successful completion
   * @default 'complete'
   */
  completeState?: string;

  /**
   * State to set on error
   * @default 'error'
   */
  errorState?: string;
}

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  /**
   * Step name (for result tracking)
   */
  name?: string;

  /**
   * Hook to dispatch for this step
   */
  hook: string;

  /**
   * Parameters to pass (can be function receiving context)
   */
  params?: any | ((context: WorkflowContext) => any);

  /**
   * Optional state to set before executing this step
   */
  state?: string;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  /**
   * Results from completed steps (by step name)
   */
  results: Record<string, any>;

  /**
   * Errors encountered during workflow
   */
  errors: Array<{
    step: string;
    error: string;
    index: number;
  }>;

  /**
   * Names of completed steps
   */
  completed: string[];
}

/**
 * Workflow execution options
 */
export interface WorkflowOptions {
  /**
   * Stop workflow on first error
   * @default true
   */
  stopOnError?: boolean;
}

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  /**
   * Whether workflow completed successfully
   */
  success: boolean;

  /**
   * Names of completed steps
   */
  completed: string[];

  /**
   * Results from each step (by step name)
   */
  results: Record<string, any>;

  /**
   * Errors encountered
   */
  errors: Array<{
    step: string;
    error: string;
    index: number;
  }>;

  /**
   * Step name where workflow stopped (if stopOnError)
   */
  stoppedAt?: string;
}

/**
 * Performance statistics
 */
export interface PerformanceStats {
  /**
   * Total number of API calls made
   */
  apiCalls: number;

  /**
   * Total time spent in API calls (milliseconds)
   */
  totalTime: number;

  /**
   * Average time per API call (milliseconds)
   */
  averageTime: string;

  /**
   * Total number of retries attempted
   */
  retries: number;

  /**
   * Number of cache hits
   */
  cacheHits: number;

  /**
   * Number of cache misses
   */
  cacheMisses: number;

  /**
   * Individual call records
   */
  calls: Array<{
    hook: string;
    duration: string;
    error?: string;
    timestamp: number;
    attempts?: number;
    retriesExhausted?: boolean;
  }>;
}

/**
 * Cache information
 */
export interface CacheInfo {
  /**
   * Whether caching is enabled
   */
  enabled: boolean;

  /**
   * Whether cache is currently valid
   */
  valid: boolean;

  /**
   * Whether cache has data
   */
  hasData: boolean;

  /**
   * Timestamp when cache was created
   */
  timestamp: number | null;

  /**
   * Timestamp when cache expires
   */
  expiresAt: number | null;

  /**
   * Time until cache expires (milliseconds)
   */
  ttl: number;

  /**
   * Maximum configured TTL
   */
  maxTTL: number;
}

/**
 * Main FixiPlug Agent client
 */
export class FixiPlugAgent {
  /**
   * The fixiplug instance being used
   */
  readonly fixi: any;

  /**
   * Discovered capabilities (null until discover() is called)
   */
  capabilities: Capabilities | null;

  /**
   * Agent configuration options
   */
  readonly options: Required<AgentOptions>;

  /**
   * Create a new FixiPlug agent client
   *
   * @param fixiplugInstance - The fixiplug instance to interact with
   * @param options - Configuration options
   * @throws {Error} If fixiplug instance is invalid
   */
  constructor(fixiplugInstance: any, options?: AgentOptions);

  /**
   * Discover available capabilities from the fixiplug instance
   *
   * @param options - Discovery options
   * @returns Capabilities object
   * @throws {Error} If discovery fails
   */
  discover(options?: DiscoveryOptions): Promise<Capabilities>;

  /**
   * Check if a specific capability is available
   *
   * @param capability - Capability name (plugin or hook)
   * @returns True if capability is available
   */
  hasCapability(capability: string): Promise<boolean>;

  /**
   * Get current application state
   *
   * @returns Current state information
   * @throws {Error} If state retrieval fails
   */
  getCurrentState(): Promise<StateInfo>;

  /**
   * Set application state
   *
   * @param state - Target state name
   * @param options - State transition options
   * @returns Transition result
   * @throws {Error} If state transition fails
   */
  setState(state: string, options?: StateOptions): Promise<any>;

  /**
   * Wait for application to reach a specific state
   *
   * @param state - Target state to wait for
   * @param options - Wait options
   * @returns Result when state is reached
   * @throws {Error} If timeout or wait fails
   */
  waitForState(state: string, options?: WaitOptions): Promise<WaitResult>;

  /**
   * Execute a function with automatic state management
   *
   * @param state - State to set during execution
   * @param fn - Async function to execute
   * @param options - Execution options
   * @returns Result of the function execution
   * @throws {Error} If function execution fails
   */
  withState<T>(
    state: string,
    fn: () => Promise<T>,
    options?: WithStateOptions
  ): Promise<T>;

  /**
   * Execute a multi-step workflow
   *
   * @param steps - Array of workflow steps
   * @param options - Workflow options
   * @returns Workflow execution result
   */
  executeWorkflow(
    steps: WorkflowStep[],
    options?: WorkflowOptions
  ): Promise<WorkflowResult>;

  /**
   * Get performance statistics
   *
   * @returns Performance statistics (if tracking enabled)
   */
  getStats(): PerformanceStats | { error: string; message: string };

  /**
   * Reset performance statistics
   */
  resetStats(): void;

  /**
   * Invalidate cached capabilities
   * Forces the next discover() call to fetch fresh data
   */
  invalidateCache(): void;

  /**
   * Warm the cache by performing an initial discovery
   * Useful for reducing latency on first capability check
   * @returns Capabilities object
   */
  warmCache(): Promise<Capabilities>;

  /**
   * Get cache information
   * @returns Cache status and metadata
   */
  getCacheInfo(): CacheInfo;
}

export default FixiPlugAgent;

/**
 * Executable workflow with execute method
 */
export interface ExecutableWorkflow {
  /**
   * Execute the workflow
   * @returns Workflow execution result
   */
  execute(): Promise<WorkflowResult & { skipped?: string[] }>;

  /**
   * Get the workflow definition
   * @returns Workflow definition
   */
  getDefinition(): {
    steps: Array<{
      name: string;
      hook: string;
      hasParams: boolean;
      hasState: boolean;
      hasCondition: boolean;
      retry: boolean;
    }>;
    options: WorkflowOptions;
  };
}

/**
 * Fluent workflow builder for constructing complex workflows
 */
export class WorkflowBuilder {
  /**
   * Create a new WorkflowBuilder
   * @param agent - FixiPlugAgent instance
   */
  constructor(agent: FixiPlugAgent);

  /**
   * Add a new step to the workflow
   * @param name - Step name
   * @param hook - Hook to dispatch
   * @returns this for chaining
   */
  step(name: string, hook: string): this;

  /**
   * Set parameters for the current step
   * @param params - Parameters to pass
   * @returns this for chaining
   */
  params(params: any | ((context: WorkflowContext) => any)): this;

  /**
   * Set state for the current step
   * @param state - State to set before executing
   * @returns this for chaining
   */
  state(state: string): this;

  /**
   * Add a condition for executing the current step
   * @param condition - Function returning boolean
   * @returns this for chaining
   */
  when(condition: (context: WorkflowContext) => boolean): this;

  /**
   * Disable retry for the current step
   * @returns this for chaining
   */
  noRetry(): this;

  /**
   * Continue workflow on errors instead of stopping
   * @returns this for chaining
   */
  continueOnError(): this;

  /**
   * Stop workflow on first error (default)
   * @returns this for chaining
   */
  stopOnError(): this;

  /**
   * Add an error handler
   * @param handler - Function receiving error and context
   * @returns this for chaining
   */
  onError(handler: (error: Error, context: WorkflowContext) => void | Promise<void>): this;

  /**
   * Add a before-execution handler
   * @param handler - Function receiving step and context
   * @returns this for chaining
   */
  before(handler: (step: WorkflowStep, context: WorkflowContext) => void | Promise<void>): this;

  /**
   * Add an after-execution handler
   * @param handler - Function receiving step, result, and context
   * @returns this for chaining
   */
  after(
    handler: (step: WorkflowStep, result: any, context: WorkflowContext) => void | Promise<void>
  ): this;

  /**
   * Build and return the executable workflow
   * @returns Executable workflow
   */
  build(): ExecutableWorkflow;
}
