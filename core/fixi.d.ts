export interface FxResponse {
  ok: boolean;
  status: number;
  headers: Headers;
  json(): Promise<any>;
  text(): Promise<string>;
}

export interface RequestConfig {
  action: string;
  method: string;
  body?: FormData | BodyInit | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  [key: string]: any;
}

export declare class Fixi {
  constructor(base?: string);
  fetch(cfg: RequestConfig): Promise<FxResponse>;
}
