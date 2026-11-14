import { get, put } from '@vercel/blob';

export const PATH_LIVE = 'askf/v4/live.json';
export const PATH_STATUS = 'askf/v4/status.json';
export const PATH_PENDING = 'askf/v4/pending.json';
export const PATH_PREVIOUS_LIVE = 'askf/v4/previous-live.json';
export const PATH_SETTINGS = 'askf/v4/settings.json';
export const PATH_AUDIT_PREFIX = 'askf/v4/audit/';

export async function readJSON<T>(path: string): Promise<T | null> {
  const response = await get(path, { access: 'private' });
  if (!response) return null;
  if (response.statusCode !== 200) throw new Error(`Blob read failed: HTTP ${response.statusCode}`);
  return await new Response(response.stream).json() as T;
}

export async function writeJSON<T>(path: string, value: T): Promise<void> {
  await put(path, JSON.stringify(value), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json; charset=utf-8',
    cacheControlMaxAge: 60,
  });
}

export async function writeBytes(
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  await put(path, bytes, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    cacheControlMaxAge: 60,
  });
}
