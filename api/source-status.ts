import { getAskfMonitorState } from './_lib/askf-state.js';
import { setNoStoreHeaders, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { defaultAskfMonitorSettings } from '../src/ingestion/schedule.js';

const initialStatus = {
  schema: 5,
  state: 'awaiting_first_run',
  lastSuccess: null,
  lastAttempt: null,
  lastError: null,
  schedule: 'Her Salı saat 18:00 (Türkiye saati)',
  pending: false,
};

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  setNoStoreHeaders(res);
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const state = await getAskfMonitorState();
    res.status(200).json({
      ...(state.status ?? initialStatus),
      settings: state.settings ?? defaultAskfMonitorSettings,
      pendingReview: state.pending,
      rollbackAvailable: state.rollbackAvailable,
    });
  } catch {
    console.error('ASKF_STATUS_READ_FAILED');
    res.status(503).json({
      ...initialStatus,
      state: 'not_configured',
      lastError: 'Kaynak kayıtları şu anda okunamıyor.',
      settings: defaultAskfMonitorSettings,
      pendingReview: null,
      rollbackAvailable: false,
    });
  }
}
