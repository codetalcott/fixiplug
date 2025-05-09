/** @typedef {import('../types').FixiPlug.PluginContext} PluginContext */

/**
 * Content Modifier Plugin for FixiPlug
 * @param {PluginContext} ctx - The plugin context provided by FixiPlug
 */
export default function contentModifier(ctx) {
  const modifyContent = () => {
    const target = document.getElementById('modified');
    if (target) {
      target.textContent = 'Content Modified!';
      target.style.backgroundColor = '#ffeb3b';
      target.style.color = '#000';
    }
  };

  const resetContent = () => {
    const target = document.getElementById('modified');
    if (target) {
      target.textContent = 'hello world';
      target.style.backgroundColor = '';
      target.style.color = '';
    }
  };

  // Listen for the modifyEvent hook
  ctx.on('modifyEvent', modifyContent);

  // Cleanup logic to reset content when the plugin is disabled
  ctx.registerCleanup(resetContent);

  console.log('Content Modifier plugin initialized');
}
