import { PATH_STATUS, readJSON } from './_lib/blob-store.js';
import { setNoStoreHeaders, type ApiRequest, type ApiResponse } from './_lib/http.js';

interface SourceStatus {
  schema: number;
  state: string;
  lastSuccess: string | null;
  lastAttempt: string | null;
  lastError: string | null;
  schedule: string;
}

const initialStatus: SourceStatus = {
  schema: 4,
  state: 'awaiting_first_run',
  lastSuccess: null,
  lastAttempt: null,
  lastError: null,
  schedule: 'Geçici entegrasyon takvimi: her gün Türkiye saati 18:00',
};

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  setNoStoreHeaders(res);
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const status = await readJSON<SourceStatus>(PATH_STATUS);
    res.status(200).json(status ?? initialStatus);
  } catch {
    console.error('ASKF_STATUS_READ_FAILED');
    res.status(503).json({
      schema: 4,
      state: 'not_configured',
      lastSuccess: null,
      lastAttempt: null,
      lastError: 'Kaynak kayıtları şu anda okunamıyor.',
      schedule: initialStatus.schedule,
    });
  }
}
