# Pilates Ders Takvimi

Pilates stüdyosu için ders seçme, iptal, değişiklik ve paket takibi yapılan web uygulaması.
Telefonda da bilgisayarda da çalışır. Hocanın her hafta tek tek mesaj atmasına gerek kalmaz:
üyeler takvime girip boş saatleri görür, kendileri ders seçer veya iptal eder.

## Neler var?

**Üyeler için**
- Hafta ve ay görünümüyle takvim. İstenen ay ve yıla atlanabilir, tıklanan gün haftalık görünümde açılır.
- Her derste dolu/boş yerler görünür (5 kişilik kontenjan, 5 daire).
- Paketteki hak kadar ders seçilebilir. 8 derslik paketi olan biri 9. dersi seçemez.
- Dersten 24 saat öncesine kadar ücretsiz iptal veya başka saate alma yapılabilir, hak yanmaz.
  Daha geç iptal edilirse hak yanar ve sistem bunu önceden açıkça uyarır.
- Paket süresi: 8 ders → 1 ay, 16 ders → 2 ay, 24 ders → 3 ay. Bitişe 7 gün kala uyarı çıkar.
- "Derslerim" sayfasında paket durumu (yapılan, planlı ve kalan dersler) ile geçmiş görünür.

**Hoca (yönetici) için**
- Haftalık program oluşturma: günleri ve saatleri seçip istenen hafta sayısı kadar dersi tek seferde ekleme.
- Tek ders ekleme veya silme.
- Hoca müsait değilse dersi neden yazarak iptal edebilir. Kayıtlı üyelerin hakları otomatik iade edilir.
- **Otomatik iptal:** Dersten X saat önce (varsayılan 12) derste en az 2 kişi yoksa ders kendiliğinden
  iptal olur ve hak iade edilir. Belirli bir ders için "Az kişiyle de yap" seçilerek kapatılabilir.
- Bir üyeyi başka gün veya saate taşıma, dersten çıkarma, derse üye ekleme.
- Üyelere 8, 16 veya 24 derslik paket tanımlama ve paket bitiş tarihini uzatma.
- Tüm kurallar (kontenjan, en az kişi sayısı, iptal süresi, kontrol saati) Ayarlar sayfasından değiştirilebilir.

## Hemen denemek (demo modu)

`config.js` içinde `firebase: null` olduğu sürece uygulama **demo modunda** çalışır.
`index.html` dosyasını tarayıcıda açmak yeterli. Örnek üyeler, paketler ve dersler hazır gelir.
Giriş ekranında "Hoca (Yönetici)" veya bir üye seçilerek iki taraf da denenebilir.
Demo verileri sadece o tarayıcıda tutulur, başkası göremez.

## Gerçek kullanım için kurulum (yaklaşık 15 dakika, ücretsiz)

Herkesin aynı takvimi görmesi için verilerin ortak bir yerde tutulması gerekir.
Bunun için Google'ın ücretsiz **Firebase** hizmeti kullanılır. Küçük bir stüdyo ücretsiz kotayı aşmaz.

1. https://console.firebase.google.com adresine Google hesabıyla girin ve **Proje ekle** ile yeni proje oluşturun
   (Google Analytics gerekmez).
2. Sol menüden **Build → Authentication → Get started** adımına gidin, **Email/Password** yöntemini açın.
3. **Build → Firestore Database → Create database** ile veritabanı oluşturun. Konum olarak `eur3 (europe-west)` seçin,
   "production mode" ile başlayın.
4. Firestore'da **Rules** sekmesini açın, bu klasördeki `firestore.rules` dosyasının içeriğini yapıştırın.
   `'hoca@ornek.com'` yazan yere hocanın e-posta adresini yazıp **Publish** deyin.
5. Proje ayarlarından (⚙ → Project settings) **Your apps → Web (</>)** ile bir web uygulaması ekleyin.
   Gösterilen `firebaseConfig` bilgilerini `config.js` içindeki `firebase:` alanına yapıştırın.
   `adminEmails` listesine de hocanın e-postasını yazın.
6. Sayfayı yayınlayın. En kolay yol GitHub Pages: depo ayarlarında **Settings → Pages → Deploy from a branch**.
   Sonra adres `https://<kullanıcı>.github.io/<depo>/pilates/` olur.
   Firebase'de **Authentication → Settings → Authorized domains** listesine bu alan adını (`<kullanıcı>.github.io`) ekleyin.
7. Hoca bu adresten **Kayıt ol** ile kendi e-postasıyla hesap açar ve otomatik olarak yönetici olur.
   Ardından **Ders programı** sekmesinden haftalık dersleri oluşturur.
8. Bağlantı üyelerle paylaşılır. Üyeler kayıt olur, hoca **Üyeler** sekmesinden her birine paket tanımlar
   ve üyeler ders seçmeye başlar.

## Kurallar nasıl işliyor?

| Kural | Varsayılan | Nerede değişir |
|---|---|---|
| Ders kontenjanı | 5 kişi | Ayarlar / her ders için Ders programı |
| Ücretsiz iptal ve değişiklik | Dersten 24 saat öncesine kadar | Ayarlar |
| Dersin yapılması için en az kişi | 2 | Ayarlar |
| Kişi sayısı kontrolü | Dersten 12 saat önce | Ayarlar |
| Paket süresi | 8 → 1 ay, 16 → 2 ay, 24 → 3 ay | Üye sayfasında bitiş tarihi elle uzatılabilir |

- Bir ders hakkı, ders **seçildiği anda** paketten düşer. Böylece hiç kimse paketindeki hak sayısından fazla ders seçemez.
- Hoca dersi iptal ederse veya ders az katılım nedeniyle otomatik iptal olursa hak geri gelir.
- Zamanında iptal edilen dersin hakkı geri gelir. Geç iptal edilen dersin hakkı yanar.
- Paket süresi dolduğunda kullanılmayan haklar yanar. Paket bitiş tarihinden sonraki bir ders seçilemez.

## Hatırlatmalar (e-posta / SMS)

Sayfa kapalıyken de mesaj gidebilmesi için GitHub Actions kullanılır. Ücretsizdir ve 15 dakikada bir
`notify/notify.mjs` betiğini çalıştırır. Gönderilen bildirimler:

| Bildirim | Ne zaman |
|---|---|
| Ders hatırlatması | Dersten 26 saat önce (Ayarlar → Bildirimler). Böylece üye ücretsiz iptal süresi bitmeden haberdar olur. Derste az kişi varsa iptal riski de yazılır. |
| Ders iptali | Hoca dersi iptal ettiğinde veya ders az katılım nedeniyle otomatik iptal olduğunda |
| Saat değişikliği | Hoca üyeyi başka bir derse taşıdığında |
| Paket bitiyor | Paketin bitmesine 7 gün kala hâlâ seçilmemiş ders hakkı varsa |

Aynı bildirim iki kez gönderilmez. Gönderici ayrıca az katılımlı dersleri, hoca sayfayı açmasa bile zamanında iptal eder.
Hoca, **Ayarlar → Bildirimler** bölümünden e-posta ve SMS'i açıp kapatabilir, gönderim geçmişini ve göndericinin son çalışma zamanını görebilir.
Üyeler de **Derslerim → Bildirim tercihlerim** bölümünden bildirimleri kapatabilir ve telefon numaralarını güncelleyebilir.

### Kurulum

GitHub'da depo sayfasında **Settings → Secrets and variables → Actions** bölümüne aşağıdakiler eklenir.

1. **Firebase erişimi (zorunlu).** Firebase konsolunda ⚙ → Project settings → **Service accounts** → **Generate new private key**
   ile bir JSON dosyası indirilir. Dosyanın tüm içeriği `FIREBASE_SERVICE_ACCOUNT` adlı **secret** olarak eklenir.
   Bu dosya veritabanına tam erişim verir. Hiçbir yere yüklenmemeli, kimseyle paylaşılmamalıdır.
2. **E-posta.** Gmail ile en kolay yol: Google hesabında 2 adımlı doğrulamayı açın, ardından
   https://myaccount.google.com/apppasswords adresinden bir "uygulama şifresi" oluşturun. Secret'lar:
   - `SMTP_HOST` = `smtp.gmail.com`
   - `SMTP_PORT` = `465`
   - `SMTP_USER` = gmail adresi
   - `SMTP_PASS` = uygulama şifresi
   - `MAIL_FROM` = `Pilates Stüdyo <adres@gmail.com>` (isteğe bağlı)
3. **SMS (isteğe bağlı, ücretli).** Türkiye için **Netgsm** önerilir (onaylı bir SMS başlığı gerekir). Twilio da desteklenir.
   - Netgsm: **variable** `SMS_PROVIDER` = `netgsm`. **Secret'lar:** `NETGSM_USERCODE`, `NETGSM_PASSWORD`, `NETGSM_HEADER` (onaylı başlık).
   - Twilio: **variable** `SMS_PROVIDER` = `twilio`. **Secret'lar:** `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM`.
   - Uygulamada da **Ayarlar → Bildirimler → SMS gönder** işaretlenmelidir. SMS varsayılan olarak kapalıdır.
4. **Variables** sekmesine:
   - `APP_URL` = uygulamanın adresi (mesajların sonuna eklenir)
   - `PILATES_NOTIFY_ENABLED` = `true` (zamanlanmış çalışmayı açar)
5. Deneme: **Actions → Pilates bildirimleri → Run workflow** (deneme kutusu işaretli) ile çalıştırılır. Kayıtta kime ne
   gideceği listelenir ama hiçbir şey gönderilmez. Sonuç doğruysa kutu işaretsiz çalıştırılır ya da 15 dakikalık
   otomatik çalışma beklenir.

> GitHub zamanlanmış görevleri yalnızca varsayılan dalda (genellikle `main`) çalıştırır. Bu yüzden değişikliklerin `main` dalına
> alınmış olması gerekir. GitHub yoğun saatlerde zamanlanmış görevleri birkaç dakika geciktirebilir.

## Dosyalar

- `index.html`: uygulamanın tamamı
- `config.js`: stüdyo adı, yönetici e-postası, Firebase bağlantı ayarları
- `firestore.rules`: veritabanı güvenlik kuralları (üyeler sadece kendi kayıtlarını değiştirebilir)
- `notify/`: e-posta ve SMS gönderici (`lib.mjs` ile kimin ne alacağı hesaplanır, `notify.mjs` ile gönderilir, `node test.mjs` testleri çalıştırır)
- `../.github/workflows/pilates-bildirim.yml`: göndericiyi 15 dakikada bir çalıştıran zamanlayıcı
