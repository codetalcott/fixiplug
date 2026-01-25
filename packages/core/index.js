// @fixiplug/core - Minimal plugin framework
// Zero dependencies, ~30KB unminified

export { createFixiplug, FEATURES } from './fixiplug-factory.js';
export { Fixi } from './fixi-core.js';
export {
  on, off, dispatch,
  registerPlugin, unregisterPlugin,
  enablePlugin, disablePlugin,
  registerSkill, unregisterSkill, getSkill, getAllSkills,
  PRIORITY
} from './hooks.js';
