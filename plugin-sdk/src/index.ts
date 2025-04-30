// Core plugin types and enums
export { PluginHook, PluginContext, RequestPluginContext, DomPluginContext, FixiPlugs } from '../../plugin';

// Helper utilities
/**
 * Safe fetch wrapper that returns JSON or throws
 */
export async function safeJsonFetch(url: string, options?: RequestInit): Promise<any> {
  const resp = await fetch(url, options);
  if (!resp.ok) throw new Error(`Fetch error ${resp.status}: ${resp.statusText}`);
  return resp.json();
}

/**
 * Delay for given milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

/**
 * Generate unique plugin ID
 */
export function generatePluginId(name: string, version: string): string {
  return `${name}@${version}`;
}
