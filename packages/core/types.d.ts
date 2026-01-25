// @fixiplug/core TypeScript definitions

export interface PluginContext {
  on(hookName: string, handler: Function, priority?: number): void;
  off(hookName: string, handler: Function): void;
  dispatch(hookName: string, event?: object): Promise<any>;
  registerSkill(skillMetadata: SkillMetadata): void;
}

export interface SkillMetadata {
  name: string;
  description: string;
  instructions?: string;
  tags?: string[];
  version?: string;
}

export interface Plugin {
  name: string;
  setup(context: PluginContext): void | Promise<void>;
  skill?: SkillMetadata;
}

export interface ConfigOptions {
  features?: string[];
  base?: string;
}

export interface Fixiplug {
  use(plugin: Plugin): Promise<void>;
  unuse(pluginName: string): void;
  enable(pluginName: string): void;
  disable(pluginName: string): void;
  dispatch(hookName: string, event?: object): Promise<any>;
  on(hookName: string, handler: Function, priority?: number): void;
  off(hookName: string, handler: Function): void;
  getPluginsInfo(): PluginInfo[];
  getPluginInfo(name: string): PluginInfo | undefined;
  getSkillsByTag(tag: string): SkillMetadata[];
}

export interface PluginInfo {
  name: string;
  disabled: boolean;
  hasSkill: boolean;
  skill?: SkillMetadata;
}

export const PRIORITY: {
  HIGH: 100;
  NORMAL: 0;
  LOW: -100;
};

export const FEATURES: {
  DOM: 'dom';
  LOGGING: 'logging';
  TESTING: 'testing';
  SERVER: 'server';
};

export function createFixiplug(options?: ConfigOptions): Fixiplug;

export class Fixi {
  constructor(base?: string);
  fetch(config: object): Promise<any>;
  use(plugin: Plugin): Promise<void>;
  unuse(pluginName: string): void;
  enable(pluginName: string): void;
  disable(pluginName: string): void;
}

export function on(hookName: string, handler: Function, plugin?: string, priority?: number): void;
export function off(hookName: string, handler: Function): void;
export function dispatch(hookName: string, event?: object): Promise<any>;
export function registerPlugin(plugin: Plugin): void;
export function unregisterPlugin(pluginName: string): void;
export function enablePlugin(pluginName: string): void;
export function disablePlugin(pluginName: string): void;
export function registerSkill(pluginName: string, skillMetadata: SkillMetadata): void;
export function unregisterSkill(pluginName: string): void;
export function getSkill(pluginName: string): SkillMetadata | undefined;
export function getAllSkills(): Map<string, SkillMetadata>;
