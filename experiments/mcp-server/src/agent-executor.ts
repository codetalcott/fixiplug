/**
 * Execute FixiPlug agent commands via browser
 */

import { BrowserManager } from "./browser.js";
import {
  ToolResponse,
  successResponse,
  errorResponse,
  Config
} from "./core/types.js";

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
            Accept: "application/json",
            "Content-Type": "application/json"
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
          method: "direct-api"
        });
      } catch (apiError) {
        // Fallback to browser if direct API fails
        console.warn("Direct API call failed, trying browser method:", apiError);

        if (!this.browser.isActive()) {
          throw new Error("Browser not available for fallback");
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
          method: "browser-fallback"
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
        throw new Error("Browser is not active");
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
        throw new Error("Browser is not active");
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
        throw new Error("Browser is not active");
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
        throw new Error("Browser is not active");
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
        throw new Error("Browser is not active");
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
