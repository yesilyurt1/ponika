// Sunucu testleri: node --test logo-bulma/server/test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lb-test-"));
process.env.DATA_DIR = dir; process.env.ADMIN_KEY = "test-admin";
const { server } = await import("./server.mjs");
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
async function winCoupon(phone, campaign = "giyim-civil-demo", brand = "Civil") {
  const {body:{token}} = await call("POST", "/api/giris", {ad:"Test Kişi", telefon:phone, kvkkOnay:true});
  const auth = {Authorization:`Bearer ${token}`};
  const start = await call("POST", "/api/oyun/basla", {kampanya:campaign}, auth);
  assert.equal(start.status, 200, JSON.stringify(start.body));
  assert.equal(start.body.logolar.length, 24);
  const pick = await call("POST", "/api/oyun/sec", {deneme:start.body.deneme, token:start.body.logolar.find(x => x.marka === brand).token}, auth);
  assert.equal(pick.body.sonuc, "kazandi");
  return {code:pick.body.kupon.kod, auth};
}

let civil, koton, code1, code2, code3;
test("yönetici marka anahtarı oluşturur, yetkisiz istek reddedilir", async () => {
  assert.equal((await call("POST", "/api/admin/marka", {ad:"Civil"})).status, 401);
  civil = (await call("POST", "/api/admin/marka", {ad:"Civil"}, admin)).body;
  koton = (await call("POST", "/api/admin/marka", {ad:"Koton"}, admin)).body;
  assert.match(civil.apiAnahtari, /^mk_/); assert.match(civil.gizliAnahtar, /^gz_/);
});
test("oyun: tek hak, kazanana kişiye özel kod", async () => {
  ({code:code1} = await winCoupon("05321110001"));
  ({code:code2} = await winCoupon("05321110002"));
  ({code:code3} = await winCoupon("05321110003"));
  assert.notEqual(code1, code2);
  const {body:{token}} = await call("POST", "/api/giris", {ad:"Test Kişi", telefon:"05321110001", kvkkOnay:true});
  const again = await call("POST", "/api/oyun/basla", {kampanya:"giyim-civil-demo"}, {Authorization:`Bearer ${token}`});
  assert.equal(again.status, 409); assert.equal(again.body.hata, "hak_kullanildi");
});
test("marka imzası: yanlış imza, eski zaman ve yanlış anahtar reddedilir", async () => {
  assert.equal((await brandCall(civil, "/api/marka/kupon-dogrula", {kod:code1}, {secret:"yanlis"})).body.hata, "imza_gecersiz");
  assert.equal((await brandCall(civil, "/api/marka/kupon-dogrula", {kod:code1}, {ts:Math.floor(Date.now() / 1000) - 3600})).body.hata, "zaman_asimi");
  assert.equal((await brandCall({...civil, apiAnahtari:"mk_sahte"}, "/api/marka/kupon-dogrula", {kod:code1})).status, 401);
});
test("kod doğrulama: yalnızca kendi markasında geçer", async () => {
  assert.equal((await brandCall(koton, "/api/marka/kupon-dogrula", {kod:code1})).body.gecerli, false);
  const ok = await brandCall(civil, "/api/marka/kupon-dogrula", {kod:code1.toLowerCase()});
  assert.equal(ok.body.gecerli, true); assert.equal(ok.body.kupon.kod, code1);
});
test("sipariş: %3 komisyon, tekrar bildirim tek sayılır, kullanılmış kod reddedilir", async () => {
  const r = await brandCall(civil, "/api/marka/siparis", {kod:code1, siparisNo:"C-1001", tutar:1250});
  assert.equal(r.status, 200); assert.equal(r.body.komisyon, 37.5);
  const again = await brandCall(civil, "/api/marka/siparis", {kod:code1, siparisNo:"C-1001", tutar:1250});
  assert.equal(again.body.tekrar, true);
  const reuse = await brandCall(civil, "/api/marka/siparis", {kod:code1, siparisNo:"C-1002", tutar:900});
  assert.equal(reuse.status, 409); assert.equal(reuse.body.hata, "kullanildi");
  const clash = await brandCall(civil, "/api/marka/siparis", {kod:code2, siparisNo:"C-1001", tutar:100});
  assert.equal(clash.body.hata, "siparis_cakisma");
  assert.equal((await brandCall(civil, "/api/marka/siparis", {kod:code2, siparisNo:"C-1003", tutar:-5})).body.hata, "tutar_gecersiz");
});
test("iade: kısmi iade komisyonu düşürür, fazlası reddedilir", async () => {
  await brandCall(civil, "/api/marka/siparis", {kod:code2, siparisNo:"C-2001", tutar:1000});
  const part = await brandCall(civil, "/api/marka/iade", {siparisNo:"C-2001", iadeTutari:400});
  assert.equal(part.body.kalanKomisyon, 18);
  assert.equal((await brandCall(civil, "/api/marka/iade", {siparisNo:"C-2001", iadeTutari:700})).body.hata, "iade_tutari_gecersiz");
  assert.equal((await brandCall(civil, "/api/marka/iade", {siparisNo:"C-2001", iadeTutari:600})).body.kalanKomisyon, 0);
});
test("rapor: hakediş toplamları ve doğrulanıp siparişi bildirilmeyen kod", async () => {
  await brandCall(civil, "/api/marka/kupon-dogrula", {kod:code3});
  const rep = await call("GET", "/api/admin/rapor", undefined, admin);
  const c = rep.body.markalar.find(x => x.marka === "Civil");
  assert.deepEqual({kupon:c.kupon, siparis:c.siparis, ciro:c.ciro, komisyon:c.komisyon}, {kupon:3, siparis:2, ciro:2250, komisyon:37.5});
  assert.deepEqual(rep.body.kontrolEdilecek.map(x => x.kod), [code3]);
  const csv = await call("GET", "/api/admin/kuponlar.csv", undefined, admin);
  assert.match(csv.body, /C-1001/); assert.equal((await call("GET", "/api/admin/rapor")).status, 401);
});
test("site dosyaları sunuluyor, sunucu klasörü ve üst dizin kapalı", async () => {
  assert.equal((await call("GET", "/")).status, 200);
  assert.equal((await call("GET", "/server/data/db.json")).status, 404);
  assert.equal((await call("GET", "/..%2f..%2f..%2fetc%2fpasswd")).status, 404);
  assert.equal((await call("GET", "/..%2findex.html")).status, 404);
  assert.equal((await call("POST", "/api/giris", "{bozuk")).body.hata, "gecersiz_json");
});
