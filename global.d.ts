/**
 * Global type declarations for FixiPlug
 * Extends Window, Document, and other browser APIs with custom properties
 */

declare global {
  /**
   * Window interface extensions for dynamically loaded libraries
   */
  interface Window {
    /**
     * Idiomorph library loaded from CDN
     * @see https://github.com/bigskysoftware/idiomorph
     */
    Idiomorph?: {
      morph: (
        existingNode: Node,
        newNode: Node | string,
        options?: {
          morphStyle?: 'innerHTML' | 'outerHTML';
          ignoreActiveValue?: boolean;
          morphCallbacks?: {
            beforeNodeAdded?: (node: Node) => boolean;
            afterNodeAdded?: (node: Node) => void;
            beforeNodeMorphed?: (oldNode: Node, newNode: Node) => boolean;
            afterNodeMorphed?: (oldNode: Node, newNode: Node) => void;
            beforeNodeRemoved?: (node: Node) => boolean;
            afterNodeRemoved?: (node: Node) => void;
            beforeAttributeUpdated?: (
              attributeName: string,
              node: Node,
              mutationType: string
            ) => boolean;
          };
        }
      ) => void;
    };

    /**
     * Morphlex library loaded from CDN
     * @see https://github.com/yippee-fun/morphlex
     */
    morphlex?: {
      morph: (
        currentNode: HTMLElement,
        newNode: HTMLElement | string,
        options?: {
          preserveChanges?: boolean;
          beforeNodeAdded?: (node: Node) => boolean;
          afterNodeVisited?: (oldNode: Node, newNode: Node) => void;
          beforeAttributeUpdated?: (
            attributeName: string,
            node: Node,
            mutationType: string
          ) => boolean;
        }
      ) => void;
      morphInner: (
        currentNode: HTMLElement,
        newNode: HTMLElement | string,
        options?: any
      ) => void;
      morphDocument: (doc: Document, newDoc: Document, options?: any) => void;
    };

    /**
     * Global FixiPlug instance
     */
    fixiplug?: any;
  }

  /**
   * Document interface extensions for Fixi functionality
   */
  interface Document {
    /**
     * Internal MutationObserver for Fixi DOM monitoring
     * @internal
     */
    __fixi_mo?: MutationObserver;
  }

  /**
   * OfflineDatabase type for offline plugin
   */
  type OfflineDatabase = {
    open(): Promise<void>;
    save(key: string, value: any): Promise<void>;
    get(key: string): Promise<any>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
  };

  /**
   * Global fixiplug instance (also available as window.fixiplug)
   */
  const fixiplug: any;
}

// This export is required to make this file a module
export {};
