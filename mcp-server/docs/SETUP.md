# FixiPlug MCP Server - Setup Guide

This guide will help you set up and configure the FixiPlug MCP server for Django integration.

## Prerequisites

- Node.js 18+ and npm
- A Django project with dj-fixi installed
- FixiPlug built and integrated in your Django project
- Playwright browsers (will be installed automatically)

## Installation

### 1. Install the MCP Server

```bash
cd fixiplug/mcp-server
npm install
```

### 2. Build the Server

```bash
npm run build
```

This compiles the TypeScript source to JavaScript in the `build/` directory.

### 3. Install Playwright Browsers

```bash
npx playwright install chromium
```

## Configuration

### Environment Variables

The MCP server can be configured using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DJANGO_BASE_URL` | Base URL of your Django application | `http://localhost:8000` |
| `HEADLESS` | Run browser in headless mode | `true` |

**Example:**

```bash
export DJANGO_BASE_URL="http://localhost:8000"
export HEADLESS="false"  # Show browser window for debugging
```

### Configuration File

You can also create a custom configuration by modifying the config in your code:

```typescript
import { defaultConfig } from './core/types.js';

const customConfig = {
  ...defaultConfig,
  baseUrl: 'http://custom.local:8000',
  browser: {
    headless: false,
    timeout: {
      page: 60000,      // Page load timeout (60s)
      fixiplug: 10000,  // FixiPlug load timeout (10s)
      command: 20000,   // Command execution timeout (20s)
    },
  },
  api: {
    timeout: 10000,  // API request timeout (10s)
    retries: 3,      // Number of retries for failed requests
  },
};
```

## Django Project Setup

### 1. Install dj-fixi

```bash
pip install dj-fixi
```

### 2. Add to Django Settings

```python
# settings.py

INSTALLED_APPS = [
    # ...
    'dj_fixi',
]

MIDDLEWARE = [
    # ...
    'dj_fixi.middleware.FxMiddleware',
]
```

### 3. Create Agent Test View

Create a view that includes FixiPlug and the agent-commands plugin:

```python
# views.py
from dj_fixi.views import FxView

class AgentTestView(FxView):
    template_name = 'experimental/agent_test.html'

    def get_fixi_config(self):
        return {
            'plugins': [
                'agent-commands',
                'table',
                'state-tracker',
            ],
            'debug': True,
        }
```

### 4. Create Template

```html
<!-- templates/experimental/agent_test.html -->
{% load fixi %}
<!DOCTYPE html>
<html>
<head>
    <title>Agent Test Page</title>
    {% fixi_head %}
</head>
<body>
    <h1>FixiPlug Agent Test</h1>

    <!-- Your content here -->

    {% fixi_scripts %}
</body>
</html>
```

### 5. Add URL Route

```python
# urls.py
from django.urls import path
from .views import AgentTestView

urlpatterns = [
    path('experimental/agent-test/', AgentTestView.as_view(), name='agent-test'),
]
```

## FixiPlug Build Configuration

Ensure your FixiPlug build includes the required plugins:

```javascript
// fixiplug build config
{
  "plugins": [
    "agent-commands",
    "table",
    "state-tracker",
    "introspection"
  ]
}
```

Build FixiPlug:

```bash
cd fixiplug
npm run build
```

The built files should be accessible to your Django static files.

## Running the Server

### Development Mode

```bash
# From mcp-server directory
npm run inspector
```

This launches the MCP Inspector, which provides a UI for testing tools.

### Production Mode

Run the server directly:

```bash
node build/index.js
```

Or use it with an MCP client (like Claude Desktop):

```json
{
  "mcpServers": {
    "fixiplug": {
      "command": "node",
      "args": ["/path/to/fixiplug/mcp-server/build/index.js"],
      "env": {
        "DJANGO_BASE_URL": "http://localhost:8000"
      }
    }
  }
}
```

## Testing the Installation

### 1. Start Your Django Server

```bash
python manage.py runserver
```

### 2. Run MCP Inspector

```bash
cd fixiplug/mcp-server
npm run inspector
```

### 3. Test a Tool

In the MCP Inspector, try the `query_courses` tool:

```json
{
  "filter": {
    "search": "math"
  },
  "limit": 10
}
```

You should see results from your Django application.

## Troubleshooting

### Browser Not Starting

**Issue:** Browser fails to launch

**Solutions:**
- Ensure Playwright browsers are installed: `npx playwright install chromium`
- Check if Chromium is blocked by security settings
- Try running in non-headless mode: `export HEADLESS=false`

### FixiPlug Not Loading

**Issue:** "FixiPlug not available" warning

**Solutions:**
- Verify FixiPlug is built: `npm run build` in fixiplug directory
- Check Django static files configuration
- Ensure `{% fixi_scripts %}` is in your template
- Check browser console for JavaScript errors

### Connection Refused

**Issue:** Cannot connect to Django server

**Solutions:**
- Verify Django is running: `python manage.py runserver`
- Check `DJANGO_BASE_URL` is correct
- Ensure no firewall is blocking connections
- Try accessing the URL in a browser first

### Tool Returns Errors

**Issue:** Tools return error responses

**Solutions:**
- Check Django logs for errors
- Verify the agent-commands plugin is loaded
- Test the endpoint manually in a browser
- Enable debug mode in Django settings

### Timeout Errors

**Issue:** Operations timeout

**Solutions:**
- Increase timeout values in config
- Check network latency
- Ensure Django server is responding quickly
- Look for slow database queries

## Next Steps

- Read the [API Documentation](./API.md) for tool details
- Check out [Examples](./EXAMPLES.md) for common use cases
- Review the [Validation Document](../../MCP_SERVER_VALIDATION.md) for best practices
- Explore integration tests in `dj-fixi/tests/test_mcp_integration.py`

## Support

For issues and questions:
- Check the [GitHub Issues](https://github.com/your-org/fixiplug/issues)
- Review Django logs: `python manage.py runserver --verbosity 3`
- Enable browser DevTools: `export HEADLESS=false`
