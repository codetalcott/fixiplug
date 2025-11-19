/**
 * Agent Playground - Backend Server
 *
 * HTTP server providing multi-LLM agent integration with:
 * - OpenAI and Anthropic adapter endpoints
 * - Server-sent events for streaming
 * - WebSocket support for real-time updates
 * - Conversation history management
 *
 * @module playground/backend/server
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { FixiPlugAgent } from '../../sdk/agent-client.js';
import { OpenAIAdapter } from '../../sdk/adapters/openai-adapter.js';
import { AnthropicAdapter } from '../../sdk/adapters/anthropic-adapter.js';
import { createFixiplug } from '../../builder/fixiplug-factory.js';
import introspectionPlugin from '../../plugins/introspection.js';
import stateTrackerPlugin from '../../plugins/state-tracker.js';
import fixiAgentPlugin from '../../plugins/fixi-agent.js';
import { ConversationManager } from './services/conversation-manager.js';
import { LLMProviderService } from './services/llm-provider.js';
import { ClaudeAgentService } from './services/claude-agent-service.js';
import { createFixiPlugMcpServer } from './services/fixiplug-mcp-server.js';
import { setupWebSocket } from './websocket/handlers.js';

// Configuration
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Initialize FixiPlug with plugins
const fixiplug = createFixiplug({
  features: ['logging']
});

fixiplug.use(introspectionPlugin);
fixiplug.use(stateTrackerPlugin);
fixiplug.use(fixiAgentPlugin);

// Initialize Agent and Adapters
const agent = new FixiPlugAgent(fixiplug, {
  enableCaching: true,
  trackPerformance: true
});

const openaiAdapter = new OpenAIAdapter(agent, {
  includeCoreTools: true,
  includeWorkflowTools: true,
  includeCacheTools: true
});

const anthropicAdapter = new AnthropicAdapter(agent, {
  includeCoreTools: true,
  includeWorkflowTools: true,
  includeCacheTools: true,
  includePluginHooks: true  // Enable automatic plugin hook discovery (fixi-agent hooks)
});

// Create FixiPlug SDK MCP Server
console.log('Creating FixiPlug MCP server...');
const fixiplugMcpServer = await createFixiPlugMcpServer(agent, anthropicAdapter);

// Initialize services
const conversationManager = new ConversationManager();
const llmProvider = new LLMProviderService({
  openai: { apiKey: OPENAI_API_KEY },
  anthropic: { apiKey: ANTHROPIC_API_KEY }
});

const claudeAgentService = new ClaudeAgentService({
  apiKey: ANTHROPIC_API_KEY,
  mcpServer: fixiplugMcpServer  // Add FixiPlug tools
});

// WebSocket setup
const wss = new WebSocketServer({ server: httpServer });
setupWebSocket(wss, { agent, conversationManager, llmProvider, claudeAgentService });

// ============================================================
// Health Check Endpoint
// ============================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    providers: {
      openai: !!OPENAI_API_KEY,
      anthropic: !!ANTHROPIC_API_KEY,
      claudeAgent: claudeAgentService.isAvailable()
    },
    agent: {
      plugins: fixiplug.plugins?.size || 0,
      cacheEnabled: agent.options.enableCaching
    }
  });
});

// ============================================================
// Capabilities Endpoints
// ============================================================

app.get('/api/capabilities', async (req, res) => {
  try {
    const capabilities = await agent.discover({ refresh: false });
    res.json({
      success: true,
      data: capabilities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/tools/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const adapter = provider === 'openai' ? openaiAdapter : anthropicAdapter;
    const tools = await adapter.getToolDefinitions();

    res.json({
      success: true,
      provider,
      tools,
      count: tools.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// OpenAI Chat Endpoint
// ============================================================

app.post('/api/chat/openai', async (req, res) => {
  try {
    const { messages, model = 'gpt-5-nano-2025-08-07', stream = false } = req.body;

    if (!OPENAI_API_KEY) {
      return res.status(400).json({
        success: false,
        error: 'OpenAI API key not configured'
      });
    }

    const conversationId = req.body.conversationId || conversationManager.createConversation();
    const tools = await openaiAdapter.getToolDefinitions();

    if (stream) {
      // Server-sent events for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const response = await llmProvider.chatCompletion({
        provider: 'openai',
        model,
        messages,
        tools,
        stream: true
      });

      // Stream response chunks
      for await (const chunk of response) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);

        // Handle tool calls in stream
        if (chunk.choices?.[0]?.message?.tool_calls) {
          const toolCalls = chunk.choices[0].message.tool_calls;
          for (const toolCall of toolCalls) {
            const result = await openaiAdapter.executeToolCall(toolCall);
            const toolMessage = openaiAdapter.createToolMessage(toolCall, result);

            res.write(`data: ${JSON.stringify({
              type: 'tool_result',
              tool_call: toolCall,
              result: toolMessage
            })}\n\n`);
          }
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // Non-streaming response
      let response = await llmProvider.chatCompletion({
        provider: 'openai',
        model,
        messages,
        tools
      });

      const conversationMessages = [...messages];
      let iterations = 0;
      const maxIterations = 10;

      // Handle tool calls in a loop
      while (response.choices[0].message.tool_calls && iterations < maxIterations) {
        const toolCalls = response.choices[0].message.tool_calls;

        conversationMessages.push(response.choices[0].message);

        for (const toolCall of toolCalls) {
          const result = await openaiAdapter.executeToolCall(toolCall);
          const toolMessage = openaiAdapter.createToolMessage(toolCall, result);
          conversationMessages.push(toolMessage);
        }

        response = await llmProvider.chatCompletion({
          provider: 'openai',
          model,
          messages: conversationMessages,
          tools
        });

        iterations++;
      }

      // Save conversation
      conversationManager.saveConversation(conversationId, conversationMessages);

      res.json({
        success: true,
        conversationId,
        response: response.choices[0].message,
        usage: response.usage,
        iterations
      });
    }
  } catch (error) {
    console.error('OpenAI chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// Anthropic Chat Endpoint
// ============================================================

app.post('/api/chat/anthropic', async (req, res) => {
  try {
    const { messages, model = 'claude-haiku-4-5-20251001', stream = false } = req.body;

    if (!ANTHROPIC_API_KEY) {
      return res.status(400).json({
        success: false,
        error: 'Anthropic API key not configured'
      });
    }

    const conversationId = req.body.conversationId || conversationManager.createConversation();
    const tools = await anthropicAdapter.getToolDefinitions();

    if (stream) {
      // Server-sent events for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const response = await llmProvider.createMessage({
        provider: 'anthropic',
        model,
        messages,
        tools,
        stream: true
      });

      // Stream response
      for await (const chunk of response) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);

        // Handle tool uses in stream
        if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'tool_use') {
          // Tool use will be complete in message_stop event
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // Non-streaming response
      let response = await llmProvider.createMessage({
        provider: 'anthropic',
        model,
        messages,
        tools,
        max_tokens: 4096
      });

      const conversationMessages = [...messages];
      let iterations = 0;
      const maxIterations = 10;

      // Handle tool uses in a loop
      while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
        const toolUses = response.content.filter(c => c.type === 'tool_use');

        conversationMessages.push({
          role: 'assistant',
          content: response.content
        });

        const toolResults = [];
        for (const toolUse of toolUses) {
          try {
            const result = await anthropicAdapter.executeToolUse(toolUse);
            toolResults.push(anthropicAdapter.createToolResult(toolUse.id, result));
          } catch (error) {
            toolResults.push(
              anthropicAdapter.createToolResult(toolUse.id, { error: error.message }, true)
            );
          }
        }

        conversationMessages.push({
          role: 'user',
          content: toolResults
        });

        response = await llmProvider.createMessage({
          provider: 'anthropic',
          model,
          messages: conversationMessages,
          tools,
          max_tokens: 4096
        });

        iterations++;
      }

      // Save conversation
      conversationManager.saveConversation(conversationId, conversationMessages);

      const textContent = response.content.find(c => c.type === 'text');

      res.json({
        success: true,
        conversationId,
        response: {
          content: textContent?.text || '',
          full_content: response.content,
          stop_reason: response.stop_reason
        },
        usage: response.usage,
        iterations
      });
    }
  } catch (error) {
    console.error('Anthropic chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// Conversation Management Endpoints
// ============================================================

app.get('/api/conversations', (req, res) => {
  try {
    const conversations = conversationManager.getAllConversations();
    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/conversations/:id', (req, res) => {
  try {
    const { id } = req.params;
    const conversation = conversationManager.getConversation(id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      conversation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/conversations/:id', (req, res) => {
  try {
    const { id } = req.params;
    conversationManager.deleteConversation(id);

    res.json({
      success: true,
      message: 'Conversation deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// Agent State Endpoints
// ============================================================

app.get('/api/agent/state', async (req, res) => {
  try {
    const state = await agent.getCurrentState();
    res.json({
      success: true,
      state
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/agent/state', async (req, res) => {
  try {
    const { state, metadata } = req.body;
    await agent.setState(state, metadata);

    res.json({
      success: true,
      state
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// Workflow Endpoints
// ============================================================

app.post('/api/workflow/execute', async (req, res) => {
  try {
    const { steps, stopOnError = true } = req.body;

    const result = await agent.executeWorkflow(steps, { stopOnError });

    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// Claude Agent SDK Endpoints
// ============================================================

app.post('/api/claude-agent/query', async (req, res) => {
  try {
    const {
      prompt,
      sessionId,
      stream = false,
      permissionMode = 'default',
      allowedTools,
      disallowedTools
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    if (!claudeAgentService.isAvailable()) {
      return res.status(400).json({
        success: false,
        error: 'Claude Agent SDK not available - ANTHROPIC_API_KEY not configured'
      });
    }

    if (stream) {
      // Server-sent events for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for await (const message of claudeAgentService.executeQuery({
        prompt,
        sessionId,
        stream: true,
        permissionMode,
        allowedTools,
        disallowedTools
      })) {
        res.write(`data: ${JSON.stringify(message)}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // Non-streaming response
      const messages = await claudeAgentService.executeSingleQuery({
        prompt,
        sessionId,
        permissionMode,
        allowedTools,
        disallowedTools
      });

      // Find the result message
      const resultMessage = messages.find(m => m.type === 'sdk/result');
      const errorMessage = messages.find(m => m.type === 'sdk/error');

      if (errorMessage) {
        return res.status(500).json({
          success: false,
          error: errorMessage.error.message,
          messages
        });
      }

      res.json({
        success: true,
        result: resultMessage,
        messages,
        messageCount: messages.length
      });
    }
  } catch (error) {
    console.error('Claude Agent SDK query error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/claude-agent/sessions', (req, res) => {
  try {
    res.json({
      success: true,
      sessionCount: claudeAgentService.getSessionCount()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/claude-agent/sessions/:id', (req, res) => {
  try {
    const { id } = req.params;
    claudeAgentService.clearSession(id);

    res.json({
      success: true,
      message: 'Session cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// Error Handling
// ============================================================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// ============================================================
// Start Server
// ============================================================

httpServer.listen(PORT, () => {
  console.log(`🚀 Agent Playground Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log('');
  console.log('Providers configured:');
  console.log(`  OpenAI: ${OPENAI_API_KEY ? '✓' : '✗'}`);
  console.log(`  Anthropic: ${ANTHROPIC_API_KEY ? '✓' : '✗'}`);
  console.log('');
  console.log(`Plugins loaded: ${fixiplug.plugins?.size || 0}`);
});

export { app, httpServer, wss };
