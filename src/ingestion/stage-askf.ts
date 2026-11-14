import { diffFixtures } from '../domain/changes.js';
import { evaluateSnapshot } from '../domain/snapshot.js';
import type { ParsedAskfSchedule } from './parse-askf.js';
import type { PreviousPublishedSnapshot, PublishedSnapshot } from './publish.js';

export interface PendingAskfReview {
  state: 'pending_review';
  stagedAt: string;
  snapshot: PublishedSnapshot;
}

export interface AskfStagingStorage {
  writeSource(path: string, bytes: Uint8Array): Promise<void>;
  writeSnapshot(path: string, snapshot: PublishedSnapshot): Promise<void>;
  writePending(pending: PendingAskfReview): Promise<void>;
}

export type StagingResult =
  | { status: 'staged'; pending: PendingAskfReview }
  | { status: 'rejected'; decision: ReturnType<typeof evaluateSnapshot> };

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export async function stageVerifiedSnapshot(input: {
  previous: PreviousPublishedSnapshot | null;
  schedule: ParsedAskfSchedule;
  sourceHash: string;
  checkedAt: string;
  parserVersion: string;
  rawBytes: Uint8Array;
  storage: AskfStagingStorage;
}): Promise<StagingResult> {
  const { previous, schedule, sourceHash, checkedAt, parserVersion, rawBytes, storage } = input;

  const decision = evaluateSnapshot(previous, {
    source: 'Kocaeli ASKF',
    provenance: 'official_site_download',
    sourceFile: schedule.sourceFile,
    sourceWeek: schedule.sourceWeek,
    sourceSeason: schedule.season,
    sourceHash,
    checkedAt,
    parserVersion,
    matches: schedule.matches,
  });

  if (!decision.apply) return { status: 'rejected', decision };

  const sameSeason = previous?.sourceSeason === schedule.season;
  const changes = sameSeason && previous ? diffFixtures(previous.matches, schedule.matches) : [];
  const fileName = safeFileName(schedule.sourceFile);
  const versionKey = `${schedule.season}/${String(schedule.sourceWeek).padStart(3, '0')}-${sourceHash.slice(0, 12)}`;
  const sourceBlobPath = `askf/v4/source/${versionKey}-${fileName}`;
  const snapshotBlobPath = `askf/v4/snapshots/${versionKey}.json`;

  const snapshot: PublishedSnapshot = {
    ...schedule,
    source: 'Kocaeli ASKF',
    provenance: 'official_site_download',
    sourceHash,
    checkedAt,
    parserVersion,
    sourceBlobPath,
    snapshotBlobPath,
    changes,
  };

  await storage.writeSource(sourceBlobPath, rawBytes);
  await storage.writeSnapshot(snapshotBlobPath, snapshot);

  const pending: PendingAskfReview = {
    state: 'pending_review',
    stagedAt: checkedAt,
    snapshot,
  };
  await storage.writePending(pending);
  return { status: 'staged', pending };
}
