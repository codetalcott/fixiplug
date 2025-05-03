# FixiPlugs: plugin system for Fixi.js HTTP library

FixiPlugs aims to standardize fixi plugins as JavaScript/TypeScript objects that adhere to a single, well‑typed interface.

1. Defines one canonical interface in TypeScript that describes everything a plugin may do:
export interface FixiPlugin {
  name: string;                      // unique ID
  description?: string;
  // optional hooks your core will call
  beforeRequest?(ctx: RequestCtx): RequestConfig | Promise<RequestConfig>;
  afterResponse?(ctx: ResponseCtx): FxResponse | Promise<FxResponse>;
  onError?(ctx: ErrorCtx): void | Promise<void>;
  onDomMutated?(ctx: DomCtx): void;
  // …etc
}
2. No version checks. Your TS compiler (or JSON‑schema validator) guarantees at build time that the plugin object “fits” the interface. If you try to hook into a non‑existent method, you’ll get a compile‑time (or schema) error, not a runtime mismatch.
3. At registration time we do a shape‐check (eg, assert typeof plugin.beforeRequest === 'function') and throw immediately if it’s missing required bits. 
4. If the interface needs updates later, we can add new optional hooks rather than changing or removing existing ones. Existing plugins keep working because every hook is optional.
5. For extra safety, the interface will be published as an NPM package or JSON‐schema (plugin-manifest.schema.json) so plugin authors can import the exact type/shape, and we never have to version it at runtime.
6. A JSON schema -- generated from the canonical TypeScript interface -- allows runtime validation for JSON configurations.

Benefits:
• Zero runtime version logic → faster startup
• Compile‑time or build‑time validation → long‑term reliability
• A single, stable object shape → clear docs and easy adoption
