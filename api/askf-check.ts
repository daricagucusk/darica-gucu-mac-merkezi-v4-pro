import { runAskfCheck } from './_lib/askf-monitor.js';
import { setNoStoreHeaders, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { assertSameOrigin } from './_lib/request-security.js';

export const config = { maxDuration: 60 };

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  setNoStoreHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    assertSameOrigin(req);
  } catch {
    res.status(403).json({ error: 'Bu işlem yalnızca uygulama içinden başlatılabilir.' });
    return;
  }

  const result = await runAskfCheck('manual');
  const statusCode = result.status === 'failed' ? 503 : result.status === 'rejected' ? 409 : 200;
  res.status(statusCode).json(result);
}
