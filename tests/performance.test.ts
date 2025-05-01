import { vi } from 'vitest';
import { PluginManager, PluginHook } from '../plugin';

describe('Plugin Performance', () => {
  it('measures average execution time for empty plugin set', async () => {
    // Minimal Fixi stub
    const fixi = { configure: () => ({ config: { logger: console } }), fetch: vi.fn() };
    const manager = new PluginManager(fixi);

    const reps = 500;
    const start = performance.now();
    for (let i = 0; i < reps; i++) {
      // Execute hook with no plugins registered
      await manager.execute(PluginHook.BEFORE_REQUEST, { fixi, config: { url: '/', method: 'GET' } });
    }
    const duration = performance.now() - start;
    const avg = duration / reps;

    console.info(`Executed ${reps} empty hooks in ${duration.toFixed(2)}ms (avg ${avg.toFixed(2)}ms)`);
    // Sanity check: avg should be positive
    expect(avg).toBeGreaterThan(0);
  });
});