/**
 * Conversation Manager
 *
 * Manages conversation sessions, message history, and persistence.
 *
 * @module playground/backend/services/conversation-manager
 */

import { randomUUID } from 'crypto';

/**
 * Conversation Manager Service
 *
 * Handles storage and retrieval of conversation history
 */
export class ConversationManager {
  constructor() {
    this.conversations = new Map();
    this.maxConversations = 100; // Limit to prevent memory issues
  }

  /**
   * Create a new conversation
   *
   * @returns {string} Conversation ID
   */
  createConversation() {
    const id = randomUUID();
    this.conversations.set(id, {
      id,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {}
    });

    // Clean up old conversations if limit exceeded
    if (this.conversations.size > this.maxConversations) {
      this._cleanupOldConversations();
    }

    return id;
  }

  /**
   * Get a conversation by ID
   *
   * @param {string} id - Conversation ID
   * @returns {Object|null} Conversation data
   */
  getConversation(id) {
    return this.conversations.get(id) || null;
  }

  /**
   * Save messages to a conversation
   *
   * @param {string} id - Conversation ID
   * @param {Array} messages - Messages to save
   * @param {Object} metadata - Optional metadata
   */
  saveConversation(id, messages, metadata = {}) {
    let conversation = this.conversations.get(id);

    if (!conversation) {
      conversation = {
        id,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };
      this.conversations.set(id, conversation);
    }

    conversation.messages = messages;
    conversation.updatedAt = Date.now();
    conversation.metadata = { ...conversation.metadata, ...metadata };
  }

  /**
   * Append a message to a conversation
   *
   * @param {string} id - Conversation ID
   * @param {Object} message - Message to append
   */
  appendMessage(id, message) {
    const conversation = this.conversations.get(id);

    if (!conversation) {
      throw new Error(`Conversation ${id} not found`);
    }

    conversation.messages.push(message);
    conversation.updatedAt = Date.now();
  }

  /**
   * Delete a conversation
   *
   * @param {string} id - Conversation ID
   */
  deleteConversation(id) {
    this.conversations.delete(id);
  }

  /**
   * Get all conversations
   *
   * @returns {Array} Array of conversation summaries
   */
  getAllConversations() {
    return Array.from(this.conversations.values()).map(conv => ({
      id: conv.id,
      messageCount: conv.messages.length,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      metadata: conv.metadata
    }));
  }

  /**
   * Clear all conversations
   */
  clearAll() {
    this.conversations.clear();
  }

  /**
   * Get conversation statistics
   *
   * @returns {Object} Statistics
   */
  getStats() {
    const conversations = Array.from(this.conversations.values());
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);

    return {
      conversationCount: conversations.length,
      totalMessages,
      avgMessagesPerConversation: conversations.length > 0
        ? (totalMessages / conversations.length).toFixed(2)
        : 0,
      oldestConversation: conversations.length > 0
        ? Math.min(...conversations.map(c => c.createdAt))
        : null,
      newestConversation: conversations.length > 0
        ? Math.max(...conversations.map(c => c.createdAt))
        : null
    };
  }

  /**
   * Clean up old conversations
   *
   * @private
   */
  _cleanupOldConversations() {
    const conversations = Array.from(this.conversations.entries());

    // Sort by updatedAt (oldest first)
    conversations.sort((a, b) => a[1].updatedAt - b[1].updatedAt);

    // Remove oldest 20% of conversations
    const toRemove = Math.floor(conversations.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.conversations.delete(conversations[i][0]);
    }
  }
}

export default ConversationManager;
