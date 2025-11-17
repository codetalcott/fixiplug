# FixiPlug Agent Playground - Frontend

Interactive web UI for the FixiPlug Agent Playground with real-time chat, tool execution visualization, and multi-provider support.

## Features

- **Real-Time Chat**: Interactive conversation interface with streaming support
- **Multi-Provider Support**: Switch between OpenAI and Anthropic
- **Tool Visualization**: See tool executions in real-time
- **WebSocket & HTTP**: Dual communication modes
- **Conversation History**: Save and load conversations
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Clean UI**: Modern, accessible interface

## Getting Started

### Prerequisites

- Backend server running (see [backend README](../README.md))
- Modern web browser with WebSocket support
- JavaScript enabled

### Running the Frontend

The frontend is served automatically by the backend server:

1. Start the backend:
   ```bash
   cd playground
   npm start
   ```

2. Open browser to:
   ```
   http://localhost:3000
   ```

The frontend will load automatically.

### Development

For frontend-only development with live reload:

```bash
# Install a simple HTTP server
npm install -g http-server

# Serve from frontend directory
cd playground/frontend
http-server -p 8080
```

Then configure the backend URL in `js/app.js` if needed.

## Architecture

```
frontend/
├── index.html              # Main HTML page
├── css/
│   └── styles.css         # All styles
└── js/
    ├── app.js             # Main application logic
    ├── websocket-client.js # WebSocket handling
    └── api-client.js      # REST API calls
```

### Components

**Main Application (`js/app.js`)**
- Orchestrates UI interactions
- Manages application state
- Coordinates between WebSocket and HTTP
- Handles message display and tool visualization

**WebSocket Client (`js/websocket-client.js`)**
- Maintains WebSocket connection
- Auto-reconnect with exponential backoff
- Event-based message handling
- Connection status management

**API Client (`js/api-client.js`)**
- REST API wrapper
- Health checks
- Capabilities discovery
- Conversation management
- Agent state management

## User Interface

### Provider Selection

Switch between OpenAI and Anthropic:
- Click provider button (🟢 OpenAI or 🟣 Anthropic)
- Select model from dropdown
- Models automatically filtered by provider

### Sending Messages

1. Type message in input area
2. Press Enter or click "Send" button
3. Watch response stream in real-time
4. See tool executions visualized inline

### Options

**Enable Streaming**
- When enabled: Messages stream in real-time
- When disabled: Wait for complete response

**Use WebSocket**
- When enabled: Use WebSocket for communication
- When disabled: Fall back to HTTP/SSE

### Tool Execution

Tools are displayed inline with:
- 🔧 Tool icon
- Tool name
- Execution status (executing/success/error)
- Result preview

### Conversations

**New Conversation**
- Click "New" to start fresh conversation
- Previous conversation is cleared

**List Conversations**
- Click "List" to see all saved conversations
- Click any conversation to load it
- Shows conversation ID, message count, and date

### Capabilities

Click "Discover" to see:
- Agent version
- Available plugins
- Hook count
- List of available hooks

### Statistics

Real-time stats show:
- **Messages**: Total messages sent/received
- **Tools**: Number of tools executed
- **Tokens**: Total tokens used (when available)

## Styling

### Color Scheme

The UI uses a professional color palette:
- **Primary**: Blue (#2563eb) - Actions, links
- **Success**: Green (#10b981) - OpenAI, success states
- **Purple**: (#8b5cf6) - Anthropic
- **Error**: Red (#ef4444) - Errors, warnings

### Responsive Design

The interface adapts to screen size:
- **Desktop** (>1024px): Sidebar + chat area
- **Tablet** (768-1024px): Stacked layout
- **Mobile** (<768px): Single column, optimized touch targets

### Dark/Light Mode

Currently light mode only. Dark mode can be added by:
1. Adding `prefers-color-scheme` media query
2. Defining dark color palette
3. Updating CSS variables

## WebSocket Events

### Client → Server

```javascript
// Chat message
ws.send({
  type: 'chat',
  provider: 'openai',
  model: 'gpt-4',
  messages: [...],
  stream: true
});

// Get capabilities
ws.send({ type: 'get_capabilities' });

// Get tools
ws.send({ type: 'get_tools', provider: 'openai' });
```

### Server → Client

```javascript
// Connection established
{ type: 'connected', clientId: '...', timestamp: ... }

// Chat chunk (streaming)
{ type: 'chat_chunk', chunk: {...} }

// Tool execution
{ type: 'tool_call', toolCall: {...} }
{ type: 'tool_result', result: {...} }

// Completion
{ type: 'chat_complete', conversationId: '...' }
```

## API Integration

### Health Check

```javascript
const health = await apiClient.checkHealth();
console.log(health.providers); // { openai: true, anthropic: true }
```

### Send Message

```javascript
const response = await apiClient.chat('openai', {
  messages: [{ role: 'user', content: 'Hello' }],
  model: 'gpt-4',
  stream: false
});
```

### Conversation Management

```javascript
// List conversations
const { conversations } = await apiClient.listConversations();

// Load conversation
const { conversation } = await apiClient.getConversation(id);

// Delete conversation
await apiClient.deleteConversation(id);
```

## Customization

### Change Backend URL

Edit `js/app.js`:

```javascript
constructor() {
  this.apiBaseURL = 'http://your-backend-url';
  this.wsURL = 'ws://your-backend-url';
  // ...
}
```

### Add Custom Styling

Add to `css/styles.css` or create a new stylesheet:

```css
/* Custom theme */
:root {
  --primary-color: #your-color;
  /* ... */
}
```

### Extend Functionality

Add new features by:
1. Adding UI elements to `index.html`
2. Styling in `css/styles.css`
3. Logic in `js/app.js`
4. API methods in `js/api-client.js`

## Browser Compatibility

Tested and supported:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

Required features:
- ES6 Modules
- Fetch API
- WebSocket API
- CSS Grid
- CSS Custom Properties

## Troubleshooting

### "Backend server not available"

- Check backend is running on port 3000
- Verify backend URL in console
- Check CORS settings

### WebSocket connection fails

- Ensure WebSocket port is accessible
- Check firewall settings
- Try disabling WebSocket (use HTTP mode)

### Messages not appearing

- Check browser console for errors
- Verify API key configuration in backend
- Test with backend examples first

### Styling issues

- Clear browser cache
- Check for CSS conflicts
- Verify all CSS files loaded

## Performance

### Optimization Tips

1. **Limit message history**: Clear old conversations regularly
2. **Use streaming**: Better perceived performance
3. **WebSocket preferred**: Lower latency than HTTP polling
4. **Minimize tool calls**: Each tool adds latency

### Known Limitations

- Conversations stored in memory (backend restart clears)
- No pagination for conversation list
- Limited message history display (scrolling can be slow with 100+ messages)
- No message search/filter

## Security

### Best Practices

- Always use HTTPS in production
- Validate all user input
- Sanitize HTML to prevent XSS
- Don't expose API keys in frontend code
- Use authentication in production

### Current Security

The frontend:
- ✅ Escapes HTML in messages
- ✅ Validates API responses
- ✅ Handles errors gracefully
- ⚠️ No authentication (add for production)
- ⚠️ Trusts backend completely

## Development

### File Structure

```
frontend/
├── index.html           # 150 lines - Main UI
├── css/
│   └── styles.css      # 750 lines - All styling
└── js/
    ├── app.js          # 600 lines - Main app
    ├── websocket-client.js # 150 lines - WS client
    └── api-client.js   # 130 lines - HTTP client
```

### Code Style

- ES6 modules
- Class-based architecture
- Event-driven patterns
- Promises/async-await
- Clean, commented code

### Adding Features

1. **New UI Element**:
   - Add HTML in `index.html`
   - Style in `css/styles.css`
   - Wire up in `js/app.js`

2. **New API Endpoint**:
   - Add method to `js/api-client.js`
   - Call from `js/app.js`

3. **New WebSocket Event**:
   - Add handler in `js/websocket-client.js`
   - Listen in `js/app.js`

## Future Enhancements

Potential improvements:
- [ ] Dark mode toggle
- [ ] Message search/filter
- [ ] Conversation export (JSON, Markdown)
- [ ] Syntax highlighting for code blocks
- [ ] File upload support
- [ ] Voice input/output
- [ ] Multi-language support
- [ ] Keyboard shortcuts
- [ ] Conversation branching
- [ ] Custom system prompts

## License

Part of the FixiPlug project.

## See Also

- [Backend Documentation](../README.md)
- [Agent SDK](../../sdk/README.md)
- [OpenAI Adapter](../../sdk/adapters/openai-adapter.js)
- [Anthropic Adapter](../../sdk/adapters/anthropic-adapter.js)
