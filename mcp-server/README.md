# FixiPlug MCP Server

Model Context Protocol (MCP) server that enables Claude to interact with FixiPlug agent commands programmatically.

## Overview

This MCP server bridges Claude with FixiPlug's browser automation capabilities, allowing Claude to:
- Query data from Django applications
- Click buttons and interact with UI elements
- Extract structured data from pages
- Fill forms programmatically
- Navigate pages
- Query table data

## Architecture

```
┌─────────────────────────────────┐
│  Claude Desktop / Claude Code   │
│  Uses MCP tools:                │
│  - query_courses()              │
│  - click_button()               │
│  - extract_data()               │
│  - fill_form()                  │
│  - navigate()                   │
│  - get_table_data()             │
└────────────┬────────────────────┘
             │ MCP Protocol (stdio)
             ▼
┌─────────────────────────────────┐
│  MCP Server (TypeScript)        │
│  - Receives tool calls          │
│  - Manages Playwright browser   │
│  - Executes FixiPlug commands   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Headless Browser (Playwright)  │
│  - window.fixiplug.dispatch()   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Django App (localhost:8000)    │
│  - FixiPlug agent commands      │
└─────────────────────────────────┘
```

## Installation

### Prerequisites

- Node.js 16 or higher
- Django app running on `http://localhost:8000` with FixiPlug loaded

### Setup

```bash
cd mcp-server
npm install
npm run build
```

### Install Playwright browsers (first time only)

```bash
npx playwright install chromium
```

## Configuration

### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "fixiplug-agent": {
      "command": "node",
      "args": [
        "/absolute/path/to/fixiplug/mcp-server/build/index.js"
      ],
      "env": {
        "DJANGO_BASE_URL": "http://localhost:8000",
        "HEADLESS": "true"
      }
    }
  }
}
```

### Environment Variables

- `DJANGO_BASE_URL`: Base URL of your Django app (default: `http://localhost:8000`)
- `HEADLESS`: Run browser in headless mode (default: `true`, set to `false` to see browser)

## Available Tools

### query_courses

Query course data from the Django database with search and pagination support.

```typescript
{
  filter?: {
    search?: string;  // Search query
    page?: number;    // Page number
  };
  limit?: number;     // Results per page (default: 25, max: 100)
}
```

### click_button

Click a button using CSS selector or text content.

```typescript
{
  selector?: string;  // CSS selector
  text?: string;      // Button text
}
```

### extract_data

Extract structured data from page elements.

```typescript
{
  selector: string;              // Container CSS selector
  fields?: Record<string, string>;  // Field mappings
}
```

### fill_form

Fill form fields programmatically.

```typescript
{
  form_selector: string;           // Form CSS selector
  data: Record<string, any>;       // Field values
}
```

### navigate

Navigate to a URL.

```typescript
{
  url: string;  // URL path or full URL
}
```

### get_table_data

Extract all data from a table.

```typescript
{
  table_selector?: string;  // Table CSS selector (default: "#course-table")
}
```

## Usage Examples

Once configured in Claude Desktop, you can use natural language:

**Example 1: Query data**
```
User: "Show me all Biology courses"
Claude: [Uses query_courses with filter: {search: "Biology"}]
```

**Example 2: Navigate and interact**
```
User: "Go to the course list and click the refresh button"
Claude:
1. [Uses navigate to /experimental/courses/]
2. [Uses click_button with text: "Refresh"]
```

**Example 3: Extract data**
```
User: "Extract all course names from the table"
Claude: [Uses get_table_data to extract table rows]
```

## Development

### Build

```bash
npm run build
```

### Test with MCP Inspector

```bash
npm run inspector
```

This opens a debugging interface where you can test tool calls manually.

### Debug Mode

Run with visible browser:

```bash
HEADLESS=false node build/index.js
```

## Troubleshooting

### Browser fails to start

- Ensure Django app is running on the configured base URL
- Check that Playwright browsers are installed: `npx playwright install chromium`

### Tools not appearing in Claude

- Verify the MCP server is properly configured in `claude_desktop_config.json`
- Check the paths are absolute, not relative
- Restart Claude Desktop after configuration changes

### FixiPlug not loading

- Ensure the Django page at `/experimental/agent-test/` loads FixiPlug
- Check browser console for errors (run with `HEADLESS=false`)

## Security

- MCP server runs locally only
- Browser automation is isolated to localhost
- No external network access required
- Validate all inputs in production use

## License

MIT
