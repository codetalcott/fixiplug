import { describe, it, expect } from 'vitest';
import { PluginManager, createPlugin } from '../plugin';

describe('API Version Compatibility', () => {
  const manager = new PluginManager({} as any);

  it('rejects plugins with incompatible major API version', () => {
    const bad = createPlugin({
      name: 'bad', version: '1.0.0', apiVersion: '3.0.0',
      beforeRequest: () => ({})
    });
    expect(manager.register(bad)).toBe(false);
  });

  it('accepts plugins with compatible major API version', () => {
    const good = createPlugin({
      name: 'good', version: '1.0.0', apiVersion: '2.5.0',
      beforeRequest: () => ({})
    });
    expect(manager.register(good)).toBe(true);
    expect(manager.get('good')).toBeDefined();
  });
});