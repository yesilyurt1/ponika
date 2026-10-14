# Marka entegrasyonu ve komisyon kontrolü

Bu belge iki okuyucu içindir:
- **Platform sahibi:** %3 komisyonu nasıl kontrol ettiğini anlatır.
- **Markanın yazılım ekibi:** Sitesine hangi iki çağrıyı ekleyeceğini anlatır.

Kodun tamamı `server/server.mjs` dosyasında, testleri `server/test.mjs` dosyasında.

## 1. Akış

```
Kullanıcı logoyu bulur ──► Platform kişiye özel kod verir (ör. CIV-7KQ2MX, 24 saat geçerli)
        │
        ▼
Markanın sitesinde ödeme sayfası: kullanıcı kodu girer
        │
        ├─► (1) Marka sitesi → POST /api/marka/kupon-dogrula   "Bu kod geçerli mi?"
        │       Platform: geçerliyse indirimi onaylar ve "kasada doğrulandı" olarak kaydeder.
        ▼
Kullanıcı ödemeyi tamamlar
        │
        └─► (2) Marka sitesi → POST /api/marka/siparis          "Sipariş no + tutar"
                Platform: kodu kullanıldı yapar, %3 komisyonu yazar.
        (İade olursa) → POST /api/marka/iade                     Komisyon düşülür.
```

## 2. Komisyonu nasıl kontrol ediyorsun?

| Kontrol | Nasıl çalışır |
|---|---|
| **Kişiye özel, tek kullanımlık kod** | Her kod tek kazanana ve tek siparişe bağlanır. Kodu tahmin etmek ya da sosyal medyada paylaşmak işe yaramaz. |
| **Kod yalnızca bizden doğrulanır** | Markanın sitesi kodun geçerli olup olmadığını bilemez; mutlaka bize sorar. Böylece hangi kodun hangi gün ödeme sayfasına geldiğini biz de görürüz. |
| **"Kontrol edilecek" listesi** | Kasada doğrulanmış ama siparişi bildirilmemiş kodlar. Bu, satışın gizlendiğinin en güçlü işaretidir. Ay sonu raporunda ayrı listelenir. |
| **İmzalı istekler** | Her marka isteği markanın gizli anahtarıyla imzalanır (HMAC-SHA256) ve 5 dakika geçerlidir. Başkası marka adına sahte sipariş ya da sahte iade bildiremez. |
| **Tekrar sayılmaz** | Aynı sipariş numarası ikinci kez gelirse komisyon iki kez yazılmaz. Başka bir kodla gelirse reddedilir. |
| **İşlem kaydı** | Her doğrulama, sipariş ve iade çağrısı zaman damgasıyla saklanır; anlaşmazlıkta delil olur. |
| **Aylık rapor ve CSV** | `GET /api/admin/rapor?ay=2026-10` ve `GET /api/admin/kuponlar.csv?ay=2026-10`. Marka başına kupon, doğrulama, sipariş, ciro, iade ve komisyon toplamı verir. Fatura bu rapora göre kesilir. |

> Teknik kontrol tek başına yetmez. Sözleşmeye de şunlar girmeli:
> - Siparişin 24 saat içinde bildirilmesi zorunluluğu
> - Platformun kodla gelen siparişleri denetleme hakkı (ör. "kontrol edilecek" kodlar için sipariş kaydı isteme)
> - İadelerin bildirilme süresi
> - Ödeme vadesi
> - Bildirilmeyen satış için cezai şart

## 3. Platform tarafı: kurulum

```bash
ADMIN_KEY=uzun-rastgele-bir-sifre PORT=8080 node logo-bulma/server/server.mjs
```

Marka için anahtar oluştur. Marka adı, kampanyadaki adla birebir aynı olmalı:

```bash
curl -X POST http://localhost:8080/api/admin/marka \
  -H "X-Admin-Anahtar: uzun-rastgele-bir-sifre" -H "Content-Type: application/json" \
  -d '{"ad":"Civil"}'
# → {"apiAnahtari":"mk_…","gizliAnahtar":"gz_…"}  (bir daha gösterilmez; markaya güvenli kanaldan ilet)
```

Aylık hakediş:

```bash
curl "http://localhost:8080/api/admin/rapor?ay=2026-10" -H "X-Admin-Anahtar: uzun-rastgele-bir-sifre"
```

## 4. Marka tarafı: yapılacak iki çağrı

Her isteğe üç başlık eklenir:

| Başlık | Değer |
|---|---|
| `Authorization` | `Bearer <apiAnahtari>` |
| `X-Zaman` | Şu anki Unix zamanı (saniye) |
| `X-Imza` | `hex( HMAC_SHA256( gizliAnahtar, X-Zaman + "." + istek_govdesi ) )` |

Çağrılar **markanın sunucusundan** yapılmalı. Gizli anahtar tarayıcıya ya da mobil uygulamaya konmaz.

### 4.1 Kod doğrulama: kullanıcı ödeme sayfasında kodu girince

`POST /api/marka/kupon-dogrula` gövde: `{"kod":"CIV-7KQ2MX"}`

```json
{"gecerli":true,"kupon":{"kod":"CIV-7KQ2MX","marka":"Civil","kampanyaMetni":"…","sonKullanma":"2026-10-15T12:00:00.000Z"}}
{"gecerli":false,"hata":"kullanildi","mesaj":"Kod daha önce kullanılmış."}
```

Hata kodları: `kod_bulunamadi`, `kullanildi`, `suresi_doldu`, `iade`.

### 4.2 Sipariş bildirimi: ödeme başarıyla tamamlanınca

`POST /api/marka/siparis` gövde:

```json
{"kod":"CIV-7KQ2MX","siparisNo":"C-100045","tutar":1249.90}
```

- `tutar`: Müşterinin ödediği tutar (TL, KDV dahil, indirim sonrası).
- Yanıt: `{"kaydedildi":true,"tekrar":false,"komisyon":37.5}`
- Aynı istek tekrar gönderilirse (ağ hatasında yeniden deneme gibi) `"tekrar":true` döner ve ikinci kez sayılmaz.

### 4.3 İade

`POST /api/marka/iade` gövde: `{"siparisNo":"C-100045","iadeTutari":400}`

- Kısmi iadede komisyon kalan tutar üzerinden yeniden hesaplanır.
- `iadeTutari` gönderilmezse siparişin tamamı iade sayılır.

### İmza örnekleri

**Node.js**

```js
const ts = Math.floor(Date.now() / 1000), body = JSON.stringify({kod, siparisNo, tutar});
const imza = crypto.createHmac("sha256", process.env.LB_GIZLI).update(`${ts}.${body}`).digest("hex");
await fetch("https://api.1milyonuncumarka.com/api/marka/siparis", {method:"POST", body,
  headers:{"Content-Type":"application/json", Authorization:`Bearer ${process.env.LB_API}`, "X-Zaman":String(ts), "X-Imza":imza}});
```

**PHP**

```php
$ts = time();
$body = json_encode(['kod' => $kod, 'siparisNo' => $siparisNo, 'tutar' => $tutar]);
$imza = hash_hmac('sha256', $ts . '.' . $body, getenv('LB_GIZLI'));
// Başlıklar: Authorization: Bearer <api>, X-Zaman: $ts, X-Imza: $imza, Content-Type: application/json
```

## 5. Entegre olamayan markalar

Küçük markalar API kuramıyorsa iki seçenek var:

**a) Aylık CSV mutabakatı.** Marka, kullanılan kodları ve sipariş tutarlarını içeren bir dosya gönderir. Platform bunu kendi listesiyle karşılaştırır.
- Bu yöntemde "kasada doğrulandı" bilgisi olmaz; yani satışın gizlenip gizlenmediğini göremezsin.
- O yüzden yalnızca güvenilen markalar için kullanılmalı.

**b) E-ticaret altyapısının eklentisi.** Ticimax, IdeaSoft, T-Soft, Shopify, WooCommerce gibi altyapılar için bir eklenti yazılırsa, bu iki çağrı markanın yazılım ekibi olmadan yapılır.
- Çok sayıda markaya hızlı yayılmanın yolu budur.
- Bir sonraki geliştirme adımı olarak önerilir.

## 6. Canlıya çıkmadan önce

- **Veritabanı:** Veriler şu an tek bir JSON dosyasında. PostgreSQL'e taşınmalı; kontenjan sayacı için tek işlemde kilit (`SELECT … FOR UPDATE`) ya da Redis kullanılmalı.
- **SMS doğrulama:** Giriş için SMS doğrulaması eklenmeli (`/api/giris` içinde işaretli yer).
- **Güvenli bağlantı ve sınırlar:** HTTPS ve istek sınırlama (rate limit) gerekli. Gizli anahtarlar bir anahtar kasasında saklanmalı.
- **Site–sunucu bağlantısı:** Site şu an veriyi tarayıcıda tutuyor. `app.js` içindeki `Api` bölümü bu sunucunun uç noktalarına bağlanmalı; kurallar ikisinde de aynı.
