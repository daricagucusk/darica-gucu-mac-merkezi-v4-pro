# ASKF Program Takip Merkezi — Tasarım Belgesi

**Tarih:** 15 Kasım 2026  
**Proje:** Darıca Gücü Maç Merkezi V4 PRO  
**Kaynak:** KASKF resmî haftalık program arşivi — https://www.kaskf.org/HaftalikProgram

## Amaç
KASKF haftalık program dosyalarını sunucu tarafından günlük veya haftalık olarak kontrol etmek, doğrulanmış yeni dosyayı değiştirilemez arşive ve bekleyen inceleme alanına indirmek, farkları kullanıcıya göstermek ve yalnızca açık kullanıcı onayından sonra canlı fikstürü değiştirmek.

## Kullanıcı ve başarı ölçütü
Birincil kullanıcı kulüp yöneticisi/teknik ekip sorumlusudur. Uygulama kapalıyken de zamanlanmış kontrol yapılır. Kullanıcı uygulamayı açtığında yeni dosya, kaynak bilgisi, değişiklik özeti ve onay/ret işlemleri görünür. Onay verilmeden canlı maç takvimi aynı kalır.

## Hedefler
1. Sunucu tarafında zamanlanmış KASKF kontrolü.
2. Günlük veya haftalık (varsayılan Salı) çalışma tercihi.
3. Uygulama içinden manuel “Şimdi kontrol et”.
4. Resmî kaynaktan .xls/.xlsx dosyası indirme; gerçek dosya tipi ve boyutu doğrulama.
5. SHA-256, sezon, hafta, kaynak dosya, indirme zamanı ve parser sürümü ile provenance.
6. Bekleyen snapshot ve ham dosyanın arşivlenmesi.
7. Yeni, değişen ve kayıp görünen maçların diff ekranında sunulması.
8. Canlı fikstürün yalnızca açık onayla değiştirilmesi.
9. Önceki canlı snapshot'ın arşivlenmesi ve rollback imkânı.
10. Kaynak hatası, hatalı dosya, yinelenen dosya ve eşzamanlı işlem durumlarında mevcut canlı verinin korunması.

## Kapsam dışı
- Resmî KASKF sitesinin yerine geçmek.
- Resmî kanıt olmadan maç iptalini veya saha boşluğunu varsaymak.
- Ana dalı veya mevcut canlı sistemi doğrudan değiştirmek.
- Kullanıcı onayı olmadan otomatik yayın yapmak.

## Yaklaşımlar
- **A — Yalnızca sunucu zamanlaması:** Uygulama kapalıyken çalışır; ancak kullanıcıya manuel kontrol esnekliği sunmaz.
- **B — Yalnızca uygulama açıkken kontrol:** Kurulumu kolaydır; uygulama kapalıyken güvenilir zamanlama sağlayamaz.
- **C — Hibrit (seçilen):** Vercel Cron günlük tetiklenir; kullanıcı tercihi günlük/haftalık çalışmayı belirler. Uygulama içi manuel kontrol de aynı doğrulama hattını kullanır. Böylece kapalıyken izleme ve gerektiğinde anında kontrol sağlanır.

## Mevcut proje bulguları
- V4 repo: daricagucusk/darica-gucu-mac-merkezi-v4-pro.
- Ana geliştirme dalı: develop/v4-pro.
- Vercel projesi GitHub deposuna bağlı; preview deployment destekleniyor.
- api/cron-askf.ts KASKF dosyasını indirip parse ediyor; mevcut davranış doğrulama sonrası doğrudan PATH_LIVE üzerine yazıyor. Bu davranış onay kapısıyla değiştirilecek.
- vercel.json her gün 15:00 UTC / 18:00 Europe/Istanbul cron tanımlıyor.
- api/_lib/askf-source.ts Playwright ile resmî dosya yöneticisinden güncel sezon klasörünü ve en yüksek hafta XLS/XLSX dosyasını seçiyor.
- src/ingestion/parse-askf.ts .xls ve .xlsx parser'larını ve Darıca Gücü eşleştirmesini içeriyor.
- src/ingestion/publish.ts arşiv ve canlı pointer yayınlama akışını içeriyor.
- Mevcut ASKF Yönetimi ekranında manuel kontrol, zamanlama ayarı ve kullanıcı onaylı yayın akışı henüz bulunmuyor.

## Mimari kararlar
- Mevcut Vercel Cron 18:00 Türkiye saati tetikleyicisi korunur; weekly tercihi Salı günü dışındaki tetiklemeleri no-op yapar, daily her gün çalışır.
- Kontrol hattı doğrulama ve staging işlemini yapar; canlı pointer'a dokunmaz.
- Yeni Blob yolları: askf/v4/pending.json, askf/v4/settings.json, askf/v4/audit/ ve askf/v4/snapshots/.
- Yeni dosya ve snapshot önce immutable/versiyonlu arşive yazılır; pending pointer en son güncellenir.
- Onay endpoint'i pending hash'i tekrar okur, eşzamanlı değişimi kontrol eder, eski live snapshot'ı arşivler ve ardından PATH_LIVE pointer'ını değiştirir.
- Ret pending pointer'ını temizler; arşivlenmiş dosyayı denetim geçmişinde tutar.
- Manuel kontrol endpoint'i ve Cron aynı ingestion servis fonksiyonunu kullanır; Cron çağrısı CRON_SECRET ile korunur.
- Kullanıcı işlemleri same-origin/CSRF kontrolleriyle korunur. Vercel proje erişim koruması ek güvenlik katmanıdır; CRON_SECRET hiçbir zaman istemciye gönderilmez.
- Varsayılan kontrol: weekly / Salı / 18:00 Europe/Istanbul.
- Onay/ret, manuel kontrol ve ayar değişiklikleri audit log'a yazılır.

## Güvenlik ve veri bütünlüğü
- Kaynak yalnızca KASKF resmî alan adı ve beklenen haftalık program dosya seçimi.
- XLS/XLSX imza, dosya boyutu, sezon/hafta, benzersiz fikstür kimliği ve mevcut snapshot kalite kapıları korunur.
- Aynı SHA-256 tekrar gelirse yeni pending oluşturulmaz.
- Yeni dosya doğrulanamazsa pending ve live verileri değiştirilmez.
- missing diff kaydı iptal değildir; verification_required olarak gösterilir.
- Onay anında pending hash değişmişse işlem reddedilir ve kullanıcı yeniden incelemeye yönlendirilir.
- Her mutasyon audit log'a yazılır; başarısızlıkta mevcut canlı snapshot korunur.

## Kabul ölçütleri
1. Haftalık modda yalnızca Salı tetiklenmesinde kontrol yapılır.
2. Günlük modda her günlük cron tetiklenmesinde kontrol yapılır.
3. Manuel kontrol aynı ingestion hattını kullanır.
4. Başarılı indirme pending arşive yazılır, live pointer değişmez.
5. Yeni/taşınan/değişen/kayıp fikstürler gösterilir.
6. Onay olmadan canlı fikstür değişmez.
7. Onay sonrası pending snapshot live olur; önceki live snapshot arşivde kalır.
8. Ret live veriyi değiştirmez.
9. Aynı dosya tekrar geldiğinde mükerrer pending oluşmaz.
10. Hatalı dosya ve kaynak kesintisi mevcut canlı veriyi korur.
11. Mobil, Fold, tablet ve masaüstünde ASKF Yönetimi kullanılabilir.
12. Typecheck, test ve Vercel preview build geçer.

## Üretim sınırı
Tüm değişiklikler feat/askf-program-approval-center dalında yapılır. develop/v4-pro ve production alias üzerinde doğrudan değişiklik yapılmaz. Önce preview deployment doğrulanır.
