import { PluginManagerExtension, PluginManager, PluginHook, PluginContext, FixiPlugs } from '..';

/**
 * Extension that provides circuit breaker functionality
 */
export class CircuitBreakerExtension implements PluginManagerExtension {
  private manager!: PluginManager;
  private circuitState = new Map<string, {
    failures: number;
    lastFailure: number;
    isOpen: boolean;
  }>();
  
  init(manager: PluginManager): void {
    this.manager = manager;
  }
  
  beforeHook<T extends PluginContext>(plugin: FixiPlugs, hookType: PluginHook, context: T): boolean | void {
    // Skip if circuit breaker is not configured
    if (!plugin.circuitBreaker) return;
    
    const pluginKey = `${plugin.name}:${hookType}`;
    const circuit = this.circuitState.get(pluginKey) || { 
      failures: 0, 
      lastFailure: 0, 
      isOpen: false 
    };
    
    if (circuit.isOpen) {
      const resetTimeout = plugin.circuitBreaker.resetTimeout || 30000;
      if (Date.now() - circuit.lastFailure > resetTimeout) {
        // Try to close the circuit
        circuit.isOpen = false;
        this.circuitState.set(pluginKey, circuit);
      } else {
        // Circuit still open, skip plugin
        return false;
      }
    }
    
    return;
  }
  
  onHookError<T extends PluginContext>(plugin: FixiPlugs, hookType: PluginHook, context: T, error: Error): boolean | void {
    // Skip if circuit breaker is not configured
    if (!plugin.circuitBreaker) return;
    
    const pluginKey = `${plugin.name}:${hookType}`;
    const circuit = this.circuitState.get(pluginKey) || { 
      failures: 0, 
      lastFailure: 0, 
      isOpen: false 
    };
    
    circuit.failures++;
    circuit.lastFailure = Date.now();
    
    if (circuit.failures >= plugin.circuitBreaker.failureThreshold) {
      circuit.isOpen = true;
    }
    
    this.circuitState.set(pluginKey, circuit);
    
    // Only handle the error if the circuit is configured to open
    return circuit.isOpen;
  }
  
  resetCircuitBreakers(pluginName?: string): void {
    if (pluginName) {
      for (const key of Array.from(this.circuitState.keys())) {
        if (key.startsWith(`${pluginName}:`)) {
          this.circuitState.delete(key);
        }
      }
    } else {
      this.circuitState.clear();
    }
  }
}