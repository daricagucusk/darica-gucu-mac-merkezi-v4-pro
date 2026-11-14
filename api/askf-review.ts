import {
  PATH_AUDIT_PREFIX,
  PATH_LIVE,
  PATH_PENDING,
  PATH_PREVIOUS_LIVE,
  PATH_STATUS,
  readJSON,
  writeJSON,
} from './_lib/blob-store.js';
import { setNoStoreHeaders, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { assertSameOrigin, readJsonBody } from './_lib/request-security.js';
import type { PendingAskfReview } from '../src/ingestion/stage-askf.js';
import type { PublishedSnapshot } from '../src/ingestion/publish.js';
import { notifyAskfReviewResult } from './_lib/notification-digest.js';

interface ReviewBody {
  action?: 'approve' | 'reject' | 'rollback';
  expectedHash?: string;
}

interface SourceStatus {
  schema: number;
  state: string;
  lastSuccess: string | null;
  lastAttempt: string | null;
  lastError: string | null;
  schedule: string;
  [key: string]: unknown;
}

async function audit(action: string, detail: Record<string, unknown>): Promise<void> {
  await writeJSON(`${PATH_AUDIT_PREFIX}${Date.now()}-${action}.json`, {
    action,
    ...detail,
    recordedAt: new Date().toISOString(),
  });
}

async function updateStatus(
  state: string,
  snapshot: PublishedSnapshot | null,
  pending: boolean,
): Promise<void> {
  const current = await readJSON<SourceStatus>(PATH_STATUS);
  await writeJSON<SourceStatus>(PATH_STATUS, {
    schema: 5,
    state,
    lastSuccess: snapshot?.checkedAt ?? current?.lastSuccess ?? null,
    lastAttempt: current?.lastAttempt ?? null,
    lastError: null,
    schedule: current?.schedule ?? 'Her Salı saat 18:00 (Türkiye saati)',
    sourceFile: snapshot?.sourceFile ?? null,
    sourceWeek: snapshot?.sourceWeek ?? null,
    sourceSeason: snapshot?.season ?? null,
    sourceHash: snapshot?.sourceHash ?? null,
    matchesCount: snapshot?.matches.length ?? 0,
    daricaMatchCount: snapshot?.daricaMatches.length ?? 0,
    pending,
    pendingHash: null,
    pendingFile: null,
    pendingStagedAt: null,
    lastResult: state,
  });
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  setNoStoreHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body: ReviewBody;
  try {
    assertSameOrigin(req);
    body = await readJsonBody<ReviewBody>(req);
  } catch {
    res.status(403).json({ error: 'İstek doğrulanamadı.' });
    return;
  }

  if (!['approve', 'reject', 'rollback'].includes(String(body.action)) ||
      !/^[a-f0-9]{64}$/i.test(body.expectedHash ?? '')) {
    res.status(400).json({ error: 'İşlem veya program doğrulama kodu geçersiz.' });
    return;
  }

  try {
    if (body.action === 'rollback') {
      const [live, previous] = await Promise.all([
        readJSON<PublishedSnapshot>(PATH_LIVE),
        readJSON<PublishedSnapshot>(PATH_PREVIOUS_LIVE),
      ]);
      if (!live || live.sourceHash.toLowerCase() !== body.expectedHash!.toLowerCase()) {
        res.status(409).json({ error: 'Canlı program değişmiş. Ekranı yenileyip tekrar incele.' });
        return;
      }
      if (!previous) {
        res.status(409).json({ error: 'Geri alınabilecek önceki program bulunamadı.' });
        return;
      }
      await audit('rollback_requested', { fromHash: live.sourceHash, toHash: previous.sourceHash });
      await writeJSON(PATH_LIVE, previous);
      await writeJSON(PATH_PREVIOUS_LIVE, live);
      await updateStatus('verified', previous, false);
      await audit('rollback_applied', { sourceHash: previous.sourceHash });
      res.status(200).json({ status: 'rolled_back', sourceHash: previous.sourceHash });
      return;
    }

    const pending = await readJSON<PendingAskfReview>(PATH_PENDING);
    if (!pending) {
      res.status(404).json({ error: 'İncelenecek bekleyen ASKF programı bulunamadı.' });
      return;
    }
    if (pending.snapshot.sourceHash.toLowerCase() !== body.expectedHash!.toLowerCase()) {
      res.status(409).json({ error: 'İncelediğin dosya değişmiş. Yeni programı yeniden incele.' });
      return;
    }

    if (body.action === 'reject') {
      await audit('program_rejected', {
        sourceHash: pending.snapshot.sourceHash,
        sourceFile: pending.snapshot.sourceFile,
      });
      await writeJSON(PATH_PENDING, null);
      const live = await readJSON<PublishedSnapshot>(PATH_LIVE);
      await updateStatus(live ? 'verified' : 'awaiting_first_run', live, false);
      try { await notifyAskfReviewResult('rejected', pending.snapshot); } catch { console.error('ASKF_REJECT_NOTIFICATION_FAILED'); }
      res.status(200).json({ status: 'rejected', liveUnchanged: true });
      return;
    }

    const live = await readJSON<PublishedSnapshot>(PATH_LIVE);
    if (live?.sourceHash.toLowerCase() === pending.snapshot.sourceHash.toLowerCase()) {
      await writeJSON(PATH_PENDING, null);
      await updateStatus('verified', live, false);
      res.status(200).json({ status: 'already_applied', sourceHash: live.sourceHash });
      return;
    }

    await audit('program_approval_requested', {
      sourceHash: pending.snapshot.sourceHash,
      sourceFile: pending.snapshot.sourceFile,
      previousHash: live?.sourceHash ?? null,
    });
    await writeJSON(PATH_PREVIOUS_LIVE, live);
    await writeJSON(PATH_LIVE, pending.snapshot);
    await writeJSON(PATH_PENDING, null);
    await updateStatus('verified', pending.snapshot, false);
    await audit('program_approved', {
      sourceHash: pending.snapshot.sourceHash,
      sourceFile: pending.snapshot.sourceFile,
      previousHash: live?.sourceHash ?? null,
    });
    try { await notifyAskfReviewResult('approved', pending.snapshot); } catch { console.error('ASKF_APPROVE_NOTIFICATION_FAILED'); }
    res.status(200).json({ status: 'approved', sourceHash: pending.snapshot.sourceHash });
  } catch {
    res.status(503).json({ error: 'İşlem sonucu doğrulanamadı. Ekranı yenileyip canlı programın ve bekleyen incelemenin durumunu kontrol et.' });
  }
}
