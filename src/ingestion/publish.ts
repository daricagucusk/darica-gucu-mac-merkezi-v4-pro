import { diffFixtures, type FixtureChange } from '../domain/changes.js';
import { evaluateSnapshot, type SnapshotDecision } from '../domain/snapshot.js';
import type { ParsedAskfFixture, ParsedAskfSchedule } from './parse-askf.js';

export interface PreviousPublishedSnapshot {
  sourceFile: string;
  sourceWeek: number;
  sourceSeason: string;
  sourceHash: string;
  checkedAt?: string;
  matches: ParsedAskfFixture[];
}

export interface PublishedSnapshot extends ParsedAskfSchedule {
  source: 'Kocaeli ASKF';
  provenance: 'official_site_download';
  sourceHash: string;
  checkedAt: string;
  parserVersion: string;
  sourceBlobPath: string;
  snapshotBlobPath: string;
  changes: FixtureChange[];
}

export interface SnapshotStorage {
  writeSource(path: string, bytes: Uint8Array): Promise<void>;
  writeSnapshot(path: string, snapshot: PublishedSnapshot): Promise<void>;
  writeLive(snapshot: PublishedSnapshot): Promise<void>;
}

export type PublicationResult =
  | { status: 'rejected'; decision: SnapshotDecision }
  | { status: 'published'; snapshot: PublishedSnapshot };

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export async function publishVerifiedSnapshot(input: {
  previous: PreviousPublishedSnapshot | null;
  schedule: ParsedAskfSchedule;
  sourceHash: string;
  checkedAt: string;
  parserVersion: string;
  rawBytes: Uint8Array;
  storage: SnapshotStorage;
}): Promise<PublicationResult> {
  const {
    previous,
    schedule,
    sourceHash,
    checkedAt,
    parserVersion,
    rawBytes,
    storage,
  } = input;

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
  const changes = sameSeason && previous
    ? diffFixtures(previous.matches, schedule.matches)
    : [];

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

  // The live pointer is the commit point. Failures before this preserve the old live snapshot.
  await storage.writeSource(sourceBlobPath, rawBytes);
  await storage.writeSnapshot(snapshotBlobPath, snapshot);
  await storage.writeLive(snapshot);

  return { status: 'published', snapshot };
}
