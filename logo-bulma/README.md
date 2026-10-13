# 1 Milyonuncu Marka (prototip)

Saat başı açılan marka kampanyalarında logoyu 5 saniyede bulana indirim kuponu veren sitenin çalışan prototipi.

- **Analiz ve öneriler:** [ANALIZ.md](ANALIZ.md)
- **Veri:** `data.js`, `logo_bulma.xlsx` dosyasından üretildi (72 kampanya)
- **Uygulama:** `index.html`, `styles.css`, `app.js` (kurulum gerektirmez)

## Çalıştırma

```bash
npx http-server logo-bulma -p 8765   # sonra http://localhost:8765
```

İstediğin kampanyayı hemen denemek için **Kupon takip → Test araçları → Demo saati**.

## Test

```bash
npx http-server logo-bulma -p 8765 &
node logo-bulma/tests/e2e.mjs        # Playwright gerekir
```

Testler; giriş, kazanma, yanlış logo, süre dolması, oyundan kaçma, kontenjan dolması, kampanya bitişi, kupon kopyalama, UTM linki, 24 saatlik kupon süresi, %3 komisyon, CSV, mobil yerleşim ve konsol hatalarını kontrol eder.
