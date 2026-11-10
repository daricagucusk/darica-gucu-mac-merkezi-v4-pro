import { createHash, timingSafeEqual } from 'node:crypto';
import { downloadLatestAskfFile } from './_lib/askf-source.js';
import { PATH_LIVE, PATH_STATUS, readJSON, writeBytes, writeJSON } from './_lib/blob-store.js';
import { setNoStoreHeaders, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { parseAskfWorkbook } from '../src/ingestion/parse-askf.js';
import {
  publishVerifiedSnapshot,
  type PreviousPublishedSnapshot,
  type PublishedSnapshot,
  type SnapshotStorage,
} from '../src/ingestion/publish.js';

export const config = { maxDuration: 60 };

interface SourceStatus {
  schema: number;
  state: string;
  lastSuccess: string | null;
  lastAttempt: string | null;
  lastError: string | null;
  schedule: string;
  sourceFile?: string;
  sourceWeek?: number;
  sourceSeason?: string;
  sourceHash?: string;
  matchesCount?: number;
  daricaMatchCount?: number;
}

function isAuthorized(authorization: string | string[] | undefined, secret: string | undefined): boolean {
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!secret || secret.length < 32 || !header?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 240) : 'Bilinmeyen kaynak hatası.';
}

const scheduleDescription = 'Her gün Türkiye saati 16:00 (Vercel Hobby Cron)';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  setNoStoreHeaders(res);
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!isAuthorized(req.headers.authorization, process.env.CRON_SECRET)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const attemptedAt = new Date().toISOString();
  let previous: PreviousPublishedSnapshot | null = null;

  try {
    previous = await readJSON<PreviousPublishedSnapshot>(PATH_LIVE);
    const currentStatus = await readJSON<SourceStatus>(PATH_STATUS);
    await writeJSON<SourceStatus>(PATH_STATUS, {
      schema: 4,
      state: 'running',
      lastSuccess: previous?.checkedAt ?? currentStatus?.lastSuccess ?? null,
      lastAttempt: attemptedAt,
      lastError: null,
      schedule: scheduleDescription,
    });

    const downloaded = await downloadLatestAskfFile();
    const sourceHash = createHash('sha256').update(downloaded.bytes).digest('hex');
    const schedule = await parseAskfWorkbook(downloaded.bytes, downloaded.fileName);

    const storage: SnapshotStorage = {
      writeSource: async (path, bytes) => {
        const contentType = path.toLowerCase().endsWith('.xlsx')
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/vnd.ms-excel';
        await writeBytes(path, bytes, contentType);
      },
      writeSnapshot: async (path, snapshot) => writeJSON(path, snapshot),
      writeLive: async (snapshot) => writeJSON(PATH_LIVE, snapshot),
    };

    const result = await publishVerifiedSnapshot({
      previous,
      schedule,
      sourceHash,
      checkedAt: attemptedAt,
      parserVersion: 'v4.0.0',
      rawBytes: downloaded.bytes,
      storage,
    });

    if (result.status === 'rejected') {
      const state = previous ? 'refresh_failed' : 'awaiting_first_run';
      await writeJSON<SourceStatus>(PATH_STATUS, {
        schema: 4,
        state,
        lastSuccess: previous?.checkedAt ?? null,
        lastAttempt: attemptedAt,
        lastError: `Yeni ASKF dosyası doğrulama kapısından geçemedi: ${result.decision.reason}`,
        schedule: scheduleDescription,
        sourceFile: downloaded.fileName,
        sourceWeek: schedule.sourceWeek,
        sourceSeason: schedule.season,
      });
      res.status(409).json({
        status: state,
        reason: result.decision.reason,
        previousSnapshotPreserved: result.decision.preservePrevious,
      });
      return;
    }

    const snapshot: PublishedSnapshot = result.snapshot;
    try {
      await writeJSON<SourceStatus>(PATH_STATUS, {
        schema: 4,
        state: 'verified',
        lastSuccess: attemptedAt,
        lastAttempt: attemptedAt,
        lastError: null,
        schedule: scheduleDescription,
        sourceFile: snapshot.sourceFile,
        sourceWeek: snapshot.sourceWeek,
        sourceSeason: snapshot.season,
        sourceHash: snapshot.sourceHash,
        matchesCount: snapshot.matches.length,
        daricaMatchCount: snapshot.daricaMatches.length,
      });
    } catch (statusError) {
      // Live snapshot is already committed; a status metadata write must not report the data publish as failed.
      console.error('ASKF_STATUS_FINALIZE_FAILED', errorMessage(statusError));
    }

    console.info('ASKF_REFRESH_VERIFIED', JSON.stringify({
      sourceFile: snapshot.sourceFile,
      sourceWeek: snapshot.sourceWeek,
      sourceSeason: snapshot.season,
      sourceHash: snapshot.sourceHash,
      matchesCount: snapshot.matches.length,
      daricaMatchCount: snapshot.daricaMatches.length,
      changesCount: snapshot.changes.length,
    }));
    res.status(200).json({
      status: 'verified',
      sourceFile: snapshot.sourceFile,
      sourceWeek: snapshot.sourceWeek,
      sourceSeason: snapshot.season,
      sourceHash: snapshot.sourceHash,
      matchesCount: snapshot.matches.length,
      daricaMatchCount: snapshot.daricaMatches.length,
      changesCount: snapshot.changes.length,
    });
  } catch (error) {
    console.error('ASKF_REFRESH_FAILED', errorMessage(error));
    try {
      const currentStatus = await readJSON<SourceStatus>(PATH_STATUS);
      await writeJSON<SourceStatus>(PATH_STATUS, {
        schema: 4,
        state: previous ? 'refresh_failed' : 'awaiting_first_run',
        lastSuccess: previous?.checkedAt ?? currentStatus?.lastSuccess ?? null,
        lastAttempt: attemptedAt,
        lastError: 'ASKF kaynağı indirilemedi veya doğrulanamadı.',
        schedule: scheduleDescription,
      });
    } catch {
      console.error('ASKF_STATUS_WRITE_FAILED');
    }
    res.status(503).json({
      status: previous ? 'refresh_failed' : 'awaiting_first_run',
      previousSnapshotPreserved: previous !== null,
      error: 'ASKF yenilemesi başarısız oldu; önceki doğrulanmış program korunuyor.',
    });
  }
}
