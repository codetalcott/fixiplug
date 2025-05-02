import createPlugin from '../hub';
import { FixiPlugs, DomPluginContext } from '../hub';

export const AccessibilityPlugin = createPlugin({
  name: 'a11y',
  version: '1.0.0',
  
  priority: 70,
  description: 'Enhances accessibility for dynamic content updates',
  author: 'Team Fixi',

  config: {
    liveRegionId: 'fx-live-region',
    focusSelector: ''
  },

  onInitialize(ctx: DomPluginContext) {
    // Create or reuse ARIA live region
    const { config } = ctx;
    let region = document.getElementById(config.liveRegionId);
    if (!region) {
      region = document.createElement('div');
      region.id = config.liveRegionId;
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('role', 'status');
      region.style.position = 'absolute';
      region.style.width = '1px';
      region.style.height = '1px';
      region.style.overflow = 'hidden';
      document.body.appendChild(region);
    }
  },

  onDomMutated(ctx: DomPluginContext) {
    const { config } = ctx;
    const region = document.getElementById(config.liveRegionId)!;
    const msg = `${ctx.mutations.length} update${ctx.mutations.length !== 1 ? 's' : ''} applied`;
    region.textContent = msg;
    if (config.focusSelector) {
      const el = document.querySelector(config.focusSelector) as HTMLElement;
      if (el) el.focus();
    }
  }
});