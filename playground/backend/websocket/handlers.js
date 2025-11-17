/**
 * WebSocket Handlers
 *
 * Handles WebSocket connections for real-time agent communication
 *
 * @module playground/backend/websocket/handlers
 */

/**
 * Setup WebSocket server with handlers
 *
 * @param {WebSocketServer} wss - WebSocket server instance
 * @param {Object} services - Service instances (agent, conversationManager, llmProvider)
 */
export function setupWebSocket(wss, services) {
  const { agent, conversationManager, llmProvider } = services;

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    // Client metadata
    ws.metadata = {
      id: generateClientId(),
      connectedAt: Date.now(),
      conversationId: null
    };

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      clientId: ws.metadata.id,
      timestamp: Date.now(),
      providers: llmProvider.getProviderInfo()
    }));

    // Message handler
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleMessage(ws, message, services);
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: error.message
        }));
      }
    });

    // Error handler
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Close handler
    ws.on('close', () => {
      console.log(`WebSocket client disconnected: ${ws.metadata.id}`);
    });
  });
}

/**
 * Handle incoming WebSocket message
 *
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} message - Parsed message
 * @param {Object} services - Service instances
 */
async function handleMessage(ws, message, services) {
  const { agent, conversationManager, llmProvider } = services;

  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;

    case 'chat':
      await handleChatMessage(ws, message, services);
      break;

    case 'get_capabilities':
      await handleGetCapabilities(ws, agent);
      break;

    case 'get_tools':
      await handleGetTools(ws, message, services);
      break;

    case 'execute_tool':
      await handleExecuteTool(ws, message, agent);
      break;

    case 'get_state':
      await handleGetState(ws, agent);
      break;

    case 'set_state':
      await handleSetState(ws, message, agent);
      break;

    case 'get_conversation':
      await handleGetConversation(ws, message, conversationManager);
      break;

    case 'list_conversations':
      await handleListConversations(ws, conversationManager);
      break;

    default:
      ws.send(JSON.stringify({
        type: 'error',
        error: `Unknown message type: ${message.type}`
      }));
  }
}

/**
 * Handle chat message
 */
async function handleChatMessage(ws, message, services) {
  const { llmProvider, conversationManager } = services;
  const { provider, model, messages, conversationId, stream = true } = message;

  try {
    // Create conversation if needed
    const convId = conversationId || conversationManager.createConversation();
    ws.metadata.conversationId = convId;

    // Send start event
    ws.send(JSON.stringify({
      type: 'chat_start',
      conversationId: convId,
      provider,
      model
    }));

    if (provider === 'openai') {
      await handleOpenAIChat(ws, { provider, model, messages, conversationId: convId, stream }, services);
    } else if (provider === 'anthropic') {
      await handleAnthropicChat(ws, { provider, model, messages, conversationId: convId, stream }, services);
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

  } catch (error) {
    ws.send(JSON.stringify({
      type: 'chat_error',
      error: error.message
    }));
  }
}

/**
 * Handle OpenAI chat with streaming
 */
async function handleOpenAIChat(ws, options, services) {
  const { llmProvider, conversationManager } = services;
  const { provider, model, messages, conversationId, stream } = options;

  const adapter = services.openaiAdapter || await getOpenAIAdapter(services.agent);
  const tools = await adapter.getToolDefinitions();

  const response = await llmProvider.chatCompletion({
    provider,
    model,
    messages,
    tools,
    stream
  });

  if (stream) {
    for await (const chunk of response) {
      ws.send(JSON.stringify({
        type: 'chat_chunk',
        chunk,
        provider: 'openai'
      }));

      // Handle tool calls
      if (chunk.choices?.[0]?.message?.tool_calls) {
        const toolCalls = chunk.choices[0].message.tool_calls;
        for (const toolCall of toolCalls) {
          ws.send(JSON.stringify({
            type: 'tool_call',
            toolCall
          }));

          const result = await adapter.executeToolCall(toolCall);
          ws.send(JSON.stringify({
            type: 'tool_result',
            toolCall,
            result
          }));
        }
      }
    }
  }

  ws.send(JSON.stringify({
    type: 'chat_complete',
    conversationId
  }));
}

/**
 * Handle Anthropic chat with streaming
 */
async function handleAnthropicChat(ws, options, services) {
  const { llmProvider, conversationManager } = services;
  const { provider, model, messages, conversationId, stream } = options;

  const adapter = services.anthropicAdapter || await getAnthropicAdapter(services.agent);
  const tools = await adapter.getToolDefinitions();

  const response = await llmProvider.createMessage({
    provider,
    model,
    messages,
    tools,
    stream,
    max_tokens: 4096
  });

  if (stream) {
    for await (const chunk of response) {
      ws.send(JSON.stringify({
        type: 'chat_chunk',
        chunk,
        provider: 'anthropic'
      }));
    }
  } else {
    ws.send(JSON.stringify({
      type: 'chat_message',
      message: response,
      provider: 'anthropic'
    }));

    // Handle tool uses
    if (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter(c => c.type === 'tool_use');
      for (const toolUse of toolUses) {
        ws.send(JSON.stringify({
          type: 'tool_use',
          toolUse
        }));

        try {
          const result = await adapter.executeToolUse(toolUse);
          ws.send(JSON.stringify({
            type: 'tool_result',
            toolUse,
            result
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'tool_error',
            toolUse,
            error: error.message
          }));
        }
      }
    }
  }

  ws.send(JSON.stringify({
    type: 'chat_complete',
    conversationId
  }));
}

/**
 * Handle get capabilities request
 */
async function handleGetCapabilities(ws, agent) {
  try {
    const capabilities = await agent.discover({ refresh: false });
    ws.send(JSON.stringify({
      type: 'capabilities',
      data: capabilities
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
}

/**
 * Handle get tools request
 */
async function handleGetTools(ws, message, services) {
  const { provider } = message;

  try {
    const adapter = provider === 'openai'
      ? await getOpenAIAdapter(services.agent)
      : await getAnthropicAdapter(services.agent);

    const tools = await adapter.getToolDefinitions();

    ws.send(JSON.stringify({
      type: 'tools',
      provider,
      tools
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
}

/**
 * Handle execute tool request
 */
async function handleExecuteTool(ws, message, agent) {
  const { hook, params } = message;

  try {
    const result = await agent.fixi.dispatch(hook, params);
    ws.send(JSON.stringify({
      type: 'tool_result',
      hook,
      result
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
}

/**
 * Handle get state request
 */
async function handleGetState(ws, agent) {
  try {
    const state = await agent.getCurrentState();
    ws.send(JSON.stringify({
      type: 'state',
      state
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
}

/**
 * Handle set state request
 */
async function handleSetState(ws, message, agent) {
  const { state, metadata } = message;

  try {
    await agent.setState(state, metadata);
    ws.send(JSON.stringify({
      type: 'state_updated',
      state
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
}

/**
 * Handle get conversation request
 */
async function handleGetConversation(ws, message, conversationManager) {
  const { conversationId } = message;

  try {
    const conversation = conversationManager.getConversation(conversationId);
    ws.send(JSON.stringify({
      type: 'conversation',
      conversation
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
}

/**
 * Handle list conversations request
 */
async function handleListConversations(ws, conversationManager) {
  try {
    const conversations = conversationManager.getAllConversations();
    ws.send(JSON.stringify({
      type: 'conversations',
      conversations
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
}

/**
 * Generate unique client ID
 */
function generateClientId() {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get or create OpenAI adapter
 */
async function getOpenAIAdapter(agent) {
  const { OpenAIAdapter } = await import('../../../sdk/adapters/openai-adapter.js');
  return new OpenAIAdapter(agent, {
    includeCoreTools: true,
    includeWorkflowTools: true,
    includeCacheTools: true
  });
}

/**
 * Get or create Anthropic adapter
 */
async function getAnthropicAdapter(agent) {
  const { AnthropicAdapter } = await import('../../../sdk/adapters/anthropic-adapter.js');
  return new AnthropicAdapter(agent, {
    includeCoreTools: true,
    includeWorkflowTools: true,
    includeCacheTools: true
  });
}

export default setupWebSocket;
