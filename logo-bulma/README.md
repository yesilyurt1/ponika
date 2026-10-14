# 1 Milyonuncu Marka (prototip)

Saat başı açılan marka kampanyalarında logoyu 5 saniyede bulana indirim kuponu veren sitenin çalışan prototipi.

- **Analiz, kararlar ve öneriler:** [ANALIZ.md](ANALIZ.md)
- **Marka entegrasyonu ve komisyon kontrolü:** [ENTEGRASYON.md](ENTEGRASYON.md)
- **Sunucu (API):** `server/server.mjs`, bağımlılık gerektirmez (Node 20+)
- **Ortak kurallar:** `kurallar.js` (program, logo havuzu ≥300, çoklu indirim, telafi, günlük hak); site ve sunucu aynı dosyayı kullanır
- **Marka kütüphanesi:** `markalar.js` (15 kategori, 1.003 benzersiz marka); logolar `logos/`, indirme betiği `tools/logo-indir.mjs`
- **Uygulama olarak yükleme (PWA):** `manifest.webmanifest`, `sw.js`, `icons/`
- **Veri:** `data.js`, `logo_bulma.xlsx` dosyasından üretildi (72 kampanya; diğer kategoriler ve demolar `kurallar.js`'de üretilir)
- **Uygulama:** `index.html`, `styles.css`, `app.js` (kurulum gerektirmez)

## Çalıştırma

```bash
npx http-server logo-bulma -p 8765   # sonra http://localhost:8765
```

Her kategoride bir demo kampanya günün her saati açıktır (Giyim: Civil, Büyük Fırsat: Muhteşem Fırsat). Diğer kampanyaları hemen denemek için **Kupon takip → Test araçları → Demo saati**. Kazandığın kuponu **Marka kasası** ekranında kullanıp komisyonun **Kupon takip**'e düştüğünü görebilirsin.

Sunucuyla (siteyi de sunar):

```bash
ADMIN_KEY=gizli node logo-bulma/server/server.mjs   # http://localhost:8080
```

## Test

```bash
npx http-server logo-bulma -p 8765 &
node logo-bulma/tests/e2e.mjs        # Playwright gerekir
node --test logo-bulma/server/test.mjs   # sunucu: imza, sipariş, iade, rapor
```

Site testleri; kurallar penceresi, kazanma, günlük hak, telafi (düşük/reklam/ücretli), Muhteşem Fırsat tahtası, filtreler, çoklu indirim, komisyon, iade, Kazancım, hatırlatma bildirimi, kupon süresi ve 5 ekran boyutunda açık/koyu tema yerleşimini kontrol eder.
