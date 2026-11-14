import { timingSafeEqual } from 'node:crypto';
import { runAskfCheck } from './_lib/askf-monitor.js';
import { setNoStoreHeaders, type ApiRequest, type ApiResponse } from './_lib/http.js';

export const config = { maxDuration: 60 };

function isAuthorized(authorization: string | string[] | undefined, secret: string | undefined): boolean {
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!secret || secret.length < 32 || !header?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  setNoStoreHeaders(res);
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!isAuthorized(req.headers.authorization, process.env.CRON_SECRET)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const result = await runAskfCheck('cron');
  const statusCode = result.status === 'failed' ? 503 : result.status === 'rejected' ? 409 : 200;
  res.status(statusCode).json(result);
}
