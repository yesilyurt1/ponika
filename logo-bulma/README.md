# 1 Milyonuncu Marka (prototip)

Saat başı açılan marka kampanyalarında logoyu 5 saniyede bulana indirim kuponu veren sitenin çalışan prototipi.

- **Analiz, kararlar ve öneriler:** [ANALIZ.md](ANALIZ.md)
- **Marka entegrasyonu ve komisyon kontrolü:** [ENTEGRASYON.md](ENTEGRASYON.md)
- **Sunucu (API):** `server/server.mjs`, bağımlılık gerektirmez (Node 20+)
- **Marka kütüphanesi:** `markalar.js` (15 kategori, 1.208 marka); logolar `logos/`, indirme betiği `tools/logo-indir.mjs`
- **Veri:** `data.js`, `logo_bulma.xlsx` dosyasından üretildi (72 kampanya)
- **Uygulama:** `index.html`, `styles.css`, `app.js` (kurulum gerektirmez)

## Çalıştırma

```bash
npx http-server logo-bulma -p 8765   # sonra http://localhost:8765
```

Civil demo kampanyası günün her saati açıktır. Diğer kampanyaları hemen denemek için **Kupon takip → Test araçları → Demo saati**. Kazandığın kuponu **Marka kasası** ekranında kullanıp komisyonun **Kupon takip**'e düştüğünü görebilirsin.

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

Testler; giriş, kazanma, yanlış logo, süre dolması, oyundan kaçma, kontenjan dolması, kampanya bitişi, kupon kopyalama, UTM linki, 24 saatlik kupon süresi, %3 komisyon, CSV, mobil yerleşim ve konsol hatalarını kontrol eder.
