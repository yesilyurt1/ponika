# Marka entegrasyonu, komisyon kontrolü ve bildirimler

Bu belge üç okuyucu içindir:
- **Platform sahibi:** %3 komisyonu nasıl kontrol ettiğini anlatır.
- **Markanın yazılım ekibi:** Sitesine hangi çağrıları ekleyeceğini anlatır.
- **Uygulama geliştiricisi:** Sitenin sunucuya nasıl bağlanacağını anlatır.

Kodun tamamı `server/server.mjs` dosyasında, testleri `server/test.mjs` dosyasında. İş kuralları (indirim, telafi, günlük hak) `kurallar.js` içinde; site ve sunucu aynı dosyayı kullanır.

## 1. Akış

```
Kullanıcı logoyu bulur ──► Platform kişiye özel kod verir (ör. CIV-7KQ2MX)
        │                  Kod kampanyanın indirim koşullarını taşır: temel %, barem, yeni üye eki
        ▼
Markanın sitesinde ya da pazaryeri mağazasında ödeme sayfası: kullanıcı kodu girer
        │
        ├─► (1) POST /api/marka/kupon-dogrula  {kod, sepetTutari}
        │       Platform: kod geçerli mi? Geçerliyse indirimi hesaplar ve döner:
        │       sepet 2.000 ₺ → barem %25 + yeni üye %5 = %30 → indirim 600 ₺, ödenecek 1.400 ₺
        ▼
Kullanıcı ödemeyi tamamlar
        │
        └─► (2) POST /api/marka/siparis  {kod, siparisNo, sepetTutari}
                Platform: kodu kullanıldı yapar; %3 komisyonu ÖDENEN tutardan yazar (1.400 ₺ → 42 ₺)
        (İade olursa) → POST /api/marka/iade  Komisyon düşülür.
```

## 2. Komisyonu nasıl kontrol ediyorsun?

| Kontrol | Nasıl çalışır |
|---|---|
| **Kişiye özel, tek kullanımlık kod** | Her kod tek kazanana ve tek siparişe bağlanır; paylaşmak ya da tahmin etmek işe yaramaz. |
| **İndirimi platform hesaplar** | Marka indirimi kendi hesaplamaz, bize sorar. Böylece kampanya koşulları (barem, yeni üye eki) her yerde aynı uygulanır. |
| **Kod yalnızca bizden doğrulanır** | Hangi kodun hangi gün ödeme sayfasına geldiğini biz de görürüz. |
| **"Kontrol edilecek" listesi** | Kasada doğrulanmış ama siparişi bildirilmemiş kodlar. Satışın gizlendiğinin en güçlü işaretidir; ay sonu raporunda ayrı listelenir. |
| **İmzalı istekler** | Her marka isteği markanın gizli anahtarıyla imzalanır (HMAC-SHA256) ve 5 dakika geçerlidir. Başkası marka adına sipariş ya da iade bildiremez. |
| **Tekrar sayılmaz** | Aynı sipariş numarası ikinci kez gelirse komisyon iki kez yazılmaz; başka bir kodla gelirse reddedilir. |
| **İşlem kaydı** | Her doğrulama, sipariş ve iade zaman damgasıyla saklanır; anlaşmazlıkta delil olur. |
| **Aylık rapor ve CSV** | `GET /api/admin/rapor?ay=2026-10` ve `GET /api/admin/kuponlar.csv?ay=2026-10` marka başına sepet, indirim, ödenen tutar, iade ve komisyonu verir. Telafi ödemeleri ve reklam izlenmeleri de raporda. |

> **Sözleşmeye girmesi gerekenler:** Teknik kontrol tek başına yetmez. Sözleşmede şunlar yazmalı:
> - Siparişin 24 saat içinde bildirilmesi zorunluluğu.
> - "Kontrol edilecek" kodlar için sipariş kaydı isteme hakkı.
> - İade bildirim süresi, ödeme vadesi ve bildirilmeyen satış için cezai şart.

### Pazaryeri mağazaları

Marka, web sitesinin yanında pazaryeri mağaza linklerini de (Trendyol, Hepsiburada, Amazon, n11 vb.) kampanyaya ekleyebilir. Bunun için `data.js` içindeki `brandLinks` alanı kullanılır; canlıda bu alan panelden girilir.

Pazaryerlerinde siparişi platforma marka bildiremez, çünkü ödeme sayfası pazaryerine aittir. Kontrol iki yolla yapılır:
1. **Kodları önceden yükleme:** Marka, kişiye özel kodları pazaryerinin satıcı kuponu aracına önceden yükler.
2. **Haftalık mutabakat:** Pazaryeri satıcı panelinden alınan "kupon kullanım raporu" haftalık olarak yüklenir ve kodlar eşleştirilir.

## 3. Platform tarafı: kurulum

```bash
ADMIN_KEY=uzun-rastgele-bir-sifre PORT=8080 node logo-bulma/server/server.mjs
# İsteğe bağlı:
#   SMS_WEBHOOK_URL=https://sms-saglayici/gonder   SMS sağlayıcısının ağ geçidi ({to, message} alır)
#   PAYMENT_MODE=demo                              Ücretli telafiyi ödeme doğrulamadan kabul et (yalnız test)
#   COMMISSION=0.03                                Komisyon oranı
```

Marka için anahtar oluştur. Marka adı, kampanyadaki adla birebir aynı olmalı:

```bash
curl -X POST http://localhost:8080/api/admin/marka \
  -H "X-Admin-Anahtar: uzun-rastgele-bir-sifre" -H "Content-Type: application/json" \
  -d '{"ad":"Civil"}'
# → {"apiAnahtari":"mk_…","gizliAnahtar":"gz_…"}  (bir daha gösterilmez; markaya güvenli kanaldan ilet)
```

Yönetim uç noktaları (`X-Admin-Anahtar` başlığıyla):

| Uç nokta | Ne verir |
|---|---|
| `GET /api/admin/rapor?ay=2026-10` | Aylık hakediş, kontrol listesi, telafi gelirleri |
| `GET /api/admin/kuponlar.csv?ay=2026-10` | Tüm kuponlar Excel'de açılabilir CSV olarak |
| `GET /api/admin/giden-kutusu` | Son 200 SMS/push bildirimi ve hangi kanaldan gittiği |

## 4. Marka tarafı: yapılacak çağrılar

Her isteğe üç başlık eklenir:

| Başlık | Değer |
|---|---|
| `Authorization` | `Bearer <apiAnahtari>` |
| `X-Zaman` | Şu anki Unix zamanı (saniye) |
| `X-Imza` | `hex( HMAC_SHA256( gizliAnahtar, X-Zaman + "." + istek_govdesi ) )` |

Çağrılar **markanın sunucusundan** yapılmalı. Gizli anahtar tarayıcıya ya da mobil uygulamaya konmaz.

### 4.1 Kod doğrulama ve indirim hesabı: kullanıcı kodu girince

`POST /api/marka/kupon-dogrula`

```json
{"kod":"CIV-7KQ2MX","sepetTutari":2000}
```

- `sepetTutari`: Kampanyaya dahil seçili ürünlerin **indirim öncesi** toplamı (TL, KDV dahil). İsteğe bağlıdır; gönderilirse indirim dökümü döner.

Yanıt:

```json
{"gecerli":true,
 "kupon":{"kod":"CIV-7KQ2MX","marka":"Civil","gecerliUrunler":"…","indirim":{"temel":20,"yeniUyeEk":5,"barem":[{"min":1000,"pct":25}]},"sonKullanma":"…"},
 "hesap":{"sepet":2000,"temelYuzde":20,"baremYuzde":25,"yeniUyeYuzde":5,"toplamYuzde":30,"indirim":600,"odenecek":1400}}
```

Hata kodları: `kod_bulunamadi`, `kullanildi`, `suresi_doldu`, `iade`.

### 4.2 Sipariş bildirimi: ödeme tamamlanınca

`POST /api/marka/siparis`

```json
{"kod":"CIV-7KQ2MX","siparisNo":"C-100045","sepetTutari":2000}
```

Yanıt: `{"kaydedildi":true,"tekrar":false,"indirim":600,"odenecek":1400,"komisyon":42}`

- Aynı istek tekrar gelirse (ör. ağ hatasından sonra yeniden deneme) `"tekrar":true` döner ve sipariş ikinci kez sayılmaz.

### 4.3 İade

`POST /api/marka/iade`

```json
{"siparisNo":"C-100045","iadeTutari":400}
```

- `iadeTutari` ödenen tutar üzerinden verilir. Kısmi iadede komisyon kalan tutardan yeniden hesaplanır.
- `iadeTutari` gönderilmezse kalan tutarın tamamı iade sayılır.

### İmza örnekleri

**Node.js**

```js
const ts = Math.floor(Date.now() / 1000), body = JSON.stringify({kod, siparisNo, sepetTutari});
const imza = crypto.createHmac("sha256", process.env.LB_GIZLI).update(`${ts}.${body}`).digest("hex");
await fetch("https://api.1milyonuncumarka.com/api/marka/siparis", {method:"POST", body,
  headers:{"Content-Type":"application/json", Authorization:`Bearer ${process.env.LB_API}`, "X-Zaman":String(ts), "X-Imza":imza}});
```

**PHP**

```php
$ts = time();
$body = json_encode(['kod' => $kod, 'siparisNo' => $siparisNo, 'sepetTutari' => $sepet]);
$imza = hash_hmac('sha256', $ts . '.' . $body, getenv('LB_GIZLI'));
// Başlıklar: Authorization: Bearer <api>, X-Zaman: $ts, X-Imza: $imza, Content-Type: application/json
```

## 5. Uygulama API'si (site ve mobil uygulama için)

Kullanıcı uç noktaları `Authorization: Bearer <token>` ister. Token `POST /api/giris` ile alınır.

| Uç nokta | Görev |
|---|---|
| `POST /api/giris` `{ad, telefon, kvkkOnay}` | Oturum açar. Canlıda araya SMS ile tek kullanımlık kod adımı eklenmeli. |
| `GET /api/kampanyalar` | Tüm kampanyalar: durum, kalan kupon, indirim koşulları, Muhteşem Fırsat işareti, linkler |
| `POST /api/oyun/basla` `{kampanya}` | 30 logoluk tahta gelir (yalnızca anlamsız tokenler). Tek hak ve günlük kupon hakkı burada denetlenir. |
| `POST /api/oyun/sec` `{deneme, token}` | Sonuç ve kupon döner. Kaybedene telafi seçenekleri de döner. |
| `POST /api/reklam/basla` `{deneme}` | Reklamlı telafi için reklam başlar. Sunucu süreyi kendisi ölçer. |
| `POST /api/oyun/telafi` `{deneme, tur, reklamId?, odemeRef?}` | `tur`: `dusuk`, `reklam` ya da `ucretli`. Günde bir kez. |
| `GET /api/kuponlarim` · `GET /api/profil` | Kuponlar; Kazancım (toplam indirim), günlük hak, bildirim ayarları |
| `POST /api/hatirlatma` `{kampanya}` | Hatırlatmayı açar ya da kapatır |
| `POST /api/bildirim-ayarlari` | `{push, sms, before5, onStart, expiry}` |
| `POST /api/push-abonelik` `{abonelik}` | Tarayıcının PushSubscription nesnesini kaydeder |

### Bildirimler

Zamanlayıcı her 30 saniyede çalışır ve üç durumda bildirim gönderir:
- Hatırlatma kurulan kampanyaya **5 dk kala**.
- Kampanya **başladığında**.
- Kuponun bitmesine **1 saat kala**.

Kanallar:
- **SMS:** `SMS_WEBHOOK_URL` tanımlıysa sağlayıcıya gider (Netgsm, İleti Merkezi vb.). Tanımlı değilse mesaj giden kutusuna yazılır. SMS yalnızca KVKK/İYS onayı olan kullanıcıya gönderilir. Canlıda numaranın İYS'de kayıtlı izni de sorgulanmalı.
- **Push:** Tarayıcı aboneliği kaydedilir. Gönderim için VAPID anahtarları üretilmeli ve `web-push` kütüphanesi `deliver()` fonksiyonuna eklenmeli. Mobil uygulamada bu iş Firebase Cloud Messaging ile yapılır. `sw.js` içindeki `push` olayı bildirimi gösterir.

### Telafi kuponu

Kaybeden kullanıcıya üç seçenek sunulur:

| Seçenek | İndirim | Not |
|---|---|---|
| Daha düşük indirimi kabul et | Kampanya oranının %40'ı | Ücretsiz, hemen |
| Reklam izle | %60'ı | Sunucu reklamın 15 saniyesinin dolduğunu doğrular |
| 5 ₺ öde | Tam oran | Ödeme kuruluşu üzerinden |

- Oranlar `data.js` içindeki `telafi` ayarından gelir.
- Telafi kuponu kampanya kontenjanından düşmez.
- **Ücretli seçenek:** `verifyPayment()` adaptörü canlıda iyzico, PayTR gibi bir ödeme kuruluşunun sonucunu sunucudan sorgulamalı. `PAYMENT_MODE=demo` yalnız test içindir.

## 6. Entegre olamayan markalar

Küçük markalar API kuramıyorsa iki seçenek var:

**a) Aylık CSV mutabakatı.** Marka, kullanılan kodları ve tutarları içeren bir dosya gönderir. Platform bunu kendi listesiyle karşılaştırır.
- Bu yöntemde "kasada doğrulandı" bilgisi olmaz; yani satışın gizlenip gizlenmediğini göremezsin.
- O yüzden yalnızca güvenilen markalar için kullanılmalı.

**b) E-ticaret altyapısının eklentisi.** Ticimax, IdeaSoft, T-Soft, Shopify, WooCommerce gibi altyapılar için bir eklenti yazılırsa, bu çağrılar markanın yazılım ekibi olmadan yapılır.
- Çok sayıda markaya hızlı yayılmanın yolu budur.
- Sonraki adım olarak önerilir.

## 7. Canlıya çıkmadan önce

- **Veritabanı:** Veriler şu an tek bir JSON dosyasında. PostgreSQL'e taşınmalı. Kontenjan ve günlük hak sayaçları tek işlemde kilitlenmeli (`SELECT … FOR UPDATE`) ya da Redis'te tutulmalı.
- **Giriş:** SMS ile tek kullanımlık kod adımı eklenmeli (`/api/giris` içinde işaretli yer).
- **Bağlantılar:** SMS sağlayıcısı, ödeme kuruluşu ve Web Push için VAPID anahtarları bağlanmalı.
- **Güvenlik:** HTTPS ve istek sınırlama (rate limit) gerekli. Gizli anahtarlar bir anahtar kasasında saklanmalı.
- **Site–sunucu bağlantısı:** Site şu an veriyi tarayıcıda tutuyor. `app.js` içindeki `Api` bölümü bu belgedeki uç noktalara bağlanmalı; kurallar iki tarafta zaten aynı.
