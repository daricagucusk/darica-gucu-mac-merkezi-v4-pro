import { ANTHROPIC_BASE_URL, ANTHROPIC_VERSION } from './models.js';
import type { TokenUsage } from './cost.js';

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiRequest {
  model: string;
  /** Sabit sistem talimatı ayrı alandır ve prompt önbelleğine alınır. */
  system: string;
  messages: AiMessage[];
  maxTokens: number;
  /** Doğrulanmamış model davranışı için varsayılan gönderilmez. */
  temperature?: number;
  signal?: AbortSignal;
  /** Aynı anahtar, işlem süresi içinde aynı sonucu döndürür (süreç içi tekilleştirme). */
  idempotencyKey?: string;
}

export interface AiResult {
  text: string;
  stopReason: string;
  truncated: boolean;
  usage: TokenUsage;
  model: string;
  attempts: number;
}

export type AiErrorKind = 'auth' | 'rate_limit' | 'server' | 'timeout' | 'aborted' | 'refusal' | 'bad_request' | 'circuit_open' | 'unexpected';

export class AiError extends Error {
  constructor(public readonly kind: AiErrorKind, message: string, public readonly status?: number) {
    super(message);
    this.name = 'AiError';
  }
}

export interface ClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  breakerThreshold?: number;
  breakerCooldownMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
}

interface BreakerState { failures: number; openedAt: number | null; }

export function createAnthropicClient(options: ClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? ANTHROPIC_BASE_URL;
  const timeoutMs = options.timeoutMs ?? 25_000;
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 8_000;
  const breakerThreshold = options.breakerThreshold ?? 5;
  const breakerCooldownMs = options.breakerCooldownMs ?? 60_000;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const breaker: BreakerState = { failures: 0, openedAt: null };
  const inflight = new Map<string, Promise<AiResult>>();

  const headers = {
    'content-type': 'application/json',
    'x-api-key': options.apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
  };

  function body(request: AiRequest, stream: boolean): string {
    return JSON.stringify({
      model: request.model,
      max_tokens: request.maxTokens,
      // Sabit talimat önbelleğe alınır; ölçüm usage.cache_* alanlarından okunur.
      system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
      messages: request.messages,
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(stream ? { stream: true } : {}),
    });
  }

  function checkBreaker(): void {
    if (breaker.openedAt === null) return;
    if (now() - breaker.openedAt >= breakerCooldownMs) return; // yarı açık: tek deneme
    throw new AiError('circuit_open', 'Claude servisi geçici olarak devre dışı (art arda hata).');
  }
  const onSuccess = () => { breaker.failures = 0; breaker.openedAt = null; };
  const onFailure = () => {
    breaker.failures += 1;
    if (breaker.failures >= breakerThreshold) breaker.openedAt = now();
  };

  function classify(status: number): AiErrorKind {
    if (status === 401 || status === 403) return 'auth';
    if (status === 429) return 'rate_limit';
    if (status >= 500) return 'server';
    return 'bad_request';
  }

  function retryDelay(attempt: number, retryAfterHeader: string | null): number {
    const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter * 1000, maxDelayMs);
    const exponential = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
    return Math.round(exponential * (0.5 + random() * 0.5));
  }

  async function send(request: AiRequest, stream: boolean): Promise<{ response: Response; attempts: number }> {
    checkBreaker();
    let lastError: AiError | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (request.signal?.aborted) throw new AiError('aborted', 'İstek iptal edildi.');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const onAbort = () => controller.abort();
      request.signal?.addEventListener('abort', onAbort, { once: true });
      try {
        const response = await fetchImpl(`${baseUrl}/v1/messages`, {
          method: 'POST',
          headers,
          body: body(request, stream),
          signal: controller.signal,
        });
        if (response.ok) {
          onSuccess();
          return { response, attempts: attempt };
        }
        const kind = classify(response.status);
        lastError = new AiError(kind, `Claude API HTTP ${response.status}`, response.status);
        if (kind === 'auth' || kind === 'bad_request') { onFailure(); throw lastError; }
        onFailure();
        if (attempt < maxAttempts) await sleep(retryDelay(attempt, response.headers.get('retry-after')));
      } catch (error) {
        if (error instanceof AiError) {
          if (error.kind === 'auth' || error.kind === 'bad_request') throw error;
          lastError = error;
        } else if (request.signal?.aborted) {
          throw new AiError('aborted', 'İstek iptal edildi.');
        } else {
          onFailure();
          lastError = new AiError(controller.signal.aborted ? 'timeout' : 'server', controller.signal.aborted ? 'Claude isteği zaman aşımına uğradı.' : 'Claude bağlantı hatası.');
          if (attempt < maxAttempts) await sleep(retryDelay(attempt, null));
        }
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener('abort', onAbort);
      }
    }
    throw lastError ?? new AiError('unexpected', 'Claude isteği tamamlanamadı.');
  }

  interface MessageBody {
    content?: Array<{ type: string; text?: string }>;
    stop_reason?: string;
    usage?: TokenUsage;
    model?: string;
  }

  function toResult(data: MessageBody, request: AiRequest, attempts: number): AiResult {
    const stopReason = data.stop_reason ?? 'unknown';
    if (stopReason === 'refusal') throw new AiError('refusal', 'Claude isteği yanıtlamayı reddetti.');
    if (stopReason === 'tool_use') throw new AiError('unexpected', 'Beklenmeyen araç çağrısı (bu katman araç tanımlamaz).');
    const text = (data.content ?? []).filter((block) => block.type === 'text').map((block) => block.text ?? '').join('');
    return {
      text,
      stopReason,
      truncated: stopReason === 'max_tokens',
      usage: data.usage ?? { input_tokens: 0, output_tokens: 0 },
      model: data.model ?? request.model,
      attempts,
    };
  }

  async function complete(request: AiRequest): Promise<AiResult> {
    const key = request.idempotencyKey;
    if (key && inflight.has(key)) return inflight.get(key)!;
    const run = (async () => {
      const { response, attempts } = await send(request, false);
      return toResult((await response.json()) as MessageBody, request, attempts);
    })();
    if (key) {
      inflight.set(key, run);
      // Başarılı sonuç kısa süre saklanır; hatalı sonuç hemen bırakılır.
      void run.then(() => setTimeout(() => inflight.delete(key), 30_000).unref?.(), () => inflight.delete(key));
    }
    return run;
  }

  /** SSE akışı: metin parçalarını sırayla üretir, bitişte AiResult döner. */
  async function* stream(request: AiRequest): AsyncGenerator<string, AiResult, void> {
    const { response, attempts } = await send(request, true);
    if (!response.body) throw new AiError('unexpected', 'Akış gövdesi yok.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let stopReason = 'unknown';
    let model = request.model;
    const usage: TokenUsage = { input_tokens: 0, output_tokens: 0 };
    try {
      for (;;) {
        if (request.signal?.aborted) throw new AiError('aborted', 'İstek iptal edildi.');
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');
          const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data:'));
          if (!dataLine) continue;
          let event: Record<string, any>;
          try { event = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
          if (event.type === 'message_start') {
            model = event.message?.model ?? model;
            Object.assign(usage, event.message?.usage ?? {});
          } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            text += event.delta.text;
            yield event.delta.text as string;
          } else if (event.type === 'message_delta') {
            stopReason = event.delta?.stop_reason ?? stopReason;
            if (event.usage?.output_tokens !== undefined) usage.output_tokens = event.usage.output_tokens;
          } else if (event.type === 'error') {
            throw new AiError('server', 'Claude akış hatası.');
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    if (stopReason === 'refusal') throw new AiError('refusal', 'Claude isteği yanıtlamayı reddetti.');
    return { text, stopReason, truncated: stopReason === 'max_tokens', usage, model, attempts };
  }

  return { complete, stream, breakerState: () => ({ ...breaker }) };
}

export type AnthropicClient = ReturnType<typeof createAnthropicClient>;
