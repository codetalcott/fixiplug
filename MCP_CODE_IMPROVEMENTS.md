# FixiPlug MCP Server - Code Improvements

## 1. Standardized Response Type

### Create `src/core/types.ts`

```typescript
/**
 * Standard response format for all MCP tools
 */
export interface ToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    timestamp?: string;
    executionTime?: number;
    [key: string]: any;
  };
}

/**
 * Helper to create success responses
 */
export function successResponse<T>(
  data: T,
  meta?: ToolResponse['meta']
): ToolResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Helper to create error responses
 */
export function errorResponse(
  error: string | Error,
  meta?: ToolResponse['meta']
): ToolResponse {
  return {
    success: false,
    error: error instanceof Error ? error.message : error,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Configuration interface
 */
export interface Config {
  baseUrl: string;
  browser: {
    headless: boolean;
    timeout: {
      page: number;
      fixiplug: number;
      command: number;
    };
  };
  api: {
    timeout: number;
    retries: number;
  };
}

export const defaultConfig: Config = {
  baseUrl: process.env.BASE_URL || 'http://localhost:8000',
  browser: {
    headless: process.env.HEADLESS !== 'false',
    timeout: {
      page: 30000,
      fixiplug: 5000,
      command: 10000
    }
  },
  api: {
    timeout: 5000,
    retries: 3
  }
};
```

## 2. Improved AgentExecutor with Error Handling

### Update `src/agent-executor.ts`

```typescript
import { BrowserManager } from "./browser.js";
import { ToolResponse, successResponse, errorResponse, Config } from "./core/types.js";

export class AgentExecutor {
  constructor(
    private browser: BrowserManager,
    private config: Config
  ) {}

  /**
   * Query courses - can work with or without browser
   */
  async queryCourses(args: {
    filter?: { search?: string; page?: number };
    limit?: number;
  }): Promise<ToolResponse> {
    const startTime = Date.now();
    
    try {
      const { filter = {}, limit = 25 } = args;

      // Build query params
      const params: string[] = [];
      if (filter.search) {
        params.push(`q=${encodeURIComponent(filter.search)}`);
      }
      if (filter.page) {
        params.push(`page=${filter.page}`);
      }
      params.push(`limit=${limit}`);

      const queryString = params.join("&");
      const url = `${this.config.baseUrl}/experimental/courses/?${queryString}`;

      // Try direct API call first (faster, no browser needed)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.api.timeout
        );

        const response = await fetch(url, {
          headers: { 
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        return successResponse(data, {
          executionTime: Date.now() - startTime,
          method: 'direct-api'
        });

      } catch (apiError) {
        // Fallback to browser if direct API fails
        console.warn('Direct API call failed, trying browser method:', apiError);
        
        if (!this.browser.isActive()) {
          throw new Error('Browser not available for fallback');
        }

        await this.browser.navigateTo(url);
        const page = this.browser.getPage();
        
        if (!page) {
          throw new Error("Browser page not available");
        }

        const data = await page.evaluate(async () => {
          const response = await fetch(window.location.href, {
            headers: { Accept: "application/json" }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          return await response.json();
        });

        return successResponse(data, {
          executionTime: Date.now() - startTime,
          method: 'browser-fallback'
        });
      }

    } catch (error) {
      return errorResponse(error as Error, {
        executionTime: Date.now() - startTime,
        args
      });
    }
  }

  /**
   * Click button - requires browser
   */
  async clickButton(args: {
    selector?: string;
    text?: string;
  }): Promise<ToolResponse> {
    const startTime = Date.now();

    try {
      if (!this.browser.isActive()) {
        throw new Error('Browser is not active');
      }

      const params: any = {};

      if (args.selector) {
        params.selector = args.selector;
      } else if (args.text) {
        params.button = args.text;
      } else {
        throw new Error("Must provide selector or text");
      }

      const result = await this.browser.executeAgentCommand(
        "agent:clickButton",
        params
      );

      return successResponse(result, {
        executionTime: Date.now() - startTime
      });

    } catch (error) {
      return errorResponse(error as Error, {
        executionTime: Date.now() - startTime,
        args
      });
    }
  }

  /**
   * Extract data from page - requires browser
   */
  async extractData(args: {
    selector: string;
    fields?: Record<string, string>;
  }): Promise<ToolResponse> {
    const startTime = Date.now();

    try {
      if (!this.browser.isActive()) {
        throw new Error('Browser is not active');
      }

      const params: any = { selector: args.selector };
      if (args.fields) {
        params.fields = args.fields;
      }

      const result = await this.browser.executeAgentCommand(
        "agent:extract",
        params
      );

      return successResponse(result, {
        executionTime: Date.now() - startTime
      });

    } catch (error) {
      return errorResponse(error as Error, {
        executionTime: Date.now() - startTime,
        args
      });
    }
  }

  /**
   * Fill form - requires browser
   */
  async fillForm(args: {
    form_selector: string;
    data: Record<string, any>;
  }): Promise<ToolResponse> {
    const startTime = Date.now();

    try {
      if (!this.browser.isActive()) {
        throw new Error('Browser is not active');
      }

      const result = await this.browser.executeAgentCommand("agent:fillForm", {
        form: args.form_selector,
        data: args.data
      });

      return successResponse(result, {
        executionTime: Date.now() - startTime
      });

    } catch (error) {
      return errorResponse(error as Error, {
        executionTime: Date.now() - startTime,
        args
      });
    }
  }

  /**
   * Navigate to URL
   */
  async navigate(args: { url: string }): Promise<ToolResponse> {
    const startTime = Date.now();

    try {
      if (!this.browser.isActive()) {
        throw new Error('Browser is not active');
      }

      await this.browser.navigateTo(args.url);
      
      return successResponse(
        { message: `Navigated to ${args.url}` },
        { executionTime: Date.now() - startTime }
      );

    } catch (error) {
      return errorResponse(error as Error, {
        executionTime: Date.now() - startTime,
        args
      });
    }
  }

  /**
   * Get table data - requires browser
   */
  async getTableData(args: {
    table_selector?: string;
  }): Promise<ToolResponse> {
    const startTime = Date.now();

    try {
      if (!this.browser.isActive()) {
        throw new Error('Browser is not active');
      }

      const tableSelector = args.table_selector || "#course-table";

      const result = await this.browser.executeAgentCommand("agent:queryTable", {
        table: tableSelector,
        extractData: true
      });

      return successResponse(result, {
        executionTime: Date.now() - startTime,
        selector: tableSelector
      });

    } catch (error) {
      return errorResponse(error as Error, {
        executionTime: Date.now() - startTime,
        args
      });
    }
  }
}
```

## 3. Enhanced BrowserManager

### Update `src/browser.ts`

```typescript
import { chromium, Browser, Page } from "playwright";
import { Config } from "./core/types.js";

export class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.browser) {
      console.warn("Browser already started");
      return;
    }

    try {
      this.browser = await chromium.launch({
        headless: this.config.browser.headless
      });

      this.page = await this.browser.newPage();

      // Set timeouts
      this.page.setDefaultTimeout(this.config.browser.timeout.page);

      // Load the agent test page
      await this.page.goto(
        `${this.config.baseUrl}/experimental/agent-test/`,
        { waitUntil: 'domcontentloaded' }
      );

      // Wait for FixiPlug to load
      await this.page.waitForFunction(
        "typeof window.fixiplug !== 'undefined'",
        { timeout: this.config.browser.timeout.fixiplug }
      );

      console.log("✅ Browser started, FixiPlug loaded");
    } catch (error) {
      console.error("Failed to start browser:", error);
      await this.close(); // Clean up on failure
      throw error;
    }
  }

  async executeAgentCommand(command: string, params: any): Promise<any> {
    if (!this.page) {
      throw new Error("Browser not started");
    }

    try {
      const result = await this.page.evaluate(
        async ({ cmd, prms }) => {
          try {
            const result = await (window as any).fixiplug.dispatch(cmd, prms);
            return { success: true, data: result };
          } catch (error: any) {
            return { 
              success: false, 
              error: error.message,
              stack: error.stack
            };
          }
        },
        { cmd: command, prms: params }
      );

      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      return result.data;
    } catch (error) {
      console.error("Error executing agent command:", error);
      throw error;
    }
  }

  async navigateTo(path: string): Promise<void> {
    if (!this.page) {
      throw new Error("Browser not started");
    }

    const url = path.startsWith("http") 
      ? path 
      : `${this.config.baseUrl}${path}`;

    await this.page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for FixiPlug to load on the new page
    await this.page.waitForFunction(
      "typeof window.fixiplug !== 'undefined'",
      { timeout: this.config.browser.timeout.fixiplug }
    ).catch(() => {
      console.warn("Warning: FixiPlug not available on this page");
    });
  }

  async getPageContent(): Promise<string> {
    if (!this.page) {
      throw new Error("Browser not started");
    }
    return await this.page.content();
  }

  getPage(): Page | null {
    return this.page;
  }

  isActive(): boolean {
    return this.browser !== null && this.page !== null;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log("Browser closed");
    }
  }
}
```

## 4. Updated Index with Configuration

### Update `src/index.ts`

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { BrowserManager } from "./browser.js";
import { AgentExecutor } from "./agent-executor.js";
import { toolSchemas, toolDescriptions } from "./tools.js";
import { Config, defaultConfig } from "./core/types.js";

// Load configuration
const config: Config = {
  ...defaultConfig,
  baseUrl: process.env.BASE_URL || defaultConfig.baseUrl,
  browser: {
    ...defaultConfig.browser,
    headless: process.env.HEADLESS !== 'false',
    timeout: {
      page: parseInt(process.env.PAGE_TIMEOUT || '30000'),
      fixiplug: parseInt(process.env.FIXIPLUG_TIMEOUT || '5000'),
      command: parseInt(process.env.COMMAND_TIMEOUT || '10000')
    }
  },
  api: {
    timeout: parseInt(process.env.API_TIMEOUT || '5000'),
    retries: parseInt(process.env.API_RETRIES || '3')
  }
};

const server = new Server(
  {
    name: "fixiplug-agent",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let browserManager: BrowserManager;
let executor: AgentExecutor;

// Initialize browser and executor
async function initialize() {
  browserManager = new BrowserManager(config);
  executor = new AgentExecutor(browserManager, config);
  
  // Start browser (optional - can be lazy loaded)
  if (process.env.AUTO_START_BROWSER !== 'false') {
    try {
      await browserManager.start();
    } catch (error) {
      console.error("Failed to start browser during initialization:", error);
      // Continue without browser - some tools will work
    }
  }
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.entries(toolSchemas).map(([name, schema]) => ({
      name,
      description: toolDescriptions[name],
      inputSchema: schema.shape as any,
    })),
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "query_courses":
        result = await executor.queryCourses(args as any);
        break;
      case "click_button":
        result = await executor.clickButton(args as any);
        break;
      case "extract_data":
        result = await executor.extractData(args as any);
        break;
      case "fill_form":
        result = await executor.fillForm(args as any);
        break;
      case "navigate":
        result = await executor.navigate(args as any);
        break;
      case "get_table_data":
        result = await executor.getTableData(args as any);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error(`Error in tool ${name}:`, error);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            tool: name,
            args
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Cleanup on exit
async function cleanup() {
  if (browserManager) {
    await browserManager.close();
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Start server
async function main() {
  await initialize();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("FixiPlug Agent MCP server running");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

## 5. Environment Configuration

### Create `.env.example`

```bash
# Base URL for Django application
BASE_URL=http://localhost:8000

# Browser configuration
HEADLESS=true
PAGE_TIMEOUT=30000
FIXIPLUG_TIMEOUT=5000
COMMAND_TIMEOUT=10000

# API configuration
API_TIMEOUT=5000
API_RETRIES=3

# Auto-start browser on initialization
AUTO_START_BROWSER=false
```

## 6. Usage Examples

### Direct API Usage (No Browser)
```typescript
// If browser isn't started, queryCourses will use direct API
const result = await executor.queryCourses({
  filter: { search: "Chemistry" },
  limit: 10
});

// Response format:
{
  success: true,
  data: { ... },
  meta: {
    timestamp: "2025-01-15T10:30:00Z",
    executionTime: 145,
    method: "direct-api"
  }
}
```

### Browser-Based Extraction
```typescript
// Start browser first
await browserManager.start();

// Now browser-dependent tools work
const tableData = await executor.getTableData({
  table_selector: "#course-table"
});

const extracted = await executor.extractData({
  selector: ".course-row",
  fields: {
    title: "td:nth-child(1)",
    grade: "td:nth-child(3)"
  }
});
```

## Migration Path

1. **Phase 1**: Add types and response helpers
   - Create `src/core/types.ts`
   - No breaking changes

2. **Phase 2**: Update AgentExecutor methods one by one
   - Maintain backward compatibility
   - Add deprecation warnings

3. **Phase 3**: Update BrowserManager
   - Add `isActive()` method
   - Add configuration support

4. **Phase 4**: Update index.ts
   - Add configuration loading
   - Add proper error handling

5. **Phase 5**: Add tests
   - Unit tests for each method
   - Integration tests

This migration can be done incrementally without breaking existing functionality.
