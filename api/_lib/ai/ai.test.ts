import { describe, expect, it, vi } from 'vitest';
import { AiError, createAnthropicClient } from './client';
import { createBudgetGuard, estimateCostUsd, monthKey, type UsageLedger } from './cost';
import { MODEL_REGISTRY } from './models';
import { PrivacyGateError, assertAiSafeText, toSafeMatchFacts } from './privacy';
import { buildFactsPayload, createAiService, resolveAiConfig } from './service';

const okBody = (overrides: Record<string, unknown> = {}) => ({
  content: [{ type: 'text', text: 'Özet hazır.' }],
  stop_reason: 'end_turn',
  model: 'claude-sonnet-5-5',
  usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 800 },
  ...overrides,
});
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const req = { model: 'claude-sonnet-5-5', system: 'sistem', messages: [{ role: 'user' as const, content: 'merhaba' }], maxTokens: 100 };
const fast = { sleep: async () => {}, random: () => 0.5 };

describe('model kaydı', () => {
  it('yalnızca resmi dokümandan doğrulanmış üç kimliği içerir', () => {
    expect(Object.values(MODEL_REGISTRY).map((m) => m.id).sort()).toEqual(['claude-haiku-5-5', 'claude-opus-5-5', 'claude-sonnet-5-5']);
  });
});

describe('Anthropic istemcisi', () => {
  it('sistem talimatını ayrı alan olarak ve önbellek işaretiyle gönderir; anahtar yalnızca başlıkta', async () => {
    const fetchImpl = vi.fn(async () => json(200, okBody()));
    const client = createAnthropicClient({ apiKey: 'sk-test-anahtar-123456789', fetchImpl, ...fast });
    const result = await client.complete(req);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-test-anahtar-123456789');
    expect(sent.system[0]).toMatchObject({ type: 'text', text: 'sistem', cache_control: { type: 'ephemeral' } });
    expect(JSON.stringify(sent)).not.toContain('sk-test-anahtar');
    expect(sent).not.toHaveProperty('temperature');
    expect(result).toMatchObject({ text: 'Özet hazır.', truncated: false, attempts: 1 });
  });

  it('429 ve 5xx için yeniden dener, 401 için denemez', async () => {
    const seq = [json(429, {}, { 'retry-after': '0' }), json(503, {}), json(200, okBody())];
    const fetchImpl = vi.fn(async () => seq.shift()!);
    const client = createAnthropicClient({ apiKey: 'k'.repeat(24), fetchImpl, ...fast });
    expect((await client.complete(req)).attempts).toBe(3);

    const auth = vi.fn(async () => json(401, {}));
    const failing = createAnthropicClient({ apiKey: 'k'.repeat(24), fetchImpl: auth, ...fast });
    await expect(failing.complete(req)).rejects.toMatchObject({ kind: 'auth' });
    expect(auth).toHaveBeenCalledTimes(1);
  });

  it('art arda hatalarda devre kesici açılır ve ağ çağrısını durdurur', async () => {
    let clock = 0;
    const fetchImpl = vi.fn(async () => json(500, {}));
    const client = createAnthropicClient({ apiKey: 'k'.repeat(24), fetchImpl, maxAttempts: 1, breakerThreshold: 2, breakerCooldownMs: 1000, now: () => clock, ...fast });
    await expect(client.complete(req)).rejects.toBeInstanceOf(AiError);
    await expect(client.complete(req)).rejects.toBeInstanceOf(AiError);
    const callsBefore = fetchImpl.mock.calls.length;
    await expect(client.complete(req)).rejects.toMatchObject({ kind: 'circuit_open' });
    expect(fetchImpl.mock.calls.length).toBe(callsBefore);
    clock = 2000; // soğuma bitti: tek deneme serbest
    fetchImpl.mockImplementationOnce(async () => json(200, okBody()));
    await expect(client.complete(req)).resolves.toMatchObject({ text: 'Özet hazır.' });
  });

  it('max_tokens kesilmesini işaretler, reddi ve araç çağrısını hata sayar', async () => {
    const truncated = createAnthropicClient({ apiKey: 'k'.repeat(24), fetchImpl: async () => json(200, okBody({ stop_reason: 'max_tokens' })), ...fast });
    expect((await truncated.complete(req)).truncated).toBe(true);
    const refusal = createAnthropicClient({ apiKey: 'k'.repeat(24), fetchImpl: async () => json(200, okBody({ stop_reason: 'refusal' })), ...fast });
    await expect(refusal.complete(req)).rejects.toMatchObject({ kind: 'refusal' });
    const tool = createAnthropicClient({ apiKey: 'k'.repeat(24), fetchImpl: async () => json(200, okBody({ stop_reason: 'tool_use' })), ...fast });
    await expect(tool.complete(req)).rejects.toMatchObject({ kind: 'unexpected' });
  });

  it('önceden iptal edilmiş istek ağa çıkmaz', async () => {
    const fetchImpl = vi.fn(async () => json(200, okBody()));
    const controller = new AbortController();
    controller.abort();
    const client = createAnthropicClient({ apiKey: 'k'.repeat(24), fetchImpl, ...fast });
    await expect(client.complete({ ...req, signal: controller.signal })).rejects.toMatchObject({ kind: 'aborted' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('aynı idempotency anahtarı tek ağ çağrısı yapar', async () => {
    const fetchImpl = vi.fn(async () => json(200, okBody()));
    const client = createAnthropicClient({ apiKey: 'k'.repeat(24), fetchImpl, ...fast });
    const [a, b] = await Promise.all([client.complete({ ...req, idempotencyKey: 'x' }), client.complete({ ...req, idempotencyKey: 'x' })]);
    expect(a).toBe(b);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('SSE akışını parçalara ayırır ve bitişte kullanım bilgisini döner', async () => {
    const events = [
      { type: 'message_start', message: { model: 'claude-sonnet-5-5', usage: { input_tokens: 50, output_tokens: 1 } } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Mer' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'haba' } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 7 } },
    ];
    const sse = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
    const client = createAnthropicClient({ apiKey: 'k'.repeat(24), fetchImpl: async () => new Response(sse, { status: 200 }), ...fast });
    const chunks: string[] = [];
    const iterator = client.stream(req);
    let step = await iterator.next();
    while (!step.done) { chunks.push(step.value); step = await iterator.next(); }
    expect(chunks.join('')).toBe('Merhaba');
    expect(step.value).toMatchObject({ text: 'Merhaba', stopReason: 'end_turn', usage: { input_tokens: 50, output_tokens: 7 } });
  });
});

describe('maliyet ve bütçe', () => {
  it('maliyeti kayıttaki fiyatlarla hesaplar', () => {
    const cost = estimateCostUsd(MODEL_REGISTRY.deep, { input_tokens: 1_000_000, output_tokens: 1_000_000 });
    expect(cost).toBe(24);
  });

  it('aylık tavan dolunca harcamaya izin vermez, ay değişince sıfırlanır', async () => {
    const store = new Map<string, { spentUsd: number; calls: number }>();
    const ledger: UsageLedger = { read: async (k) => store.get(k) ?? null, write: async (k, v) => { store.set(k, v); } };
    const guard = createBudgetGuard(ledger, 1);
    const day = new Date('2026-11-15T10:00:00Z');
    expect((await guard.canSpend(day)).allowed).toBe(true);
    await guard.record(1.2, day);
    expect((await guard.canSpend(day)).allowed).toBe(false);
    expect((await guard.canSpend(new Date('2026-12-02T10:00:00Z'))).allowed).toBe(true);
    expect(monthKey(day)).toBe('2026-11');
  });
});

describe('gizlilik kapısı', () => {
  it.each([
    ['TC kimlik', 'Ali 12345678901 numaralı'],
    ['IBAN', 'TR33 0006 1005 1978 6457 8413 26'],
    ['telefon', 'Ara: 0532 123 45 67'],
    ['e-posta', 'veli@ornek.com'],
    ['anahtar', 'Bearer abcdefghijklmnopqrstuvwxyz123456'],
    ['hassas kelime', 'sporcu sakatlık raporu'],
  ])('%s içeren metni engeller', (_name, text) => {
    expect(() => assertAiSafeText(text)).toThrow(PrivacyGateError);
  });

  it('takım, tarih ve sayaç içeren güvenli metni geçirir', () => {
    expect(() => assertAiSafeText('Darıca Gücü U15 - Gebze Spor, 2026-11-22 14:00, hafta 11')).not.toThrow();
  });

  it('bilinmeyen alanları atar ve metni kırpar', () => {
    const facts = toSafeMatchFacts({ home: 'A', away: 'B', phone: '0532 111 22 33', note: 'x' });
    expect(facts).not.toHaveProperty('phone');
    expect(facts).not.toHaveProperty('note');
  });

  it('modele giden yük yalnızca izinli alanları taşır', () => {
    const payload = buildFactsPayload({
      sourceWeek: 11, season: '2026-2027', fixtureCount: 30, hashPrefix: 'a'.repeat(64),
      changes: [{ fixtureId: 'f1', type: 'kickoff_changed', current: { id: 'f1', home: 'A', away: 'B', group: 'U15', date: '2026-11-22', time: '14:00', venue: 'Saha', secret: 'gizli' } as never }],
    });
    expect(payload).not.toContain('gizli');
    expect(JSON.parse(payload).hashPrefix).toHaveLength(12);
  });
});

describe('AI servisi', () => {
  const ledger = (): UsageLedger => { const m = new Map<string, { spentUsd: number; calls: number }>(); return { read: async (k) => m.get(k) ?? null, write: async (k, v) => { m.set(k, v); } }; };

  it('anahtar veya özellik anahtarı yoksa anlaşılır şekilde devre dışı kalır', () => {
    expect(resolveAiConfig({})).toMatchObject({ enabled: false });
    expect(resolveAiConfig({ AI_ENABLED: 'true' })).toMatchObject({ enabled: false, reason: expect.stringContaining('ANTHROPIC_API_KEY') });
    expect(resolveAiConfig({ AI_ENABLED: 'true', ANTHROPIC_API_KEY: 'x'.repeat(30), AI_MONTHLY_BUDGET_USD: '3' })).toMatchObject({ enabled: true, capUsd: 3 });
  });

  it('başarılı çağrıda maliyeti kaydeder ve ana akışa hata fırlatmaz', async () => {
    const client = createAnthropicClient({ apiKey: 'k'.repeat(24), fetchImpl: async () => json(200, okBody()), ...fast });
    const service = createAiService({ client, budget: createBudgetGuard(ledger(), 5) });
    const outcome = await service.pendingSummary({ sourceWeek: 11, season: '2026-2027', fixtureCount: 30 });
    expect(outcome).toMatchObject({ status: 'ok', text: 'Özet hazır.', approximate: true, cacheReadTokens: 800 });
  });

  it('Claude hatasında fırlatmaz, "unavailable" döner', async () => {
    const client = createAnthropicClient({ apiKey: 'k'.repeat(24), fetchImpl: async () => json(500, {}), maxAttempts: 1, ...fast });
    const service = createAiService({ client, budget: createBudgetGuard(ledger(), 5) });
    await expect(service.sourceFailure({ failureReason: 'indirme zaman aşımı' })).resolves.toMatchObject({ status: 'unavailable' });
  });

  it('tavan dolmuşsa ağ çağrısı yapmaz', async () => {
    const fetchImpl = vi.fn(async () => json(200, okBody()));
    const l = ledger();
    const guard = createBudgetGuard(l, 1);
    await guard.record(2, new Date());
    const service = createAiService({ client: createAnthropicClient({ apiKey: 'k'.repeat(24), fetchImpl, ...fast }), budget: guard });
    expect(await service.pendingSummary({ sourceWeek: 1 })).toMatchObject({ status: 'disabled' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('kişisel veri içeren yükü modele göndermez', async () => {
    const fetchImpl = vi.fn(async () => json(200, okBody()));
    const service = createAiService({ client: createAnthropicClient({ apiKey: 'k'.repeat(24), fetchImpl, ...fast }), budget: createBudgetGuard(ledger(), 5) });
    const outcome = await service.sourceFailure({ failureReason: 'Hata: veli@ornek.com adresine gönderilemedi' });
    expect(outcome).toMatchObject({ status: 'unavailable' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
