// Kulüp sponsorları: kulüp yöneticisinin verdiği GERÇEK liste (2026-11-15). Hepsi sahibince onaylıdır.
// Logo yolları public/sponsors altındadır (scripts/brand-assets.mjs üretir). Logosu olmayan sponsor
// (Doğanay Raf) için yalnız yazı rozeti çizilir; Instagram hesabı olmayana hesap UYDURULMAZ.
export interface Sponsor {
  id: string;
  name: string;
  /** Afiş şeridi ve kayan bant için kısa ad. */
  shortName: string;
  role?: string;
  /** public/ altındaki logo yolu; yoksa yazı rozeti (wordmark). */
  logo?: string;
  /** Instagram kullanıcı adı, "@" ile (ör. "@kanatcinizam"). Yoksa hiç gösterilmez. */
  instagram?: string;
  /** Web sitesi (isteğe bağlı). */
  url?: string;
  city?: string;
  approvedByOwner: true;
}

export const DEFAULT_SPONSORS: readonly Sponsor[] = [
  {
    id: 'arapcesme', name: 'Özel Arapçeşme Ağız ve Diş Sağlığı Polikliniği', shortName: 'Arapçeşme Diş',
    logo: '/sponsors/arapcesme.png', instagram: '@arapcesmedis', url: 'https://arapcesmedis.com.tr', city: 'Gebze / Kocaeli', approvedByOwner: true,
  },
  {
    id: 'kanatci-nizam', name: 'Kanatçı Nizam', shortName: 'Kanatçı Nizam',
    logo: '/sponsors/kanatci-nizam.png', instagram: '@kanatcinizam', city: 'Darıca', approvedByOwner: true,
  },
  { id: 'doganay-raf', name: 'Doğanay Raf', shortName: 'Doğanay Raf', role: 'Forma Sponsoru', approvedByOwner: true },
];

export function getSponsors(): Sponsor[] {
  return DEFAULT_SPONSORS.map((sponsor) => ({ ...sponsor }));
}

/** Tüm sponsorlar sahibince onaylandı mı (yayın kapısı için). */
export function allSponsorsApproved(sponsors: readonly Sponsor[] = DEFAULT_SPONSORS): boolean {
  return sponsors.length > 0 && sponsors.every((s) => s.approvedByOwner);
}

/** "@kanatcinizam" -> "https://www.instagram.com/kanatcinizam/"; hesap yoksa null (uydurma bağlantı yok). */
export function instagramUrl(sponsor: Pick<Sponsor, 'instagram'>): string | null {
  const handle = sponsor.instagram?.trim().replace(/^@/, '');
  if (!handle || !/^[A-Za-z0-9._]+$/.test(handle)) return null;
  return `https://www.instagram.com/${handle}/`;
}

/** Afiş şeridinde adın altında görünen kısa satır: rol varsa rol, yoksa Instagram hesabı. */
export function sponsorSubline(sponsor: Sponsor): string {
  return sponsor.role?.trim() || sponsor.instagram?.trim() || '';
}

/** Bülten sonu teşekkür satırı. Instagram hesabı olmayan sponsorun yalnız adı yazılır. */
export function sponsorThanksLine(sponsors: readonly Sponsor[] = DEFAULT_SPONSORS): string {
  if (sponsors.length === 0) return '';
  const names = sponsors.map((s) => s.shortName).join(', ');
  const handles = sponsors.map((s) => s.instagram?.trim()).filter((h): h is string => Boolean(h));
  return `Sponsorlarımıza teşekkürler: ${names}.${handles.length ? ` Instagram: ${handles.join(' ')}` : ''}`;
}
