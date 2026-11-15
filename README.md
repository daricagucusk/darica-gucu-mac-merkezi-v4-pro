# Darıca Gücü Maç Merkezi V4 PRO

Single-source match operations application for Darıca Gücü and Kocaeli amateur football.

## Current state
V4 is under isolated development. The original site and V3 production application remain untouched. Until an official ASKF workbook passes source, parser, season, hash, and fixture-count validation, the UI will not invent fixtures.

## Implemented
- Vite + React + TypeScript responsive shell with live API-backed source and fixture status.
- Canonical Turkish club identity and fixture identity.
- Snapshot acceptance guardrails: official provenance, SHA-256, duplicate fixture rejection, season rollover, older-week rejection, and abnormal fixture-loss rejection.
- Added/changed/missing fixture classification; repeated same-pair matches are matched by nearest kickoff with ambiguity protection.
- Missing matches are `verification_required`, never silently cancelled.
- Real ASKF `.xls` parser test fixtures for weeks 10 and 11, including the latest file downloaded from the official ASKF file manager.
- U11–U19 parsing and Darıca Gücü / Darıca Kartalgücü disambiguation.
- `.xlsx` parser adapter.
- ASKF file-manager candidate selection by highest week and real browser download test.
- Vercel API routes: `/api/cron-askf`, `/api/source-status`, `/api/live`.
- Private Vercel Blob store in Frankfurt and sensitive `CRON_SECRET` environment variable.
- Vercel Cron currently runs daily at 18:00 Türkiye time as a temporary integration schedule (cron expression `0 15 * * *` UTC). After the first successful end-to-end ingestion and Blob archive verification, change it to 16:00 Türkiye time (`0 13 * * *` UTC).

## Current integration gate
The first successful V4 Cron execution has not yet been proven. The live official file manager was successfully opened in Edge and its latest `011.HAFTA PROGRAM.xls` file was downloaded (243,200 bytes). That exact workbook is now a parser fixture and passes the V4 parser tests. The Vercel-hosted Playwright + Chromium run must still complete, archive the source workbook and versioned JSON snapshot in the V4 private Blob store, and publish a verified live snapshot.

## Development
- Node.js 22 veya üstü (`package.json` engines)
- `npm install`
- `npm run dev`
- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm audit`

## Storage and cost guardrails
V4 uses a separate private Blob store in the Frankfurt region. The Vercel Hobby documentation lists 1 GB/month storage, 10 GB/month Blob data transfer, 10,000 simple operations, and 2,000 advanced operations as included usage. The current daily ingestion pattern is intentionally low-volume. If limits are exceeded, Hobby access is paused rather than silently upgraded to a paid plan. No paid upgrade is authorized.

## Architecture and decisions
See `DESIGN.md` and `docs/superpowers/specs/2026-11-11-darica-gucu-mac-merkezi-v4-design.md`.

## Safety invariants
- Missing fixtures are quarantined for verification, never silently cancelled.
- Invalid source snapshots cannot replace the last verified snapshot.
- Raw workbook and versioned snapshot are archived before the live pointer changes.
- Secrets remain server-side.
- V4 is a separate SSO-protected deployment; no original/V3 domain is replaced.

## Zamanlama (cron) nasıl çalışır
`vercel.json` içindeki tek cron her gün çalışır (`0 15 * * *` UTC = 18:00 Türkiye). Aynı çağrı iki iş yapar:
1. Günlük maç hatırlatmalarını gönderir.
2. ASKF programını yalnızca haftalık kapıdan geçince kontrol eder (Salı 18:00, Türkiye saati). Diğer günler ASKF'ye gidilmez.
Hobby planı günde en fazla bir cron çalıştırır; bu yüzden tek günlük cron kullanılır. Elle kontrol en az 5 dakika arayla yapılabilir. Çalışan bir kontrol kilidi 65 saniye sonra bayat sayılır (fonksiyon süresi 60 sn + 5 sn pay) ve denetim kaydına `stale_lock_recovered` yazılır.

## Telefon kurulumu (PWA)
- Android Chrome: siteyi aç, "Yükle" bandına veya menüdeki "Ana ekrana ekle"ye dokun.
- iPhone Safari: Paylaş simgesi, sonra "Ana Ekrana Ekle".
- Çevrimdışıyken son doğrulanmış program gösterilir; onay, yapay zeka ve indirme uçları asla önbelleğe alınmaz.
- Yeni sürüm çıkınca "Yeni sürüm hazır" bandı görünür; "Yenile"ye basınca etkinleşir.
- Dağıtım SSO korumalıdır: ilk açılışta Vercel girişi istenir.

## Yapay zeka (isteğe bağlı, varsayılan kapalı)
Tek servis katmanı `api/_lib/ai/` altındadır ve yalnızca Claude kullanır. `AI_ENABLED=true`, `ANTHROPIC_API_KEY` ve `AI_MONTHLY_BUDGET_USD` girilmezse hiçbir şey çalışmaz. Kişisel veri (TC, IBAN, telefon, e-posta, anahtar) kapıdan geçemez; yalnızca maç alanları gönderilir. Aylık tavan Blob'da tutulur ve aşılınca durur.

## Hava durumu kaynağı
Maç kartlarındaki hava bilgisi `api/media.ts` (`?resource=weather`; mantık `api/_lib/weather-handler.ts` ve `api/_lib/weather.ts`) üzerinden **Open-Meteo** tahmin API'sinden gelir (anahtarsız, ücretsiz; lisans CC BY 4.0, atıf zorunlu: yanıttaki `source: "Open-Meteo (CC BY 4.0)"` arayüzde gösterilmelidir, https://open-meteo.com). Konum Darıca (40.77 K, 29.37 D), saat dilimi Europe/Istanbul. `GET /api/weather?at=<maç zamanı>` (`vercel.json` rewrites ile `/api/media?resource=weather`; Hobby plan fonksiyon sınırı için üç uç tek fonksiyonda birleşti) o saatin sıcaklığını ve Türkçe durum etiketini döner. Önbellek: modül içi bellek 30 dk + `Cache-Control: public, s-maxage=1800, stale-while-revalidate=600` (Vercel CDN). Hata, 3 sn zaman aşımı veya 16 günden uzak maçta `{available:false}` döner ve arayüz kartı gizler; sabit/uydurma değer asla dönmez. Service worker bu ucu önbelleğe almaz.

## Oyuncu verisi
Liste tek JSON olarak **private Blob**'da durur: `players/roster.json`; fotoğraflar `players/photos/<id>-<hash>.<jpg|png|webp>` (uzantı görsel türüne göre). Uçlar `api/media.ts` içinde birleşiktir (`?resource=players|player-photo`, rewrites ile `/api/players` ve `/api/player-photo`); mantık `api/_lib/players-handler.ts` ve `api/_lib/player-photo-handler.ts` dosyalarındadır. İstemciye yalnız `id, number, name, position, team, hasPhoto, updatedAt` gider; Blob yolu/URL'si gitmez, fotoğraf `GET /api/player-photo?id=` ile sunucu üzerinden akıtılır (`private, no-store`). TC, IBAN, telefon alanı yoktur; serbest metinde bu desenler reddedilir. Yazma uçları (POST/DELETE) aynı-kaynak (origin) kontrolünden geçer. **Erişim notu:** uçlar uygulama içi kimlik doğrulama içermez; Vercel Deployment Protection (SSO) arkasındadır. Koruma kapatılırsa oyuncu verisi ve fotoğraflar herkese açık uçlardan okunup yazılabilir; korumayı kapatmadan önce uygulama içi yetkilendirme eklenmelidir. Veri repoya girmez; testlerde yalnız sahte veri kullanılır. Loglara yalnız oyuncu id'si ve sayı yazılır. `/api/players` ve `/api/player-photo` service worker tarafından asla önbelleğe alınmaz.

## Sponsorlar (sahibin onayı gerekli)
`src/media/sponsors.ts` içindeki liste prototipten alınmış varsayılan adlardır ve hepsi `approvedByOwner: false` işaretlidir. Kulüp sahibi onaylamadan afişe/yayına konmamalıdır.

## Sıfırdan yayına alma
1. Depoyu Vercel'e bağla (Hobby yeterli).
2. Frankfurt bölgesinde özel bir Blob deposu oluştur ve projeye bağla.
3. `.env.example` içindeki zorunlu değişkenleri gir (`CRON_SECRET` en az 32 karakter).
4. Dağıtımın "Ready" olduğunu kontrol et. Hata varsa build günlüğünün son satırlarına bak.
5. Cron'u Vercel panelinden elle tetikle; `/api/source-status` durumunun `awaiting_first_run`dan çıktığını doğrula.
6. İlk başarılı kayıttan sonra isteğe bağlı olarak cron saatini 16:00'ya çek (`0 13 * * *`).
