# 1 Milyonuncu Marka: `logo_bulma.xlsx` analizi

Bu belge Excel'deki fikri inceler. Verideki hataları, eksik kuralları ve sitenin sorunsuz çalışması için yapılması gerekenleri listeler. Aynı klasördeki prototip (`index.html`) bu analizdeki kararlarla çalışır.

## 0. Verilen kararlar

| Konu | Karar | Uygulama |
|---|---|---|
| Deneme hakkı | Her kampanyada kişi başı **tek hak** | Yanlış logo, süre dolması ya da oyundan çıkmak hakkı bitirir |
| Kupon kodu | **Kişiye özel, tek kullanımlık** | `CIV-7KQ2MX` biçiminde; prototipte `DEMO-` ön ekli |
| %3 komisyon | Markanın sitesinde kullanılan kodu kontrol edebilmek | Markanın sitesi kodu bizden doğrular ve siparişi imzalı istekle bildirir. Ayrıntılar `ENTEGRASYON.md`'de, kod `server/` klasöründe. |
| Logolar | Orijinal logolar kullanılacak, hukuki süreç platformda | Marka kütüphanesi `markalar.js` (1.208 marka). Logo dosyaları `tools/logo-indir.mjs` ile toplanır. |
| Oyun tahtası | Kategoride çok marka var | Her oyunda havuzdan rastgele **30 logo** gelir, hedef her zaman içindedir (2. turda 24'ten 30'a çıktı) |

### Marka kütüphanesi
Hedef kategori başına 200 bilinen markaydı. Yalnızca Türkiye'de bilinen, var olduğu kesin markalar yazıldı; sayıyı doldurmak için uydurma marka eklenmedi.

| Kategori | Marka sayısı | Not |
|---|---|---|
| Giyim | 146 | |
| Ayakkabı | 104 | |
| Ev Tekstil | 78 | |
| Elektronik | 120 | |
| Gözlük | 72 | |
| Çanta | 72 | |
| Süpermarket | 176 | Zincirler ve market ürünü markaları birlikte |
| Saat | 82 | |
| Bijuteri | 40 | |
| Kozmetik | 146 | |
| Çiçek | 5 | Sektör çoğunlukla yerel çiçekçilerden oluşuyor; bölgesel çiçekçi ortaklığı gerekir |
| Yemek | 53 | |
| Sağlık | 62 | İlaçlar çıkarıldı: Türkiye'de ilaç reklamı ve indirimi kısıtlıdır |
| Cafe / Hastane vb. | 52 | |
| Büyük Fırsat | – | Sektör değil; tüm kategorilerin logolarını kullanır |

- **Listeyi markalar onaylamalı.** Liste markalarla sözleşme yapıldıkça güncellenmeli. Oyunda bir logonun çeldirici olarak görünmesi de o markanın logosunu kullanmak demektir.
- **Logo dosyaları henüz yok.** Bu çalışma ortamının ağ politikası logo servislerine erişimi kapattığı için indirilemedi. Ağ açılınca `LOGO_DEV_TOKEN=… node tools/logo-indir.mjs` alan adı bilinen markaların logolarını indirir. Markanın kendi verdiği dosyalar `logos/elle/` klasörüne konur. Eksik kalanlar `logos/eksik.csv` dosyasına yazılır.

## 0.1 İkinci tur kararları ve uygulaması

| İstek | Uygulama |
|---|---|
| Canlı, hareketli, göz alıcı tasarım | Gece neonu teması: koyu zemin, pembe→turuncu→sarı geçişler, kategori başına renk ve SVG ikon, kayan marka şeridi, canlı nabız rozetleri, parlayan CTA'lar, kazanınca konfeti. Açık tema da aynı canlılıkta. Hareket azaltma ayarı açık olanlarda animasyonlar kapanır. |
| Oyun kuralları pop-up / detay sayfası; Detay ve Başla yan yana | Her kartta **Detay** ve **Başla** yan yana. Başla'ya basınca kurallar penceresi açılır, "Hazırım"dan sonra 3-2-1 sayılır. Detay sayfasında kampanya koşulları ve oyun kuralları ayrı ayrı yazılı. |
| Tüm kategorileri aktif et; her kategoride en az 300 logo | 15 kategorinin hepsinde 24 saatlik program var (375 kampanya). Her kategorinin oyun havuzu en az 300 logo. Kategoride 300 bilinen marka yoksa havuz uydurma isimle değil, diğer sektörlerin gerçek markalarıyla tamamlanır. "Jack Jones" / "Jack & Jones" gibi ikiz yazımlar tek marka sayılır. |
| Tüm ekranları kontrol et | Android 360, iPhone 390, iPhone SE 375, tablet 768 ve masaüstü 1440 genişliğinde, açık ve koyu temada 8 sayfa otomatik test edilir. Telefonda alt menüyle uygulama gibi çalışır, ana ekrana yüklenebilir (PWA). |
| Kuponları kaydet, zamanı gelince push/SMS | Yaklaşan kampanyada **Hatırlat**: 5 dk kala ve başladığında bildirim. Kupon bitmeden 1 saat önce de bildirim gelir. Bildirim merkezi (zil) ve profilde kanal ayarları var. Sunucuda SMS sağlayıcısına bağlanan zamanlayıcı hazır (`ENTEGRASYON.md` §5). |
| Profilin yanındaki sayaç | Türkiye saatini gösteriyordu. Artık **"Sıradaki 16:00 · 00:12:34"** biçiminde, bir sonraki saat başı kampanyalarına kalan süreyi gösteriyor. |
| Başlangıç ve bitiş sayaçları; her kategoriden bir aktif kampanya | Yaklaşan kartlarda "Başlamasına", canlılarda "Bitmesine" sayacı ve ilerleme çubuğu var. Her kategoride günün her saati açık bir demo kampanya bulunuyor (Giyim: Civil). |
| Muhteşem Fırsat | Büyük Fırsat kategorisinde (demo + 12:00 ve 20:00). Ana sayfada fosforlu sarı-yeşil, hareketli çizgili şeritte gösterilir. Oyunda tüm logolar bordo/siyah ve aynı yazı tipinde; koşullarda ve kurallar penceresinde bu açıkça yazılı. |
| Filtreler | Aktif, Yaklaşan, Kazandıklarım, Kazanamadıklarım, Sona eren, Hatırlatmalarım + kategori çipleri. Liste 24'erli sayfalanır. |
| Çoklu indirim koşulu | Her kampanyada temel oran + **yeni üye eki** (ilk kuponda +%5) + **tutar baremi** (ör. 1.000 ₺ üstü %25, 2.500 ₺ üstü %30). Marka kasasında döküm gösterilir. Komisyon indirim sonrası ödenen tutardan hesaplanır. |
| Telafi kuponu | Kaybedene üç seçenek: daha düşük indirim (ücretsiz), reklam izle (15 sn), 5 ₺ öde (tam indirim). Günde bir kez; kontenjandan düşmez. |
| Kazancım | Profilde toplam kazanılan indirim tutarı, kupon sayıları ve alışveriş toplamı. Telefonda alt menüde "Kazancım" sekmesi. |
| Günlük bir kupon hakkı | Bir kupon kazanınca o gün diğer kampanyaların Başla düğmesi kilitlenir; hak gece yarısı yenilenir. |
| Nasıl çalışır ve kupon metinleri | İstenen metinlerle güncellendi (kampanya süresi, kupon sayısı, günlük hak, pazaryeri linkleri, seçili ürünler). |

### Dikkat edilmesi gereken yeni riskler
- **Ücretli telafi:** Para ödeyip kupon almak bir satıştır, şans oyunu değildir; ödeme ve iade koşulları Mesafeli Satışlar Yönetmeliği'ne uygun yazılmalı. Ödeme bir ödeme kuruluşu (iyzico, PayTR vb.) üzerinden alınmalı.
- **Reklamlı telafi:** Reklam envanteri bir reklam ağı (ör. Google Ad Manager) ya da markaların sponsorluğuyla doldurulur. Prototipteki reklam ekranı yer tutucudur.
- **SMS:** Ticari SMS için İYS'de alıcı onayı şart. Kayıt formundaki onay metni bunu kapsıyor, ama gönderimden önce İYS sorgusu da yapılmalı.
- **Günlük tek kupon:** Kullanıcı birden fazla hesap açarak bu kuralı aşmaya çalışabilir. Telefonla SMS doğrulaması bu yüzden canlıda zorunlu.

## 0.2 Bu tarzda bir site var mı?

Yapılan aramada **saat başı marka kampanyası + logoyu 5 saniyede bulma + kontenjanlı kişiye özel kupon** birleşimini yapan bir site ya da uygulama bulunamadı. Fikrin parçaları ayrı ayrı var:

| Örnek | Benzerlik | Fark |
|---|---|---|
| Trendyol "Kazandıran Çark" | Her gün belli bir saatte (20:00) oyunla kupon kazanma | Şansa dayalı çark; beceri yok, tek marka (Trendyol) |
| Trendyol "Her Gün Gel Kazan" | Günlük ziyaretle kupon | Oyun yok |
| Temo | Çark çevirerek kupon | Şansa dayalı |
| Kazan Kazan | Oyun oynayıp puan toplayıp 200'den fazla markada harcama | Puan sistemi; anlık marka kampanyası yok |
| Logo Logo (eski mobil oyun) | Logo tahmin oyunu | Ödül/kupon yok |
| Liquid Barcodes "gamified couponing" | Süre ve adet sınırlı, oyunlaştırılmış kuponlar (markalara satılan altyapı) | Tüketiciye dönük bir platform değil, markanın kendi uygulamasına kurulan araç |
| Shopify/Wix/WooCommerce kupon oyunları (XOX, hafıza kartı) | Oyunu kazanana indirim kodu | Tek mağazanın kendi sitesinde; çok markalı, saat başı yarış yok |

**Değerlendirme:**
- Türkiye'de oyunla kupon veren örnekler hep tek bir pazaryerinin içinde ve **şansa** dayalı.
- "Çok markalı, saat başı, beceriye dayalı, kontenjanlı" kurgu farklılaşma noktası.
- Beceriye dayalı olması, çekiliş mevzuatı açısından da şans oyunlarından daha savunulabilir bir konum sağlar (yine de hukuk görüşü alınmalı).

Kaynaklar: [Hürriyet – Trendyol Kazandıran Çark](https://www.hurriyet.com.tr/advertorial/trendyol-musterilerinin-hep-yaninda-42174479), [Kazan Kazan](https://www.tamindir.com/indir/kazan-kazan/amp/), [Logo Logo](https://www.tamindir.com/indir/logo-logo/), [Liquid Barcodes](https://liquidbarcodes.com/platform/gamification/gamified-couponing), [BL Discount Coupon Code Game (Shopify)](https://apps.shopify.com/bl-discount-coupon-code-game), [Coupontools](https://www.coupontools.com/en/digital-catch-game-coupons)

## 1. Fikrin özeti (Excel'den)

| Konu | Excel'deki kural |
|---|---|
| Kategoriler | 15 kategori: Giyim, Ayakkabı, Ev Tekstil, Elektronik, Gözlük, Çanta, Süpermarket, Saat, Bijuteri, Kozmetik, Çiçek, Yemek, Sağlık, Cafe/Hastane vb., Büyük Fırsat |
| Kampanya saati | Her kategoride her saat başı (00:00–23:00) bir marka kampanyası açılır |
| Oyun | Kullanıcı, hedef markanın logosunu **5 saniye** içinde bulursa kuponu kazanır |
| Kontenjan | Her kampanya 5 / 10 / 15 / 20 / 50 kişi ile sınırlıdır; dolunca otomatik kapanır |
| Kampanya süresi | 10–30 dakika; bitince ana sayfadan kalkar, kategoride de kapanır |
| Kupon | Kazanınca ekranda kopyalanabilir kod çıkar; "Kuponlarım"a kaydedilir; **24 saat** geçerlidir |
| Kullanım | Kullanıcı markanın sitesinde kampanyalı üründe kodu girer |
| Gelir | Kupon başına satış fiyatının **%3**'ü platform komisyonu |
| Takip | UTM verisi ve kupon takip ekranı |
| Logo duvarı | Kategoriye girince o sektördeki tüm logolar ekranda olmalı |

**Sayılarla (yalnızca dolu 3 kategori):** 72 kampanya, günde **1.860 kupon** (kategori başına 620). 15 kategori dolduğunda bu sayı günde yaklaşık 9.300 kupona çıkar.

## 2. Veride bulunan hatalar ve tutarsızlıklar

### 2.1 Çelişen kontenjanlar (karar gerekiyor)
| Hücre | Metin | "Kişi Sayısı" sütunu | Prototipte |
|---|---|---|---|
| D4 (Giyim 00:00, LCW) | "bulan **ilk kişiye**" | **5** | 5 kişi; metinden sayı kaldırıldı |
| D6 (Giyim 02:00, Defacto) | "**20** kişi ile sınırlıdır" | **15** | 15 kişi; metinden sayı kaldırıldı |

**Öneri:** Kontenjanı yalnızca sayı sütunu belirlesin. Kampanya metnine sayı yazılmasın; site metni sayıdan kendisi üretsin. Böylece bu tür çelişkiler bir daha oluşmaz.

### 2.2 Kampanya detayı eksik
- Kampanya metni (ürün + indirim oranı) yalnızca **4 kampanyada** var: Giyim 00:00–03:00. Kalan **68 kampanyada** yalnızca marka adı yazıyor. Hangi ürün, yüzde kaç indirim, alt limit var mı, bilinmiyor.
- Giyim 04:00'teki "Koton" hücresi diğer satırlardaki gibi kampanya metni değil, sadece marka adı.
- Prototip eksik olanları "Sürpriz indirim (detay markayla netleşecek)" olarak gösteriyor.

### 2.3 Boş kategoriler
- 15 kategoriden **12'sinde hiç veri yok**: Elektronik, Gözlük, Çanta, Süpermarket, Saat, Bijuteri, Kozmetik, Çiçek, Yemek, Sağlık, Cafe/Hastane vb., Büyük Fırsat.
- "Büyük Fırsat" sütununda (AC4–AC25) yalnızca "Logo" yer tutucusu var. Bu sütun 22 satır, saatlik tablo ise 24 satır.
- "Cafe / Hastane vb." birbirinden çok farklı iki sektörü birleştiriyor. "Cafe & Restoran" ve "Sağlık hizmetleri" gibi ayrılmalı ya da kapsamı tanımlanmalı.
- Prototip bu kategorileri "Yakında" olarak gösteriyor.

### 2.4 Aynı gün tekrar eden markalar
- **Ev Tekstil:** English Home (00:00 ve 21:00), Madame Coco (01:00 ve 22:00), Karaca (02:00 ve 23:00). Son 3 saat, ilk 3 saatin kopyası gibi duruyor. Bu yüzden kategoride 24 değil 21 farklı marka var.
- **Kategoriler arası:** Adidas (Giyim 10:00 ve Ayakkabı 02:00), Hummel (Giyim 17:00 ve Ayakkabı 03:00), U.S. Polo (Giyim 20:00 ve Ayakkabı 22:00).
- Tekrar bilinçli olabilir. Bilinçli değilse 3 yeni Ev Tekstil markası gerekir.

### 2.5 Logo duvarı tablosu (B45:F69) hatalı
- Logo listesi olması gereken alana **kampanya cümleleri** kopyalanmış (ör. "Fabrika Markasından Elbise %50 İndirimli…").
- 120 hücrede yalnızca 26 farklı değer var. Aynı markalar defalarca tekrar ediyor: Adidas 10 kez, Madmext 7 kez, Mavi / Jack Jones / Buratti / Lela / Damat 6'şar kez.
- 00:00 kampanyasının hedefi olan **LC Waikiki ve Fabrika logo duvarında hiç yok.** Oyunda hedef logo ekranda yoksa kimse kazanamaz.
- **Kural önerisi:** Oyun ekranındaki logo duvarı = kategorinin tüm markaları, **her marka bir kez**, hedef marka mutlaka içinde. Aynı logo iki kez olursa "hangisine tıkladım" tartışması çıkar. Prototip duvarı otomatik olarak saatlik tablodaki benzersiz markalardan üretir (Giyim 24, Ayakkabı 24, Ev Tekstil 21 logo).

### 2.6 Yazım hataları ve doğrulanması gereken marka adları
- **Başlıklar:** "Kampnaya Süresi" → Kampanya Süresi; "İndiriml" → İndirimli; "sınırlıdıri" → sınırlıdır; "açlır" → açılır; "olmasu" → olması; "belirtien" → belirtilen; "kampnayaları" → kampanyaları.
- **Prototipte düzeltilenler:** "Penolope" → Penelope, "NewBalance" → New Balance, "Us Polo" → U.S. Polo Assn., "Lcw" → LC Waikiki.
- **Kontrol edilmeli:**
  - "D1ffrence": markanın resmi yazımı doğrulanmalı.
  - "Daxtors", "Muggo", "Ceyo", "Limoya", "Marjin", "Gezer", "Ziya": marka sahibinin resmi adı ve logosu teyit edilmeli.
  - "Cat" (Caterpillar), "Harley" (Harley-Davidson): resmi marka adıyla yazılmalı.
  - "Noname" (Ev Tekstil 08:00): Gerçek bir marka mı, yoksa B30'daki "noname ve A brand" notundan kalan bir yer tutucu mu?
- **İsim tutarsızlığı:** Platformun adı B2'de "1 Milyonuncu Marka", B37'de "1 Milyon Logo" olarak geçiyor. Tek bir isim seçilmeli; alan adı ve marka tescili buna göre yapılmalı.
- "LCW **Banner**ını bulan" ifadesi: Oyunun konusu banner mı, logo mu? Tüm kurallar logo dediği için prototip logo kullanır.

### 2.7 Zaman tablosu
- Kampanya süreleri 10–30 dakika, hepsi 60 dakikadan kısa. Aynı kategoride kampanyalar çakışmıyor (doğru).
- Gece 00:00–05:59 arası 6 kampanya × 3 kategori var. Bu saatlerde trafik düşük olacağı için kontenjan dolmayabilir; marka açısından düşük görünürlük demek. Gece saatlerini daha uzun süre ya da daha az kampanya ile planlamak düşünülebilir.
- Tüm kategoriler aynı dakikada açılıyor; bir kullanıcı aynı anda tek oyuna odaklanır. Kategorileri birkaç dakika kaydırmak (Giyim :00, Ayakkabı :05, Ev Tekstil :10 …) aynı kullanıcının birden fazla kampanyaya katılmasını sağlar ve sunucu yükünü yayar.

## 3. Excel'de tanımlı olmayan ama sitenin çalışması için şart olan kurallar

Prototipte aşağıdaki kararlar uygulandı. Hepsi değiştirilebilir, ama **mutlaka bir karar verilmeli**:

1. **Deneme hakkı:** Kampanya başına kullanıcı başına **tek hak**. Yanlış logo, süre dolması ya da oyun sırasında sayfadan çıkmak hakkı bitirir. Aksi halde sırayla tüm logolara tıklayan herkes kazanır.
2. **5 saniye ne zaman başlar:** "Başla" düğmesine basılıp logolar ekrana geldiği anda. Süre **sunucuda** ölçülmeli; ağ gecikmesi için küçük bir pay (prototipte 0,3 sn) verilmeli.
3. **"İlk N kişi" tanımı:** Logoyu süre içinde doğru bulan **ilk N kişi**, sunucunun onay sırasına göre. Aynı anda gelen son tıklamalar için kural tanımlanmalı. Prototipte: kontenjan doluysa "Kontenjan doldu" mesajı gösterilir.
4. **Hedef logo:** Hedef marka kampanya kartında önceden duyurulur. Zorluk, logoyu karışık duvarda bulmaktır. Logo sırası **her denemede yeniden karıştırılır**; konumu paylaşmak işe yaramaz.
5. **Kupon kodu kişiye özel ve tek kullanımlık** olmalı (ör. `LCW-7KQ2MX`). Herkese aynı kod verilirse kod sosyal medyada yayılır. Hem kontenjan anlamsızlaşır hem de komisyon takibi yapılamaz.
6. **24 saat:** Kuponun kazanıldığı andan itibaren 24 saat. Süresi dolan kupon "Süresi doldu" olarak görünür ve kullanılamaz.
7. **Giriş zorunlu:** Kuponlar hesaba bağlıdır. Çoklu hesapla hile yapmayı önlemek için **telefon + SMS doğrulama** gerekir (prototipte SMS yok).
8. **Saat dilimi:** Tüm saatler Türkiye saati (Europe/Istanbul). Kullanıcının cihaz saati kullanılmamalı.

## 4. İş modeli ve hukuk riskleri

### 4.1 %3 komisyon nasıl tahsil edilecek?
Excel'e göre komisyon "müşterinin yaptığı ödemeden kesilerek" platforma aktarılıyor. Ancak ödeme **markanın sitesinde** yapılıyor; platformun bu ödemeye erişimi yok. Uygulanabilir yollar:
- **Affiliate / performans pazarlaması:** Marka, sipariş bilgisini (kupon kodu + tutar) platforma bir postback veya webhook ile bildirir. Platform ay sonunda markaya %3 fatura keser. Bunun için markayla **sözleşme** ve **sipariş bildirimi entegrasyonu** gerekir.
- **Affiliate ağı:** Admitad, Gelirortaklari vb. üzerinden; bu ağlarla zaten çalışan markalar için en hızlı yol.
- Kişiye özel kupon kodu sayesinde hangi siparişin platformdan geldiği kesin olarak eşleşir. UTM tek başına yeterli değildir: kullanıcı linke tıklamadan kodu girebilir.
- Prototipteki "Kupon takip" ekranı bu akışı taklit eder: marka bildirince satış tutarı girilir, %3 komisyon hesaplanır, CSV alınır.

### 4.2 Hukuki kontrol listesi (bir avukata danışılmalı)
- **Marka/logo kullanımı:** Bir markanın logosunu izinsiz kullanmak marka hakkı ihlali riskidir. Yalnızca **sözleşme yapılan markalar** oyunda yer almalı. "Tüm bilinen markaların logosu olmalı" kuralı (B30) bu nedenle risklidir; çeldirici logolar için de izin gerekir.
- **Çekiliş / şans oyunu mevzuatı:** Ödül şansa değil beceriye (5 saniyede bulma) bağlı olduğu için genelde çekiliş sayılmaz. Yine de Milli Piyango İdaresi düzenlemeleri açısından görüş alınmalı.
- **KVKK:** Aydınlatma metni, açık rıza, çerez onayı (UTM ve analitik için) ve veri saklama süresi.
- **İYS:** SMS ve e-posta ile kampanya bildirimi gönderilecekse İleti Yönetim Sistemi kaydı ve onayı gerekir.
- **Tüketici mevzuatı:** Kampanya koşulları (kontenjan, süre, ürün, alt limit) açıkça yazılmalı. Excel'de bu koşullar çoğu kampanyada eksik.

## 5. Hile ve teknik riskler

| Risk | Önlem |
|---|---|
| Bot / otomatik tıklayıcı | Süre ve doğruluk sunucuda kontrol edilir. Logolar resim olarak ve anlamsız kimliklerle gönderilir (marka adı HTML'de yazmaz). Çok hızlı tepkiler (ör. < 300 ms) şüpheli olarak işaretlenir. Gerekirse CAPTCHA kullanılır. |
| Çoklu hesap | Telefon + SMS doğrulama; cihaz ve IP sınırları |
| Kod paylaşımı | Kişiye özel, tek kullanımlık kod; marka tarafında doğrulama |
| Saat başı ani trafik | Kampanyalar saat başında aynı anda açılır, yük ani olarak gelir. Statik içerik CDN'den sunulmalı; kontenjan sayacı atomik olmalı (Redis `DECR` veya veritabanı kilidi). Kontenjanın aşılmaması için verilen kupon sayısı tek bir işlemde kontrol edilmeli. |
| Saat oynatma | Kullanıcı cihaz saatini değiştirse de bir şey değişmez; saat sunucudan gelir. |
| Marka stoku | Kontenjan, markanın kampanya stoğuyla eşleşmeli. Kupon 24 saat geçerliyken stok biterse ne olacağı sözleşmede yazmalı. |

## 6. Önerilen geliştirmeler (öncelik sırasıyla)

1. **Veri temizliği:** Bölüm 2'deki hataları düzeltip her kampanya için ürün, indirim oranı, alt limit, marka linki ve logo dosyasını içeren tek bir tablo hazırlamak. Bu tablo yönetim panelinden girilebilir hale gelmeli.
2. **Sunucu (backend):** Prototipteki `Api` bölümünü gerçek bir sunucuya taşımak. Önerilen yapı: Node.js/NestJS veya Laravel + PostgreSQL + Redis. Aynı kurallar zaten kodda tanımlı.
3. **SMS doğrulamalı üyelik** (Netgsm, İleti Merkezi vb.).
4. **Marka paneli:** Markalar kendi kampanyalarını, kupon kullanımlarını ve faturalarını görsün.
5. **Bildirimler:** "Takip ettiğin kategoride kampanya 5 dk sonra başlıyor" (web push / SMS, İYS onaylı).
6. **Gerçek logolar:** Lisanslı SVG/PNG logolar. Prototipteki renkli yazı rozetleri yalnızca yer tutucudur.
7. **Analitik:** Kampanya başına görüntülenme → oyuna başlama → kazanma → linke tıklama → satın alma hunisi.
8. **Ana sayfada geri sayım ve bildirim izni:** Kullanıcıyı saat başına geri getiren asıl mekanizma.

## 7. Prototipte neler var?

- **Kampanyalar:** 15 kategoride Türkiye saatine göre saat başı açılan 375 kampanya. Süre ya da kontenjan dolunca otomatik kapanır. Her kategoride her saat açık bir demo kampanya var.
- **Ana sayfa:**
  - Hareketli giriş bölümü, sıradaki kampanyalara büyük geri sayım, kayan marka şeridi.
  - Muhteşem Fırsat şeridi.
  - Kategori çipleri ve 6 durum filtresi.
- **Kampanya kartı ve detay:**
  - Başlangıç ya da bitiş sayacı, kalan kupon.
  - Detay + Başla yan yana; Hatırlat, Kuponu gör, Telafi al düğmeleri.
  - Detay sayfasında indirim koşulları, pazaryeri linkleri ve oyun kuralları.
- **Oyun:**
  - Kurallar penceresi → 3-2-1 → 30 logoluk tam ekran tahta ve 5 sn sayaç.
  - Muhteşem Fırsat'ta bordo-siyah tahta.
  - Kazanınca konfeti; kaybedince telafi seçenekleri.
- **Kupon:**
  - Kişiye özel kod ve kopyalama; temel + barem + yeni üye indirimi.
  - Kampanyaya göre kullanım süresi; web sitesi ve pazaryeri linkleri (UTM'li).
  - Kuponlarım sekmeleri: Aktif, Kullanılan, Süresi dolan.
- **Profil:** Kazancım (toplam indirim), günlük hak, hatırlatmalar, bildirim ayarları, uygulamayı yükle.
- **Bildirimler:** Zil ile açılan bildirim merkezi. 5 dk kala, başladı ve kupon bitiyor bildirimleri; tarayıcı bildirimi ve SMS (demo).
- **Marka kasası (demo):** Kodu doğrulama, indirim dökümü, sipariş ve komisyon.
- **Kupon takip paneli:** Hakediş, kontrol listesi, iade, telafi gelirleri, reklam izlenme, CSV.
- **Sunucu (`server/`):** Bu kuralların hepsi, imzalı marka API'si ve SMS/push zamanlayıcısı.
- **Test:** Sunucuda 12, sitede 63 otomatik kontrol; 5 ekran boyutu ve açık/koyu tema.

**Prototipin sınırları:**
- **Veriler tarayıcıda tutuluyor.** Her tarayıcı kendi dünyasını görür; kullanıcılar arasında gerçek bir yarış yoktur.
- **Bağlanması gerekenler:** Canlıya çıkmak için site sunucuya bağlanmalı. SMS doğrulama, ödeme kuruluşu ve gerçek logolar da eklenmeli (Bölüm 6 ve `ENTEGRASYON.md` §7).
