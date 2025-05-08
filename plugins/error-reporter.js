export default function fixiplugErrorReporter(ctx) {
  // 1) In-memory error store
  const errors = [];

  // 2) Handle pluginError events from core dispatch
  ctx.on('pluginError', event => {
    const entry = {
      ts: new Date().toISOString(),
      plugin: event.plugin,
      hookName: event.hookName,
      error: event.error,
      event
    };
    errors.push(entry);
    console.warn(
      `[fixiplug][pluginError]`,
      `plugin=${entry.plugin}`,
      `hook=${entry.hookName}`,
      `at ${entry.ts}`,
      entry.error
    );
    return entry;
  });

  // Register a handler for 'brokenEvent' to simulate an error
  ctx.on('brokenEvent', () => {
    throw new Error('Simulated error from brokenEvent');
  });

  // 3) Wrap dispatch for “brokenEvent” style isolation
  const originalDispatch = fixiplug.dispatch.bind(fixiplug);
  fixiplug.dispatch = async function (hookName, evt) {
    try {
      return await originalDispatch(hookName, evt);
    } catch (err) {
      const entry = {
        ts: new Date().toISOString(),
        plugin: 'dispatch',
        hookName,
        error: err,
        event: evt
      };
      errors.push(entry);
      console.error(
        `[fixiplug][dispatchError]`,
        `hook=${hookName}`,
        `at ${entry.ts}`,
        err
      );
    }
  };

  // 4) Expose an API to retrieve stored errors
  ctx.on('api:getErrors', () => ({ errors }));

  console.log('🛑 fixiplugErrorReporter active – capturing errors');
}