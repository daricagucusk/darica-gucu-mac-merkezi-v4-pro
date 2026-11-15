# PROJE DURUMU — Darıca Gücü Maç Merkezi V4 PRO

Son güncelleme: 2026-11-15 · Dal: `gelistirme/v6-medya-studyosu` (taban `develop/v4-pro` @ 01bf37b)

## Biten (v6 Medya Stüdyosu, 4 aşama — bağımsız denetim: GEÇTİ)
- Aşama 1: Maç Ajandası, kabuk, değişiklik/veli uyarı, veli takvim (.ics), ASKF Veri Merkezi, bildirim çekmecesi Stitch'e hizalandı. Yalnız gerçek veri; sahte rozet/hava/harita yok.
- Aşama 2: Afiş motoru — Shorts/TikTok kapak (YouTube Kırmızı, TikTok Mor, Darıca Zümrüt), Hikaye A (geri sayım + hava), Hikaye C (MVP + girilen skor), 4:5 maç günü/haftalık/sonuç/duyuru, sponsor şeridi, Chivo/Inter `document.fonts.load`, gerçek arma karosu.
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

## Sahibin kararı gerekenler
- Sponsor listesi (şu an prototip adları, `approvedByOwner:false`; afiş bandı varsayılan kapalı, ana ekran kayan bandı açık).
- Hava kaynağı onayı: Open-Meteo, anahtarsız, CC BY 4.0 (atıf ekranda).
- TikTok Mor teması: prototip moru (#d946ef) mı, Stitch ikonundaki camgöbeği/pembe mi.
- Şeffaf arka planlı arma dosyası (şu an beyaz zeminli PNG, çerçeveli karo içinde).
- Oyuncu uçları uygulama içi kimlik doğrulama içermez; Vercel SSO koruması kapatılmamalı.

Birleştirme ve production yayını YAPILMADI (sahibin kararı).
