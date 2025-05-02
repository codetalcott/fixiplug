import { PluginManagerExtension, PluginManager, FixiPlugs } from '..';

/**
 * Extension that provides API version compatibility checking
 */
export class VersionCompatibilityExtension implements PluginManagerExtension {
  private manager!: PluginManager;
  private readonly API_VERSION = '2.0.0';
  
  init(manager: PluginManager): void {
    this.manager = manager;
  }
  
  beforeRegister(plugin: FixiPlugs): boolean | void {
    if (!this.isVersionCompatible(plugin.apiVersion)) {
      this.manager.getLogger()?.error(
        `Plugin "${plugin.name}" v${plugin.version} uses API version ${plugin.apiVersion} which is ` +
        `not compatible with the current API version ${this.API_VERSION}.`
      );
      return false;
    }
  }
  
  /**
   * Check if a plugin version is compatible with the current system version
   * 
   * @param pluginVersion The API version declared by the plugin
   * @returns true if compatible, false otherwise
   */
  private isVersionCompatible(pluginVersion: string): boolean {
    // If no version is specified, default to compatible with older plugins
    if (!pluginVersion) return true;
    
    // Parse versions into components
    const currentParts = this.API_VERSION.split('.').map(Number);
    const pluginParts = pluginVersion.split('.').map(Number);
    
    // If major versions differ, they're incompatible
    if (currentParts[0] !== pluginParts[0]) {
      return false;
    }
    
    // If plugin's minor version is higher than current, it might use features we don't have
    if (pluginParts[1] > currentParts[1]) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get the current API version
   */
  getApiVersion(): string {
    return this.API_VERSION;
  }
  
  /**
   * Check if a specific API version would be compatible
   */
  checkVersionCompatibility(version: string): boolean {
    return this.isVersionCompatible(version);
  }
}