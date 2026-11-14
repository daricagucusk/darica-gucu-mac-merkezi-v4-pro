import { PATH_AUDIT_PREFIX, PATH_SETTINGS, PATH_STATUS, readJSON, writeJSON } from './_lib/blob-store.js';
import { setNoStoreHeaders, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { assertSameOrigin, readJsonBody } from './_lib/request-security.js';
import { defaultAskfMonitorSettings, describeAskfSchedule, type AskfMonitorSettings } from '../src/ingestion/schedule.js';
import { getAskfMonitorState } from './_lib/askf-state.js';

interface SourceStatus {
  schema: number;
  state: string;
  lastSuccess: string | null;
  lastAttempt: string | null;
  lastError: string | null;
  schedule: string;
  [key: string]: unknown;
}

function validSettings(value: unknown): value is AskfMonitorSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Partial<AskfMonitorSettings>;
  return (settings.frequency === 'daily' || settings.frequency === 'weekly') &&
    settings.weekday === 2 &&
    settings.hour === 18 &&
    settings.timeZone === 'Europe/Istanbul';
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  setNoStoreHeaders(res);
  if (req.method === 'GET') {
    const state = await getAskfMonitorState();
    res.status(200).json({ settings: state.settings, status: state.status, pending: state.pending });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    assertSameOrigin(req);
    const body = await readJsonBody<{ frequency?: string }>(req);
    if (body.frequency !== 'daily' && body.frequency !== 'weekly') {
      res.status(400).json({ error: 'Kontrol sıklığı geçersiz.' });
      return;
    }
    const settings: AskfMonitorSettings = {
      ...defaultAskfMonitorSettings,
      frequency: body.frequency,
    };
    if (!validSettings(settings)) {
      res.status(400).json({ error: 'Kontrol sıklığı geçersiz.' });
      return;
    }

    await writeJSON(PATH_SETTINGS, settings);
    const current = await readJSON<SourceStatus>(PATH_STATUS);
    await writeJSON<SourceStatus>(PATH_STATUS, {
      schema: 5,
      state: current?.state ?? 'awaiting_first_run',
      lastSuccess: current?.lastSuccess ?? null,
      lastAttempt: current?.lastAttempt ?? null,
      lastError: current?.lastError ?? null,
      ...current,
      schedule: describeAskfSchedule(settings),
    });
    await writeJSON(`${PATH_AUDIT_PREFIX}${Date.now()}-settings.json`, {
      action: 'settings_updated',
      frequency: settings.frequency,
      recordedAt: new Date().toISOString(),
    });
    res.status(200).json({ settings });
  } catch {
    res.status(403).json({ error: 'Ayarlar güvenli biçimde kaydedilemedi.' });
  }
}
