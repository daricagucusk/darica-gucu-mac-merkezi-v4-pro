import { AiError, createAnthropicClient, type AnthropicClient, type AiResult } from './client.js';
import { createBudgetGuard, estimateCostUsd, type BudgetGuard } from './cost.js';
import { DEFAULT_TIER, MODEL_REGISTRY, ANTHROPIC_BASE_URL, ANTHROPIC_VERSION, type ModelTier } from './models.js';
import { assertAiSafeText, PrivacyGateError, toSafeMatchFacts } from './privacy.js';
import type { FixtureChange } from '../../../src/domain/changes.js';

/**
 * Tüm Claude çağrıları bu servisten geçer; UI ve diğer API dosyaları sağlayıcıya özgü
 * kod görmez. AI hatası ana akışı (program, doğrulama, cron) hiçbir zaman durdurmaz:
 * her görev `{ status: 'disabled' | 'unavailable' | 'ok' }` döner, hiçbir zaman fırlatmaz.
 */
export type AiTask = 'pendingSummary' | 'parserDiscrepancy' | 'notificationCopy' | 'sourceFailure';

export type AiOutcome =
  | { status: 'ok'; text: string; model: string; truncated: boolean; costUsd: number; approximate: true; cacheReadTokens: number; attempts: number }
  | { status: 'disabled'; reason: string }
  | { status: 'unavailable'; reason: string };

const TASK_TIER: Record<AiTask, ModelTier> = {
  pendingSummary: 'balanced',
  parserDiscrepancy: 'balanced',
  notificationCopy: 'fast',
  sourceFailure: 'balanced',
};

const SYSTEM_BASE = [
  'Sen Darıca Gücü SK maç operasyon uygulamasının yardımcı analistisin.',
  'Çıktın Türkçe, kısa, somut ve operatör için bir sonraki adımı içerir.',
  'Yalnızca verilen JSON verisine dayan; veri yoksa bunu açıkça söyle, tahmin uydurma.',
  'Parser ve doğrulama kapılarının yerine geçmezsin: yalnızca açıklar ve öneri sunarsın.',
  'Kişisel veri isteme ve üretme. Eksik maçlar iptal edilmiş sayılmaz; "doğrulama gerekli"dir.',
].join('\n');

const SYSTEM_BY_TASK: Record<AiTask, string> = {
  pendingSummary: `${SYSTEM_BASE}\nGÖREV: Onay bekleyen ASKF programı için en fazla 6 maddelik özet ve bir risk notu yaz (Düşük/Orta/Yüksek + gerekçe).`,
  parserDiscrepancy: `${SYSTEM_BASE}\nGÖREV: Değişiklik listesindeki şüpheli eşleşmeleri ve tutarsızlıkları açıkla; her biri için operatörün kontrol etmesi gereken tek cümlelik adım öner.`,
  notificationCopy: `${SYSTEM_BASE}\nGÖREV: Bildirim ve afiş metni üret: başlık en fazla 60, gövde en fazla 180 karakter, sıcak ama resmi ton, emoji yok.`,
  sourceFailure: `${SYSTEM_BASE}\nGÖREV: Kaynak/indirme hatasının olası kök nedenini ve operatörün sıradaki adımını 4 maddeyi geçmeden yaz.`,
};

export interface AiServiceDeps {
  client: AnthropicClient;
  budget: BudgetGuard;
  now?: () => Date;
}

export interface AiFacts {
  sourceWeek?: number;
  season?: string;
  fixtureCount?: number;
  hashPrefix?: string;
  changes?: FixtureChange[];
  failureReason?: string;
  notificationKind?: string;
}

const MAX_CHANGES = 25;

/** İstemciden gelen metin ASLA modele gitmez; yalnızca sunucuda üretilen, izinli alanlar. */
export function buildFactsPayload(facts: AiFacts): string {
  const changes = (facts.changes ?? []).slice(0, MAX_CHANGES).map((change) => ({
    type: change.type,
    verificationRequired: change.status === 'verification_required',
    previous: change.previous ? toSafeMatchFacts(change.previous as unknown as Record<string, unknown>) : undefined,
    current: change.current ? toSafeMatchFacts(change.current as unknown as Record<string, unknown>) : undefined,
  }));
  return JSON.stringify({
    sourceWeek: facts.sourceWeek,
    season: facts.season,
    fixtureCount: facts.fixtureCount,
    hashPrefix: facts.hashPrefix?.slice(0, 12),
    changeCount: facts.changes?.length ?? 0,
    changes,
    failureReason: facts.failureReason?.slice(0, 240),
    notificationKind: facts.notificationKind,
  });
}

export function createAiService(deps: AiServiceDeps) {
  const now = deps.now ?? (() => new Date());

  async function run(task: AiTask, facts: AiFacts, tierOverride?: ModelTier): Promise<AiOutcome> {
    const tier = tierOverride ?? TASK_TIER[task] ?? DEFAULT_TIER;
    const spec = MODEL_REGISTRY[tier];
    const payload = buildFactsPayload(facts);
    try {
      assertAiSafeText(payload);
    } catch (error) {
      if (error instanceof PrivacyGateError) return { status: 'unavailable', reason: 'Veri gizlilik kapısını geçemedi; AI çağrısı yapılmadı.' };
      throw error;
    }
    const budget = await deps.budget.canSpend(now());
    if (!budget.allowed) return { status: 'disabled', reason: `Aylık AI tavanı doldu ($${budget.capUsd}).` };

    let result: AiResult;
    try {
      result = await deps.client.complete({
        model: spec.id,
        system: SYSTEM_BY_TASK[task],
        messages: [{ role: 'user', content: payload }],
        maxTokens: Math.min(spec.maxOutputTokens, 1200),
        idempotencyKey: `${task}:${payload.length}:${payload.slice(0, 64)}:${payload.slice(-64)}`,
      });
    } catch (error) {
      const kind = error instanceof AiError ? error.kind : 'unexpected';
      return { status: 'unavailable', reason: `Claude şu an yanıt veremiyor (${kind}). Ana akış etkilenmedi.` };
    }
    const costUsd = estimateCostUsd(spec, result.usage);
    try { await deps.budget.record(costUsd, now()); } catch { /* ölçüm hatası ana akışı bozmaz */ }
    return {
      status: 'ok',
      text: result.text.trim(),
      model: result.model,
      truncated: result.truncated,
      costUsd,
      approximate: true,
      cacheReadTokens: result.usage.cache_read_input_tokens ?? 0,
      attempts: result.attempts,
    };
  }

  return {
    pendingSummary: (facts: AiFacts) => run('pendingSummary', facts),
    parserDiscrepancy: (facts: AiFacts) => run('parserDiscrepancy', facts),
    notificationCopy: (facts: AiFacts) => run('notificationCopy', facts),
    sourceFailure: (facts: AiFacts) => run('sourceFailure', facts),
    /** Karmaşık, nadir görevler için derin akıl yürütme sınıfı (daha pahalı/yavaş). */
    deepParserDiscrepancy: (facts: AiFacts) => run('parserDiscrepancy', facts, 'deep'),
  };
}

export type AiService = ReturnType<typeof createAiService>;

export interface AiEnv {
  AI_ENABLED?: string;
  ANTHROPIC_API_KEY?: string;
  AI_MONTHLY_BUDGET_USD?: string;
}

/** Özellik anahtarı kapalıysa veya anahtar yoksa `null` döner (anlaşılır "devre dışı" yanıtı için). */
export function resolveAiConfig(env: AiEnv): { enabled: false; reason: string } | { enabled: true; apiKey: string; capUsd: number } {
  if (env.AI_ENABLED !== 'true') return { enabled: false, reason: 'AI özelliği kapalı (AI_ENABLED=true ayarlanmadı).' };
  if (!env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY.length < 20) return { enabled: false, reason: 'ANTHROPIC_API_KEY tanımlı değil.' };
  const cap = Number(env.AI_MONTHLY_BUDGET_USD ?? '5');
  return { enabled: true, apiKey: env.ANTHROPIC_API_KEY, capUsd: Number.isFinite(cap) && cap > 0 ? cap : 5 };
}

/** Doğrulama: canlı model listesi. Başarısızsa null döner (kayıt belgelenmiş kimliklerle çalışır). */
export async function verifyModelIds(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<Set<string> | null> {
  try {
    const response = await fetchImpl(`${ANTHROPIC_BASE_URL}/v1/models?lifecycle=active`, {
      headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: Array<{ id?: string }> };
    return new Set((body.data ?? []).map((item) => item.id ?? '').filter(Boolean));
  } catch {
    return null;
  }
}

export function createBudget(ledger: Parameters<typeof createBudgetGuard>[0], capUsd: number): BudgetGuard {
  return createBudgetGuard(ledger, capUsd);
}

export { createAnthropicClient };
