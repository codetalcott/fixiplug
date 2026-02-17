# Using FixiPlug MCP Server in Claude Code

There are several ways to use the MCP server with Claude Code.

## Current Status

✅ **MCP server is built and ready**
✅ **Project-specific MCP config created** (`.claude/mcp.json`)
⏳ **Configuration may need Claude Code restart to load**

## Method 1: Project-Specific MCP Config (Recommended)

The MCP server is configured in:
```
/Users/williamtalcott/projects/fixiplug/.claude/mcp.json
```

Claude Code should automatically detect and load this configuration.

**To verify it's working:**
1. Restart Claude Code (close and reopen the window)
2. Look for MCP server indicator in the UI
3. Ask Claude Code to use one of the tools

**Available tools:**
- `query_courses` - Query Django course data
- `click_button` - Click UI elements
- `extract_data` - Extract structured data
- `fill_form` - Fill forms programmatically
- `navigate` - Navigate to URLs
- `get_table_data` - Extract table data

## Method 2: Direct Command Execution

You can call the MCP server tools directly by running the server and sending JSON-RPC messages.

**Start server:**
```bash
cd /Users/williamtalcott/projects/fixiplug/mcp-server
node build/index.js
```

**The server communicates via stdio using JSON-RPC 2.0 protocol.**

## Method 3: Use from Claude Desktop

The server is already configured in Claude Desktop:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

Just restart Claude Desktop and the tools will be available.

## Testing the Server

### Test 1: Basic Startup
```bash
cd /Users/williamtalcott/projects/fixiplug/mcp-server
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node build/index.js
```

Should output: Server initialization response

### Test 2: List Available Tools
After initialization, send:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

Should return: List of 6 tools with descriptions

### Test 3: Call a Tool (requires Django running)
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "query_courses",
    "arguments": {
      "filter": {
        "search": "Biology"
      },
      "limit": 10
    }
  }
}
```

## Example Usage in Claude Code

Once the MCP server is loaded, you can ask Claude Code:

**Example 1:**
```
Use the query_courses tool to find all Biology courses
```

**Example 2:**
```
Navigate to /experimental/agent-test/ using the navigate tool
```

**Example 3:**
```
Use get_table_data to extract all course data from the table
```

## Troubleshooting

### MCP Server Not Appearing

1. **Check config exists:**
   ```bash
   cat /Users/williamtalcott/projects/fixiplug/.claude/mcp.json
   ```

2. **Verify server builds:**
   ```bash
   cd /Users/williamtalcott/projects/fixiplug/mcp-server
   npm run build
   ```

3. **Test server manually:**
   ```bash
   node build/index.js
   # Should start without errors
   ```

4. **Restart Claude Code**

### Django Not Running

If you get "Connection refused" errors:
```bash
# Start Django in another terminal
cd /path/to/your/django/project
python manage.py runserver
```

### Browser Errors

The server uses Playwright with Chromium. If browser fails:
```bash
# Reinstall Playwright browsers
cd /Users/williamtalcott/projects/fixiplug/mcp-server
npx playwright install chromium
```

## Configuration Options

Edit `.claude/mcp.json` to customize:

```json
{
  "mcpServers": {
    "fixiplug-agent": {
      "command": "node",
      "args": [
        "/Users/williamtalcott/projects/fixiplug/mcp-server/build/index.js"
      ],
      "env": {
        "DJANGO_BASE_URL": "http://localhost:8000",
        "HEADLESS": "true",
        "AUTO_START_BROWSER": "false",
        "API_TIMEOUT": "5000",
        "PAGE_TIMEOUT": "30000"
      }
    }
  }
}
```

## Benefits in Claude Code

1. **Automated testing** - Claude Code can run tests using the tools
2. **Data extraction** - Extract data from your Django app programmatically
3. **UI automation** - Automate clicking buttons and filling forms
4. **Integration testing** - Test your app's behavior end-to-end

## Current Limitations

- Requires Django app running on localhost:8000
- Browser-based tools require FixiPlug loaded on the page
- Tools run in the context of your local machine

## Next Steps

1. **Verify MCP server loads in Claude Code** (check UI)
2. **Start Django app** (`python manage.py runserver`)
3. **Try a tool** ("Use query_courses to show all courses")
4. **Monitor performance** (responses include execution time)

---

**The MCP server is ready to use! Try asking Claude Code to use one of the tools.**
