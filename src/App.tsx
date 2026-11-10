const navigation = ['Maç Merkezi', 'Kulüplerim', 'Saha Merkezi', 'Paylaşım Stüdyosu', 'Değişiklikler', 'ASKF Yönetimi'];

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Ana gezinme">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">DG</div>
          <div>
            <strong>Darıca Gücü</strong>
            <span>MAÇ MERKEZİ <b>V4 PRO</b></span>
          </div>
        </div>
        <div className="nav-label">OPERASYON</div>
        <nav>
          {navigation.map((item, index) => (
            <button className={index === 0 ? 'nav-item active' : 'nav-item'} key={item} type="button" aria-current={index === 0 ? 'page' : undefined}>
              <span className="nav-index">{String(index + 1).padStart(2, '0')}</span>
              {item}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" />
          <span>V4 GELİŞTİRME SÜRÜMÜ</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">DARICA GÜCÜ SPOR KULÜBÜ</span>
            <h1>Maç Merkezi</h1>
          </div>
          <div className="topbar-meta">
            <span className="environment">ÖNİZLEME / V4</span>
            <span className="date-label">11 KASIM 2026</span>
          </div>
        </header>

        <section className="source-banner" aria-labelledby="source-heading">
          <div className="source-icon" aria-hidden="true">!</div>
          <div className="source-copy">
            <span className="eyebrow">VERİ KAYNAĞI DURUMU</span>
            <h2 id="source-heading">İlk resmî ASKF doğrulaması bekleniyor</h2>
            <p>Henüz doğrulanmış bir haftalık program bulunmuyor. Eski veya örnek maçlar canlı program gibi gösterilmeyecek.</p>
          </div>
          <span className="state-pill">AWAITING FIRST RUN</span>
        </section>

        <section className="workspace-grid">
          <div className="schedule-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">FİKSTÜR</span>
                <h2>Haftalık maç programı</h2>
              </div>
              <span className="muted-label">Kaynak doğrulaması gerekli</span>
            </div>
            <div className="empty-state">
              <div className="empty-symbol" aria-hidden="true">—</div>
              <h3>Doğrulanmış maç verisi henüz yok</h3>
              <p>ASKF kaynağı başarıyla taranıp Excel dosyası doğrulandığında maçlar burada listelenecek.</p>
              <span className="empty-note">Bu durum, sahaların veya takvimlerin boş olduğu anlamına gelmez.</span>
            </div>
          </div>

          <aside className="source-panel">
            <span className="eyebrow">KAYNAK KONTROLÜ</span>
            <h2>ASKF bağlantısı</h2>
            <dl>
              <div><dt>Kaynak</dt><dd>Kocaeli ASKF</dd></div>
              <div><dt>Son başarılı kontrol</dt><dd>Henüz yok</dd></div>
              <div><dt>Son deneme</dt><dd>Henüz yok</dd></div>
              <div><dt>Doğrulanmış dosya</dt><dd>Bulunmuyor</dd></div>
            </dl>
            <div className="source-footnote">Kaynak doğrulanmadan fikstür yayımlanmaz.</div>
          </aside>
        </section>

        <footer className="app-footer">
          <span>V4 PRO · İZOLE GELİŞTİRME</span>
          <span>ORİJİNAL VE V3 CANLI SİSTEMLER KORUNUYOR</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
