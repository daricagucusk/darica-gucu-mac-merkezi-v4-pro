import type { ModelSpec } from './models.js';

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/** Yaklaşık maliyet (USD). Önbellek tokenları giriş fiyatıyla sayılır: üst sınıra yakın tahmin. */
export function estimateCostUsd(spec: ModelSpec, usage: TokenUsage): number {
  const input = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  const cost = (input * spec.inputPerMTok + usage.output_tokens * spec.outputPerMTok) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export interface UsageLedger {
  read(monthKey: string): Promise<{ spentUsd: number; calls: number } | null>;
  write(monthKey: string, value: { spentUsd: number; calls: number }): Promise<void>;
}

export const monthKey = (now: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit' })
    .format(now)
    .slice(0, 7);

export interface BudgetGuard {
  /** Aylık tavan dolduysa false. */
  canSpend(now: Date): Promise<{ allowed: boolean; spentUsd: number; capUsd: number }>;
  record(costUsd: number, now: Date): Promise<void>;
}

export function createBudgetGuard(ledger: UsageLedger, capUsd: number): BudgetGuard {
  return {
    async canSpend(now) {
      const entry = await ledger.read(monthKey(now));
      const spentUsd = entry?.spentUsd ?? 0;
      return { allowed: spentUsd < capUsd, spentUsd, capUsd };
    },
    async record(costUsd, now) {
      const key = monthKey(now);
      const entry = (await ledger.read(key)) ?? { spentUsd: 0, calls: 0 };
      await ledger.write(key, {
        spentUsd: Math.round((entry.spentUsd + costUsd) * 1_000_000) / 1_000_000,
        calls: entry.calls + 1,
      });
    },
  };
}
