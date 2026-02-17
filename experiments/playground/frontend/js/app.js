/**
 * FixiPlug Agent Playground - Main Application
 *
 * Handles UI interactions, message display, and coordination between
 * WebSocket and REST API clients.
 */

import { WebSocketClient } from './websocket-client.js';
import { APIClient } from './api-client.js';

class AgentPlayground {
  constructor() {
    // Configuration
    this.apiBaseURL = window.location.origin;
    this.wsURL = `ws://${window.location.host}`;

    // State
    this.currentProvider = 'claude-agent';  // Default to Claude Agent SDK
    this.currentModel = 'claude-haiku-4-5-20251001';  // Default to Haiku 4.5
    this.conversationId = null;
    this.messages = [];
    this.useWebSocket = true;
    this.streaming = true;
    this.streamingMessageElement = null;  // Track current streaming message element
    this.lastStreamedContent = null;  // Track last streamed message content to prevent duplicates

    // Stats
    this.stats = {
      messages: 0,
      tools: 0,
      tokens: 0
    };

    // Clients
    this.wsClient = null;
    this.apiClient = new APIClient(this.apiBaseURL);

    // DOM Elements
    this.elements = {};

    // Initialize
    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    this.setupDOM();
    this.setupEventListeners();
    await this.checkHealth();
    this.connectWebSocket();
    this.updateConnectionStatus('connecting');
  }

  /**
   * Setup DOM element references
   */
  setupDOM() {
    this.elements = {
      // Connection
      connectionStatus: document.getElementById('connectionStatus'),
      connectionText: document.getElementById('connectionText'),

      // Provider & Model
      providerOpenAI: document.getElementById('providerOpenAI'),
      providerAnthropic: document.getElementById('providerAnthropic'),
      providerClaudeAgent: document.getElementById('providerClaudeAgent'),
      modelSelect: document.getElementById('modelSelect'),

      // Options
      streamingToggle: document.getElementById('streamingToggle'),
      websocketToggle: document.getElementById('websocketToggle'),

      // Capabilities
      discoverBtn: document.getElementById('discoverBtn'),
      capabilitiesInfo: document.getElementById('capabilitiesInfo'),

      // Conversations
      newConversationBtn: document.getElementById('newConversationBtn'),
      listConversationsBtn: document.getElementById('listConversationsBtn'),
      conversationsList: document.getElementById('conversationsList'),

      // Stats
      statMessages: document.getElementById('statMessages'),
      statTools: document.getElementById('statTools'),
      statTokens: document.getElementById('statTokens'),

      // Chat
      messagesContainer: document.getElementById('messagesContainer'),
      messageInput: document.getElementById('messageInput'),
      sendBtn: document.getElementById('sendBtn'),
      clearBtn: document.getElementById('clearBtn'),

      // Modal
      conversationsModal: document.getElementById('conversationsModal'),
      modalClose: document.getElementById('modalClose'),
      modalBody: document.getElementById('modalBody')
    };
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Provider selection
    this.elements.providerOpenAI.addEventListener('click', () => this.selectProvider('openai'));
    this.elements.providerAnthropic.addEventListener('click', () => this.selectProvider('anthropic'));
    this.elements.providerClaudeAgent.addEventListener('click', () => this.selectProvider('claude-agent'));

    // Model selection
    this.elements.modelSelect.addEventListener('change', (e) => {
      this.currentModel = e.target.value;
    });

    // Options
    this.elements.streamingToggle.addEventListener('change', (e) => {
      this.streaming = e.target.checked;
    });

    this.elements.websocketToggle.addEventListener('change', (e) => {
      this.useWebSocket = e.target.checked;
      if (this.useWebSocket && !this.wsClient) {
        this.connectWebSocket();
      }
    });

    // Capabilities
    this.elements.discoverBtn.addEventListener('click', () => this.discoverCapabilities());

    // Conversations
    this.elements.newConversationBtn.addEventListener('click', () => this.newConversation());
    this.elements.listConversationsBtn.addEventListener('click', () => this.showConversations());

    // Chat
    this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
    this.elements.clearBtn.addEventListener('click', () => this.clearMessages());

    // Input
    this.elements.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Modal
    this.elements.modalClose.addEventListener('click', () => this.hideModal());
    this.elements.conversationsModal.addEventListener('click', (e) => {
      if (e.target === this.elements.conversationsModal) {
        this.hideModal();
      }
    });
  }

  /**
   * Check backend health
   */
  async checkHealth() {
    try {
      const health = await this.apiClient.checkHealth();
      console.log('Backend health:', health);

      // Update provider buttons based on availability
      if (!health.providers.openai) {
        this.elements.providerOpenAI.disabled = true;
        this.elements.providerOpenAI.title = 'OpenAI API key not configured';
      }

      if (!health.providers.anthropic) {
        this.elements.providerAnthropic.disabled = true;
        this.elements.providerAnthropic.title = 'Anthropic API key not configured';
      }
    } catch (error) {
      console.error('Health check failed:', error);
      this.showError('Backend server not available');
    }
  }

  /**
   * Connect WebSocket
   */
  connectWebSocket() {
    this.wsClient = new WebSocketClient(this.wsURL);

    this.wsClient.on('connected', (data) => {
      console.log('WebSocket connected:', data);
      this.updateConnectionStatus('connected');
    });

    this.wsClient.on('disconnected', () => {
      console.log('WebSocket disconnected');
      this.updateConnectionStatus('disconnected');
    });

    this.wsClient.on('chat_chunk', (data) => {
      this.handleChatChunk(data);
    });

    this.wsClient.on('tool_call', (data) => {
      this.handleToolCall(data.toolCall);
    });

    this.wsClient.on('tool_use', (data) => {
      this.handleToolUse(data.toolUse);
    });

    this.wsClient.on('tool_result', (data) => {
      this.handleToolResult(data);
    });

    this.wsClient.on('chat_complete', () => {
      this.elements.sendBtn.disabled = false;
      this.elements.messageInput.disabled = false;
    });

    this.wsClient.on('claude_agent_stream', (data) => {
      this.handleClaudeAgentStream(data);
    });

    this.wsClient.on('claude_agent_message', (data) => {
      this.handleClaudeAgentMessage(data.message);
    });

    this.wsClient.on('claude_agent_complete', (data) => {
      this.handleClaudeAgentComplete(data);
      this.elements.sendBtn.disabled = false;
      this.elements.messageInput.disabled = false;
    });

    this.wsClient.on('claude_agent_error', (data) => {
      this.showError(data.error || 'Claude Agent SDK error');

      // Clear streaming message on error
      if (this.streamingMessageElement) {
        this.streamingMessageElement.remove();
        this.streamingMessageElement = null;
      }

      this.elements.sendBtn.disabled = false;
      this.elements.messageInput.disabled = false;
    });

    this.wsClient.on('error', (error) => {
      this.showError(error.error || error.message);
    });

    this.wsClient.connect();
  }

  /**
   * Update connection status
   */
  updateConnectionStatus(status) {
    this.elements.connectionStatus.className = `status-dot ${status}`;

    const statusText = {
      connecting: 'Connecting...',
      connected: 'Connected',
      disconnected: 'Disconnected'
    };

    this.elements.connectionText.textContent = statusText[status] || status;
  }

  /**
   * Select provider
   */
  selectProvider(provider) {
    this.currentProvider = provider;

    // Update UI
    document.querySelectorAll('.provider-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    const activeBtnMap = {
      'openai': this.elements.providerOpenAI,
      'anthropic': this.elements.providerAnthropic,
      'claude-agent': this.elements.providerClaudeAgent
    };
    const activeBtn = activeBtnMap[provider];
    if (activeBtn) {
      activeBtn.classList.add('active');
    }

    // Update model select
    const defaultModels = {
      'openai': 'gpt-5-nano-2025-08-07',
      'anthropic': 'claude-haiku-4-5-20251001',
      'claude-agent': 'claude-haiku-4-5-20251001'
    };

    const firstModel = defaultModels[provider] || 'claude-haiku-4-5-20251001';
    this.currentModel = firstModel;
    this.elements.modelSelect.value = firstModel;
  }

  /**
   * Discover capabilities
   */
  async discoverCapabilities() {
    try {
      const capabilities = await this.apiClient.getCapabilities();

      const info = `
Version: ${capabilities.version}
Plugins: ${capabilities.plugins.length}
Hooks: ${Object.keys(capabilities.hooks).length}

Available Hooks:
${Object.keys(capabilities.hooks).slice(0, 10).join('\n')}
${Object.keys(capabilities.hooks).length > 10 ? '...' : ''}
      `.trim();

      this.elements.capabilitiesInfo.textContent = info;
    } catch (error) {
      this.showError('Failed to discover capabilities');
    }
  }

  /**
   * New conversation
   */
  newConversation() {
    this.conversationId = null;
    this.messages = [];
    this.clearMessages();
    this.showInfo('Started new conversation');
  }

  /**
   * Show conversations
   */
  async showConversations() {
    try {
      const response = await this.apiClient.listConversations();
      const conversations = response.conversations;

      if (conversations.length === 0) {
        this.elements.modalBody.innerHTML = '<p class="text-center text-secondary">No conversations yet</p>';
      } else {
        this.elements.modalBody.innerHTML = conversations.map(conv => `
          <div class="conversation-item" data-id="${conv.id}">
            <div><strong>ID:</strong> ${conv.id.substring(0, 8)}...</div>
            <div><strong>Messages:</strong> ${conv.messageCount}</div>
            <div><strong>Created:</strong> ${new Date(conv.createdAt).toLocaleString()}</div>
          </div>
        `).join('');

        // Add click handlers
        this.elements.modalBody.querySelectorAll('.conversation-item').forEach(item => {
          item.addEventListener('click', () => {
            const id = item.dataset.id;
            this.loadConversation(id);
            this.hideModal();
          });
        });
      }

      this.showModal();
    } catch (error) {
      this.showError('Failed to load conversations');
    }
  }

  /**
   * Load conversation
   */
  async loadConversation(id) {
    try {
      const response = await this.apiClient.getConversation(id);
      const conversation = response.conversation;

      this.conversationId = id;
      this.messages = conversation.messages;
      this.clearMessages();

      // Display messages
      this.messages.forEach(msg => {
        this.displayMessage(msg);
      });

      this.showInfo(`Loaded conversation ${id.substring(0, 8)}...`);
    } catch (error) {
      this.showError('Failed to load conversation');
    }
  }

  /**
   * Send message
   */
  async sendMessage() {
    const content = this.elements.messageInput.value.trim();

    if (!content) return;

    // Add user message
    const userMessage = {
      role: 'user',
      content
    };

    this.messages.push(userMessage);
    this.displayMessage(userMessage);
    this.elements.messageInput.value = '';

    // Update stats
    this.stats.messages++;
    this.updateStats();

    // Disable input while processing
    this.elements.sendBtn.disabled = true;
    this.elements.messageInput.disabled = true;

    try {
      if (this.useWebSocket && this.wsClient && this.wsClient.isConnected()) {
        await this.sendViaWebSocket();
      } else {
        await this.sendViaHTTP();
      }
    } catch (error) {
      this.showError(error.message);
      this.elements.sendBtn.disabled = false;
      this.elements.messageInput.disabled = false;
    }
  }

  /**
   * Send via WebSocket
   */
  async sendViaWebSocket() {
    if (this.currentProvider === 'claude-agent') {
      // Send to Claude Agent SDK handler
      this.wsClient.send({
        type: 'claude_agent',
        prompt: this.messages[this.messages.length - 1].content,
        sessionId: this.conversationId,
        stream: this.streaming,
        permissionMode: 'bypassPermissions'  // Allow tool execution without prompts
      });
    } else {
      // Send to standard chat handler (OpenAI/Anthropic)
      this.wsClient.send({
        type: 'chat',
        provider: this.currentProvider,
        model: this.currentModel,
        messages: this.messages,
        conversationId: this.conversationId,
        stream: this.streaming
      });
    }
  }

  /**
   * Send via HTTP
   */
  async sendViaHTTP() {
    const endpoint = this.currentProvider === 'openai' ? 'openai' : 'anthropic';

    const response = await this.apiClient.chat(endpoint, {
      messages: this.messages,
      model: this.currentModel,
      stream: this.streaming,
      conversationId: this.conversationId
    });

    if (response.success) {
      this.conversationId = response.conversationId;

      const assistantMessage = {
        role: 'assistant',
        content: response.response.content || response.response
      };

      this.messages.push(assistantMessage);
      this.displayMessage(assistantMessage);

      // Update stats
      if (response.usage) {
        this.stats.tokens += response.usage.total_tokens || 0;
        this.updateStats();
      }
    }

    this.elements.sendBtn.disabled = false;
    this.elements.messageInput.disabled = false;
  }

  /**
   * Handle chat chunk (streaming)
   */
  handleChatChunk(data) {
    // This is a simplified handler - full implementation would accumulate chunks
    console.log('Chat chunk:', data);
  }

  /**
   * Handle tool call
   */
  handleToolCall(toolCall) {
    console.log('Tool call:', toolCall);

    this.stats.tools++;
    this.updateStats();

    const toolMessage = this.createToolMessage(toolCall.function.name, 'executing...');
    this.displayMessage({
      role: 'system',
      content: toolMessage,
      isHTML: true
    });
  }

  /**
   * Handle tool use (Anthropic)
   */
  handleToolUse(toolUse) {
    console.log('Tool use:', toolUse);

    this.stats.tools++;
    this.updateStats();

    const toolMessage = this.createToolMessage(toolUse.name, 'executing...');
    this.displayMessage({
      role: 'system',
      content: toolMessage,
      isHTML: true
    });
  }

  /**
   * Handle tool result
   */
  handleToolResult(data) {
    console.log('Tool result:', data);

    const toolName = data.toolCall?.function?.name || data.toolUse?.name || 'unknown';
    const result = typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2);

    const toolMessage = this.createToolMessage(toolName, result, 'success');
    this.displayMessage({
      role: 'system',
      content: toolMessage,
      isHTML: true
    });
  }

  /**
   * Create tool message HTML
   */
  createToolMessage(toolName, result, status = '') {
    return `
      <div class="tool-execution ${status}">
        <div class="tool-name">🔧 ${toolName}</div>
        <div class="tool-result">${this.escapeHTML(result)}</div>
      </div>
    `;
  }

  /**
   * Handle Claude Agent SDK streaming text chunks
   */
  handleClaudeAgentStream(data) {
    console.log('Claude Agent stream chunk:', data.text?.length || 0, 'chars');

    // Create or get streaming message element
    if (!this.streamingMessageElement) {
      // Create new assistant message element for streaming
      const messageEl = document.createElement('div');
      messageEl.className = 'message assistant streaming';

      const avatar = document.createElement('div');
      avatar.className = 'message-avatar';
      avatar.textContent = '🤖';

      const content = document.createElement('div');
      content.className = 'message-content';

      // Create text container (will accumulate text)
      const textContent = document.createElement('div');
      textContent.className = 'streaming-text';

      const metadata = document.createElement('div');
      metadata.className = 'message-metadata';
      metadata.textContent = new Date().toLocaleTimeString();

      content.appendChild(textContent);
      content.appendChild(metadata);
      messageEl.appendChild(avatar);
      messageEl.appendChild(content);

      // Remove welcome message if present
      const welcomeMsg = this.elements.messagesContainer.querySelector('.welcome-message');
      if (welcomeMsg) {
        welcomeMsg.remove();
      }

      this.elements.messagesContainer.appendChild(messageEl);
      this.streamingMessageElement = messageEl;
    }

    // Append text chunk to streaming message
    const textContainer = this.streamingMessageElement.querySelector('.streaming-text');
    if (textContainer && data.text) {
      // Append the text (already escaped by backend or browser)
      textContainer.textContent += data.text;
    }

    // Auto-scroll to bottom
    this.scrollToBottom();
  }

  /**
   * Handle Claude Agent SDK message
   */
  handleClaudeAgentMessage(message) {
    console.log('Claude Agent message:', message);

    switch (message.type) {
      case 'system':
        // System initialization message
        if (message.session_id) {
          this.conversationId = message.session_id;
        }
        break;

      case 'assistant':
        // Assistant text response
        // Skip if we're already streaming this message
        if (this.streamingMessageElement) {
          // Just update token stats if available
          if (message.message?.usage) {
            this.stats.tokens += message.message.usage.output_tokens || 0;
            this.updateStats();
          }
          break;
        }

        if (message.message?.content) {
          const textContent = message.message.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('\n');

          // Skip if this is the same content we just streamed
          if (textContent && textContent === this.lastStreamedContent) {
            this.lastStreamedContent = null; // Clear for next message
            // Still update token stats if available
            if (message.message.usage) {
              this.stats.tokens += message.message.usage.output_tokens || 0;
              this.updateStats();
            }
            break;
          }

          if (textContent) {
            const assistantMessage = {
              role: 'assistant',
              content: textContent
            };
            this.messages.push(assistantMessage);
            this.displayMessage(assistantMessage);

            // Update token stats
            if (message.message.usage) {
              this.stats.tokens += message.message.usage.output_tokens || 0;
              this.updateStats();
            }
          }
        }
        break;

      case 'tool_use':
        // Tool execution (for Anthropic-style tool use)
        this.stats.tools++;
        this.updateStats();

        const toolName = message.tool_use?.name || 'unknown';
        const toolInput = message.tool_use?.input ?
          JSON.stringify(message.tool_use.input, null, 2) : '';

        const toolMessage = `
          <div class="tool-execution">
            <div class="tool-name">🔧 ${toolName}</div>
            <div class="tool-result">${this.escapeHTML(toolInput)}</div>
          </div>
        `;

        this.displayMessage({
          role: 'system',
          content: toolMessage,
          isHTML: true
        });
        break;

      case 'tool_result':
        // Tool execution completed
        const resultToolName = message.tool_use?.name || 'unknown';
        const result = typeof message.result === 'string' ?
          message.result : JSON.stringify(message.result, null, 2);

        const resultMessage = `
          <div class="tool-execution success">
            <div class="tool-name">✓ ${resultToolName}</div>
            <div class="tool-result">${this.escapeHTML(result)}</div>
          </div>
        `;

        this.displayMessage({
          role: 'system',
          content: resultMessage,
          isHTML: true
        });
        break;

      case 'stream_event':
        // Streaming event - accumulate text deltas
        if (message.event?.type === 'content_block_delta' &&
            message.event?.delta?.type === 'text_delta') {
          // For now, just log - could implement real-time streaming display
          console.log('Text delta:', message.event.delta.text);
        }
        break;

      case 'result':
        // Final result
        if (message.result) {
          const finalMessage = {
            role: 'assistant',
            content: typeof message.result === 'string' ?
              message.result : JSON.stringify(message.result, null, 2)
          };
          // Only add if not already added by 'assistant' message
          if (this.messages[this.messages.length - 1]?.content !== finalMessage.content) {
            this.messages.push(finalMessage);
            this.displayMessage(finalMessage);
          }

          // Show usage stats
          if (message.usage) {
            this.stats.tokens += message.usage.output_tokens || 0;
            this.updateStats();
          }
        }
        break;

      case 'error':
        // Error occurred
        this.showError(message.error?.message || message.message || 'Unknown error');
        break;
    }
  }

  /**
   * Handle Claude Agent SDK completion
   */
  handleClaudeAgentComplete(data) {
    console.log('Claude Agent complete:', data);

    // Finalize streaming message if present
    if (this.streamingMessageElement) {
      // Remove streaming class
      this.streamingMessageElement.classList.remove('streaming');

      // Get the final text content
      const textContainer = this.streamingMessageElement.querySelector('.streaming-text');
      if (textContainer && textContainer.textContent) {
        const markdownText = textContainer.textContent;

        // Save this content to prevent duplicate display
        this.lastStreamedContent = markdownText;

        // Render the accumulated text as markdown
        textContainer.innerHTML = this.renderMarkdown(markdownText);
        textContainer.classList.add('markdown-content');

        // Add to messages array
        this.messages.push({
          role: 'assistant',
          content: markdownText
        });

        // Update stats
        this.stats.messages++;
        this.updateStats();
      }

      // Clear the streaming message reference
      this.streamingMessageElement = null;
    }

    this.showInfo('Query completed');
  }

  /**
   * Display message
   */
  displayMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = {
      user: '👤',
      assistant: '🤖',
      system: '⚙️'
    }[message.role] || '💬';

    const content = document.createElement('div');
    content.className = 'message-content';

    if (message.isHTML) {
      content.innerHTML = message.content;
    } else if (message.role === 'assistant') {
      // Render assistant messages as markdown
      content.innerHTML = this.renderMarkdown(message.content);
      content.classList.add('markdown-content');
    } else {
      content.textContent = message.content;
    }

    const metadata = document.createElement('div');
    metadata.className = 'message-metadata';
    metadata.textContent = new Date().toLocaleTimeString();

    content.appendChild(metadata);
    messageEl.appendChild(avatar);
    messageEl.appendChild(content);

    // Remove welcome message if present
    const welcomeMsg = this.elements.messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) {
      welcomeMsg.remove();
    }

    this.elements.messagesContainer.appendChild(messageEl);
    this.scrollToBottom();
  }

  /**
   * Clear messages
   */
  clearMessages() {
    this.elements.messagesContainer.innerHTML = '';
    this.messages = [];
    this.stats.messages = 0;
    this.stats.tools = 0;
    this.updateStats();
  }

  /**
   * Update stats display
   */
  updateStats() {
    this.elements.statMessages.textContent = this.stats.messages;
    this.elements.statTools.textContent = this.stats.tools;
    this.elements.statTokens.textContent = this.stats.tokens;
  }

  /**
   * Show info message
   */
  showInfo(message) {
    this.displayMessage({
      role: 'system',
      content: `ℹ️ ${message}`
    });
  }

  /**
   * Show error message
   */
  showError(message) {
    this.displayMessage({
      role: 'system',
      content: `❌ Error: ${message}`
    });
  }

  /**
   * Show modal
   */
  showModal() {
    this.elements.conversationsModal.classList.add('active');
  }

  /**
   * Hide modal
   */
  hideModal() {
    this.elements.conversationsModal.classList.remove('active');
  }

  /**
   * Scroll to bottom of messages
   */
  scrollToBottom() {
    this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
  }

  /**
   * Escape HTML
   */
  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Render markdown to sanitized HTML
   */
  renderMarkdown(markdown) {
    // Check if marked and DOMPurify are available
    // @ts-ignore - Global libraries loaded via script tags
    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
      console.warn('Markdown libraries not loaded, falling back to plain text');
      return this.escapeHTML(markdown);
    }

    try {
      // Configure marked for better rendering
      // @ts-ignore - Global library loaded via script tag
      marked.setOptions({
        breaks: true,  // Convert line breaks to <br>
        gfm: true,     // GitHub Flavored Markdown
        headerIds: false,  // Don't add IDs to headers
        mangle: false  // Don't escape autolinked emails
      });

      // Parse markdown to HTML
      // @ts-ignore - Global library loaded via script tag
      const rawHTML = marked.parse(markdown);

      // Sanitize HTML to prevent XSS attacks
      // @ts-ignore - Global library loaded via script tag
      const cleanHTML = DOMPurify.sanitize(rawHTML, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 'code', 'pre',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li',
          'blockquote',
          'a', 'img',
          'table', 'thead', 'tbody', 'tr', 'th', 'td'
        ],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class']
      });

      return cleanHTML;
    } catch (error) {
      console.error('Markdown rendering error:', error);
      return this.escapeHTML(markdown);
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // @ts-ignore - Global app instance for debugging
    window.app = new AgentPlayground();
  });
} else {
  // @ts-ignore - Global app instance for debugging
  window.app = new AgentPlayground();
}

export default AgentPlayground;
