/**
 * Core types and utilities for FixiPlug MCP Server
 */

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
  meta?: ToolResponse["meta"]
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
  meta?: ToolResponse["meta"]
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
  baseUrl: process.env.DJANGO_BASE_URL || "http://localhost:8000",
  browser: {
    headless: process.env.HEADLESS !== "false",
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
