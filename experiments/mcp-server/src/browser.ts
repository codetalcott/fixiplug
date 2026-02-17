/**
 * Browser automation manager using Playwright
 */

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
        { waitUntil: "domcontentloaded" }
      );

      // Wait for FixiPlug to load
      await this.page.waitForFunction(
        "typeof window.fixiplug !== 'undefined'",
        { timeout: this.config.browser.timeout.fixiplug }
      );

      console.error("✅ Browser started, FixiPlug loaded");
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
        throw new Error(result.error || "Unknown error");
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

    await this.page.goto(url, { waitUntil: "domcontentloaded" });

    // Wait for FixiPlug to load on the new page
    await this.page
      .waitForFunction("typeof window.fixiplug !== 'undefined'", {
        timeout: this.config.browser.timeout.fixiplug
      })
      .catch(() => {
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
      console.error("Browser closed");
    }
  }
}
