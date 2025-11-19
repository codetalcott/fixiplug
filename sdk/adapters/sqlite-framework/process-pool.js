/**
 * Process Pool Manager for Python Bridge
 *
 * Manages a pool of Python processes for executing bridge requests.
 * Handles process lifecycle, health checks, and load distribution.
 *
 * @module sdk/adapters/sqlite-framework/process-pool
 */

import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { ProcessError, TimeoutError } from './errors.js';
import {
  createRequest,
  parseResponse,
  serializeRequest,
  CorrelationTracker
} from './protocol.js';

/**
 * Process states
 * @enum {string}
 */
export const ProcessState = {
  STARTING: 'starting',
  READY: 'ready',
  BUSY: 'busy',
  IDLE: 'idle',
  ERROR: 'error',
  STOPPING: 'stopping',
  STOPPED: 'stopped'
};

/**
 * Managed Python process wrapper
 *
 * @class ManagedProcess
 * @extends EventEmitter
 * @private
 */
class ManagedProcess extends EventEmitter {
  /**
   * Create a managed process
   *
   * @param {number} id - Process ID
   * @param {Object} config - Configuration
   */
  constructor(id, config) {
    super();

    this.id = id;
    this.config = config;
    this.process = null;
    this.state = ProcessState.STARTING;

    // Request tracking
    this.correlationTracker = new CorrelationTracker();
    this.activeRequests = 0;

    // Statistics
    this.stats = {
      startTime: null,
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      lastRequest: null,
      lastError: null,
      uptime: 0
    };

    // Buffer for stdout/stderr
    this.stdoutBuffer = '';
    this.stderrBuffer = '';

    // Health check
    this.lastHealthCheck = null;
    this.healthCheckTimer = null;

    // Idle timeout
    this.idleTimer = null;
  }

  /**
   * Start the Python process
   * @returns {Promise<void>}
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        // Spawn Python process
        this.process = spawn(
          this.config.pythonExecutable,
          [
            '-u', // Unbuffered output
            '-m', 'json_rpc_server', // RPC server module (to be created)
            '--framework-path', this.config.frameworkPath
          ],
          {
            cwd: this.config.frameworkPath,
            env: {
              ...process.env,
              PYTHONUNBUFFERED: '1'
            }
          }
        );

        this.stats.startTime = Date.now();

        // Setup stdout handler
        this.process.stdout.on('data', (data) => {
          this._handleStdout(data);
        });

        // Setup stderr handler
        this.process.stderr.on('data', (data) => {
          this._handleStderr(data);
        });

        // Setup exit handler
        this.process.on('exit', (code, signal) => {
          this._handleExit(code, signal);
        });

        // Setup error handler
        this.process.on('error', (error) => {
          this._handleError(error);
        });

        // Wait for ready signal or timeout
        const timeout = setTimeout(() => {
          this.kill();
          reject(new TimeoutError(
            'Process startup timeout',
            this.config.processStartupTimeout
          ));
        }, this.config.processStartupTimeout);

        this.once('ready', () => {
          clearTimeout(timeout);
          this.state = ProcessState.READY;
          this._setIdle();
          resolve();
        });

        this.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

      } catch (error) {
        reject(new ProcessError(
          'Failed to spawn Python process',
          -1,
          error.message
        ));
      }
    });
  }

  /**
   * Execute a request on this process
   *
   * @param {string} method - Method name
   * @param {Object} params - Method parameters
   * @param {Object} [options={}] - Request options
   * @returns {Promise<*>} Result
   */
  async execute(method, params, options = {}) {
    if (this.state !== ProcessState.READY && this.state !== ProcessState.IDLE) {
      throw new ProcessError(
        `Process is not ready (state: ${this.state})`,
        -1,
        ''
      );
    }

    return new Promise((resolve, reject) => {
      try {
        // Create request
        const request = createRequest(method, params, {
          timeout: options.timeout || this.config.requestTimeout
        });

        // Update state
        this._setBusy();
        this.activeRequests++;
        this.stats.totalRequests++;
        this.stats.lastRequest = Date.now();

        // Register request
        this.correlationTracker.registerRequest(
          request.id,
          request,
          (error, result) => {
            this.activeRequests--;

            if (error) {
              this.stats.totalFailures++;
              this.stats.lastError = {
                timestamp: Date.now(),
                error: error.message
              };
              this._setIdle();
              reject(error);
            } else {
              this.stats.totalSuccesses++;
              this._setIdle();
              resolve(result);
            }
          },
          request.metadata?.timeout
        );

        // Send request
        const json = serializeRequest(request);
        this.process.stdin.write(json + '\n');

      } catch (error) {
        this.activeRequests--;
        this._setIdle();
        reject(error);
      }
    });
  }

  /**
   * Handle stdout data
   * @param {Buffer} data - Data buffer
   * @private
   */
  _handleStdout(data) {
    this.stdoutBuffer += data.toString();

    // Process complete lines
    let newlineIndex;
    while ((newlineIndex = this.stdoutBuffer.indexOf('\n')) !== -1) {
      const line = this.stdoutBuffer.substring(0, newlineIndex);
      this.stdoutBuffer = this.stdoutBuffer.substring(newlineIndex + 1);

      this._processLine(line);
    }
  }

  /**
   * Handle stderr data
   * @param {Buffer} data - Data buffer
   * @private
   */
  _handleStderr(data) {
    this.stderrBuffer += data.toString();

    // Log stderr output
    if (this.config.debug) {
      console.error(`[Process ${this.id}] stderr:`, data.toString());
    }
  }

  /**
   * Process a complete line from stdout
   * @param {string} line - Line to process
   * @private
   */
  _processLine(line) {
    try {
      // Check for ready signal
      if (line.trim() === 'READY') {
        this.emit('ready');
        return;
      }

      // Try to parse as JSON-RPC response
      const response = parseResponse(line);

      // Handle response
      this.correlationTracker.handleResponse(response);

    } catch (error) {
      if (this.config.debug) {
        console.error(`[Process ${this.id}] Failed to parse line:`, line, error);
      }
    }
  }

  /**
   * Handle process exit
   * @param {number} code - Exit code
   * @param {string} signal - Exit signal
   * @private
   */
  _handleExit(code, signal) {
    this.state = ProcessState.STOPPED;

    // Cancel all pending requests
    this.correlationTracker.cancelAll();

    // Clear timers
    if (this.healthCheckTimer) {
      clearTimeout(this.healthCheckTimer);
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    // Emit event
    this.emit('exit', { code, signal });

    if (code !== 0 && code !== null) {
      const error = new ProcessError(
        `Process exited with code ${code}`,
        code,
        this.stderrBuffer
      );
      this.emit('error', error);
    }
  }

  /**
   * Handle process error
   * @param {Error} error - Error object
   * @private
   */
  _handleError(error) {
    this.state = ProcessState.ERROR;
    this.stats.lastError = {
      timestamp: Date.now(),
      error: error.message
    };
    this.emit('error', error);
  }

  /**
   * Set process to busy state
   * @private
   */
  _setBusy() {
    this.state = ProcessState.BUSY;

    // Clear idle timer
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Set process to idle state
   * @private
   */
  _setIdle() {
    if (this.activeRequests === 0) {
      this.state = ProcessState.IDLE;

      // Start idle timeout
      if (this.config.processIdleTimeout > 0) {
        this.idleTimer = setTimeout(() => {
          this.emit('idle-timeout');
        }, this.config.processIdleTimeout);
      }
    } else {
      this.state = ProcessState.BUSY;
    }
  }

  /**
   * Check if process is available for requests
   * @returns {boolean}
   */
  isAvailable() {
    return (
      (this.state === ProcessState.READY || this.state === ProcessState.IDLE) &&
      this.activeRequests < this.config.maxConcurrentRequests
    );
  }

  /**
   * Get process statistics
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats,
      state: this.state,
      activeRequests: this.activeRequests,
      uptime: Date.now() - this.stats.startTime,
      pendingRequests: this.correlationTracker.getPendingCount()
    };
  }

  /**
   * Kill the process
   * @param {string} [signal='SIGTERM'] - Signal to send
   */
  kill(signal = 'SIGTERM') {
    if (this.process && !this.process.killed) {
      this.state = ProcessState.STOPPING;
      this.process.kill(signal);
    }
  }

  /**
   * Gracefully shutdown the process
   * @returns {Promise<void>}
   */
  async shutdown() {
    return new Promise((resolve) => {
      if (!this.process || this.process.killed) {
        resolve();
        return;
      }

      // Wait for exit
      this.once('exit', () => {
        resolve();
      });

      // Send SIGTERM
      this.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.kill('SIGKILL');
        }
      }, 5000);
    });
  }
}

/**
 * Process pool manager
 *
 * @class ProcessPool
 * @extends EventEmitter
 *
 * @example
 * const pool = new ProcessPool(config);
 * await pool.start();
 *
 * const result = await pool.execute('method.name', { param: 'value' });
 *
 * await pool.shutdown();
 */
export class ProcessPool extends EventEmitter {
  /**
   * Create a process pool
   * @param {Object} config - Configuration
   */
  constructor(config) {
    super();

    this.config = config;
    this.processes = [];
    this.nextProcessId = 0;
    this.roundRobinIndex = 0;

    // Pool state
    this.started = false;
    this.shuttingDown = false;

    // Statistics
    this.stats = {
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      processRestarts: 0
    };
  }

  /**
   * Start the process pool
   * @returns {Promise<void>}
   */
  async start() {
    if (this.started) {
      return;
    }

    // Start initial processes
    const startPromises = [];
    for (let i = 0; i < this.config.maxProcesses; i++) {
      startPromises.push(this._createProcess());
    }

    await Promise.all(startPromises);

    this.started = true;
    this.emit('started');
  }

  /**
   * Create and start a new process
   * @returns {Promise<ManagedProcess>}
   * @private
   */
  async _createProcess() {
    const id = this.nextProcessId++;
    const process = new ManagedProcess(id, this.config);

    // Setup event handlers
    process.on('exit', () => {
      this._handleProcessExit(process);
    });

    process.on('error', (error) => {
      this._handleProcessError(process, error);
    });

    process.on('idle-timeout', () => {
      this._handleIdleTimeout(process);
    });

    // Start process
    await process.start();

    // Add to pool
    this.processes.push(process);

    this.emit('process-started', { id });

    return process;
  }

  /**
   * Handle process exit
   * @param {ManagedProcess} process - Process that exited
   * @private
   */
  async _handleProcessExit(process) {
    // Remove from pool
    const index = this.processes.indexOf(process);
    if (index !== -1) {
      this.processes.splice(index, 1);
    }

    this.emit('process-exited', { id: process.id });

    // Restart if not shutting down
    if (!this.shuttingDown && this.started) {
      try {
        this.stats.processRestarts++;
        await this._createProcess();
        this.emit('process-restarted');
      } catch (error) {
        this.emit('process-restart-failed', { error });
      }
    }
  }

  /**
   * Handle process error
   * @param {ManagedProcess} process - Process with error
   * @param {Error} error - Error object
   * @private
   */
  _handleProcessError(process, error) {
    this.emit('process-error', { id: process.id, error });
  }

  /**
   * Handle idle timeout
   * @param {ManagedProcess} process - Idle process
   * @private
   */
  async _handleIdleTimeout(process) {
    // Don't recycle if it's the last process
    if (this.processes.length <= 1) {
      return;
    }

    this.emit('process-recycling', { id: process.id });

    // Shutdown process
    await process.shutdown();

    // It will be restarted by _handleProcessExit if needed
  }

  /**
   * Get an available process (round-robin)
   * @returns {ManagedProcess|null}
   * @private
   */
  _getAvailableProcess() {
    if (this.processes.length === 0) {
      return null;
    }

    // Try round-robin first
    for (let i = 0; i < this.processes.length; i++) {
      const index = (this.roundRobinIndex + i) % this.processes.length;
      const process = this.processes[index];

      if (process.isAvailable()) {
        this.roundRobinIndex = (index + 1) % this.processes.length;
        return process;
      }
    }

    // No available process
    return null;
  }

  /**
   * Execute a request on the pool
   *
   * @param {string} method - Method name
   * @param {Object} params - Method parameters
   * @param {Object} [options={}] - Request options
   * @returns {Promise<*>} Result
   * @throws {Error} If pool is not started or no process available
   */
  async execute(method, params, options = {}) {
    if (!this.started) {
      throw new Error('Process pool not started');
    }

    if (this.shuttingDown) {
      throw new Error('Process pool is shutting down');
    }

    this.stats.totalRequests++;

    // Get available process
    const process = this._getAvailableProcess();

    if (!process) {
      this.stats.totalFailures++;
      throw new Error('No available process in pool');
    }

    try {
      const result = await process.execute(method, params, options);
      this.stats.totalSuccesses++;
      return result;
    } catch (error) {
      this.stats.totalFailures++;
      throw error;
    }
  }

  /**
   * Get pool statistics
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats,
      processCount: this.processes.length,
      availableProcesses: this.processes.filter(p => p.isAvailable()).length,
      processes: this.processes.map(p => p.getStats())
    };
  }

  /**
   * Shutdown the pool
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.shuttingDown) {
      return;
    }

    this.shuttingDown = true;
    this.emit('shutting-down');

    // Shutdown all processes
    const shutdownPromises = this.processes.map(p => p.shutdown());
    await Promise.all(shutdownPromises);

    this.processes = [];
    this.started = false;
    this.shuttingDown = false;

    this.emit('shutdown');
  }
}
