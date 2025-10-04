#!/usr/bin/env node

/**
 * FixiPlug MCP Server
 *
 * Enables Claude to interact with FixiPlug agent commands through the Model Context Protocol.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { BrowserManager } from "./browser.js";
import { AgentExecutor } from "./agent-executor.js";
import { toolDescriptions } from "./tools.js";
import { Config, defaultConfig } from "./core/types.js";

// Load configuration
const config: Config = {
  ...defaultConfig,
  baseUrl: process.env.DJANGO_BASE_URL || defaultConfig.baseUrl,
  browser: {
    ...defaultConfig.browser,
    headless: process.env.HEADLESS !== "false",
    timeout: {
      page: parseInt(process.env.PAGE_TIMEOUT || "30000"),
      fixiplug: parseInt(process.env.FIXIPLUG_TIMEOUT || "5000"),
      command: parseInt(process.env.COMMAND_TIMEOUT || "10000")
    }
  },
  api: {
    timeout: parseInt(process.env.API_TIMEOUT || "5000"),
    retries: parseInt(process.env.API_RETRIES || "3")
  }
};

// Global instances (initialized on first tool call)
let browserManager: BrowserManager | null = null;
let agentExecutor: AgentExecutor | null = null;

async function ensureBrowserReady(): Promise<AgentExecutor> {
  if (!browserManager) {
    console.error("Initializing browser...");
    browserManager = new BrowserManager(config);
    agentExecutor = new AgentExecutor(browserManager, config);

    // Auto-start browser if enabled
    if (process.env.AUTO_START_BROWSER !== "false") {
      try {
        await browserManager.start();
      } catch (error) {
        console.error("Failed to start browser during initialization:", error);
        // Continue without browser - some tools will work
      }
    }
  }
  return agentExecutor!;
}

// Create server
const server = new McpServer(
  {
    name: "fixiplug-agent",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Register tools
server.tool(
  "query_courses",
  toolDescriptions.query_courses,
  {
    filter: z
      .object({
        search: z
          .string()
          .optional()
          .describe("Search query (matches course title, subject, student name)"),
        page: z.number().int().positive().optional().describe("Page number (default: 1)")
      })
      .optional()
      .describe("Filter criteria"),
    limit: z.number().int().min(1).max(100).default(25).describe("Number of results per page")
  },
  async ({ filter, limit }) => {
    const executor = await ensureBrowserReady();
    const result = await executor.queryCourses({ filter, limit });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "click_button",
  toolDescriptions.click_button,
  {
    selector: z.string().optional().describe("CSS selector for the button"),
    text: z.string().optional().describe("Button text to search for")
  },
  async ({ selector, text }) => {
    const executor = await ensureBrowserReady();
    const result = await executor.clickButton({ selector, text });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "extract_data",
  toolDescriptions.extract_data,
  {
    selector: z.string().describe("CSS selector for container elements"),
    fields: z.record(z.string()).optional().describe("Field mapping (field_name -> selector)")
  },
  async ({ selector, fields }) => {
    const executor = await ensureBrowserReady();
    const result = await executor.extractData({ selector, fields });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "fill_form",
  toolDescriptions.fill_form,
  {
    form_selector: z.string().describe("CSS selector for form element"),
    data: z.record(z.any()).describe("Field values (field_name -> value)")
  },
  async ({ form_selector, data }) => {
    const executor = await ensureBrowserReady();
    const result = await executor.fillForm({ form_selector, data });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "navigate",
  toolDescriptions.navigate,
  {
    url: z.string().describe("URL path to navigate to (e.g., '/experimental/courses/')")
  },
  async ({ url }) => {
    const executor = await ensureBrowserReady();
    const result = await executor.navigate({ url });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

server.tool(
  "get_table_data",
  toolDescriptions.get_table_data,
  {
    table_selector: z.string().default("#course-table").describe("CSS selector for table element")
  },
  async ({ table_selector }) => {
    const executor = await ensureBrowserReady();
    const result = await executor.getTableData({ table_selector });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

// Cleanup handlers
process.on("SIGINT", async () => {
  console.error("Shutting down...");
  if (browserManager) {
    await browserManager.close();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.error("Shutting down...");
  if (browserManager) {
    await browserManager.close();
  }
  process.exit(0);
});

// Main entry point
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FixiPlug MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
