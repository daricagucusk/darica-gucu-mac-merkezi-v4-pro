import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export function useToast(): { toast: ReactNode; show: (message: string) => void } {
  const [message, setMessage] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((next: string) => {
    if (!next) return;
    setMessage(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(''), 2800);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const toast = <div className={message ? 'dg-toast show' : 'dg-toast'} role="status" aria-live="polite">{message}</div>;
  return { toast, show };
}
