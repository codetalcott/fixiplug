import { vi } from 'vitest';
import { generatePluginId, delay, safeJsonFetch } from '../plugin-sdk/src/index';

describe('Plugin SDK Utilities', () => {
  test('generatePluginId combines name and version', () => {
    const id = generatePluginId('test', '1.2.3');
    expect(id).toBe('test@1.2.3');
  });

  test('delay resolves after specified timeout', async () => {
    const start = Date.now();
    await delay(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(50);
  });

  describe('safeJsonFetch', () => {
    afterEach(() => {
      vi.resetAllMocks();
    });

    test('resolves JSON on successful fetch', async () => {
      const mockJson = { a: 1 };
      (global as any).fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(mockJson)
      });

      await expect(safeJsonFetch('/url')).resolves.toEqual(mockJson);
      expect(global.fetch).toHaveBeenCalledWith('/url', undefined);
    });

    test('throws error on non-ok response', async () => {
      (global as any).fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({})
      });

      await expect(safeJsonFetch('/bad')).rejects.toThrow('Fetch error 404: Not Found');
    });
  });
});