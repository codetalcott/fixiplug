# FixiPlug MCP Server - Quick Start

Follow these steps to get the MCP server running with Claude Desktop.

## Step 1: Install Dependencies

```bash
cd mcp-server
npm install
npx playwright install chromium
```

## Step 2: Build the Server

```bash
npm run build
```

## Step 3: Test the Server

Start your Django app (if not already running):

```bash
# In your Django project directory
python manage.py runserver
```

Test the MCP server with the inspector:

```bash
npm run inspector
```

This opens a web interface where you can test the tools manually.

## Step 4: Configure Claude Desktop

1. Find your Claude Desktop config file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the FixiPlug MCP server configuration:

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
        "HEADLESS": "true"
      }
    }
  }
}
```

**Important**: Replace `/Users/williamtalcott/projects/fixiplug` with your actual project path.

3. Save the file and restart Claude Desktop.

## Step 5: Verify Installation

1. Open Claude Desktop
2. Look for the 🔌 icon in the bottom right (indicates MCP servers are connected)
3. Click it to see available tools from "fixiplug-agent"

## Step 6: Try It Out!

In Claude Desktop, try these commands:

```
Show me all Biology courses
```

```
Navigate to /experimental/agent-test/ and click the "Test Query Table" button
```

```
Extract all course data from the table
```

## Troubleshooting

### Server not appearing in Claude

- Check the path in `claude_desktop_config.json` is absolute and correct
- Verify the build was successful: check that `build/index.js` exists
- Restart Claude Desktop completely

### Browser fails to start

- Make sure Django is running on http://localhost:8000
- Try running with visible browser: set `"HEADLESS": "false"` in config

### FixiPlug not loading

- Verify your Django app loads FixiPlug on the test page
- Navigate to http://localhost:8000/experimental/agent-test/ manually
- Check browser console for errors (run with HEADLESS=false)

## Debug Mode

To see what's happening in the browser:

1. Edit `claude_desktop_config.json` and set `"HEADLESS": "false"`
2. Restart Claude Desktop
3. When you use a tool, you'll see the browser window

## Next Steps

- Read [README.md](README.md) for detailed documentation
- Check available tools and their parameters
- Integrate with your Django app's specific pages

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DJANGO_BASE_URL | http://localhost:8000 | Your Django app URL |
| HEADLESS | true | Run browser in headless mode |
