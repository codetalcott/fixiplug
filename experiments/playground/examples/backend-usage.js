/**
 * Agent Playground Backend - Usage Examples
 *
 * Examples demonstrating how to interact with the Agent Playground backend
 *
 * @module playground/examples/backend-usage
 */

console.log('=== Agent Playground Backend Usage Examples ===\n');

// ============================================================
// Example 1: Health Check
// ============================================================

async function example1_healthCheck() {
  console.log('Example 1: Health Check');
  console.log('----------------------');

  const response = await fetch('http://localhost:3000/health');
  const data = await response.json();

  console.log('Server status:', data.status);
  console.log('Version:', data.version);
  console.log('Providers:', data.providers);
  console.log('Agent:', data.agent);
  console.log('✓ Health check complete\n');
}

// ============================================================
// Example 2: Get Capabilities
// ============================================================

async function example2_getCapabilities() {
  console.log('Example 2: Get Capabilities');
  console.log('--------------------------');

  const response = await fetch('http://localhost:3000/api/capabilities');
  const data = await response.json();

  if (data.success) {
    console.log('Plugins:', data.data.plugins.length);
    console.log('Hooks:', Object.keys(data.data.hooks).length);
    console.log('Version:', data.data.version);
  }

  console.log('✓ Capabilities retrieved\n');
}

// ============================================================
// Example 3: Get Tools for OpenAI
// ============================================================

async function example3_getToolsOpenAI() {
  console.log('Example 3: Get Tools for OpenAI');
  console.log('-------------------------------');

  const response = await fetch('http://localhost:3000/api/tools/openai');
  const data = await response.json();

  if (data.success) {
    console.log('Provider:', data.provider);
    console.log('Tool count:', data.count);
    console.log('Tools:', data.tools.map(t => t.function.name).join(', '));
  }

  console.log('✓ Tools retrieved\n');
}

// ============================================================
// Example 4: Get Tools for Anthropic
// ============================================================

async function example4_getToolsAnthropic() {
  console.log('Example 4: Get Tools for Anthropic');
  console.log('----------------------------------');

  const response = await fetch('http://localhost:3000/api/tools/anthropic');
  const data = await response.json();

  if (data.success) {
    console.log('Provider:', data.provider);
    console.log('Tool count:', data.count);
    console.log('Tools:', data.tools.map(t => t.name).join(', '));
  }

  console.log('✓ Tools retrieved\n');
}

// ============================================================
// Example 5: Chat with OpenAI (no streaming)
// ============================================================

async function example5_chatOpenAI() {
  console.log('Example 5: Chat with OpenAI (no streaming)');
  console.log('------------------------------------------');

  const response = await fetch('http://localhost:3000/api/chat/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'What capabilities do you have? Use the discover_capabilities tool.' }
      ],
      model: 'gpt-4',
      stream: false
    })
  });

  const data = await response.json();

  if (data.success) {
    console.log('Conversation ID:', data.conversationId);
    console.log('Iterations:', data.iterations);
    console.log('Response:', data.response.content?.substring(0, 100) + '...');
    console.log('Tokens used:', data.usage?.total_tokens);
  } else {
    console.log('Error:', data.error);
  }

  console.log('✓ Chat complete\n');
}

// ============================================================
// Example 6: Chat with Anthropic (no streaming)
// ============================================================

async function example6_chatAnthropic() {
  console.log('Example 6: Chat with Anthropic (no streaming)');
  console.log('---------------------------------------------');

  const response = await fetch('http://localhost:3000/api/chat/anthropic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'What tools are available? Use discover_capabilities.' }
      ],
      model: 'claude-3-5-sonnet-20241022',
      stream: false
    })
  });

  const data = await response.json();

  if (data.success) {
    console.log('Conversation ID:', data.conversationId);
    console.log('Iterations:', data.iterations);
    console.log('Response:', data.response.content?.substring(0, 100) + '...');
    console.log('Stop reason:', data.response.stop_reason);
  } else {
    console.log('Error:', data.error);
  }

  console.log('✓ Chat complete\n');
}

// ============================================================
// Example 7: Streaming Chat with OpenAI
// ============================================================

async function example7_streamingOpenAI() {
  console.log('Example 7: Streaming Chat with OpenAI');
  console.log('-------------------------------------');

  const response = await fetch('http://localhost:3000/api/chat/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'Count to 5 slowly.' }
      ],
      model: 'gpt-4',
      stream: true
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let chunkCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          console.log('Stream complete');
          continue;
        }

        try {
          const chunk = JSON.parse(data);
          chunkCount++;

          if (chunk.type === 'tool_result') {
            console.log('Tool executed:', chunk.tool_call.function.name);
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }

  console.log(`Received ${chunkCount} chunks`);
  console.log('✓ Streaming complete\n');
}

// ============================================================
// Example 8: Get Agent State
// ============================================================

async function example8_getState() {
  console.log('Example 8: Get Agent State');
  console.log('-------------------------');

  const response = await fetch('http://localhost:3000/api/agent/state');
  const data = await response.json();

  if (data.success) {
    console.log('State:', data.state);
  }

  console.log('✓ State retrieved\n');
}

// ============================================================
// Example 9: Set Agent State
// ============================================================

async function example9_setState() {
  console.log('Example 9: Set Agent State');
  console.log('-------------------------');

  const response = await fetch('http://localhost:3000/api/agent/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      state: 'testing',
      metadata: { example: 9 }
    })
  });

  const data = await response.json();

  if (data.success) {
    console.log('State set to:', data.state);
  }

  console.log('✓ State updated\n');
}

// ============================================================
// Example 10: Execute Workflow
// ============================================================

async function example10_executeWorkflow() {
  console.log('Example 10: Execute Workflow');
  console.log('---------------------------');

  const response = await fetch('http://localhost:3000/api/workflow/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      steps: [
        {
          name: 'get_state',
          hook: 'api:getCurrentState',
          params: {}
        },
        {
          name: 'set_processing',
          hook: 'api:setState',
          params: { state: 'processing' }
        },
        {
          name: 'set_complete',
          hook: 'api:setState',
          params: { state: 'complete' }
        }
      ],
      stopOnError: true
    })
  });

  const data = await response.json();

  if (data.success) {
    console.log('Workflow success:', data.result.success);
    console.log('Steps completed:', data.result.completed.join(', '));
    console.log('Errors:', data.result.errors.length);
  } else {
    console.log('Error:', data.error);
  }

  console.log('✓ Workflow executed\n');
}

// ============================================================
// Example 11: List Conversations
// ============================================================

async function example11_listConversations() {
  console.log('Example 11: List Conversations');
  console.log('-----------------------------');

  const response = await fetch('http://localhost:3000/api/conversations');
  const data = await response.json();

  if (data.success) {
    console.log('Total conversations:', data.conversations.length);
    data.conversations.slice(0, 3).forEach(conv => {
      console.log(`  - ${conv.id}: ${conv.messageCount} messages`);
    });
  }

  console.log('✓ Conversations listed\n');
}

// ============================================================
// Example 12: WebSocket Communication
// ============================================================

async function example12_websocket() {
  console.log('Example 12: WebSocket Communication');
  console.log('----------------------------------');

  return new Promise((resolve) => {
    const WebSocket = globalThis.WebSocket;
    if (!WebSocket) {
      console.log('⚠ WebSocket not available in this environment');
      console.log('  (Run in browser or with ws package)\n');
      resolve();
      return;
    }

    const ws = new WebSocket('ws://localhost:3000');

    ws.onopen = () => {
      console.log('WebSocket connected');

      // Send ping
      ws.send(JSON.stringify({ type: 'ping' }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Received:', message.type);

      if (message.type === 'connected') {
        console.log('Client ID:', message.clientId);

        // Get capabilities
        ws.send(JSON.stringify({ type: 'get_capabilities' }));
      } else if (message.type === 'capabilities') {
        console.log('Plugins:', message.data.plugins.length);

        ws.close();
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      console.log('✓ WebSocket example complete\n');
      resolve();
    };

    ws.onerror = (error) => {
      // @ts-ignore - WebSocket error event handling
      console.log('WebSocket error:', error.message || 'Unknown error');
      resolve();
    };
  });
}

// ============================================================
// Run Examples
// ============================================================

(async () => {
  try {
    console.log('Note: These examples require the backend server to be running.');
    console.log('Start server with: npm start\n');

    await example1_healthCheck();
    await example2_getCapabilities();
    await example3_getToolsOpenAI();
    await example4_getToolsAnthropic();

    // Skip chat examples if no API keys configured
    const healthCheck = await fetch('http://localhost:3000/health');
    const health = await healthCheck.json();

    if (health.providers.openai) {
      await example5_chatOpenAI();
      await example7_streamingOpenAI();
    } else {
      console.log('⚠ Skipping OpenAI examples (API key not configured)\n');
    }

    if (health.providers.anthropic) {
      await example6_chatAnthropic();
    } else {
      console.log('⚠ Skipping Anthropic examples (API key not configured)\n');
    }

    await example8_getState();
    await example9_setState();
    await example10_executeWorkflow();
    await example11_listConversations();

    // WebSocket example (browser only or with ws package)
    if (typeof WebSocket !== 'undefined') {
      await example12_websocket();
    } else {
      console.log('⚠ Skipping WebSocket example (not available in Node.js)\n');
      console.log('  Run in browser or install ws package\n');
    }

    console.log('=== All examples complete ===');

  } catch (error) {
    console.error('Error running examples:', error.message);
    console.log('\nMake sure the backend server is running on port 3000');
  }
})();
