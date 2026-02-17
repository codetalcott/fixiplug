/**
 * Skill Versioning Plugin
 * @module plugins/skill-versioning
 *
 * Tracks skill versions and maintains version history for all registered skills.
 * Demonstrates usage of skill:registered, skill:updated, and skill:removed hooks.
 *
 * API Hooks Exposed:
 * - api:getSkillHistory - Get version history for a skill
 * - api:getSkillVersion - Get current version of a skill
 * - api:getAllSkillVersions - Get all skill versions
 *
 * Events Listened To:
 * - skill:registered - Tracks when new skills are added
 * - skill:updated - Tracks when skills are modified
 * - skill:removed - Tracks when skills are deleted
 *
 * @example
 * import skillVersioning from './plugins/skill-versioning.js';
 *
 * const fixiplug = createFixiplug();
 * fixiplug.use(skillVersioning);
 *
 * // Get version history for a skill
 * const history = await fixiplug.dispatch('api:getSkillHistory', {
 *   plugin: 'myPlugin'
 * });
 * // Returns: { history: [{ version, timestamp, skill }, ...] }
 */

export default function skillVersioning(ctx) {
  // Version history storage: Map<pluginName, Array<versionEntry>>
  const versions = new Map();

  // ========================================
  // Lifecycle: Skill Registered
  // ========================================
  ctx.on('skill:registered', (event) => {
    const { plugin, skill, timestamp } = event;

    // Initialize version history for this plugin
    const versionEntry = {
      version: skill.version || '1.0.0',
      timestamp,
      skill: { ...skill },
      action: 'registered'
    };

    versions.set(plugin, [versionEntry]);

    if (ctx.debug) {
      console.log(`[Versioning] Skill registered: ${plugin} v${versionEntry.version}`);
    }

    return event;
  });

  // ========================================
  // Lifecycle: Skill Updated
  // ========================================
  ctx.on('skill:updated', (event) => {
    const { plugin, skill, previous, timestamp } = event;

    // Get existing history or create new
    const history = versions.get(plugin) || [];

    // Add new version entry
    const versionEntry = {
      version: skill.version || previous?.version || '1.0.0',
      timestamp,
      skill: { ...skill },
      previous: previous ? { ...previous } : null,
      action: 'updated',
      changes: detectChanges(previous, skill)
    };

    history.push(versionEntry);
    versions.set(plugin, history);

    if (ctx.debug) {
      const changeCount = Object.keys(versionEntry.changes).length;
      console.log(`[Versioning] Skill updated: ${plugin} v${versionEntry.version} (${changeCount} changes)`);
    }

    return event;
  });

  // ========================================
  // Lifecycle: Skill Removed
  // ========================================
  ctx.on('skill:removed', (event) => {
    const { plugin, skill, timestamp } = event;

    // Get existing history
    const history = versions.get(plugin) || [];

    // Add removal entry
    const versionEntry = {
      version: skill.version || 'unknown',
      timestamp,
      skill: { ...skill },
      action: 'removed'
    };

    history.push(versionEntry);
    versions.set(plugin, history);

    if (ctx.debug) {
      console.log(`[Versioning] Skill removed: ${plugin} v${versionEntry.version}`);
    }

    return event;
  });

  // ========================================
  // Helper: Detect Changes
  // ========================================
  function detectChanges(prev, curr) {
    const changes = {};

    if (!prev) return changes;

    // Check common fields for changes
    const fields = ['version', 'description', 'instructions', 'level', 'author'];

    for (const field of fields) {
      if (prev[field] !== curr[field]) {
        changes[field] = {
          from: prev[field],
          to: curr[field]
        };
      }
    }

    // Check tags
    const prevTags = JSON.stringify(prev.tags || []);
    const currTags = JSON.stringify(curr.tags || []);
    if (prevTags !== currTags) {
      changes.tags = {
        from: prev.tags || [],
        to: curr.tags || []
      };
    }

    // Check references
    const prevRefs = JSON.stringify(prev.references || []);
    const currRefs = JSON.stringify(curr.references || []);
    if (prevRefs !== currRefs) {
      changes.references = {
        from: prev.references || [],
        to: curr.references || []
      };
    }

    return changes;
  }

  // ========================================
  // API: Get Skill History
  // ========================================
  ctx.on('api:getSkillHistory', (event) => {
    const { plugin } = event;

    if (!plugin) {
      return { error: 'plugin parameter required' };
    }

    const history = versions.get(plugin) || [];

    return {
      plugin,
      history,
      count: history.length
    };
  });

  // ========================================
  // API: Get Skill Version
  // ========================================
  ctx.on('api:getSkillVersion', (event) => {
    const { plugin } = event;

    if (!plugin) {
      return { error: 'plugin parameter required' };
    }

    const history = versions.get(plugin);

    if (!history || history.length === 0) {
      return { error: `No version history for plugin: ${plugin}` };
    }

    // Get most recent entry (not removed)
    const current = history
      .slice()
      .reverse()
      .find(entry => entry.action !== 'removed');

    if (!current) {
      return { error: `Skill ${plugin} has been removed` };
    }

    return {
      plugin,
      version: current.version,
      timestamp: current.timestamp,
      action: current.action
    };
  });

  // ========================================
  // API: Get All Skill Versions
  // ========================================
  ctx.on('api:getAllSkillVersions', (event) => {
    const allVersions = [];

    for (const [plugin, history] of versions.entries()) {
      const current = history
        .slice()
        .reverse()
        .find(entry => entry.action !== 'removed');

      // Check if the most recent action was removal
      const latestEntry = history[history.length - 1];
      const isRemoved = latestEntry?.action === 'removed';

      allVersions.push({
        plugin,
        version: current?.version || 'removed',
        status: isRemoved ? 'removed' : 'active',
        historyCount: history.length,
        lastModified: history[history.length - 1]?.timestamp
      });
    }

    return {
      skills: allVersions,
      count: allVersions.length
    };
  });

  // ========================================
  // Cleanup
  // ========================================
  ctx.registerCleanup(() => {
    versions.clear();
  });
}
