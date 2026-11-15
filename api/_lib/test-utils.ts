// Yalnız testler için: sahte istek/yanıt ve bellek içi Blob.
import { Writable } from 'node:stream';
import type { ApiRequest, ApiResponse } from './http';

export function fakeReq(opts: { method: string; url: string; headers?: Record<string, string>; json?: unknown; raw?: Uint8Array }): ApiRequest {
  const chunks = opts.raw ? [Buffer.from(opts.raw)] : [];
  const req = {
    method: opts.method,
    url: opts.url,
    headers: { host: 'app.example.com', ...(opts.headers ?? {}) },
    [Symbol.asyncIterator]: async function* () { for (const c of chunks) yield c; },
  } as unknown as ApiRequest;
  if (opts.json !== undefined) (req as unknown as { body: unknown }).body = opts.json;
  return req;
}

export const SAME_ORIGIN = { origin: 'https://app.example.com' };

export interface FakeRes {
  res: ApiResponse;
  headers: Record<string, string>;
  code: () => number;
  text: () => string;
  json: () => unknown;
  done: Promise<void>;
}

export function fakeRes(): FakeRes {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  const parts: Buffer[] = [];
  let resolve!: () => void;
  const done = new Promise<void>((r) => { resolve = r; });
  const w = new Writable({
    write(chunk, _enc, cb) { parts.push(Buffer.from(chunk)); cb(); },
    final(cb) { resolve(); cb(); },
  });
  const res = w as unknown as ApiResponse & Record<string, unknown>;
  res.setHeader = ((k: string, v: string) => { headers[k.toLowerCase()] = String(v); return res; }) as never;
  res.status = ((c: number) => { statusCode = c; return res; }) as never;
  res.json = ((b: unknown) => { parts.push(Buffer.from(JSON.stringify(b))); w.end(); }) as never;
  return {
    res, headers, done,
    code: () => statusCode,
    text: () => Buffer.concat(parts).toString('utf8'),
    json: () => JSON.parse(Buffer.concat(parts).toString('utf8')),
  };
}

export function memoryBlob() {
  const store = new Map<string, { bytes: Uint8Array; contentType: string }>();
  return {
    store,
    put: async (path: string, body: string | Uint8Array, opts: { contentType: string }) => {
      store.set(path, { bytes: typeof body === 'string' ? new TextEncoder().encode(body) : body, contentType: opts.contentType });
      return { pathname: path };
    },
    get: async (path: string) => {
      const e = store.get(path);
      if (!e) return null;
      return {
        statusCode: 200,
        stream: new Response(e.bytes as unknown as BodyInit).body,
        headers: new Headers(),
        blob: { contentType: e.contentType, size: e.bytes.length },
      };
    },
    del: async (path: string | string[]) => { for (const p of [path].flat()) store.delete(p); },
  };
}
