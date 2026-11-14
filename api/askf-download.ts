import { get } from '@vercel/blob';
import { PATH_LIVE, PATH_PENDING, readJSON } from './_lib/blob-store.js';
import { setNoStoreHeaders, type ApiRequest, type ApiResponse } from './_lib/http.js';
import type { PendingAskfReview } from '../src/ingestion/stage-askf.js';
import type { PublishedSnapshot } from '../src/ingestion/publish.js';

function safeDownloadName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'askf-program.xls';
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  setNoStoreHeaders(res);
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const requestUrl = new URL(req.url ?? '/', `https://${req.headers.host ?? 'localhost'}`);
    const hash = requestUrl.searchParams.get('hash') ?? '';
    if (!/^[a-f0-9]{64}$/i.test(hash)) {
      res.status(400).json({ error: 'Program doğrulama kodu geçersiz.' });
      return;
    }

    const [pending, live] = await Promise.all([
      readJSON<PendingAskfReview>(PATH_PENDING),
      readJSON<PublishedSnapshot>(PATH_LIVE),
    ]);
    const snapshot = pending?.snapshot.sourceHash.toLowerCase() === hash.toLowerCase()
      ? pending.snapshot
      : live?.sourceHash.toLowerCase() === hash.toLowerCase()
        ? live
        : null;

    if (!snapshot?.sourceBlobPath) {
      res.status(404).json({ error: 'Bu programa ait arşiv dosyası bulunamadı.' });
      return;
    }

    const blob = await get(snapshot.sourceBlobPath, { access: 'private' });
    if (!blob || blob.statusCode !== 200) {
      res.status(404).json({ error: 'Arşiv dosyası şu anda indirilemiyor.' });
      return;
    }

    const bytes = Buffer.from(await new Response(blob.stream).arrayBuffer());
    const contentType = snapshot.sourceFile.toLowerCase().endsWith('.xlsx')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.ms-excel';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName(snapshot.sourceFile)}"`);
    res.setHeader('Content-Length', String(bytes.byteLength));
    res.statusCode = 200;
    res.end(bytes);
  } catch {
    res.status(503).json({ error: 'ASKF arşiv dosyası indirilemedi.' });
  }
}
