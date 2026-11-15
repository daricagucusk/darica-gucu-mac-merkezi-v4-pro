# PROJE DURUMU — Darıca Gücü Maç Merkezi V4 PRO

Son güncelleme: 2026-11-15 · Dal: `gelistirme/v6-medya-studyosu` (taban `develop/v4-pro` @ 01bf37b)

## Biten (v6 Medya Stüdyosu, 4 aşama — bağımsız denetim: GEÇTİ)
- Aşama 1: Maç Ajandası, kabuk, değişiklik/veli uyarı, veli takvim (.ics), ASKF Veri Merkezi, bildirim çekmecesi Stitch'e hizalandı. Yalnız gerçek veri; sahte rozet/hava/harita yok.
- Aşama 2: Afiş motoru — Shorts / Reels kapak (YouTube Kırmızı, Darıca Zümrüt), Hikaye A (geri sayım + hava), Hikaye C (MVP + girilen skor), 4:5 maç günü/haftalık/sonuç/duyuru, sponsor şeridi, Chivo/Inter `document.fonts.load`, gerçek arma (şeffaf PNG, Stitch karosunda).
- Aşama 3: Oyuncu kaydı + fotoğraf (private Blob, istemcide 600px JPEG küçültme), MVP afişinde kullanım. Kadro tahtası yok.
- Aşama 4: Geri sayım (Europe/Istanbul, geçmişte gizli), Open-Meteo hava (sunucu önbellekli, alınamazsa gizli), sponsor kayan bandı.
- Altyapı: `npm run shots -- --compare` (Stitch yan yana karşılaştırma), `node scripts/poster-shots.mjs` (afiş PNG'leri). API kökü 12 fonksiyon (medya uçları `api/media.ts` + rewrites).

## Kanıt
typecheck temiz · `npm test` 27 dosya / 193 test geçti (eski 97 dahil) · `vite build` geçti · `npm audit` 0 açık · 390px/1440px yatay taşma 0.

## Kalan iş (nereden devam)
1. **Push + PR + Vercel preview** — oturumda `git push` otomatik izin sınıflandırıcısınca reddedildi. Yapılacak:
   `git push -u origin gelistirme/v6-medya-studyosu` → `gh api repos/daricagucusk/darica-gucu-mac-merkezi-v4-pro/pulls -f title="v6 Medya Stüdyosu" -f head=gelistirme/v6-medya-studyosu -f base=develop/v4-pro -f body="..."` → Vercel preview "Ready" kontrolü; `/api/weather?at=...` ve `/api/players` rewrite'larının sorgu dizesini taşıdığını canlıda doğrula.
2. Gerçek Blob ile oyuncu/fotoğraf uçtan uca deneme (preview'da).
3. Gerçek Z Fold7 cihaz kontrolü.

## Sahibin kararı (2026-11-15, işlendi)
- Sponsorlar gerçek liste (Arapçeşme Diş, Kanatçı Nizam, Doğanay Raf), `approvedByOwner:true`; afiş şeridi varsayılan açık.
- Kulüp sosyal medyası: yalnız Instagram/YouTube/WhatsApp; ilgisiz platform temaları yok. Shorts temaları: YouTube Kırmızı, Darıca Zümrüt.
- Yeni resmi arma işlendi (`node scripts/brand-assets.mjs`: şeffaf arma, PWA ikonları, favicon, sponsor logoları).

## Sahibin kararı gerekenler
- Hava kaynağı onayı: Open-Meteo, anahtarsız, CC BY 4.0 (atıf ekranda).
- Oyuncu uçları uygulama içi kimlik doğrulama içermez; Vercel SSO koruması kapatılmamalı.

Birleştirme ve production yayını YAPILMADI (sahibin kararı).
