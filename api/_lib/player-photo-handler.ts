import { createHash } from 'node:crypto';
import { get } from '@vercel/blob';
import { Readable } from 'node:stream';
import { writeBytes } from './blob-store.js';
import type { ApiRequest, ApiResponse } from './http.js';
import { assertSameOrigin } from './request-security.js';
import { deletePhotoBlob, readRoster, writeRoster } from './players-store.js';
import { isSafePlayerId, MAX_PHOTO_BYTES, photoKeyFor, validatePhoto } from '../../src/players/model.js';

function noStore(res: ApiResponse): void {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

async function readRawBody(req: ApiRequest, limit: number): Promise<Uint8Array | null> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > limit) return null;
    chunks.push(buffer);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

// Yalnız id loglanır; fotoğraf içeriği ve oyuncu adı asla.
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  noStore(res);
  try {
    const id = new URL(req.url ?? '/', 'http://localhost').searchParams.get('id');
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    if (!isSafePlayerId(id)) {
      res.status(400).json({ error: 'Geçersiz oyuncu kimliği.' });
      return;
    }

    if (req.method === 'GET') {
      const player = (await readRoster()).find((p) => p.id === id);
      if (!player?.photoKey) {
        res.status(404).json({ error: 'Fotoğraf yok.' });
        return;
      }
      const blob = await get(player.photoKey, { access: 'private' });
      if (!blob || blob.statusCode !== 200) {
        res.status(404).json({ error: 'Fotoğraf yok.' });
        return;
      }
      res.setHeader('Content-Type', blob.blob.contentType || 'image/jpeg');
      res.status(200);
      Readable.fromWeb(blob.stream as never).pipe(res);
      return;
    }

    try {
      assertSameOrigin(req);
    } catch {
      res.status(403).json({ error: 'İstek aynı kaynaktan gelmiyor.' });
      return;
    }
    const roster = await readRoster();
    const player = roster.find((p) => p.id === id);
    if (!player) {
      res.status(404).json({ error: 'Oyuncu bulunamadı.' });
      return;
    }

    if (req.method === 'DELETE') {
      const old = player.photoKey;
      await writeRoster(roster.map((p) => (p.id === id ? { ...p, photoKey: undefined, updatedAt: new Date().toISOString() } : p)));
      await deletePhotoBlob(old);
      console.info(`player-photo: delete id=${id}`);
      res.status(200).json({ ok: true });
      return;
    }

    const bytes = await readRawBody(req, MAX_PHOTO_BYTES);
    if (!bytes) {
      res.status(413).json({ error: 'Fotoğraf en fazla 1,5 MB olabilir.' });
      return;
    }
    const checked = validatePhoto(String(req.headers['content-type'] ?? ''), bytes);
    if (!checked.ok) {
      res.status(400).json({ error: checked.error });
      return;
    }
    const hash = createHash('sha256').update(bytes).digest('hex');
    const key = photoKeyFor(id, hash);
    await writeBytes(key, bytes, checked.value.contentType);
    const old = player.photoKey;
    await writeRoster(roster.map((p) => (p.id === id ? { ...p, photoKey: key, updatedAt: new Date().toISOString() } : p)));
    if (old && old !== key) await deletePhotoBlob(old);
    console.info(`player-photo: upload id=${id} bytes=${bytes.length}`);
    res.status(200).json({ ok: true, hasPhoto: true });
  } catch {
    res.status(500).json({ error: 'Fotoğraf işlenemedi.' });
  }
}
