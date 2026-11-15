import { readJSON, writeJSON } from '../blob-store.js';
import type { UsageLedger } from './cost.js';

/** Aylık AI harcama defteri, özel Blob deposunda. */
export const blobLedger: UsageLedger = {
  read: (month) => readJSON<{ spentUsd: number; calls: number }>(`ai/v1/usage-${month}.json`),
  write: (month, value) => writeJSON(`ai/v1/usage-${month}.json`, value),
};
