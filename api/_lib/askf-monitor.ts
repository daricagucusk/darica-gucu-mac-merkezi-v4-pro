import { createHash } from 'node:crypto';
import { downloadLatestAskfFile } from './askf-source.js';
import {
  PATH_AUDIT_PREFIX,
  PATH_LIVE,
  PATH_PENDING,
  PATH_SETTINGS,
  PATH_STATUS,
  readJSON,
  writeBytes,
  writeJSON,
} from './blob-store.js';
import { defaultAskfMonitorSettings, describeAskfSchedule, shouldRunScheduledCheck, type AskfMonitorSettings } from '../../src/ingestion/schedule.js';
import { parseAskfWorkbook } from '../../src/ingestion/parse-askf.js';
import { evaluateRunLock, isManualCheckTooSoon } from '../../src/ingestion/lock.js';
import { stageVerifiedSnapshot, type PendingAskfReview } from '../../src/ingestion/stage-askf.js';
import type { PreviousPublishedSnapshot, PublishedSnapshot } from '../../src/ingestion/publish.js';
import { notifyAskfSourceIssue, notifyPendingAskfReview } from './notification-digest.js';

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
  pending?: boolean;
  pendingHash?: string;
  pendingFile?: string;
  pendingStagedAt?: string;
  lastResult?: string;
}

export type AskfCheckResult =
  | { status: 'staged'; pending: PendingAskfReview }
  | { status: 'unchanged'; sourceFile?: string }
  | { status: 'pending_exists'; pending: PendingAskfReview }
  | { status: 'skipped'; reason: string }
  | { status: 'rejected'; reason: string }
  | { status: 'failed'; reason: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 240) : 'Bilinmeyen kaynak hatası.';
}

async function writeAudit(event: Record<string, unknown>): Promise<void> {
  const key = `${PATH_AUDIT_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  await writeJSON(key, { ...event, recordedAt: new Date().toISOString() });
}

export async function runAskfCheck(trigger: 'cron' | 'manual'): Promise<AskfCheckResult> {
  const attemptedAt = new Date();
  const attemptedIso = attemptedAt.toISOString();
  let previous: PreviousPublishedSnapshot | null = null;
  let liveSnapshot: PublishedSnapshot | null = null;
  let currentStatus: SourceStatus | null = null;

  try {
    const [live, pending, storedSettings, status] = await Promise.all([
      readJSON<PublishedSnapshot>(PATH_LIVE),
      readJSON<PendingAskfReview>(PATH_PENDING),
      readJSON<AskfMonitorSettings>(PATH_SETTINGS),
      readJSON<SourceStatus>(PATH_STATUS),
    ]);
    liveSnapshot = live;
    previous = live ? {
      sourceFile: live.sourceFile,
      sourceWeek: live.sourceWeek,
      sourceSeason: live.season,
      sourceHash: live.sourceHash,
      checkedAt: live.checkedAt,
      matches: live.matches,
    } : null;
    currentStatus = status;

    const settings = storedSettings ?? defaultAskfMonitorSettings;
    if (trigger === 'cron' && !shouldRunScheduledCheck(settings, attemptedAt)) {
      return { status: 'skipped', reason: 'Haftalık kontrol günü değil; bir sonraki Salı 18:00 bekleniyor.' };
    }
    if (pending) return { status: 'pending_exists', pending };
    const lockVerdict = evaluateRunLock(status, attemptedAt);
    if (lockVerdict === 'active') {
      return { status: 'skipped', reason: 'Başka bir ASKF kontrolü devam ediyor.' };
    }
    if (lockVerdict === 'stale') {
      // Önceki çalışma zaman aşımıyla yarıda kalmış; kilit bırakıldı ve izi denetim kaydına yazıldı.
      await writeAudit({ action: 'stale_lock_recovered', trigger, previousAttempt: status?.lastAttempt ?? null });
    }
    if (trigger === 'manual' && isManualCheckTooSoon(status?.lastAttempt, attemptedAt)) {
      return { status: 'skipped', reason: 'Güvenli kullanım için manuel kontrol aralığı 5 dakikadır.' };
    }

    await writeJSON<SourceStatus>(PATH_STATUS, {
      schema: 5,
      state: 'running',
      lastSuccess: status?.lastSuccess ?? liveSnapshot?.checkedAt ?? null,
      lastAttempt: attemptedIso,
      lastError: null,
      schedule: describeAskfSchedule(settings),
      pending: false,
      lastResult: trigger,
    });

    const downloaded = await downloadLatestAskfFile();
    const sourceHash = createHash('sha256').update(downloaded.bytes).digest('hex');

    if (liveSnapshot && liveSnapshot.sourceHash.toLowerCase() === sourceHash.toLowerCase()) {
      await writeJSON<SourceStatus>(PATH_STATUS, {
        schema: 5,
        state: 'verified',
        lastSuccess: attemptedIso,
        lastAttempt: attemptedIso,
        lastError: null,
        schedule: describeAskfSchedule(settings),
        sourceFile: liveSnapshot.sourceFile,
        sourceWeek: liveSnapshot.sourceWeek,
        sourceSeason: liveSnapshot.season,
        sourceHash: liveSnapshot.sourceHash,
        matchesCount: liveSnapshot.matches.length,
        daricaMatchCount: liveSnapshot.daricaMatches.length,
        pending: false,
        lastResult: 'unchanged',
      });
      return { status: 'unchanged', sourceFile: liveSnapshot.sourceFile };
    }

    const schedule = await parseAskfWorkbook(downloaded.bytes, downloaded.fileName);
    const result = await stageVerifiedSnapshot({
      previous,
      schedule,
      sourceHash,
      checkedAt: attemptedIso,
      parserVersion: 'v4.1.0',
      rawBytes: downloaded.bytes,
      storage: {
        writeSource: async (path, bytes) => {
          const contentType = path.toLowerCase().endsWith('.xlsx')
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/vnd.ms-excel';
          await writeBytes(path, bytes, contentType);
        },
        writeSnapshot: async (path, snapshot) => writeJSON(path, snapshot),
        writePending: async (value) => writeJSON(PATH_PENDING, value),
      },
    });

    if (result.status === 'rejected') {
      const reason = result.decision.reason;
      await writeJSON<SourceStatus>(PATH_STATUS, {
        schema: 5,
        state: reason === 'unchanged' ? 'verified' : 'refresh_failed',
        lastSuccess: status?.lastSuccess ?? liveSnapshot?.checkedAt ?? null,
        lastAttempt: attemptedIso,
        lastError: reason === 'unchanged' ? null : `Yeni ASKF dosyası doğrulama kapısından geçemedi: ${reason}`,
        schedule: describeAskfSchedule(settings),
        sourceFile: downloaded.fileName,
        sourceWeek: schedule.sourceWeek,
        sourceSeason: schedule.season,
        sourceHash,
        pending: false,
        lastResult: 'rejected',
      });
      await writeAudit({ action: 'staging_rejected', trigger, reason, sourceFile: downloaded.fileName, sourceHash });
      return reason === 'unchanged'
        ? { status: 'unchanged', sourceFile: downloaded.fileName }
        : { status: 'rejected', reason };
    }

    const staged = result.pending;
    await writeJSON<SourceStatus>(PATH_STATUS, {
      schema: 5,
      state: 'pending_review',
      lastSuccess: attemptedIso,
      lastAttempt: attemptedIso,
      lastError: null,
      schedule: describeAskfSchedule(settings),
      sourceFile: staged.snapshot.sourceFile,
      sourceWeek: staged.snapshot.sourceWeek,
      sourceSeason: staged.snapshot.season,
      sourceHash: staged.snapshot.sourceHash,
      matchesCount: staged.snapshot.matches.length,
      daricaMatchCount: staged.snapshot.daricaMatches.length,
      pending: true,
      pendingHash: staged.snapshot.sourceHash,
      pendingFile: staged.snapshot.sourceFile,
      pendingStagedAt: staged.stagedAt,
      lastResult: 'staged',
    });
    await writeAudit({
      action: 'program_staged',
      trigger,
      sourceFile: staged.snapshot.sourceFile,
      sourceWeek: staged.snapshot.sourceWeek,
      season: staged.snapshot.season,
      sourceHash: staged.snapshot.sourceHash,
      changesCount: staged.snapshot.changes.length,
    });
    try {
      await notifyPendingAskfReview(staged.snapshot);
    } catch {
      console.error('ASKF_PENDING_NOTIFICATION_FAILED');
    }
    return { status: 'staged', pending: staged };
  } catch (error) {
    const reason = errorMessage(error);
    try {
      const settings = await readJSON<AskfMonitorSettings>(PATH_SETTINGS) ?? defaultAskfMonitorSettings;
      await writeJSON<SourceStatus>(PATH_STATUS, {
        schema: 5,
        state: liveSnapshot ? 'refresh_failed' : 'awaiting_first_run',
        lastSuccess: currentStatus?.lastSuccess ?? previous?.checkedAt ?? null,
        lastAttempt: attemptedIso,
        lastError: 'ASKF kaynağı indirilemedi veya doğrulanamadı.',
        schedule: describeAskfSchedule(settings),
        pending: false,
        lastResult: 'failed',
      });
      await writeAudit({ action: 'check_failed', trigger, error: reason });
      if (liveSnapshot) {
        try { await notifyAskfSourceIssue(attemptedAt); } catch { console.error('ASKF_SOURCE_NOTIFICATION_FAILED'); }
      }
    } catch {
      console.error('ASKF_STATUS_WRITE_FAILED');
    }
    console.error('ASKF_CHECK_FAILED', reason);
    return { status: 'failed', reason: 'ASKF kaynağı indirilemedi veya doğrulanamadı.' };
  }
}
