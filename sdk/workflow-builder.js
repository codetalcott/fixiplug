/**
 * FixiPlug Agent SDK - Workflow Builder
 *
 * Provides a fluent API for constructing complex workflows with
 * step dependencies, conditional execution, and error handling.
 *
 * @module sdk/workflow-builder
 * @example
 * import { WorkflowBuilder } from './sdk/workflow-builder.js';
 *
 * const workflow = new WorkflowBuilder(agent)
 *   .step('init', 'api:setState')
 *     .params({ state: 'initialized' })
 *     .state('initializing')
 *   .step('process', 'api:process')
 *     .params(ctx => ({ data: ctx.results.init }))
 *   .onError((error, ctx) => {
 *     console.error('Workflow failed:', error);
 *   })
 *   .build();
 *
 * await workflow.execute();
 */

/**
 * Builder for constructing workflow steps with a fluent API
 *
 * @class WorkflowBuilder
 * @example
 * const workflow = new WorkflowBuilder(agent)
 *   .step('fetch', 'data:fetch')
 *     .params({ url: '/api/data' })
 *   .step('transform', 'data:transform')
 *     .params(ctx => ({ data: ctx.results.fetch }))
 *   .build();
 */
export class WorkflowBuilder {
  /**
   * Create a new WorkflowBuilder
   *
   * @param {Object} agent - FixiPlugAgent instance
   */
  constructor(agent) {
    if (!agent) {
      throw new Error('WorkflowBuilder requires a FixiPlugAgent instance');
    }

    this.agent = agent;
    this.steps = [];
    this.currentStep = null;
    this.options = {
      stopOnError: true
    };
    this.errorHandlers = [];
    this.beforeHandlers = [];
    this.afterHandlers = [];
  }

  /**
   * Add a new step to the workflow
   *
   * @param {string} name - Step name (for result tracking)
   * @param {string} hook - Hook to dispatch for this step
   * @returns {WorkflowBuilder} this for chaining
   *
   * @example
   * builder.step('fetch', 'data:fetch')
   */
  step(name, hook) {
    if (!name || !hook) {
      throw new Error('Step requires both name and hook parameters');
    }

    this.currentStep = {
      name,
      hook,
      params: {},
      state: null,
      condition: null,
      retry: true
    };

    this.steps.push(this.currentStep);
    return this;
  }

  /**
   * Set parameters for the current step
   *
   * @param {Object|Function} params - Parameters to pass (can be function receiving context)
   * @returns {WorkflowBuilder} this for chaining
   *
   * @example
   * builder.step('process', 'api:process')
   *   .params({ config: 'default' })
   *
   * @example
   * builder.step('transform', 'api:transform')
   *   .params(ctx => ({ data: ctx.results.fetch }))
   */
  params(params) {
    if (!this.currentStep) {
      throw new Error('params() must be called after step()');
    }

    if (params !== null && typeof params !== 'object' && typeof params !== 'function') {
      throw new Error('params() requires an object or function parameter');
    }

    this.currentStep.params = params;
    return this;
  }

  /**
   * Set state for the current step
   *
   * @param {string} state - State to set before executing this step
   * @returns {WorkflowBuilder} this for chaining
   *
   * @example
   * builder.step('save', 'data:save')
   *   .state('saving')
   */
  state(state) {
    if (!this.currentStep) {
      throw new Error('state() must be called after step()');
    }

    this.currentStep.state = state;
    return this;
  }

  /**
   * Add a condition for executing the current step
   *
   * @param {Function} condition - Function receiving context, returns boolean
   * @returns {WorkflowBuilder} this for chaining
   *
   * @example
   * builder.step('optional', 'api:optional')
   *   .when(ctx => ctx.results.fetch.needsProcessing)
   */
  when(condition) {
    if (!this.currentStep) {
      throw new Error('when() must be called after step()');
    }

    if (typeof condition !== 'function') {
      throw new Error('when() requires a function parameter');
    }

    this.currentStep.condition = condition;
    return this;
  }

  /**
   * Disable retry for the current step
   *
   * @returns {WorkflowBuilder} this for chaining
   *
   * @example
   * builder.step('critical', 'api:critical')
   *   .noRetry()
   */
  noRetry() {
    if (!this.currentStep) {
      throw new Error('noRetry() must be called after step()');
    }

    this.currentStep.retry = false;
    return this;
  }

  /**
   * Continue workflow on errors instead of stopping
   *
   * @returns {WorkflowBuilder} this for chaining
   *
   * @example
   * const workflow = new WorkflowBuilder(agent)
   *   .continueOnError()
   *   .step('step1', 'api:step1')
   *   .step('step2', 'api:step2')
   *   .build();
   */
  continueOnError() {
    this.options.stopOnError = false;
    return this;
  }

  /**
   * Stop workflow on first error (default behavior)
   *
   * @returns {WorkflowBuilder} this for chaining
   *
   * @example
   * const workflow = new WorkflowBuilder(agent)
   *   .stopOnError()
   *   .step('critical1', 'api:critical1')
   *   .step('critical2', 'api:critical2')
   *   .build();
   */
  stopOnError() {
    this.options.stopOnError = true;
    return this;
  }

  /**
   * Add an error handler
   *
   * @param {Function} handler - Function receiving (error, context)
   * @returns {WorkflowBuilder} this for chaining
   *
   * @example
   * builder.onError((error, ctx) => {
   *   console.error('Workflow failed:', error);
   *   console.log('Completed steps:', ctx.completed);
   * })
   */
  onError(handler) {
    if (typeof handler !== 'function') {
      throw new Error('onError() requires a function parameter');
    }

    this.errorHandlers.push(handler);
    return this;
  }

  /**
   * Add a before-execution handler
   *
   * @param {Function} handler - Function receiving (step, context)
   * @returns {WorkflowBuilder} this for chaining
   *
   * @example
   * builder.before((step, ctx) => {
   *   console.log('Executing step:', step.name);
   * })
   */
  before(handler) {
    if (typeof handler !== 'function') {
      throw new Error('before() requires a function parameter');
    }

    this.beforeHandlers.push(handler);
    return this;
  }

  /**
   * Add an after-execution handler
   *
   * @param {Function} handler - Function receiving (step, result, context)
   * @returns {WorkflowBuilder} this for chaining
   *
   * @example
   * builder.after((step, result, ctx) => {
   *   console.log('Step completed:', step.name, result);
   * })
   */
  after(handler) {
    if (typeof handler !== 'function') {
      throw new Error('after() requires a function parameter');
    }

    this.afterHandlers.push(handler);
    return this;
  }

  /**
   * Build and return the executable workflow
   *
   * @returns {Object} Workflow object with execute() method
   *
   * @example
   * const workflow = builder.build();
   * const result = await workflow.execute();
   */
  build() {
    if (this.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    const steps = [...this.steps];
    const options = { ...this.options };
    const errorHandlers = [...this.errorHandlers];
    const beforeHandlers = [...this.beforeHandlers];
    const afterHandlers = [...this.afterHandlers];
    const agent = this.agent;

    return {
      /**
       * Execute the workflow
       *
       * @returns {Promise<Object>} Workflow execution result
       */
      execute: async () => {
        const context = {
          results: {},
          errors: [],
          completed: [],
          skipped: []
        };

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const stepName = step.name;

          try {
            // Check condition
            if (step.condition && !step.condition(context)) {
              context.skipped.push(stepName);
              continue;
            }

            // Call before handlers
            for (const handler of beforeHandlers) {
              await handler(step, context);
            }

            // Set state for this step
            if (step.state) {
              await agent.setState(step.state);
            }

            // Get params (can be function or object)
            const params = typeof step.params === 'function'
              ? step.params(context)
              : step.params || {};

            // Execute step through agent dispatch (includes retry + perf tracking)
            const result = await agent._dispatch(step.hook, params, { retry: step.retry });

            if (result.error) {
              throw new Error(result.error);
            }

            // Store result
            context.results[stepName] = result;
            context.completed.push(stepName);

            // Call after handlers
            for (const handler of afterHandlers) {
              await handler(step, result, context);
            }

          } catch (error) {
            // Record error
            const errorInfo = {
              step: stepName,
              error: error.message,
              index: i
            };
            context.errors.push(errorInfo);

            // Call error handlers
            for (const handler of errorHandlers) {
              try {
                await handler(error, context);
              } catch (handlerError) {
                console.error('Error handler failed:', handlerError);
              }
            }

            if (options.stopOnError) {
              return {
                success: false,
                completed: context.completed,
                results: context.results,
                errors: context.errors,
                skipped: context.skipped,
                stoppedAt: stepName
              };
            }
          }
        }

        return {
          success: context.errors.length === 0,
          completed: context.completed,
          results: context.results,
          errors: context.errors,
          skipped: context.skipped
        };
      },

      /**
       * Get the workflow definition
       *
       * @returns {Object} Workflow definition
       */
      getDefinition: () => ({
        steps: steps.map(s => ({
          name: s.name,
          hook: s.hook,
          hasParams: !!s.params,
          hasState: !!s.state,
          hasCondition: !!s.condition,
          retry: s.retry
        })),
        options
      })
    };
  }
}

/**
 * Export default for convenience
 */
export default WorkflowBuilder;
