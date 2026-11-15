import { PATH_PENDING, PATH_STATUS, readJSON } from './_lib/blob-store.js';
import { setNoStoreHeaders, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { assertSameOrigin, readJsonBody } from './_lib/request-security.js';
import { blobLedger } from './_lib/ai/ledger-blob.js';
import { createAiService, createAnthropicClient, createBudget, resolveAiConfig, type AiFacts } from './_lib/ai/service.js';
import type { PendingAskfReview } from '../src/ingestion/stage-askf.js';

export const config = { maxDuration: 30 };

type Task = 'pendingSummary' | 'parserDiscrepancy' | 'sourceFailure';
const TASKS: Task[] = ['pendingSummary', 'parserDiscrepancy', 'sourceFailure'];

// Süreç başına basit hız sınırı (maliyet ve kötüye kullanım koruması).
let lastCallAt = 0;
const MIN_INTERVAL_MS = 15_000;

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  setNoStoreHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    assertSameOrigin(req);
    const body = await readJsonBody<{ task?: string }>(req);
    const task = TASKS.find((item) => item === body.task);
    if (!task) {
      res.status(400).json({ error: 'Geçersiz görev.' });
      return;
    }

    const ai = resolveAiConfig(process.env);
    if (!ai.enabled) {
      res.status(200).json({ status: 'disabled', reason: ai.reason });
      return;
    }
    const nowMs = Date.now();
    if (nowMs - lastCallAt < MIN_INTERVAL_MS) {
      res.status(429).json({ status: 'unavailable', reason: 'Çok sık istek. Birkaç saniye sonra tekrar deneyin.' });
      return;
    }
    lastCallAt = nowMs;

    // Modele giden veri YALNIZCA sunucuda, depodan okunan doğrulanmış alanlardan kurulur.
    const [pending, status] = await Promise.all([
      readJSON<PendingAskfReview>(PATH_PENDING),
      readJSON<{ lastError?: string | null }>(PATH_STATUS),
    ]);
    const facts: AiFacts = pending
      ? {
          sourceWeek: pending.snapshot.sourceWeek,
          season: pending.snapshot.season,
          fixtureCount: pending.snapshot.matches.length,
          hashPrefix: pending.snapshot.sourceHash,
          changes: pending.snapshot.changes,
        }
      : { failureReason: status?.lastError ?? undefined };
    if (task !== 'sourceFailure' && !pending) {
      res.status(200).json({ status: 'unavailable', reason: 'Onay bekleyen program yok.' });
      return;
    }

    const service = createAiService({
      client: createAnthropicClient({ apiKey: ai.apiKey }),
      budget: createBudget(blobLedger, ai.capUsd),
    });
    const outcome = await service[task](facts);
    res.status(200).json(outcome);
  } catch {
    // AI uç noktası ana akışı etkilemez; ayrıntı sızdırmadan anlaşılır yanıt.
    res.status(200).json({ status: 'unavailable', reason: 'AI isteği tamamlanamadı. Ana akış etkilenmedi.' });
  }
}
