/**
 * LLM Provider Service
 *
 * Abstraction layer for different LLM providers (OpenAI, Anthropic)
 * Provides unified interface for chat completions and message creation.
 *
 * @module playground/backend/services/llm-provider
 */

/**
 * LLM Provider Service
 *
 * Handles interactions with multiple LLM providers
 */
export class LLMProviderService {
  constructor(config = {}) {
    this.config = config;
    this.providers = {};
    this.initialized = false;

    // Lazy load provider SDKs
    this._initPromise = this._initializeProviders();
  }

  /**
   * Initialize provider clients
   *
   * @private
   */
  async _initializeProviders() {
    // OpenAI provider
    if (this.config.openai?.apiKey) {
      try {
        const { default: OpenAI } = await import('openai');
        this.providers.openai = new OpenAI({
          apiKey: this.config.openai.apiKey
        });
      } catch (error) {
        console.warn('OpenAI SDK not available:', error.message);
      }
    }

    // Anthropic provider
    if (this.config.anthropic?.apiKey) {
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        this.providers.anthropic = new Anthropic({
          apiKey: this.config.anthropic.apiKey
        });
      } catch (error) {
        console.warn('Anthropic SDK not available:', error.message);
      }
    }

    this.initialized = true;
  }

  /**
   * Ensure providers are initialized
   * @private
   */
  async _ensureInitialized() {
    if (!this.initialized) {
      await this._initPromise;
    }
  }

  /**
   * Check if provider is available
   *
   * @param {string} provider - Provider name
   * @returns {boolean}
   */
  isProviderAvailable(provider) {
    return !!this.providers[provider];
  }

  /**
   * OpenAI chat completion
   *
   * @param {Object} options - Chat completion options
   * @returns {Promise<Object>} Completion response
   */
  async chatCompletion(options) {
    await this._ensureInitialized();

    const {
      provider,
      model,
      messages,
      tools,
      stream = false,
      temperature,
      max_tokens
    } = options;

    if (provider !== 'openai') {
      throw new Error(`Invalid provider for chatCompletion: ${provider}`);
    }

    if (!this.providers.openai) {
      throw new Error('OpenAI provider not initialized');
    }

    const params = {
      model,
      messages,
      stream
    };

    if (tools && tools.length > 0) {
      params.tools = tools;
    }

    if (temperature !== undefined) {
      params.temperature = temperature;
    }

    if (max_tokens !== undefined) {
      params.max_tokens = max_tokens;
    }

    return await this.providers.openai.chat.completions.create(params);
  }

  /**
   * Anthropic message creation
   *
   * @param {Object} options - Message creation options
   * @returns {Promise<Object>} Message response
   */
  async createMessage(options) {
    await this._ensureInitialized();

    const {
      provider,
      model,
      messages,
      tools,
      stream = false,
      temperature,
      max_tokens = 4096
    } = options;

    if (provider !== 'anthropic') {
      throw new Error(`Invalid provider for createMessage: ${provider}`);
    }

    if (!this.providers.anthropic) {
      throw new Error('Anthropic provider not initialized');
    }

    const params = {
      model,
      messages,
      max_tokens,
      stream
    };

    if (tools && tools.length > 0) {
      params.tools = tools;
    }

    if (temperature !== undefined) {
      params.temperature = temperature;
    }

    return await this.providers.anthropic.messages.create(params);
  }

  /**
   * Generic chat method that routes to appropriate provider
   *
   * @param {Object} options - Chat options
   * @returns {Promise<Object>} Response
   */
  async chat(options) {
    const { provider } = options;

    switch (provider) {
      case 'openai':
        return await this.chatCompletion(options);
      case 'anthropic':
        return await this.createMessage(options);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Get available providers
   *
   * @returns {Array<string>} List of available provider names
   */
  getAvailableProviders() {
    return Object.keys(this.providers);
  }

  /**
   * Get provider info
   *
   * @returns {Object} Provider information
   */
  getProviderInfo() {
    return {
      openai: {
        available: this.isProviderAvailable('openai'),
        models: this.isProviderAvailable('openai') ? [
          'gpt-4',
          'gpt-4-turbo',
          'gpt-3.5-turbo'
        ] : []
      },
      anthropic: {
        available: this.isProviderAvailable('anthropic'),
        models: this.isProviderAvailable('anthropic') ? [
          'claude-3-5-sonnet-20241022',
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307'
        ] : []
      }
    };
  }
}

export default LLMProviderService;
