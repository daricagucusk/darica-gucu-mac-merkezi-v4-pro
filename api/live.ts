import { PATH_LIVE, PATH_STATUS, readJSON } from './_lib/blob-store.js';
import { setNoStoreHeaders, type ApiRequest, type ApiResponse } from './_lib/http.js';
import type { PublishedSnapshot } from '../src/ingestion/publish.js';

interface SourceStatus {
  state: string;
  lastSuccess: string | null;
  lastAttempt: string | null;
  lastError: string | null;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  setNoStoreHeaders(res);
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const [snapshot, sourceStatus] = await Promise.all([
      readJSON<PublishedSnapshot>(PATH_LIVE),
      readJSON<SourceStatus>(PATH_STATUS),
    ]);
    if (!snapshot) {
      res.status(200).json({
        schema: 4,
        status: 'not_configured',
        provenance: 'not_verified',
        source: 'Kocaeli ASKF',
        matches: [],
        daricaMatches: [],
        sourceStatus: sourceStatus?.state ?? 'awaiting_first_run',
      });
      return;
    }

    res.status(200).json({
      schema: 4,
      status: 'verified',
      freshness: sourceStatus?.state === 'refresh_failed' ? 'stale' : 'current',
      sourceStatus: sourceStatus?.state ?? 'unknown',
      ...snapshot,
    });
  } catch {
    console.error('ASKF_LIVE_READ_FAILED');
    res.status(503).json({
      schema: 4,
      status: 'unavailable',
      provenance: 'not_verified',
      source: 'Kocaeli ASKF',
      matches: [],
      error: 'Son doğrulanmış program şu anda okunamıyor.',
    });
  }
}
