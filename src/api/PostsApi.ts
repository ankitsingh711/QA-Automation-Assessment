import type { APIRequestContext } from '@playwright/test';

/**
 * A request body for POST /posts. `json` bodies are serialised by Playwright; `raw` bodies are
 * sent byte-for-byte so we can exercise malformed JSON and invalid encodings.
 */
export type PostPayload =
  | { kind: 'json'; description: string; body: Record<string, unknown> | unknown[] }
  | { kind: 'raw'; description: string; body: string | Buffer };

export interface ApiResult {
  status: number;
  headers: Record<string, string>;
  text: string;
  json: unknown;
  isJson: boolean;
  elapsedMs: number;
  requestBytes: number;
}

const JSON_CONTENT_TYPE = 'application/json; charset=UTF-8';

export class PostsApi {
  constructor(private readonly request: APIRequestContext) {}

  async create(payload: PostPayload): Promise<ApiResult> {
    const data = payload.kind === 'json' ? JSON.stringify(payload.body) : payload.body;
    const started = performance.now();
    const response = await this.request.post('/posts', {
      data,
      headers: { 'Content-Type': JSON_CONTENT_TYPE },
    });
    const elapsedMs = Math.round(performance.now() - started);
    const text = await response.text();

    let json: unknown = undefined;
    let isJson = false;
    try {
      json = JSON.parse(text);
      isJson = true;
    } catch {
      // Non-JSON bodies are a finding in their own right; the steps assert on isJson.
    }

    return {
      status: response.status(),
      headers: response.headers(),
      text,
      json,
      isJson,
      elapsedMs,
      requestBytes: Buffer.byteLength(data),
    };
  }
}
