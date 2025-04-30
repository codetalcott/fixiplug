declare module 'fixi' {
  /** Default exported Fixi class placeholder */
  const Fixi: any;
  export default Fixi;

  /** HTTP method types */
  export type HttpMethod = string;

  /** Configuration for requests */
  export interface RequestConfig {
    [key: string]: any;
  }

  /** Response object placeholder */
  export interface FxResponse {
    [key: string]: any;
  }

  /** Swap methods placeholder */
  export type SwapMethod = any;

  /** HTTP error class placeholder */
  export class HttpError extends Error {
    constructor(message?: string);
  }

  /** DOM observer placeholder */
  export class DOMObserver {
    constructor(callback: MutationCallback);
    observe(target: Node, options: MutationObserverInit): void;
    disconnect(): void;
  }

  /** Log level enum placeholder */
  export enum LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR,
  }
}
