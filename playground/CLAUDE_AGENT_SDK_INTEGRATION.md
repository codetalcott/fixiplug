# Claude Agent SDK Integration

## Overview

The FixiPlug Agent Playground now includes full **Claude Agent SDK** integration, providing access to Claude Code's powerful agentic capabilities.

## What is the Claude Agent SDK?

The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) is Anthropic's official SDK for building AI agents with Claude Code's capabilities. It provides:

- **16 Built-in Tools**: Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, Task (subagents), and more
- **Automatic Context Management**: Token compaction and optimization
- **Session Management**: Resume conversations across multiple queries
- **Streaming API**: Real-time message streaming
- **Permission System**: Fine-grained tool access control
- **Prompt Caching**: Massive cost savings (12K+ tokens cached)

## Installation

The SDK is already installed in the playground:

```bash
npm install @anthropic-ai/claude-agent-sdk@0.1.44 zod
```

**Note**: We use v0.1.44 specifically due to a bug in v0.1.45.

## Usage

### HTTP API

**Endpoint**: `POST /api/claude-agent/query`

**Request**:
```json
{
  "prompt": "List files in current directory and read package.json",
  "permissionMode": "bypassPermissions",
  "allowedTools": ["Bash", "Read"],
  "sessionId": "optional-session-id"
}
```

**Response**:
```json
{
  "success": true,
  "messages": [
    {
      "type": "system",
      "session_id": "...",
      "tools": ["Task", "Bash", "Read", "Write", ...]
    },
    {
      "type": "assistant",
      "message": {
        "content": [{"type": "text", "text": "..."}]
      }
    },
    {
      "type": "result",
      "result": "Final answer",
      "duration_ms": 12914,
      "total_cost_usd": 0.033379,
      "num_turns": 3
    }
  ]
}
```

### WebSocket API

**Message Type**: `claude_agent`

**Send**:
```json
{
  "type": "claude_agent",
  "prompt": "What files are in this directory?",
  "permissionMode": "default"
}
```

**Receive**:
```json
{
  "type": "claude_agent_start",
  "sessionId": "...",
  "conversationId": "..."
}
{
  "type": "claude_agent_message",
  "message": { ... }
}
{
  "type": "claude_agent_complete",
  "result": { ... }
}
```

### Programmatic Usage

```javascript
import { ClaudeAgentService } from './backend/services/claude-agent-service.js';

const service = new ClaudeAgentService({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-5-20250929',
  cwd: process.cwd()
});

// Streaming query
for await (const message of service.executeQuery({
  prompt: "Analyze this codebase",
  permissionMode: "bypassPermissions"
})) {
  if (message.type === 'assistant') {
    console.log(message.message.content);
  }
  if (message.type === 'result') {
    console.log('Final:', message.result);
    console.log('Cost:', message.total_cost_usd);
  }
}

// Non-streaming
const messages = await service.executeSingleQuery({
  prompt: "What is 2+2?"
});
```

## Available Tools

The SDK provides 16 built-in tools:

| Tool | Description |
|------|-------------|
| **Task** | Launch specialized subagents |
| **Bash** | Execute shell commands |
| **Glob** | Find files by pattern |
| **Grep** | Search file contents |
| **Read** | Read file contents |
| **Write** | Create/overwrite files |
| **Edit** | Modify existing files |
| **NotebookEdit** | Edit Jupyter notebooks |
| **WebFetch** | Fetch and process URLs |
| **WebSearch** | Search the web |
| **TodoWrite** | Manage task lists |
| **BashOutput** | Monitor background processes |
| **KillShell** | Terminate background shells |
| **ExitPlanMode** | Exit planning mode |
| **Skill** | Execute agent skills |
| **SlashCommand** | Run custom commands |

## Permission Modes

- **`default`**: Standard permission checks
- **`bypassPermissions`**: Skip all permission checks (testing only)
- **`acceptEdits`**: Auto-approve file edits
- **`plan`**: Plan mode (no execution)

## Session Management

Sessions allow conversation continuity:

```javascript
// First query
const messages1 = await service.executeQuery({
  prompt: "List files",
  sessionId: "my-session"
});

// Continue same session
const messages2 = await service.executeQuery({
  prompt: "Now read package.json",
  sessionId: "my-session"  // Reuses context
});
```

## Cost Optimization

The SDK uses automatic prompt caching:

- **First query**: ~333 tokens cached
- **Subsequent queries**: ~12,442 tokens read from cache
- **Savings**: Up to 90% reduction in input token costs

Example:
- Query without cache: $0.15 USD
- Query with cache: $0.007 USD (95% savings!)

## Examples

### Simple Query

```bash
curl -X POST http://localhost:3000/api/claude-agent/query \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is 5+7?"}'
```

### Tool Execution

```bash
curl -X POST http://localhost:3000/api/claude-agent/query \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "List files and read package.json",
    "permissionMode": "bypassPermissions"
  }'
```

### Streaming

```bash
curl -X POST http://localhost:3000/api/claude-agent/query \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze this project",
    "stream": true
  }'
```

## Architecture

```
┌─────────────────────────────────────────┐
│      FixiPlug Agent Playground          │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────────────────────┐  │
│  │   HTTP/WebSocket Endpoints       │  │
│  └──────────┬───────────────────────┘  │
│             │                           │
│  ┌──────────▼───────────────────────┐  │
│  │   ClaudeAgentService             │  │
│  │  - executeQuery()                │  │
│  │  - Session management            │  │
│  │  - Streaming support             │  │
│  └──────────┬───────────────────────┘  │
│             │                           │
│  ┌──────────▼───────────────────────┐  │
│  │   Claude Agent SDK               │  │
│  │  - query() API                   │  │
│  │  - 16 built-in tools             │  │
│  │  - Context management            │  │
│  │  - Prompt caching                │  │
│  └──────────┬───────────────────────┘  │
│             │                           │
│  ┌──────────▼───────────────────────┐  │
│  │   Anthropic API                  │  │
│  │  - Claude Sonnet 4.5             │  │
│  └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

## Performance Metrics

Based on real testing:

| Metric | Simple Query | Tool Execution |
|--------|--------------|----------------|
| **Duration** | 1.6s | 12.9s |
| **Cost** | $0.004 | $0.033 |
| **Cache Usage** | 12,769 tokens | 12,442 tokens |
| **Turns** | 1 | 3 |
| **Tools Used** | 0 | 2 (Bash + Read) |

## Troubleshooting

### SDK Version Issues

If you encounter `Symbol.asyncIterator` errors, you're using v0.1.45 which has a bug. Downgrade:

```bash
npm install @anthropic-ai/claude-agent-sdk@0.1.44
```

### Permission Denied

Tools are blocked by default. Use:

```json
{
  "permissionMode": "bypassPermissions"
}
```

Or specify allowed tools:

```json
{
  "allowedTools": ["Read", "Bash", "Glob"]
}
```

### High Costs

- Enable caching by reusing `sessionId`
- Use cheaper models for simple queries
- Set `maxTurns` to limit iterations

## Resources

- **SDK Docs**: https://docs.claude.com/en/api/agent-sdk/typescript
- **GitHub**: https://github.com/anthropics/claude-agent-sdk-typescript
- **NPM**: https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk
- **Discord**: https://anthropic.com/discord

## Next Steps

- [ ] Build frontend UI for Claude Agent SDK
- [ ] Add MCP server integration for FixiPlug tools
- [ ] Implement advanced caching strategies
- [ ] Create specialized subagents
- [ ] Add visual feedback for tool execution
