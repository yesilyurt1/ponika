# Canlıya alma

Site ve API tek bir Node.js sunucusunda çalışır (`server/server.mjs`, bağımlılık yok). Önünde Caddy durur: alan adına otomatik HTTPS sertifikası alır, yeniler ve istekleri uygulamaya iletir. İkisi de Docker ile tek komutla kalkar.

```
Ziyaretçi ──HTTPS──▶ Caddy (80/443) ──▶ app: server.mjs (8080) ──▶ /data (kalıcı disk: db.json, yedekler, yüklenen logolar)
                                              └──▶ Netgsm (SMS)
```

## 1. Başlamadan önce gerekenler

| # | Ne | Nereden / not |
|---|---|---|
| 1 | **Alan adı** | Ör. `1milyonuncumarka.com` (Natro, İsimtescil, GoDaddy…). `.com.tr` için belge istenir. |
| 2 | **Sunucu (VPS)** | Ubuntu 24.04, en az 2 GB RAM, 1 vCPU, 20 GB disk yeterli (aylık ~5–15 €). Türkiye'de veri tutmak için Turhost, Natro, Radore, Hostinger TR; yurt dışında Hetzner, DigitalOcean. Kişisel veriyi yurt dışında tutmak KVKK'da "yurt dışına aktarım"dır; avukatınla karar verin. |
| 3 | **SMS sağlayıcısı** | Netgsm hesabı + onaylı **SMS başlığı** (gönderici adı, ör. `1MMARKA`; onayı birkaç gün sürer). Hatırlatma SMS'leri ticari ileti sayılabilir: **İYS** kaydı gerekir. Netgsm dışı bir sağlayıcı için bkz. §6. |
| 4 | **Yönetim anahtarı** | Panel şifresi. Üret: `openssl rand -hex 24` (kimseyle paylaşma, bir parola yöneticisinde sakla). |
| 5 | **Hukuki metinler** | KVKK aydınlatma metni, açık rıza (SMS/İYS), kullanım koşulları, kampanya katılım koşulları. Kayıt penceresindeki onay kutusu bu metinlere bağlanmalı. |
| 6 | **Markalar** | Sözleşme (sipariş bildirimi, %3 komisyon, cezai şart; `ENTEGRASYON.md` §2), her marka için API anahtarı (panel › Markalar), orijinal logolar (panel › Logolar). |
| 7 | *(isteğe bağlı)* **Ödeme kuruluşu** | "5 ₺ öde" telafisi için iyzico / PayTR üye iş yeri hesabı. Bağlanana kadar seçenek sitede gizli kalır (`PAYMENT_MODE=off`). |

## 2. Kurulum (VPS'te, ~15 dakika)

**a) Alan adının DNS'i:** Alan adı panelinde iki **A kaydı** ekle: `@` → sunucunun IP adresi, `www` → aynı IP. Yayılması birkaç dakika ile birkaç saat sürer.

**b) Sunucuya bağlan ve Docker'ı kur:**

```bash
ssh root@SUNUCU_IP
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

**c) Kodu indir:** Depo gizli olduğu için GitHub'da bir *deploy key* (salt okunur) ya da kişisel erişim anahtarı gerekir.

```bash
git clone -b claude/epic-dirac-vazbh8 https://github.com/yesilyurt1/ponika.git /opt/ponika
cd /opt/ponika/logo-bulma
```

**d) Ayarları yaz:**

```bash
cp .env.example .env
nano .env        # DOMAIN, ADMIN_KEY, NETGSM_USER, NETGSM_PASS, NETGSM_HEADER
```

**e) Başlat:**

```bash
docker compose up -d --build
docker compose logs -f app     # "1 Milyonuncu Marka: http://localhost:8080 (SMS: netgsm, ödeme: off)" görmelisin
```

Birkaç saniye içinde `https://alanadin` açılır (sertifika otomatik).

## 3. Yayına açmadan önce kontrol listesi

- [ ] `https://alanadin/api/saglik` → `{"ok":true,…}`
- [ ] Sitenin üstündeki "Prototip" yazısı görünmüyor (sunucu modunda otomatik gizlenir).
- [ ] Kendi telefonunla giriş yap: SMS kodu geliyor mu?
- [ ] Bir kampanyada oyna; kazanınca kupon Kuponlarım'da, linke tıklayınca marka sitesine `utm_content=KOD` ile gidiyor mu?
- [ ] `https://alanadin/#/admin` → `ADMIN_KEY` ile gir. Özet, Üyeler, Kuponlar ve Satın alma takibinde kendi denemen görünüyor mu?
- [ ] Panel › Logolar: markaların orijinal logolarını yükle.
- [ ] Panel › Markalar: entegre olacak her marka için API anahtarı oluştur, markanın yazılım ekibine `ENTEGRASYON.md` ile birlikte güvenli kanaldan ilet.
- [ ] Panel › Kasa simülatörü ile bir siparişi dene; komisyon Kuponlar ve Özet'e düşüyor mu? (Deneme kayıtlarını sonra panelden iptal/iade et.)
- [ ] Telefonda "Ana ekrana ekle" ile uygulama gibi açılıyor mu?

## 4. Günlük işletme

| İş | Nasıl |
|---|---|
| **Güncelleme** | `cd /opt/ponika && git pull && cd logo-bulma && docker compose up -d --build` (veriler `/data` biriminde, silinmez) |
| **Kayıtlar** | `docker compose logs --tail 200 app` |
| **Otomatik yedek** | Sunucu her gün `/data/yedek` altına yedek alır, son 14 günü tutar. |
| **Sunucu dışı yedek** | `sh deploy/yedek-al.sh /root/yedekler` → tüm veriyi arşivler. Cron: `30 3 * * * cd /opt/ponika/logo-bulma && sh deploy/yedek-al.sh /root/yedekler`. Arşivleri ayrıca başka bir yere (ör. bulut depolama) kopyala. |
| **Geri yükleme** | `docker compose stop app` → arşivi birime aç: `docker compose run --rm -v /root/yedekler:/y app sh -c "cd /data && tar xzf /y/lb-TARIH.tar.gz"` → `docker compose start app` |
| **Ay sonu hakediş** | Panel › Kuponlar › CSV, ya da `GET /api/admin/rapor?ay=2026-10` (`ENTEGRASYON.md` §3) |
| **Kampanya programı** | Kategorilerin başlangıç saatleri ve aralıkları `data.js` › `schedules`, ürün/indirim kuralları `kurallar.js`'de. Değiştirip güncelleme komutunu çalıştır. |

## 5. Ortam değişkenleri

| Değişken | Değer | Açıklama |
|---|---|---|
| `DOMAIN` | `1milyonuncumarka.com` | Caddy sertifikası için |
| `ADMIN_KEY` | ≥16 karakter | Yönetim paneli anahtarı; kısa ise sunucu başlamaz |
| `SMS_MODE` | `netgsm` · `webhook` · `dev` · `outbox` | `dev` kodu ekranda gösterir (yalnız test). `outbox`ta SMS gitmez, giriş kapalıdır. |
| `NETGSM_USER` / `NETGSM_PASS` / `NETGSM_HEADER` | | Netgsm abone no, API şifresi, onaylı başlık |
| `SMS_WEBHOOK_URL` | URL | `webhook` modunda `{to, message}` POST edilir |
| `PAYMENT_MODE` | `off` · `demo` | `off`: ücretli telafi gizli. `demo`: ödeme doğrulamadan kabul (yalnız test) |
| `TRUST_PROXY` | `1` | Caddy arkasında gerçek ziyaretçi IP'si (istek sınırlama için) |
| `COMMISSION` | `0.03` | Komisyon oranı |
| `DATA_DIR` | `/data` | Veri klasörü (Docker'da hazır) |

## 6. Docker'sız ya da başka sağlayıcılarla

- **Docker'sız:** Node.js 20+ kur, `ADMIN_KEY=… SMS_MODE=netgsm … TRUST_PROXY=1 node server/server.mjs` komutunu bir `systemd` servisi olarak çalıştır, önüne Caddy ya da Nginx koy.
- **Render / Railway / Fly.io:** `Dockerfile` doğrudan kullanılabilir. Kalıcı disk eklenmeli ve `/data`ya bağlanmalı; disk olmazsa her yeniden başlatmada veriler silinir. HTTPS'i platform verir, Caddy gerekmez; `TRUST_PROXY=1` kalmalı.
- **Başka SMS sağlayıcısı (İleti Merkezi, Mutlucell, Verimor…):** `SMS_MODE=webhook` ve `SMS_WEBHOOK_URL` ile `{to, message}` alan küçük bir ara servis kullanılır ya da `server.mjs` › `sendSms()` içine Netgsm bloğu gibi birkaç satırlık bir blok eklenir.

## 7. Bilinen sınırlar

- Veriler tek JSON dosyasında (atomik yazma + günlük yedek). Tek sunucuda on binlerce kullanıcıya yeter; çok büyürse PostgreSQL'e geçilmeli.
- Tarayıcı push bildirimi için VAPID anahtarları ve gönderim kodu henüz bağlı değil; bildirimler site içinde ve SMS ile gider.
- Reklamlı telafideki reklam alanı yer tutucudur; bir reklam ağı ya da sponsor markayla doldurulmalı.
