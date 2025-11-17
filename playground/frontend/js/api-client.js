/**
 * API Client
 *
 * Handles REST API calls to the Agent Playground backend
 */

export class APIClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  /**
   * Make HTTP request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * GET request
   */
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  /**
   * POST request
   */
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * DELETE request
   */
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // ============================================================
  // Health & Capabilities
  // ============================================================

  /**
   * Check backend health
   */
  async checkHealth() {
    return this.get('/health');
  }

  /**
   * Get capabilities
   */
  async getCapabilities() {
    const response = await this.get('/api/capabilities');
    return response.data;
  }

  /**
   * Get tools for provider
   */
  async getTools(provider) {
    return this.get(`/api/tools/${provider}`);
  }

  // ============================================================
  // Chat
  // ============================================================

  /**
   * Send chat message
   */
  async chat(provider, options) {
    return this.post(`/api/chat/${provider}`, options);
  }

  // ============================================================
  // Conversations
  // ============================================================

  /**
   * List conversations
   */
  async listConversations() {
    return this.get('/api/conversations');
  }

  /**
   * Get conversation
   */
  async getConversation(id) {
    return this.get(`/api/conversations/${id}`);
  }

  /**
   * Delete conversation
   */
  async deleteConversation(id) {
    return this.delete(`/api/conversations/${id}`);
  }

  // ============================================================
  // Agent State
  // ============================================================

  /**
   * Get agent state
   */
  async getState() {
    return this.get('/api/agent/state');
  }

  /**
   * Set agent state
   */
  async setState(state, metadata) {
    return this.post('/api/agent/state', { state, metadata });
  }

  // ============================================================
  // Workflow
  // ============================================================

  /**
   * Execute workflow
   */
  async executeWorkflow(steps, options = {}) {
    return this.post('/api/workflow/execute', {
      steps,
      stopOnError: options.stopOnError !== false
    });
  }
}

export default APIClient;
