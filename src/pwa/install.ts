/** iOS Safari "Ana ekrana ekle" yönlendirmesi yalnızca tarayıcı sekmesinde gösterilir. */
export function shouldShowIosInstallHint(userAgent: string, standalone: boolean): boolean {
  if (standalone) return false;
  const isIos = /iPad|iPhone|iPod/.test(userAgent);
  if (!isIos) return false;
  // iOS'ta yalnızca Safari ana ekrana ekleyebilir; Chrome/Firefox/Edge iOS sürümleri (CriOS/FxiOS/EdgiOS) ekleyemez.
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent);
  return !isOtherBrowser && /Safari/.test(userAgent);
}

export const INSTALL_HINT_KEY = 'dg-install-hint-dismissed';

export function readDismissed(): boolean {
  try { return window.localStorage.getItem(INSTALL_HINT_KEY) === '1'; } catch { return false; }
}

export function writeDismissed(): void {
  try { window.localStorage.setItem(INSTALL_HINT_KEY, '1'); } catch { /* özel gezinme: yalnızca bu oturumda gizlenir */ }
}
