import { useEffect, useRef, useState } from 'react';

export type AiAssistTask = 'pendingSummary' | 'parserDiscrepancy' | 'sourceFailure';

type AiResponse =
  | { status: 'ok'; text: string; model: string; truncated: boolean; costUsd: number }
  | { status: 'disabled' | 'unavailable'; reason: string };

const LABELS: Record<AiAssistTask, string> = {
  pendingSummary: 'Yapay zekâ özeti ve risk notu',
  parserDiscrepancy: 'Şüpheli eşleşmeleri açıkla',
  sourceFailure: 'Hatanın olası nedenini açıkla',
};

/**
 * Claude yalnızca açıklar ve öneri sunar; onay/ret kararlarını ve doğrulama kapılarını
 * etkilemez. İstek gövdesinde yalnızca görev adı gider; modele giden veri sunucuda kurulur.
 */
export default function AiAssistCard({ task }: { task: AiAssistTask }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AiResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function ask() {
    if (busy) return; // çift gönderim engeli
    setBusy(true);
    setFailed(false);
    controller.current?.abort();
    controller.current = new AbortController();
    try {
      const response = await fetch('/api/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
        signal: controller.current.signal,
      });
      if (response.status === 429) {
        setResult({ status: 'unavailable', reason: 'Çok sık istek. Birkaç saniye sonra tekrar dene.' });
      } else if (!response.ok) {
        throw new Error('ai-assist');
      } else {
        setResult((await response.json()) as AiResponse);
      }
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ai-assist">
      <button className="quiet-button" type="button" onClick={() => void ask()} disabled={busy} aria-busy={busy}>
        {busy ? 'Hazırlanıyor…' : LABELS[task]}
      </button>
      <div role="status" aria-live="polite">
        {failed && <p className="quiet-note">Bağlantı kurulamadı. Program akışı etkilenmedi; tekrar deneyebilirsin.</p>}
        {result?.status === 'ok' && (
          <div className="ai-assist-result">
            <span className="eyebrow">YAPAY ZEKÂ NOTU · ONAY KARARINI DEĞİŞTİRMEZ</span>
            <p>{result.text}</p>
            {result.truncated && <small>Yanıt uzunluk sınırında kesildi.</small>}
          </div>
        )}
        {result && result.status !== 'ok' && <p className="quiet-note">{result.reason}</p>}
      </div>
    </div>
  );
}
