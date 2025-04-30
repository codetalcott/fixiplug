import { createPlugin, FixiPlugs, DomPluginContext } from '../plugin';

export const AccessibilityPlugin = createPlugin<FixiPlugs>({
  name: 'a11y',
  version: '1.0.0',
  apiVersion: '2.0.0',
  priority: 70,
  description: 'Enhances accessibility for dynamic content updates',
  author: 'Fixi Team',

  config: {
    liveRegionId: 'fx-live-region',
    focusSelector: ''
  },

  onInitialize() {
    // Create or reuse ARIA live region
    let region = document.getElementById(this.config.liveRegionId);
    if (!region) {
      region = document.createElement('div');
      region.id = this.config.liveRegionId;
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
    const region = document.getElementById(this.config.liveRegionId)!;
    const msg = `${ctx.mutations.length} update${ctx.mutations.length !== 1 ? 's' : ''} applied`;
    region.textContent = msg;
    if (this.config.focusSelector) {
      const el = document.querySelector(this.config.focusSelector) as HTMLElement;
      if (el) el.focus();
    }
  }
});