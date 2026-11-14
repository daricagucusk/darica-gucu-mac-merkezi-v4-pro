import type { ApiRequest } from './http';

export function assertSameOrigin(req: ApiRequest): void {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (typeof origin !== 'string' || typeof host !== 'string' || !host.trim()) {
    throw new Error('Origin doğrulaması başarısız.');
  }

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error('Origin adresi geçersiz.');
  }

  const forwardedHost = req.headers['x-forwarded-host'];
  const expectedHost = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : typeof forwardedHost === 'string'
      ? forwardedHost
      : host;

  if (parsed.host.toLowerCase() !== expectedHost.toLowerCase()) {
    throw new Error('İstek aynı kaynaktan gelmiyor.');
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error('Güvenli bağlantı gerekli.');
  }
}

export async function readJsonBody<T>(req: ApiRequest): Promise<T> {
  const existingBody = (req as ApiRequest & { body?: unknown }).body;
  if (existingBody && typeof existingBody === 'object') return existingBody as T;

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > 8 * 1024) throw new Error('İstek gövdesi çok büyük.');
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) throw new Error('İstek gövdesi boş.');
  return JSON.parse(raw) as T;
}
