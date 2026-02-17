# MCP Server Design for FixiPlug Agent Integration

## Overview

Create a **Model Context Protocol (MCP) server** that bridges Claude with the FixiPlug agent commands, enabling Claude to interact with the Django app programmatically.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Claude Desktop / Claude Code               │
│                                             │
│  Uses MCP tools like:                       │
│  - query_courses(filter)                    │
│  - click_button(selector)                   │
│  - extract_data(selector)                   │
│  - fill_form(data)                          │
└──────────────┬──────────────────────────────┘
               │ MCP Protocol
               │ (stdio/SSE)
               ▼
┌─────────────────────────────────────────────┐
│  MCP Server (Python/Node.js)                │
│                                             │
│  • Receives tool calls from Claude         │
│  • Manages Playwright browser instance      │
│  • Executes FixiPlug agent commands         │
│  • Returns structured results               │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Headless Browser (Playwright)              │
│                                             │
│  • Loads http://localhost:8000/...          │
│  • Executes window.fixiplug.dispatch()      │
│  • Extracts results                         │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Django App (localhost:8000)                │
│                                             │
│  • /experimental/agent-test/                │
│  • /experimental/courses/                   │
│  • FixiPlug agent commands active           │
└─────────────────────────────────────────────┘
```

## Implementation Plan

### 1. MCP Server Setup

**Technology Choice**: Python (integrates well with Django)

```bash
# Install MCP SDK and Playwright
uv pip install mcp playwright
playwright install chromium
```

**File Structure**:
```
transcripts/
├── mcp_server/
│   ├── __init__.py
│   ├── server.py              # Main MCP server
│   ├── browser.py             # Playwright browser manager
│   ├── tools.py               # MCP tool definitions
│   └── agent_executor.py      # FixiPlug command executor
├── mcp_server.json            # MCP configuration
└── README_MCP.md              # Documentation
```

### 2. MCP Server Implementation

#### `mcp_server/server.py`
```python
#!/usr/bin/env python3
"""MCP Server for FixiPlug Agent Commands"""

import asyncio
import json
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from .browser import BrowserManager
from .agent_executor import AgentExecutor
from .tools import get_tool_definitions

class FixiPlugMCPServer:
    def __init__(self):
        self.server = Server("fixiplug-agent")
        self.browser_manager = None
        self.agent_executor = None

        # Register handlers
        self.server.list_tools()(self.list_tools)
        self.server.call_tool()(self.call_tool)

    async def list_tools(self) -> list[Tool]:
        """Return available MCP tools"""
        return get_tool_definitions()

    async def call_tool(self, name: str, arguments: dict) -> list[TextContent]:
        """Execute a tool call"""
        # Initialize browser if needed
        if not self.browser_manager:
            self.browser_manager = BrowserManager()
            await self.browser_manager.start()
            self.agent_executor = AgentExecutor(self.browser_manager)

        # Route to appropriate handler
        if name == "query_courses":
            result = await self.agent_executor.query_courses(**arguments)
        elif name == "click_button":
            result = await self.agent_executor.click_button(**arguments)
        elif name == "extract_data":
            result = await self.agent_executor.extract_data(**arguments)
        elif name == "fill_form":
            result = await self.agent_executor.fill_form(**arguments)
        elif name == "navigate":
            result = await self.agent_executor.navigate(**arguments)
        elif name == "get_table_data":
            result = await self.agent_executor.get_table_data(**arguments)
        else:
            raise ValueError(f"Unknown tool: {name}")

        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]

    async def run(self):
        """Start the MCP server"""
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                self.server.create_initialization_options()
            )

async def main():
    server = FixiPlugMCPServer()
    await server.run()

if __name__ == "__main__":
    asyncio.run(main())
```

#### `mcp_server/browser.py`
```python
"""Browser automation manager using Playwright"""

from playwright.async_api import async_playwright, Browser, Page
from typing import Optional

class BrowserManager:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None

    async def start(self):
        """Start Playwright browser"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=True  # Run in background
        )
        self.page = await self.browser.new_page()

        # Load the agent test page
        await self.page.goto(f"{self.base_url}/experimental/agent-test/")

        # Wait for FixiPlug to load
        await self.page.wait_for_function(
            "typeof window.fixiplug !== 'undefined'",
            timeout=5000
        )

        print("✅ Browser started, FixiPlug loaded")

    async def execute_agent_command(self, command: str, params: dict) -> dict:
        """Execute a FixiPlug agent command"""
        if not self.page:
            raise RuntimeError("Browser not started")

        # Execute the agent command in browser context
        result = await self.page.evaluate(f"""
            async () => {{
                try {{
                    const result = await window.fixiplug.dispatch(
                        '{command}',
                        {json.dumps(params)}
                    );
                    return {{ success: true, data: result }};
                }} catch (error) {{
                    return {{ success: false, error: error.message }};
                }}
            }}
        """)

        return result

    async def navigate_to(self, path: str):
        """Navigate to a path"""
        await self.page.goto(f"{self.base_url}{path}")

    async def get_page_content(self):
        """Get current page HTML"""
        return await self.page.content()

    async def close(self):
        """Clean up resources"""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
```

#### `mcp_server/agent_executor.py`
```python
"""Execute FixiPlug agent commands via browser"""

from typing import Dict, Any, List
import json

class AgentExecutor:
    def __init__(self, browser_manager):
        self.browser = browser_manager

    async def query_courses(
        self,
        filter: Dict[str, Any] = None,
        limit: int = 25
    ) -> Dict[str, Any]:
        """Query courses from API"""
        # Build query params
        params = []
        if filter:
            if 'search' in filter:
                params.append(f"q={filter['search']}")
            if 'page' in filter:
                params.append(f"page={filter['page']}")
        params.append(f"limit={limit}")

        query_string = "&".join(params) if params else ""
        url = f"/experimental/courses/?{query_string}"

        # Fetch data
        await self.browser.navigate_to(url)

        # Extract JSON from page
        result = await self.browser.page.evaluate("""
            async () => {
                const response = await fetch(
                    window.location.href,
                    { headers: { 'Accept': 'application/json' }}
                );
                return await response.json();
            }
        """)

        return result

    async def click_button(
        self,
        selector: str = None,
        text: str = None
    ) -> Dict[str, Any]:
        """Click a button using agent command"""
        params = {}
        if selector:
            params['selector'] = selector
        elif text:
            params['button'] = text
        else:
            raise ValueError("Must provide selector or text")

        result = await self.browser.execute_agent_command(
            'agent:clickButton',
            params
        )

        return result

    async def extract_data(
        self,
        selector: str,
        fields: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """Extract structured data from page"""
        params = {'selector': selector}
        if fields:
            params['fields'] = fields

        result = await self.browser.execute_agent_command(
            'agent:extract',
            params
        )

        return result

    async def fill_form(
        self,
        form_selector: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Fill a form using agent command"""
        result = await self.browser.execute_agent_command(
            'agent:fillForm',
            {'form': form_selector, 'data': data}
        )

        return result

    async def navigate(self, url: str) -> Dict[str, Any]:
        """Navigate to URL using agent command"""
        result = await self.browser.execute_agent_command(
            'agent:navigate',
            {'url': url}
        )

        return result

    async def get_table_data(
        self,
        table_selector: str = '#course-table'
    ) -> Dict[str, Any]:
        """Query table data using agent command"""
        result = await self.browser.execute_agent_command(
            'agent:queryTable',
            {'table': table_selector, 'extractData': True}
        )

        return result
```

#### `mcp_server/tools.py`
```python
"""MCP tool definitions for Claude"""

from mcp.types import Tool

def get_tool_definitions() -> list[Tool]:
    """Return MCP tool definitions compatible with Claude"""
    return [
        Tool(
            name="query_courses",
            description=(
                "Query course data from the Django database. "
                "Supports search, filtering, and pagination. "
                "Returns structured JSON with course information."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "filter": {
                        "type": "object",
                        "description": "Filter criteria",
                        "properties": {
                            "search": {
                                "type": "string",
                                "description": "Search query (matches course title, subject, student name)"
                            },
                            "page": {
                                "type": "integer",
                                "description": "Page number (default: 1)"
                            }
                        }
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Number of results per page (default: 25, max: 100)",
                        "default": 25
                    }
                }
            }
        ),

        Tool(
            name="click_button",
            description=(
                "Click a button on the page using FixiPlug agent command. "
                "Can target by text content or CSS selector."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "selector": {
                        "type": "string",
                        "description": "CSS selector for the button"
                    },
                    "text": {
                        "type": "string",
                        "description": "Button text to search for"
                    }
                },
                "oneOf": [
                    {"required": ["selector"]},
                    {"required": ["text"]}
                ]
            }
        ),

        Tool(
            name="extract_data",
            description=(
                "Extract structured data from page elements using CSS selectors. "
                "Returns array of objects with extracted field values."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "selector": {
                        "type": "string",
                        "description": "CSS selector for container elements",
                        "required": True
                    },
                    "fields": {
                        "type": "object",
                        "description": "Field mapping (field_name -> selector)",
                        "additionalProperties": {"type": "string"}
                    }
                },
                "required": ["selector"]
            }
        ),

        Tool(
            name="fill_form",
            description=(
                "Fill form fields programmatically using FixiPlug agent command. "
                "Supports text inputs, selects, checkboxes, and radio buttons."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "form_selector": {
                        "type": "string",
                        "description": "CSS selector for form element",
                        "required": True
                    },
                    "data": {
                        "type": "object",
                        "description": "Field values (field_name -> value)",
                        "required": True,
                        "additionalProperties": True
                    }
                },
                "required": ["form_selector", "data"]
            }
        ),

        Tool(
            name="navigate",
            description=(
                "Navigate to a URL in the browser. "
                "Waits for page load before returning."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "URL path to navigate to (e.g., '/experimental/courses/')",
                        "required": True
                    }
                },
                "required": ["url"]
            }
        ),

        Tool(
            name="get_table_data",
            description=(
                "Extract all data from a table on the page. "
                "Returns structured array of row objects."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "table_selector": {
                        "type": "string",
                        "description": "CSS selector for table element",
                        "default": "#course-table"
                    }
                }
            }
        )
    ]
```

### 3. MCP Configuration

#### `mcp_server.json`
```json
{
  "mcpServers": {
    "fixiplug-agent": {
      "command": "uv",
      "args": [
        "run",
        "python",
        "-m",
        "mcp_server.server"
      ],
      "env": {
        "DJANGO_BASE_URL": "http://localhost:8000"
      }
    }
  }
}
```

### 4. Usage Examples

#### In Claude Desktop

After installing the MCP server, Claude would have access to these tools:

**Example 1: Query courses**
```
User: "Show me all Biology courses"

Claude: I'll query the course database for Biology courses.
[Uses query_courses tool with filter: {search: "Biology"}]

Result: Found 4 Biology-related courses:
- Marine Biology A (Grade: A+, Credits: 5.0)
- Marine Biology B (Grade: A+, Credits: 5.0)
- Biology 1A (Grade: A+, Credits: 5.0)
- Biology 1B (Grade: A+, Credits: 5.0)
```

**Example 2: Extract data**
```
User: "Extract all course names from the table"

Claude: I'll extract the course data from the page.
[Uses extract_data tool with selector: ".course-row", fields: {course: "td:nth-child(1)"}]

Result: Extracted 3 courses:
- Biology 101
- Algebra II
- English Literature
```

**Example 3: Interactive workflow**
```
User: "Navigate to the course list and click the test button"

Claude:
1. [Uses navigate tool to go to /experimental/agent-test/]
2. [Uses click_button tool with text: "Test Query Table"]
3. [Uses extract_data to get results]

Done! The test button was clicked and returned table data with 3 rows.
```

### 5. Installation Steps

```bash
# 1. Install dependencies
cd ~/projects/transcripts
uv pip install mcp playwright
playwright install chromium

# 2. Create MCP server files (as shown above)
mkdir mcp_server
# ... create files ...

# 3. Configure Claude Desktop
# Edit: ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "fixiplug-agent": {
      "command": "uv",
      "args": ["run", "python", "-m", "mcp_server.server"],
      "cwd": "/Users/williamtalcott/projects/transcripts"
    }
  }
}

# 4. Restart Claude Desktop
# Tools will now be available in Claude
```

### 6. Testing

```bash
# Test MCP server standalone
cd ~/projects/transcripts
uv run python -m mcp_server.server

# Should output MCP protocol messages
# Test with MCP Inspector:
npx @modelcontextprotocol/inspector uv run python -m mcp_server.server
```

## Benefits

1. **Native Integration**: Claude can use FixiPlug commands as native tools
2. **No Manual Steps**: Fully automated browser interaction
3. **Type Safety**: MCP provides structured tool schemas
4. **Reusable**: Once built, works for all Claude conversations
5. **Extensible**: Easy to add new agent commands as tools

## Security Considerations

- ✅ MCP server runs locally (no external access)
- ✅ Browser automation is headless and isolated
- ✅ Only exposes read operations by default
- ⚠️ Add authentication before enabling write operations
- ⚠️ Validate all user inputs in tool handlers

## Next Steps

1. **Implement basic server** with query_courses tool
2. **Test with MCP Inspector** to verify tool calls
3. **Add to Claude Desktop** config
4. **Expand tools** (click, extract, fill_form)
5. **Add error handling** and logging
6. **Document usage patterns** for Claude

## File Checklist

- [ ] `mcp_server/__init__.py`
- [ ] `mcp_server/server.py`
- [ ] `mcp_server/browser.py`
- [ ] `mcp_server/agent_executor.py`
- [ ] `mcp_server/tools.py`
- [ ] `mcp_server.json`
- [ ] `README_MCP.md`
- [ ] Test script
- [ ] Claude Desktop config update

## Estimated Implementation Time

- **Basic server** (query_courses): 1-2 hours
- **Browser automation**: 2-3 hours
- **All tools**: 4-6 hours
- **Testing & debugging**: 2-3 hours
- **Documentation**: 1 hour

**Total**: ~10-15 hours for complete implementation
