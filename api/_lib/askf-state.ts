import {
  PATH_LIVE,
  PATH_PENDING,
  PATH_PREVIOUS_LIVE,
  PATH_SETTINGS,
  PATH_STATUS,
  readJSON,
} from './blob-store.js';
import { defaultAskfMonitorSettings, type AskfMonitorSettings } from '../../src/ingestion/schedule.js';
import type { PendingAskfReview } from '../../src/ingestion/stage-askf.js';
import type { PublishedSnapshot } from '../../src/ingestion/publish.js';

interface SourceStatus {
  schema: number;
  state: string;
  lastSuccess: string | null;
  lastAttempt: string | null;
  lastError: string | null;
  schedule: string;
  [key: string]: unknown;
}

export async function getAskfMonitorState(): Promise<{
  settings: AskfMonitorSettings;
  status: SourceStatus | null;
  pending: PendingAskfReview | null;
  rollbackAvailable: boolean;
}> {
  const [settings, status, pending, previousLive, live] = await Promise.all([
    readJSON<AskfMonitorSettings>(PATH_SETTINGS),
    readJSON<SourceStatus>(PATH_STATUS),
    readJSON<PendingAskfReview>(PATH_PENDING),
    readJSON<PublishedSnapshot>(PATH_PREVIOUS_LIVE),
    readJSON<PublishedSnapshot>(PATH_LIVE),
  ]);
  return {
    settings: settings ?? defaultAskfMonitorSettings,
    status,
    pending,
    rollbackAvailable: previousLive !== null && previousLive.sourceHash !== live?.sourceHash,
  };
}
