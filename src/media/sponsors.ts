// Sponsor listesi: prototipteki (docs/referans/prototip-index.txt, sponsor marquee) adlar birebir.
// SAHİBİN ONAYI GEREKLİ: bu adların kullanımı ve sponsorluk rolleri kulüp sahibi tarafından
// onaylanana kadar approvedByOwner=false kalır; arayüz yayın/afiş öncesi bunu uyarmalıdır.
export interface Sponsor {
  name: string;
  role: string;
  approvedByOwner: boolean;
}

export const DEFAULT_SPONSORS: readonly Sponsor[] = [
  { name: 'DARICA BELEDİYESİ', role: 'ANA SPONSOR', approvedByOwner: false },
  { name: 'KOCAELİ ASKF', role: 'RESMÎ DESTEKÇİ', approvedByOwner: false },
  { name: 'MARMARA DİŞ KLİNİĞİ', role: 'SAĞLIK SPONSORU', approvedByOwner: false },
  { name: 'ÇINARALTI KAFE', role: 'LEZZET PARTNERİ', approvedByOwner: false },
  { name: 'AKADEMİ SPOR DÜNYASI', role: 'MALZEME TEDARİK', approvedByOwner: false },
  { name: 'KOCAELİ B.B.', role: 'TESİS DESTEĞİ', approvedByOwner: false },
];

export function getSponsors(): Sponsor[] {
  return DEFAULT_SPONSORS.map((sponsor) => ({ ...sponsor }));
}

/** Tüm sponsorlar sahibince onaylandı mı (yayın kapısı için). */
export function allSponsorsApproved(sponsors: readonly Sponsor[] = DEFAULT_SPONSORS): boolean {
  return sponsors.length > 0 && sponsors.every((s) => s.approvedByOwner);
}
