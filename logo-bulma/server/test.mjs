// Sunucu testleri: node --test logo-bulma/server/test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lb-test-"));
process.env.DATA_DIR = dir; process.env.ADMIN_KEY = "test-admin";
const { server, setNow, runScheduler } = await import("./server.mjs");
// Sabit Türkiye saati: 14 Ekim 2026 10:00 (UTC+3)
let now = Date.parse("2026-10-14T10:00:00+03:00");
setNow(() => now);
const at = hhmmss => { now = Date.parse(`2026-10-14T${hhmmss}+03:00`); };
let base;
before(() => new Promise(r => server.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(() => { server.close(); fs.rmSync(dir, {recursive:true, force:true}); });

const call = async (method, url, body, headers = {}) => {
  const res = await fetch(base + url, {method, headers:{"Content-Type":"application/json", ...headers}, body:body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body)});
  const text = await res.text();
  return {status:res.status, body:res.headers.get("content-type").includes("json") ? JSON.parse(text) : text};
};
const admin = {"X-Admin-Anahtar":"test-admin"};
// Markanın yapacağı imzalı çağrı (ENTEGRASYON.md'deki örnekle aynı)
const brandCall = (keys, url, body, {ts = Math.floor(Date.now() / 1000), secret = keys.gizliAnahtar} = {}) => {
  const raw = JSON.stringify(body);
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
  return call("POST", url, raw, {Authorization:`Bearer ${keys.apiAnahtari}`, "X-Zaman":String(ts), "X-Imza":sig});
};
const login = async phone => ({Authorization:`Bearer ${(await call("POST", "/api/giris", {ad:"Test Kişi", telefon:phone, kvkkOnay:true})).body.token}`});
async function play(auth, campaign, pick) {
  const start = await call("POST", "/api/oyun/basla", {kampanya:campaign}, auth);
  assert.equal(start.status, 200, JSON.stringify(start.body));
  const tile = pick === "wrong" ? start.body.logolar.find(x => x.marka !== campaign.brand && x.marka !== "Civil" && x.marka !== "Hotiç") : start.body.logolar.find(x => x.marka === pick);
  const res = await call("POST", "/api/oyun/sec", {deneme:start.body.deneme, token:tile.token}, auth);
  return {start, res:res.body};
}

let civil, koton, a, codeA, codeB;
test("yönetici marka anahtarı oluşturur, yetkisiz istek reddedilir", async () => {
  assert.equal((await call("POST", "/api/admin/marka", {ad:"Civil"})).status, 401);
  civil = (await call("POST", "/api/admin/marka", {ad:"Civil"}, admin)).body;
  koton = (await call("POST", "/api/admin/marka", {ad:"Koton"}, admin)).body;
  assert.match(civil.apiAnahtari, /^mk_/); assert.match(civil.gizliAnahtar, /^gz_/);
});
test("kampanya listesi: 15 kategori, demo ve Muhteşem Fırsat, çoklu indirim", async () => {
  const k = (await call("GET", "/api/kampanyalar")).body.kampanyalar;
  assert.equal(new Set(k.map(x => x.kategori)).size, 15);
  assert.equal(k.filter(x => x.demo && x.durum === "aktif").length, 15);
  const mf = k.find(x => x.id === "buyuk-firsat-demo");
  assert.equal(mf.muhtesemFirsat, true); assert.equal(mf.indirim.pct, 35);
  assert.ok(k.find(x => x.id === "giyim-00").indirim.tiers.length >= 1);
});
test("oyun: 30 logo, kazanana kişiye özel kod; günde tek kupon", async () => {
  a = await login("05321110001");
  const {start, res} = await play(a, "giyim-demo", "Civil");
  assert.equal(start.body.logolar.length, 30);
  assert.equal(res.sonuc, "kazandi"); codeA = res.kupon.kod;
  assert.equal(res.kupon.indirim.yeniUyeEk, 5, "ilk kupon yeni üye eki taşır");
  const again = await call("POST", "/api/oyun/basla", {kampanya:"ayakkabi-demo"}, a);
  assert.equal(again.status, 409); assert.equal(again.body.hata, "gunluk_hak");
  const same = await call("POST", "/api/oyun/basla", {kampanya:"giyim-demo"}, a);
  assert.equal(same.body.hata, "hak_kullanildi");
});
test("telafi: düşük teklif, reklam süresi, ücretli ödeme; günde bir", async () => {
  const b = await login("05321110002");
  const lost = (await play(b, "giyim-demo", "wrong")).res;
  assert.equal(lost.sonuc, "yanlis"); assert.deepEqual(lost.telafi.map(x => x.tur), ["low", "ad", "paid"]);
  const deneme = "giyim-demo@2026-10-14";
  const low = await call("POST", "/api/oyun/telafi", {deneme, tur:"dusuk"}, b);
  assert.equal(low.status, 200); assert.equal(low.body.kupon.tur, "telafi"); codeB = low.body.kupon.kod;
  assert.equal((await call("POST", "/api/oyun/telafi", {deneme, tur:"dusuk"}, b)).body.hata, "telafi_alindi");

  const c = await login("05321110003"); await play(c, "giyim-demo", "wrong");
  const ad = (await call("POST", "/api/reklam/basla", {deneme}, c)).body;
  assert.equal((await call("POST", "/api/oyun/telafi", {deneme, tur:"reklam", reklamId:ad.reklamId}, c)).body.hata, "reklam_bitmedi");
  now += (ad.sureSn + 1) * 1000;
  assert.equal((await call("POST", "/api/oyun/telafi", {deneme, tur:"reklam", reklamId:ad.reklamId}, c)).status, 200);

  const d = await login("05321110004"); await play(d, "giyim-demo", "wrong");
  assert.equal((await call("POST", "/api/oyun/telafi", {deneme, tur:"ucretli"}, d)).status, 402);
  assert.equal((await call("POST", "/api/oyun/telafi", {deneme, tur:"ucretli", odemeRef:"demo-123"}, d)).status, 200);
});
test("marka imzası: yanlış imza, eski zaman ve yanlış anahtar reddedilir", async () => {
  assert.equal((await brandCall(civil, "/api/marka/kupon-dogrula", {kod:codeA}, {secret:"yanlis"})).body.hata, "imza_gecersiz");
  assert.equal((await brandCall(civil, "/api/marka/kupon-dogrula", {kod:codeA}, {ts:Math.floor(Date.now() / 1000) - 3600})).body.hata, "zaman_asimi");
  assert.equal((await brandCall({...civil, apiAnahtari:"mk_sahte"}, "/api/marka/kupon-dogrula", {kod:codeA})).status, 401);
});
test("doğrulama: yalnız kendi markasında geçer, sepet tutarına göre indirim dökümü", async () => {
  assert.equal((await brandCall(koton, "/api/marka/kupon-dogrula", {kod:codeA})).body.gecerli, false);
  const ok = await brandCall(civil, "/api/marka/kupon-dogrula", {kod:codeA.toLowerCase(), sepetTutari:2000});
  assert.equal(ok.body.gecerli, true);
  // Civil demo: %20, 1.000 ₺ üstü %25 barem, yeni üye +%5 → 2.000 ₺'de %30
  assert.deepEqual({y:ok.body.hesap.toplamYuzde, i:ok.body.hesap.indirim, o:ok.body.hesap.odenecek}, {y:30, i:600, o:1400});
});
test("sipariş: komisyon ödenen tutardan, tekrar bildirim tek sayılır, kullanılmış kod reddedilir", async () => {
  const r = await brandCall(civil, "/api/marka/siparis", {kod:codeA, siparisNo:"C-1001", sepetTutari:2000});
  assert.equal(r.status, 200); assert.equal(r.body.odenecek, 1400); assert.equal(r.body.komisyon, 42);
  assert.equal((await brandCall(civil, "/api/marka/siparis", {kod:codeA, siparisNo:"C-1001", sepetTutari:2000})).body.tekrar, true);
  const reuse = await brandCall(civil, "/api/marka/siparis", {kod:codeA, siparisNo:"C-1002", sepetTutari:900});
  assert.equal(reuse.status, 409); assert.equal(reuse.body.hata, "kullanildi");
  assert.equal((await brandCall(civil, "/api/marka/siparis", {kod:codeB, siparisNo:"C-1001", sepetTutari:100})).body.hata, "siparis_cakisma");
  assert.equal((await brandCall(civil, "/api/marka/siparis", {kod:codeB, siparisNo:"C-1003", sepetTutari:-5})).body.hata, "tutar_gecersiz");
});
test("iade: kısmi iade komisyonu düşürür, fazlası reddedilir", async () => {
  assert.equal((await brandCall(civil, "/api/marka/iade", {siparisNo:"C-1001", iadeTutari:400})).body.kalanKomisyon, 30);
  assert.equal((await brandCall(civil, "/api/marka/iade", {siparisNo:"C-1001", iadeTutari:1200})).body.hata, "iade_tutari_gecersiz");
});
test("profil: Kazancım toplamı ve günlük hak", async () => {
  const p = (await call("GET", "/api/profil", undefined, a)).body;
  assert.deepEqual({k:p.kazanc, al:p.alisveris, hak:p.gunlukHakKalan, kup:p.kazanilanKupon}, {k:600, al:1400, hak:0, kup:1});
});
test("rapor: hakediş, kontrol listesi, telafi gelirleri", async () => {
  await brandCall(civil, "/api/marka/kupon-dogrula", {kod:codeB});
  const rep = (await call("GET", "/api/admin/rapor?ay=2026-10", undefined, admin)).body;
  const c = rep.markalar.find(x => x.marka === "Civil");
  assert.deepEqual({kupon:c.kupon, siparis:c.siparis, odenen:c.odenen, komisyon:c.komisyon}, {kupon:4, siparis:1, odenen:1400, komisyon:30});
  assert.deepEqual(rep.kontrolEdilecek.map(x => x.kod), [codeB]);
  assert.equal(rep.toplam.telafiOdemesi, 5); assert.equal(rep.toplam.reklamIzlenme, 1);
  const csv = await call("GET", "/api/admin/kuponlar.csv?ay=2026-10", undefined, admin);
  assert.match(csv.body, /C-1001/); assert.equal((await call("GET", "/api/admin/rapor")).status, 401);
});
test("hatırlatma: 5 dk kala ve başladığında SMS (giden kutusu)", async () => {
  const e = await login("05321110005");
  assert.equal((await call("POST", "/api/hatirlatma", {kampanya:"giyim-16"}, e)).body.kurulu, true);
  at("15:56:00"); await runScheduler();
  at("16:00:10"); await runScheduler(); await runScheduler();
  const box = (await call("GET", "/api/admin/giden-kutusu", undefined, admin)).body.mesajlar.filter(m => m.to === "05321110005");
  assert.deepEqual(box.map(m => m.title).reverse(), ["Pierre Cardin 5 dk sonra başlıyor", "Pierre Cardin kampanyası başladı"]);
  assert.ok(box.every(m => m.channels.includes("sms_giden_kutusu")));
  await call("POST", "/api/bildirim-ayarlari", {sms:false}, e);
  assert.equal((await call("GET", "/api/profil", undefined, e)).body.bildirimAyarlari.sms, false);
});
test("site dosyaları sunuluyor, sunucu ve araç klasörleri kapalı", async () => {
  assert.equal((await call("GET", "/")).status, 200);
  assert.equal((await call("GET", "/kurallar.js")).status, 200);
  assert.equal((await call("GET", "/server/data/db.json")).status, 404);
  assert.equal((await call("GET", "/tools/logo-indir.mjs")).status, 404);
  assert.equal((await call("GET", "/..%2f..%2f..%2fetc%2fpasswd")).status, 404);
  assert.equal((await call("GET", "/%E0%A4%A")).status, 400);
  assert.equal((await call("POST", "/api/giris", "{bozuk")).body.hata, "gecersiz_json");
});
