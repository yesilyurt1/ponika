// Sunucu testleri: node --test logo-bulma/server/test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lb-test-"));
Object.assign(process.env, {DATA_DIR:dir, ADMIN_KEY:"test-admin-anahtari-123", SMS_MODE:"dev", PAYMENT_MODE:"demo", TRUST_PROXY:"1"});
const { server, setNow, runScheduler, flushNow } = await import("./server.mjs");
// Sabit Türkiye saati: 14 Ekim 2026 10:00 (UTC+3)
let now = Date.parse("2026-10-14T10:00:00+03:00");
setNow(() => now);
const at = hhmmss => { now = Date.parse(`2026-10-14T${hhmmss}+03:00`); };
let base;
before(() => new Promise(r => server.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(() => { server.close(); fs.rmSync(dir, {recursive:true, force:true}); });

const call = async (method, url, body, headers = {}) => {
  const res = await fetch(base + url, {method, redirect:"manual", headers:{"Content-Type":"application/json", ...headers}, body:body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body)});
  const text = await res.text(), ct = res.headers.get("content-type") || "";
  return {status:res.status, headers:res.headers, body:ct.includes("json") && text ? JSON.parse(text) : text};
};
const admin = {"X-Admin-Anahtar":"test-admin-anahtari-123"};
const brandCall = (keys, url, body, {ts = Math.floor(Date.now() / 1000), secret = keys.gizliAnahtar} = {}) => {
  const raw = JSON.stringify(body);
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
  return call("POST", url, raw, {Authorization:`Bearer ${keys.apiAnahtari}`, "X-Zaman":String(ts), "X-Imza":sig});
};
let ipN = 1;   // her giriş ayrı IP'den gelir (hız sınırı ayrı testte denenir)
async function login(phone, name = "Test Kişi") {
  const ip = {"X-Forwarded-For":`10.0.0.${ipN}`};
  const k = await call("POST", "/api/giris/kod", {telefon:phone}, ip);
  assert.equal(k.status, 200, JSON.stringify(k.body));
  const r = await call("POST", "/api/giris", {ad:name, telefon:phone, kod:k.body.gelistirmeKodu, kvkkOnay:true}, ip);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  now += 61e3; ipN++;   // aynı numaraya 1 dk içinde yeni kod istenemez
  return {Authorization:`Bearer ${r.body.token}`};
}
async function play(auth, campaign, pick, size) {
  const start = await call("POST", "/api/oyun/basla", {kampanya:campaign, boyut:size}, auth);
  assert.equal(start.status, 200, JSON.stringify(start.body));
  const target = {"giyim-demo":"Civil", "ayakkabi-demo":"Hotiç", "buyuk-firsat-demo":"Adidas", "elektronik-demo":"Samsung"}[campaign];
  const tile = pick === "wrong" ? start.body.logolar.find(x => x.marka !== target) : start.body.logolar.find(x => x.marka === target);
  const res = await call("POST", "/api/oyun/sec", {deneme:start.body.deneme, token:tile.token}, auth);
  return {start, res:res.body};
}

let civil, koton, a, codeA, codeB;
test("sağlık, config.js sunucu modu, güvenlik başlıkları", async () => {
  assert.equal((await call("GET", "/api/saglik")).body.ok, true);
  assert.match((await call("GET", "/config.js")).body, /LB_SERVER = true/);
  const html = await call("GET", "/");
  assert.equal(html.status, 200);
  assert.match(html.headers.get("content-security-policy"), /script-src 'self'/);
  assert.equal(html.headers.get("x-frame-options"), "DENY");
});
test("SMS kodlu giriş: hatalı kod, deneme sınırı, doğru kod", async () => {
  const k = await call("POST", "/api/giris/kod", {telefon:"05320000001"});
  assert.equal(k.body.gonderildi, true); assert.match(k.body.gelistirmeKodu, /^\d{6}$/);
  assert.equal((await call("POST", "/api/giris/kod", {telefon:"05320000001"})).body.hata, "bekle");
  assert.equal((await call("POST", "/api/giris", {ad:"X Y", telefon:"05320000001", kod:"000000", kvkkOnay:true})).body.hata, "kod_hatali");
  assert.equal((await call("POST", "/api/giris", {ad:"X Y", telefon:"05320000001", kod:k.body.gelistirmeKodu, kvkkOnay:false})).body.hata, "kvkk_gerekli");
  const ok = await call("POST", "/api/giris", {ad:"X Y", telefon:"05320000001", kod:k.body.gelistirmeKodu, kvkkOnay:true});
  assert.equal(ok.status, 200);
  assert.equal((await call("POST", "/api/giris", {ad:"X Y", telefon:"05320000001", kod:k.body.gelistirmeKodu, kvkkOnay:true})).body.hata, "kod_suresi_doldu", "kod tek kullanımlık");
  now += 61e3;
});
test("yönetici marka anahtarı oluşturur, yetkisiz istek reddedilir", async () => {
  assert.equal((await call("POST", "/api/admin/marka", {ad:"Civil"})).status, 401);
  civil = (await call("POST", "/api/admin/marka", {ad:"Civil"}, admin)).body;
  koton = (await call("POST", "/api/admin/marka", {ad:"Koton"}, admin)).body;
  assert.match(civil.apiAnahtari, /^mk_/); assert.match(civil.gizliAnahtar, /^gz_/);
});
test("kampanyalar: 15 kategori, farklı başlangıçlar, en fazla 3 saat, demolar saatsiz", async () => {
  const k = (await call("GET", "/api/kampanyalar")).body.kampanyalar;
  assert.equal(new Set(k.map(x => x.kategori)).size, 15);
  assert.equal(k.filter(x => x.demo && x.durum === "aktif").length, 15);
  assert.ok(k.filter(x => !x.demo).every(x => x.sureDk <= 180));
  assert.ok(k.filter(x => x.demo).every(x => x.baslangic === null));
  assert.ok(new Set(k.filter(x => !x.demo).map(x => x.baslangic.slice(3))).size > 3, "farklı dakikalarda başlayan kampanyalar");
  const mf = k.find(x => x.id === "buyuk-firsat-demo");
  assert.equal(mf.muhtesemFirsat, true); assert.equal(mf.logoSayisi, 55);
  assert.equal(k.find(x => x.id === "giyim-demo").metin, "Bebek bezlerinde %20 indirim");
});
test("oyun: 30 logo, MF 50-55 logo, kupon hakkı sınırsız, kampanya başına tek hak", async () => {
  a = await login("05321110001");
  const {start, res} = await play(a, "giyim-demo", "right");
  assert.equal(start.body.logolar.length, 30);
  assert.equal(res.sonuc, "kazandi"); codeA = res.kupon.code;
  assert.equal(res.kupon.newMember, true, "ilk kupon yeni üye eki taşır");
  const second = await play(a, "ayakkabi-demo", "right");
  assert.equal(second.res.sonuc, "kazandi", "aynı gün ikinci kupon da kazanılabilir");
  assert.equal(second.res.kupon.newMember, false);
  assert.equal((await call("POST", "/api/oyun/basla", {kampanya:"giyim-demo"}, a)).body.hata, "hak_kullanildi");
  const mf = await call("POST", "/api/oyun/basla", {kampanya:"buyuk-firsat-demo", boyut:50}, a);
  assert.equal(mf.body.logolar.length, 50);
  const mf2 = await call("POST", "/api/oyun/basla", {kampanya:"buyuk-firsat-demo", boyut:99}, await login("05321110009"));
  assert.equal(mf2.body.logolar.length, 55, "en fazla 55");
});
test("kaybedince hedef logo gösterilir; zaman aşımı da hedefi döner", async () => {
  const b = await login("05321110002");
  const lost = (await play(b, "giyim-demo", "wrong")).res;
  assert.equal(lost.sonuc, "yanlis"); assert.ok(lost.hedef, "hedef token döner");
  const st = await call("POST", "/api/oyun/basla", {kampanya:"ayakkabi-demo"}, b);
  const to = await call("POST", "/api/oyun/zaman-asimi", {deneme:st.body.deneme}, b);
  assert.equal(to.body.sonuc, "sure_doldu"); assert.equal(to.body.hedef, st.body.logolar.find(x => x.marka === "Hotiç").token);
});
test("telafi: düşük teklif, reklam süresi, ücretli ödeme; kampanya başına bir kez", async () => {
  const b = await login("05321110003");
  await play(b, "giyim-demo", "wrong");
  const deneme = "giyim-demo@2026-10-14";
  const low = await call("POST", "/api/oyun/telafi", {deneme, tur:"dusuk"}, b);
  assert.equal(low.status, 200); assert.equal(low.body.kupon.source, "telafi"); codeB = low.body.kupon.code;
  assert.equal((await call("POST", "/api/oyun/telafi", {deneme, tur:"dusuk"}, b)).body.hata, "telafi_alindi");
  await play(b, "ayakkabi-demo", "wrong");
  assert.equal((await call("POST", "/api/oyun/telafi", {deneme:"ayakkabi-demo@2026-10-14", tur:"dusuk"}, b)).status, 200, "başka kampanyada yine telafi alınabilir");
  const c = await login("05321110004"); await play(c, "giyim-demo", "wrong");
  const ad = (await call("POST", "/api/reklam/basla", {deneme}, c)).body;
  assert.equal((await call("POST", "/api/oyun/telafi", {deneme, tur:"reklam", reklamId:ad.reklamId}, c)).body.hata, "reklam_bitmedi");
  now += (ad.sureSn + 1) * 1000;
  assert.equal((await call("POST", "/api/oyun/telafi", {deneme, tur:"reklam", reklamId:ad.reklamId}, c)).status, 200);
  const d = await login("05321110005"); await play(d, "giyim-demo", "wrong");
  assert.equal((await call("POST", "/api/oyun/telafi", {deneme, tur:"ucretli"}, d)).status, 402);
  assert.equal((await call("POST", "/api/oyun/telafi", {deneme, tur:"ucretli", odemeRef:"demo-123"}, d)).status, 200);
});
test("durum: sayaçlar ve kişisel veriler", async () => {
  const s = (await call("GET", "/api/durum", undefined, a)).body;
  assert.equal(s.ben.phone, "05321110001");
  assert.ok(s.sayaclar["giyim-demo@2026-10-14"] >= 1);
  assert.equal(s.kuponlar.length, 2);
  assert.ok(!JSON.stringify(s.denemeler).includes("target"), "hedef token istemciye gitmez");
  const anon = (await call("GET", "/api/durum")).body;
  assert.equal(anon.ben, null); assert.ok(anon.sayaclar);
});
test("marka imzası: yanlış imza, eski zaman ve yanlış anahtar reddedilir", async () => {
  assert.equal((await brandCall(civil, "/api/marka/kupon-dogrula", {kod:codeA}, {secret:"yanlis"})).body.hata, "imza_gecersiz");
  assert.equal((await brandCall(civil, "/api/marka/kupon-dogrula", {kod:codeA}, {ts:Math.floor(Date.now() / 1000) - 3600})).body.hata, "zaman_asimi");
  assert.equal((await brandCall({...civil, apiAnahtari:"mk_sahte"}, "/api/marka/kupon-dogrula", {kod:codeA})).status, 401);
});
test("doğrulama ve sipariş: indirim dökümü, komisyon, tekrar bildirim, kullanılmış kod", async () => {
  assert.equal((await brandCall(koton, "/api/marka/kupon-dogrula", {kod:codeA})).body.gecerli, false);
  const ok = await brandCall(civil, "/api/marka/kupon-dogrula", {kod:codeA.toLowerCase(), sepetTutari:2000});
  assert.deepEqual({y:ok.body.hesap.toplamYuzde, i:ok.body.hesap.indirim, o:ok.body.hesap.odenecek}, {y:30, i:600, o:1400});
  const r = await brandCall(civil, "/api/marka/siparis", {kod:codeA, siparisNo:"C-1001", sepetTutari:2000});
  assert.equal(r.body.odenecek, 1400); assert.equal(r.body.komisyon, 42);
  assert.equal((await brandCall(civil, "/api/marka/siparis", {kod:codeA, siparisNo:"C-1001", sepetTutari:2000})).body.tekrar, true);
  assert.equal((await brandCall(civil, "/api/marka/siparis", {kod:codeA, siparisNo:"C-1002", sepetTutari:900})).body.hata, "kullanildi");
  assert.equal((await brandCall(civil, "/api/marka/iade", {siparisNo:"C-1001", iadeTutari:400})).body.kalanKomisyon, 30);
});
test("UTM yönlendirme: tıklama kaydedilir ve markaya UTM'li gider", async () => {
  const r = await call("GET", `/r/${codeB}/0`);
  assert.equal(r.status, 302);
  assert.match(r.headers.get("location"), new RegExp(`utm_content=${codeB}`));
  assert.equal((await call("GET", "/r/YOK-KOD/0")).headers.get("location"), "/#/kuponlarim");
});
test("admin: veri, kupon işlemleri, elle kullanıldı, SMS, engelle, KVKK silme", async () => {
  assert.equal((await call("GET", "/api/admin/veri")).status, 401);
  const v = (await call("GET", "/api/admin/veri", undefined, admin)).body;
  assert.ok(v.users.length >= 5); assert.ok(v.coupons.length >= 5); assert.equal(v.clicks.length, 1);
  assert.equal((await call("POST", "/api/admin/islem", {tur:"kupon_uzat", kod:codeB}, admin)).body.ok, true);
  assert.equal((await call("POST", "/api/admin/islem", {tur:"kupon_kullanildi", kod:codeB, sepetTutari:500, siparisNo:"MUT-1"}, admin)).body.ok, true);
  const sms = await call("POST", "/api/admin/islem", {tur:"sms_gonder", telefon:"05321110001", baslik:"Merhaba", mesaj:"Yeni kampanya!"}, admin);
  assert.equal(sms.body.gonderilen, 1);
  assert.equal((await call("GET", "/api/durum", undefined, a)).body.bildirimler[0].title, "Merhaba");
  await call("POST", "/api/admin/islem", {tur:"uye_engelle", telefon:"05321110001"}, admin);
  assert.equal((await call("POST", "/api/oyun/basla", {kampanya:"elektronik-demo"}, a)).body.hata, "engelli");
  const z = await login("05321110008");
  await call("POST", "/api/admin/islem", {tur:"uye_sil", telefon:"05321110008"}, admin);
  assert.equal((await call("GET", "/api/durum", undefined, z)).body.ben, null, "silinen üyenin oturumu kapanır");
});
test("admin kasa simülatörü ve logo yükleme (boyut/tür kontrolü, güvenli sunum)", async () => {
  const k = await call("POST", "/api/admin/kasa", {adim:"validate", marka:"Koton", kod:codeA}, admin);
  assert.equal(k.body.ok, false);
  const png = "data:image/png;base64," + Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a1b40000000049454e44ae426082", "hex").toString("base64");
  const up = await call("POST", "/api/admin/logo", {marka:"Civil", dosya:png}, admin);
  assert.equal(up.status, 200); assert.match(up.body.yol, /^yuklenen-logolar\/civil-/);
  const man = await call("GET", "/logos/manifest.js"); assert.match(man.body, /"Civil":"yuklenen-logolar\/civil-/);
  const f = await call("GET", "/" + up.body.yol); assert.equal(f.status, 200); assert.match(f.headers.get("content-security-policy"), /sandbox/);
  assert.equal((await call("POST", "/api/admin/logo", {marka:"Civil", dosya:"data:text/html;base64,PGgxPg=="}, admin)).body.hata, "dosya_gecersiz");
  assert.equal((await call("POST", "/api/admin/logo", {marka:"Civil", dosya:"data:image/png;base64," + Buffer.alloc(310 * 1024).toString("base64")}, admin)).body.hata, "dosya_buyuk");
  assert.equal((await call("POST", "/api/admin/logo-sil", {marka:"Civil"}, admin)).body.ok, true);
});
test("rapor: hakediş, tıklama, kontrol listesi, telafi gelirleri", async () => {
  const fresh = await login("05321110007");
  const w = (await play(fresh, "elektronik-demo", "right")).res;
  await brandCall(civil, "/api/marka/kupon-dogrula", {kod:w.kupon.code});   // Civil değil: kod bulunamadı
  await call("POST", "/api/admin/kasa", {adim:"validate", marka:"Samsung", kod:w.kupon.code}, admin);
  const rep = (await call("GET", "/api/admin/rapor?ay=2026-10", undefined, admin)).body;
  assert.ok(rep.kontrolEdilecek.some(x => x.kod === w.kupon.code));
  assert.equal(rep.toplam.telafiOdemesi, 5); assert.equal(rep.toplam.reklamIzlenme, 1);
  assert.match((await call("GET", "/api/admin/kuponlar.csv?ay=2026-10", undefined, admin)).body, /C-1001/);
});
test("hatırlatma: 5 dk kala ve başladığında bildirim (uygulama + SMS giden kutusu)", async () => {
  const e = await login("05321110006");
  const camp = (await call("GET", "/api/kampanyalar")).body.kampanyalar.find(x => x.kategori === "giyim" && x.baslangic === "16:00");
  assert.equal((await call("POST", "/api/hatirlatma", {kampanya:camp.id}, e)).body.kurulu, true);
  at("15:56:00"); await runScheduler();
  at("16:00:10"); await runScheduler(); await runScheduler();
  const n = (await call("GET", "/api/durum", undefined, e)).body.bildirimler.map(x => x.title).reverse();
  assert.deepEqual(n, [`${camp.marka} 5 dk sonra başlıyor`, `${camp.marka} kampanyası başladı`]);
  const box = (await call("GET", "/api/admin/giden-kutusu", undefined, admin)).body.mesajlar.filter(m => m.to === "05321110006" && m.title !== "Giriş kodu");
  assert.ok(box.every(m => m.channels.includes("sms_giden_kutusu")));
});
test("kalıcı kayıt ve statik dosya güvenliği", async () => {
  flushNow();
  const saved = JSON.parse(fs.readFileSync(path.join(dir, "db.json"), "utf8"));
  assert.ok(Object.keys(saved.coupons).length >= 6);
  assert.ok(!JSON.stringify(saved.otps).includes("gelistirme"));
  for (const p of ["/server/server.mjs", "/server/data/db.json", "/tools/logo-indir.mjs", "/ANALIZ.md", "/..%2f..%2fetc%2fpasswd", "/.gitignore"]) assert.equal((await call("GET", p)).status, 404, p);
  assert.equal((await call("GET", "/%E0%A4%A")).status, 400);
  assert.equal((await call("POST", "/api/giris", "{bozuk")).body.hata, "gecersiz_json");
});
test("hız sınırı: aynı IP'den çok sayıda kod isteği reddedilir", async () => {
  let last;
  for (let i = 0; i < 8; i++) last = await call("POST", "/api/giris/kod", {telefon:`0533000000${i}`}, {"X-Forwarded-For":"10.9.9.9"});
  assert.equal(last.status, 429);
});
