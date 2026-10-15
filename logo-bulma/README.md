# 1 Milyonuncu Marka

Kategorilere göre gün boyu açılan marka kampanyalarında logoyu 5 saniyede bulana kişiye özel indirim kuponu veren site, sunucusu ve yönetim paneli.

- **Canlıya alma:** [CANLIYA-ALMA.md](CANLIYA-ALMA.md) (Docker + Caddy, Netgsm, yedekleme)
- **Analiz, kararlar ve öneriler:** [ANALIZ.md](ANALIZ.md)
- **Marka entegrasyonu ve komisyon kontrolü:** [ENTEGRASYON.md](ENTEGRASYON.md)
- **Sunucu (API):** `server/server.mjs`, bağımlılık gerektirmez (Node 20+)
- **Ortak kurallar:** `kurallar.js` (program, logo havuzu ≥300, tahta boyutu, çoklu indirim, telafi, arama); site ve sunucu aynı dosyayı kullanır
- **Marka kütüphanesi:** `markalar.js` (15 kategori, 1.003 benzersiz marka); logolar `logos/`, indirme betiği `tools/logo-indir.mjs`
- **Uygulama olarak yükleme (PWA):** `manifest.webmanifest`, `sw.js`, `icons/`
- **Veri:** `data.js`, `logo_bulma.xlsx` dosyasından üretildi (72 kampanya; diğer kategoriler ve demolar `kurallar.js`'de üretilir)
- **Uygulama:** `index.html`, `styles.css`, `app.js`. Sunucudan açılınca canlı modda (`config.js` sunucu tarafından üretilir), statik açılınca demo modda çalışır.
- **Yönetim paneli:** `#/admin`

## Çalıştırma

Demo (veriler tarayıcıda, sunucusuz):

```bash
npx http-server logo-bulma -p 8765   # sonra http://localhost:8765
```

Her kategoride bir demo kampanya tüm gün açıktır (Giyim: Civil, Büyük Fırsat: Muhteşem Fırsat). Diğer kampanyaları hemen denemek için **Yönetim paneli › Kampanyalar › Demo saati**. Kazandığın kuponu **Yönetim paneli › Kasa simülatörü**'nde kullanıp komisyonun Kuponlar'a düştüğünü görebilirsin.

Sunucuyla (canlı mod; siteyi de sunar):

```bash
ADMIN_KEY=en-az-16-karakterli-anahtar SMS_MODE=dev PAYMENT_MODE=demo node logo-bulma/server/server.mjs   # http://localhost:8080
```

`SMS_MODE=dev` giriş kodunu ekranda gösterir; canlı kurulum için [CANLIYA-ALMA.md](CANLIYA-ALMA.md).

## Test

```bash
npx http-server logo-bulma -p 8765 &
node logo-bulma/tests/e2e.mjs            # site (Playwright gerekir), 89 kontrol
node --test logo-bulma/server/test.mjs   # sunucu: SMS girişi, oyun, kupon, imza, sipariş, iade, admin, 17 test
```

Site testleri; arama, kurallar penceresi, kazanma, kampanya başına tek oyun, neonla gösterilen kaçan logo, telafi (düşük/reklam/ücretli), Muhteşem Fırsat 50/55 logo, filtreler, çoklu indirim, komisyon, iade, Kazancım, yönetim paneli, logo yükleme, hatırlatma bildirimi, kupon süresi ve 5 ekran boyutunda açık/koyu tema yerleşimini kontrol eder.
