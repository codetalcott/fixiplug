// @fixiplug/core/dom - With DOM integration
// Adds MutationObserver, event handling, fx-action elements

import './fixi-dom.js';
export { createFixiplug, FEATURES } from './fixiplug-factory.js';
export { Fixi } from './fixi-core.js';
export {
  on, off, dispatch,
  registerPlugin, unregisterPlugin,
  enablePlugin, disablePlugin,
  registerSkill, unregisterSkill, getSkill, getAllSkills,
  PRIORITY
} from './hooks.js';
