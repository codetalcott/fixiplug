/** @typedef {import('../types').FixiPlug.PluginContext} PluginContext */

/**
 * Offline plugin for FixiPlug.
 * Enables saving form or text editor inputs when offline and retrying when online.
 * @param {PluginContext} ctx - The plugin context provided by Fixiplug.
 */
export default function offlinePlug(ctx) {
  // @ts-ignore - OfflineDatabase class is defined elsewhere or loaded dynamically
  const db = new OfflineDatabase('fixiplugOfflineDB', 'offlineQueue');

  async function retryQueue() {
    const offlineQueue = await db.getAll();
    for (const entry of offlineQueue) {
      try {
        console.log('Retrying offline entry:', entry);
        await ctx.dispatch('submitOfflineData', entry.data);
        await db.delete(entry.id);
      } catch (e) {
        console.warn('Failed to retry offline entry:', e);
        break;
      }
    }
  }

  function handleFormSubmit(event) {
    if (!navigator.onLine) {
      event.preventDefault();
      const formData = new FormData(event.target);
      const data = Object.fromEntries(formData.entries());
      db.add({ type: 'form', data });
    }
  }

  function handleTextInput(event) {
    if (!navigator.onLine) {
      const data = {
        type: 'text',
        id: event.target.id,
        value: event.target.value,
      };
      db.add(data);
    }
  }

  function attachListeners() {
    document.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', handleFormSubmit);
    });
    document.querySelectorAll('textarea, input[type="text"]').forEach(input => {
      input.addEventListener('input', handleTextInput);
    });
  }

  function detachListeners() {
    document.querySelectorAll('form').forEach(form => {
      form.removeEventListener('submit', handleFormSubmit);
    });
    document.querySelectorAll('textarea, input[type="text"]').forEach(input => {
      input.removeEventListener('input', handleTextInput);
    });
  }

  window.addEventListener('online', retryQueue);
  window.addEventListener('offline', () => {
    console.log('You are offline. Data will be saved locally.');
  });

  ctx.on('init', () => {
    console.log('Offline plugin initialized');
    attachListeners();
  });

  ctx.registerCleanup(() => {
    detachListeners();
    window.removeEventListener('online', retryQueue);
    window.removeEventListener('offline', () => {});
  });
}