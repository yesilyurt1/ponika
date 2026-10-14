// 1 Milyonuncu Marka: platform sunucusu (bağımlılıksız Node.js 20+).
// Oyun, günlük hak, kişiye özel kupon, çoklu indirim, telafi kuponu, hatırlatma/SMS/push zamanlayıcısı,
// marka entegrasyonu (kod doğrulama + sipariş/iade bildirimi) ve komisyon raporu.
// İş kuralları sitenin de kullandığı kurallar.js'den gelir; iki taraf aynı hesabı yapar.
// Çalıştırma: ADMIN_KEY=gizli node server/server.mjs   (ayrıntı: ENTEGRASYON.md)
// Not: Veriler tek bir JSON dosyasında tutulur; canlıda PostgreSQL + Redis gerekir.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "server", "data"));
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const SMS_WEBHOOK_URL = process.env.SMS_WEBHOOK_URL || "";   // SMS sağlayıcısının (Netgsm, İleti Merkezi vb.) ağ geçidi
const PAYMENT_MODE = process.env.PAYMENT_MODE || "demo";     // "demo": ödeme doğrulanmadan kabul (yalnız test)
const SIGN_WINDOW_SEC = 300;   // imzalı isteklerin geçerlilik süresi (tekrar gönderme saldırısına karşı)
const GRACE_MS = 300;          // ağ gecikmesi payı
const MAX_BODY = 64 * 1024;

/* ---------- kampanya verisi ve kurallar: sitenin kullandığı dosyaların aynısı ---------- */
const ctx = vm.createContext({window:{}, URL});
for (const f of ["markalar.js", "data.js", "kurallar.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, {filename:f});
const D = ctx.window.LB_DATA, K = ctx.window.LB_KURALLAR;
const RATE = Number(process.env.COMMISSION || D.commissionRate);
const CAMPS = K.CAMPS, campById = K.campById;

/* ---------- saat (Türkiye) ---------- */
const fmtParts = new Intl.DateTimeFormat("en-GB", {timeZone:D.timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23"});
let nowFn = () => Date.now();
export const setNow = fn => { nowFn = fn; };   // testler için
function clock(ms = nowFn()) {
  const p = Object.fromEntries(fmtParts.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const h = +p.hour % 24;
  return {ms, day:`${p.year}-${p.month}-${p.day}`, month:`${p.year}-${p.month}`, sod:h * 3600 + +p.minute * 60 + +p.second};
}
const win = c => ({start:c.hour * 3600, end:c.hour * 3600 + c.durationMin * 60});
const instKey = (c, t) => `${c.id}@${t.day}`;

/* ---------- depo ---------- */
fs.mkdirSync(DATA_DIR, {recursive:true});
const DB_FILE = path.join(DATA_DIR, "db.json");
const fresh = () => ({users:{}, sessions:{}, attempts:{}, coupons:{}, brands:{}, orders:{}, reminders:[], prefs:{}, pushSubs:{}, ads:{}, events:[], outbox:[], log:[]});
let db = fs.existsSync(DB_FILE) ? Object.assign(fresh(), JSON.parse(fs.readFileSync(DB_FILE, "utf8"))) : fresh();
function save() { const tmp = DB_FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE); }

const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const rand = (n, abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789") => Array.from(crypto.randomBytes(n), b => abc[b % abc.length]).join("");
const money = K.money;
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const couponList = () => Object.values(db.coupons);
const winners = key => couponList().filter(x => x.key === key && x.source === "oyun").length;
function status(c, t) {
  const w = win(c);
  if (t.sod < w.start) return "yakinda";
  if (winners(instKey(c, t)) >= c.quota) return "doldu";
  return t.sod < w.end ? "aktif" : "bitti";
}
function couponStatus(cp, t = clock()) { return cp.refundedAt ? "iade" : cp.usedAt ? "kullanildi" : t.ms > cp.expiresAt ? "suresi_doldu" : "aktif"; }
const winsLeft = (u, t) => Math.max(0, D.dailyWinLimit - K.winsOn(couponList(), u.phone, t.day));
const prefsOf = phone => db.prefs[phone] = db.prefs[phone] || {push:false, sms:true, before5:true, onStart:true, expiry:true};
function normPhone(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("90") && d.length === 12) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return /^5\d{9}$/.test(d) ? "0" + d : null;
}

/* ---------- http yardımcıları ---------- */
class HttpError extends Error { constructor(status, code, msg) { super(msg); this.status = status; this.code = code; } }
const fail = (status, code, msg) => { throw new HttpError(status, code, msg); };
function send(res, status, body, type = "application/json; charset=utf-8") {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {"Content-Type":type, "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff"});
  res.end(data);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", ch => { size += ch.length; if (size > MAX_BODY) { reject(new HttpError(413, "govde_buyuk", "İstek gövdesi çok büyük.")); req.destroy(); } else chunks.push(ch); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
function parseJson(raw) { if (!raw) return {}; try { const v = JSON.parse(raw); if (v && typeof v === "object" && !Array.isArray(v)) return v; } catch { /* aşağıda */ } return fail(400, "gecersiz_json", "Gövde geçerli bir JSON nesnesi olmalı."); }
const bearer = req => (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function authUser(req) {
  const s = db.sessions[sha(bearer(req))];
  return (s && db.users[s.phone]) || fail(401, "giris_gerekli", "Giriş yapılmalı.");
}
function authAdmin(req) {
  if (!ADMIN_KEY || !safeEq(req.headers["x-admin-anahtar"] || "", ADMIN_KEY)) fail(401, "yetkisiz", "Yönetici anahtarı geçersiz.");
}
// Marka isteği: API anahtarı + HMAC-SHA256 imzası (gizli anahtar ile "zaman.gövde").
function authBrand(req, raw) {
  const brand = Object.values(db.brands).find(b => b.keyHash === sha(bearer(req)));
  if (!brand) fail(401, "yetkisiz", "API anahtarı geçersiz.");
  const ts = Number(req.headers["x-zaman"]), sig = String(req.headers["x-imza"] || "");
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > SIGN_WINDOW_SEC) fail(401, "zaman_asimi", "X-Zaman eksik ya da 5 dakikadan eski.");
  const expected = crypto.createHmac("sha256", brand.secret).update(`${ts}.${raw}`).digest("hex");
  if (!safeEq(sig.replace(/^sha256=/, ""), expected)) fail(401, "imza_gecersiz", "X-İmza doğrulanamadı.");
  return brand;
}
function audit(brand, type, code, result, extra = {}) {
  db.log.push({at:Date.now(), brand:brand.name, type, code, result, ...extra});
  if (db.log.length > 50000) db.log.splice(0, db.log.length - 50000);
}

/* ---------- bildirim kanalları ---------- */
// SMS: SMS_WEBHOOK_URL tanımlıysa sağlayıcının ağ geçidine {to, message} gönderilir; değilse giden kutusuna yazılır.
// Push: tarayıcı aboneliği saklanır; Web Push gönderimi için VAPID anahtarı ve "web-push" kütüphanesi eklenmeli (ENTEGRASYON.md).
async function deliver(u, title, body, link) {
  const p = prefsOf(u.phone), channels = [];
  if (p.sms && u.consentAt) {
    const msg = `${title}: ${body}`;
    if (SMS_WEBHOOK_URL) {
      try { const r = await fetch(SMS_WEBHOOK_URL, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({to:u.phone, message:msg}), signal:AbortSignal.timeout(10000)}); channels.push(r.ok ? "sms" : "sms_hata"); }
      catch { channels.push("sms_hata"); }
    } else channels.push("sms_giden_kutusu");
  }
  if (p.push && db.pushSubs[u.phone]) channels.push("push_giden_kutusu");
  db.outbox.push({at:nowFn(), to:u.phone, title, body, link, channels});
  if (db.outbox.length > 20000) db.outbox.splice(0, db.outbox.length - 20000);
}
// Zamanlayıcı: hatırlatmalar (5 dk kala, başladı) ve kupon bitişi (1 saat kala). Her 30 sn çalışır.
export async function runScheduler(ms = nowFn()) {
  const t = clock(ms), jobs = [];
  for (const r of db.reminders) {
    if (r.day !== t.day) continue;
    const c = campById(r.campId), u = db.users[r.phone], p = prefsOf(r.phone); if (!c || !u) continue;
    const toStart = win(c).start - t.sod;
    if (p.before5 && !r.s5 && toStart > 0 && toStart <= 300) { r.s5 = 1; jobs.push(deliver(u, `${c.brand} 5 dk sonra başlıyor`, `${K.CAT[c.cat].name} kampanyası birazdan açılıyor.`, `#/kampanya/${c.id}`)); }
    if (p.onStart && !r.s0 && toStart <= 0 && t.sod < win(c).end) { r.s0 = 1; jobs.push(deliver(u, `${c.brand} kampanyası başladı`, "Logoyu 5 saniyede bul, kuponu kap!", `#/kampanya/${c.id}`)); }
  }
  for (const cp of couponList()) {
    const u = db.users[cp.phone]; if (!u || cp.expNotified || couponStatus(cp, t) !== "aktif" || cp.expiresAt - t.ms > 3600e3) continue;
    if (!prefsOf(cp.phone).expiry) continue;
    cp.expNotified = 1; jobs.push(deliver(u, `${cp.brand} kuponunun süresi bitiyor`, `Kuponunu kullanmak için 1 saatten az kaldı (${cp.code}).`, "#/kuponlarim"));
  }
  await Promise.all(jobs);
  if (jobs.length) save();
  return jobs.length;
}
// Ödeme doğrulama adaptörü: canlıda ödeme kuruluşunun (iyzico, PayTR…) sonucu sunucudan sorgulanır.
function verifyPayment(ref, amount) {
  if (PAYMENT_MODE === "demo") return typeof ref === "string" && ref.length >= 4;
  return fail(501, "odeme_yapilandirilmadi", `Ödeme kuruluşu bağlanmadı (${amount} TL doğrulanamadı).`);
}

/* ---------- iş kuralları ---------- */
function issueCoupon(c, key, u, t, {source, pct = null, kind = null, fee = 0}) {
  const prefix = c.brand.normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  let code; do code = `${prefix}-${rand(6)}`; while (db.coupons[code]);
  const newMember = source === "oyun" && K.isNewMember(couponList(), u.phone);
  return db.coupons[code] = {code, key, campId:c.id, cat:c.cat, brand:c.brand, offer:source === "telafi" ? `Telafi: seçili ürünlerde %${pct} indirim` : c.offer,
    products:c.products, rules:source === "telafi" ? {pct, newMember:0, tiers:[]} : c.rules, newMember, source, telafiKind:kind, fee,
    phone:u.phone, day:t.day, issuedAt:t.ms, expiresAt:t.ms + c.validHours * 3600e3,
    validatedAt:null, usedAt:null, orderNo:null, gross:null, discount:null, paid:null, commission:null, refundedAt:null};
}
function couponForBrand(brand, rawCode, t) {
  const cp = db.coupons[String(rawCode ?? "").trim().toUpperCase()];
  if (!cp || cp.brand !== brand.name) return {ok:false, code:"kod_bulunamadi", reason:"Kod bu markaya ait değil ya da yok."};
  const st = couponStatus(cp, t);
  if (st !== "aktif") return {ok:false, code:st, reason:{kullanildi:"Kod daha önce kullanılmış.", suresi_doldu:"Kodun kullanım süresi dolmuş.", iade:"Kod iade edilmiş bir siparişte kullanılmış."}[st]};
  return {ok:true, cp};
}
const publicCoupon = cp => ({kod:cp.code, marka:cp.brand, kampanya:cp.campId, kampanyaMetni:cp.offer, gecerliUrunler:cp.products, tur:cp.source,
  indirim:{temel:cp.rules.pct, yeniUyeEk:cp.newMember ? cp.rules.newMember : 0, barem:cp.rules.tiers}, durum:couponStatus(cp),
  verildi:new Date(cp.issuedAt).toISOString(), sonKullanma:new Date(cp.expiresAt).toISOString()});
const calcOut = c => ({sepet:money(c.pay + c.discount), temelYuzde:c.basePct, baremYuzde:c.tierPct, yeniUyeYuzde:c.bonusPct, toplamYuzde:c.totalPct, indirim:c.discount, odenecek:c.pay});
const amountOf = body => Number(body.sepetTutari ?? body.tutar);

const routes = {
  /* kullanıcı */
  "POST /api/giris": async (req, body) => {
    const name = String(body.ad ?? "").trim().replace(/\s+/g, " "), phone = normPhone(body.telefon);
    if (name.length < 2) fail(400, "ad_gecersiz", "Ad en az 2 harf olmalı.");
    if (!phone) fail(400, "telefon_gecersiz", "Geçerli bir cep telefonu girin.");
    if (body.kvkkOnay !== true) fail(400, "kvkk_gerekli", "KVKK onayı gerekli.");
    // Canlıda burada SMS ile tek kullanımlık kod gönderilir ve doğrulanmadan oturum açılmaz.
    db.users[phone] = Object.assign(db.users[phone] || {phone, createdAt:nowFn()}, {name, consentAt:nowFn()});
    const token = rand(32, "abcdefghijklmnopqrstuvwxyz0123456789");
    db.sessions[sha(token)] = {phone, at:nowFn()}; save();
    return {token};
  },
  "GET /api/kampanyalar": async () => {
    const t = clock();
    return {saat:new Date(t.ms).toISOString(), kampanyalar:CAMPS.map(c => ({id:c.id, kategori:c.cat, marka:c.brand, baslik:c.title || null, metin:c.offer, gecerliUrunler:c.products,
      saat:c.hour, sureDk:c.durationMin, kontenjan:c.quota, kalan:Math.max(0, c.quota - winners(instKey(c, t))), durum:status(c, t), demo:!!c.demo,
      muhtesemFirsat:!!c.mono, indirim:c.rules, kuponGecerlilikSaat:c.validHours, linkler:K.campaignLinks(c)}))};
  },
  "POST /api/oyun/basla": async (req, body) => {
    const u = authUser(req), c = campById(body.kampanya), t = clock();
    if (!c) fail(404, "kampanya_yok", "Kampanya bulunamadı.");
    const st = status(c, t); if (st !== "aktif") fail(409, st, "Kampanya şu an aktif değil.");
    const key = instKey(c, t);
    if (db.attempts[key]?.[u.phone]) fail(409, "hak_kullanildi", "Bu kampanyada hakkını kullandın.");
    if (!winsLeft(u, t)) fail(409, "gunluk_hak", "Bugünkü kupon hakkını kullandın.");
    const board = shuffle([c.brand, ...shuffle(K.poolOf(c.cat).filter(b => b !== c.brand)).slice(0, D.boardSize - 1)]);
    const tiles = board.map(marka => ({token:rand(12), marka}));
    const att = {campId:c.id, startedAt:t.ms, target:tiles.find(x => x.marka === c.brand).token, result:null};
    (db.attempts[key] = db.attempts[key] || {})[u.phone] = att; save();
    return {deneme:key, logolar:tiles, muhtesemFirsat:!!c.mono, bitis:new Date(t.ms + c.findSec * 1000).toISOString()};
  },
  "POST /api/oyun/sec": async (req, body) => {
    const u = authUser(req), key = String(body.deneme ?? ""), att = db.attempts[key]?.[u.phone], t = clock();
    if (!att || att.result) fail(409, "hak_kullanildi", "Deneme bulunamadı ya da bitti.");
    const c = campById(att.campId), ms = t.ms - att.startedAt;
    att.ms = ms;
    att.result = ms > c.findSec * 1000 + GRACE_MS ? "sure_doldu" : body.token !== att.target ? "yanlis" : winners(key) >= c.quota ? "doldu" : !winsLeft(u, t) ? "gunluk_hak" : "kazandi";
    const cp = att.result === "kazandi" ? issueCoupon(c, key, u, t, {source:"oyun"}) : null;
    save();
    const lost = ["sure_doldu", "yanlis", "doldu"].includes(att.result);
    return {sonuc:att.result, sureMs:ms, kupon:cp && publicCoupon(cp),
      telafi:lost && K.telafiOn(couponList(), u.phone, t.day) < D.dailyTelafiLimit ? K.telafiOptions(c).map(o => ({tur:o.kind, yuzde:o.pct, aciklama:o.label})) : []};
  },
  // Reklamlı telafi: sunucu reklamın başladığı anı kaydeder; süre dolmadan kupon verilmez.
  "POST /api/reklam/basla": async (req, body) => {
    const u = authUser(req), att = db.attempts[String(body.deneme ?? "")]?.[u.phone];
    if (!att) fail(404, "deneme_yok", "Deneme bulunamadı.");
    const id = rand(16); db.ads[id] = {phone:u.phone, key:body.deneme, at:nowFn()}; save();
    return {reklamId:id, sureSn:campById(att.campId).telafi.adSec};
  },
  "POST /api/oyun/telafi": async (req, body) => {
    const u = authUser(req), key = String(body.deneme ?? ""), att = db.attempts[key]?.[u.phone], t = clock();
    const kind = {dusuk:"low", reklam:"ad", ucretli:"paid"}[body.tur];
    if (!kind) fail(400, "tur_gecersiz", "tur: dusuk | reklam | ucretli olmalı.");
    if (!att || !["sure_doldu", "yanlis", "doldu"].includes(att.result)) fail(409, "telafi_yok", "Bu deneme için telafi yok.");
    if (att.telafi) fail(409, "telafi_alindi", "Bu kampanya için telafi zaten alındı.");
    const c = campById(att.campId);
    if (key.split("@")[1] !== t.day || t.sod >= win(c).end) fail(409, "kampanya_kapandi", "Kampanya kapandı.");
    if (K.telafiOn(couponList(), u.phone, t.day) >= D.dailyTelafiLimit) fail(409, "telafi_limit", "Bugünkü telafi hakkını kullandın.");
    if (kind === "ad") {
      const ad = db.ads[String(body.reklamId ?? "")];
      if (!ad || ad.phone !== u.phone || ad.key !== key) fail(400, "reklam_yok", "Reklam kaydı bulunamadı.");
      if (t.ms - ad.at < c.telafi.adSec * 1000) fail(409, "reklam_bitmedi", "Reklam süresi dolmadı.");
      delete db.ads[body.reklamId];
    }
    if (kind === "paid" && !verifyPayment(body.odemeRef, c.telafi.fee)) fail(402, "odeme_dogrulanamadi", "Ödeme doğrulanamadı.");
    const opt = K.telafiOptions(c).find(o => o.kind === kind);
    att.telafi = kind;
    if (kind !== "low") db.events.push({type:kind === "ad" ? "reklam" : "odeme", phone:u.phone, campId:c.id, at:t.ms, amount:kind === "paid" ? c.telafi.fee : 0, ref:body.odemeRef || null});
    const cp = issueCoupon(c, key, u, t, {source:"telafi", pct:opt.pct, kind, fee:kind === "paid" ? c.telafi.fee : 0}); save();
    return {kupon:publicCoupon(cp)};
  },
  "GET /api/kuponlarim": async req => {
    const u = authUser(req);
    return {kuponlar:couponList().filter(x => x.phone === u.phone).map(publicCoupon)};
  },
  "GET /api/profil": async req => {
    const u = authUser(req), t = clock(), mine = couponList().filter(x => x.phone === u.phone), used = mine.filter(x => x.usedAt && !x.refundedAt);
    return {ad:u.name, telefon:u.phone, uyelik:new Date(u.createdAt).toISOString(), yeniUye:K.isNewMember(couponList(), u.phone),
      kazanc:money(used.reduce((s, x) => s + x.discount, 0)), alisveris:money(used.reduce((s, x) => s + x.paid, 0)),
      kazanilanKupon:mine.filter(x => x.source === "oyun").length, kullanilan:used.length, telafiKuponu:mine.filter(x => x.source === "telafi").length,
      gunlukHakKalan:winsLeft(u, t), bildirimAyarlari:prefsOf(u.phone)};
  },
  "POST /api/hatirlatma": async (req, body) => {
    const u = authUser(req), c = campById(body.kampanya), t = clock();
    if (!c) fail(404, "kampanya_yok", "Kampanya bulunamadı.");
    const i = db.reminders.findIndex(r => r.phone === u.phone && r.campId === c.id && r.day === t.day);
    if (i >= 0) db.reminders.splice(i, 1); else db.reminders.push({phone:u.phone, campId:c.id, day:t.day, at:t.ms});
    save(); return {kurulu:i < 0};
  },
  "GET /api/hatirlatmalar": async req => {
    const u = authUser(req), t = clock();
    return {hatirlatmalar:db.reminders.filter(r => r.phone === u.phone && r.day === t.day).map(r => ({kampanya:r.campId, gun:r.day}))};
  },
  "POST /api/bildirim-ayarlari": async (req, body) => {
    const u = authUser(req), p = prefsOf(u.phone);
    for (const k of ["push", "sms", "before5", "onStart", "expiry"]) if (typeof body[k] === "boolean") p[k] = body[k];
    save(); return {bildirimAyarlari:p};
  },
  "POST /api/push-abonelik": async (req, body) => {
    const u = authUser(req);
    if (!body.abonelik?.endpoint) fail(400, "abonelik_gecersiz", "PushSubscription nesnesi gerekli.");
    db.pushSubs[u.phone] = body.abonelik; save(); return {kaydedildi:true};
  },

  /* marka entegrasyonu */
  "POST /api/marka/kupon-dogrula": async (req, body, raw) => {
    const brand = authBrand(req, raw), t = clock(), r = couponForBrand(brand, body.kod, t);
    if (r.ok) { r.cp.validatedAt = r.cp.validatedAt || t.ms; r.cp.validations = (r.cp.validations || 0) + 1; }
    audit(brand, "dogrula", String(body.kod ?? ""), r.ok ? "gecerli" : r.code); save();
    if (!r.ok) return {gecerli:false, hata:r.code, mesaj:r.reason};
    const amount = amountOf(body);
    return {gecerli:true, kupon:publicCoupon(r.cp), hesap:amount > 0 ? calcOut(K.discount(r.cp.rules, amount, r.cp.newMember)) : null};
  },
  "POST /api/marka/siparis": async (req, body, raw) => {
    const brand = authBrand(req, raw), t = clock();
    const orderNo = String(body.siparisNo ?? "").trim(), amount = amountOf(body);
    if (!orderNo || orderNo.length > 100) fail(400, "siparis_no_gecersiz", "siparisNo gerekli (en fazla 100 karakter).");
    if (!(amount > 0) || amount > 10_000_000) fail(400, "tutar_gecersiz", "sepetTutari 0'dan büyük bir sayı olmalı (TL, KDV dahil, indirim öncesi kampanyalı ürünler).");
    const oKey = `${brand.id}:${orderNo}`, prev = db.orders[oKey];
    if (prev) {   // aynı sipariş tekrar gönderilirse ikinci kez sayılmaz (idempotent)
      if (prev.code !== String(body.kod ?? "").trim().toUpperCase()) fail(409, "siparis_cakisma", "Bu sipariş numarası başka bir kodla bildirilmiş.");
      const cp = db.coupons[prev.code];
      return {kaydedildi:true, tekrar:true, indirim:cp.discount, odenecek:cp.paid, komisyon:cp.commission};
    }
    const r = couponForBrand(brand, body.kod, t);
    if (!r.ok) { audit(brand, "siparis", String(body.kod ?? ""), r.code, {orderNo, amount}); save(); fail(409, r.code, r.reason); }
    const cp = r.cp, calc = K.discount(cp.rules, amount, cp.newMember);
    Object.assign(cp, {validatedAt:cp.validatedAt || t.ms, usedAt:t.ms, orderNo, gross:money(amount), discount:calc.discount, discountPct:calc.totalPct, paid:calc.pay, commission:money(calc.pay * RATE)});
    db.orders[oKey] = {code:cp.code, brandId:brand.id, at:t.ms};
    audit(brand, "siparis", cp.code, "kaydedildi", {orderNo, amount:cp.gross}); save();
    return {kaydedildi:true, tekrar:false, hesap:calcOut(calc), indirim:cp.discount, odenecek:cp.paid, komisyon:cp.commission, komisyonOrani:RATE};
  },
  "POST /api/marka/iade": async (req, body, raw) => {
    const brand = authBrand(req, raw), orderNo = String(body.siparisNo ?? "").trim();
    const o = db.orders[`${brand.id}:${orderNo}`]; if (!o) fail(404, "siparis_yok", "Sipariş bulunamadı.");
    const cp = db.coupons[o.code];
    const refund = body.iadeTutari === undefined ? cp.paid - (cp.refundTotal || 0) : Number(body.iadeTutari);
    const total = money((cp.refundTotal || 0) + refund);
    if (!(refund > 0) || total > cp.paid) fail(400, "iade_tutari_gecersiz", "iadeTutari 0'dan büyük olmalı; toplam iade ödenen tutarı aşamaz.");
    cp.refundTotal = total;
    cp.commission = money((cp.paid - cp.refundTotal) * RATE);
    if (cp.refundTotal >= cp.paid) cp.refundedAt = Date.now();
    audit(brand, "iade", cp.code, "kaydedildi", {orderNo, refund}); save();
    return {kaydedildi:true, kalanKomisyon:cp.commission};
  },

  /* yönetim */
  "POST /api/admin/marka": async (req, body) => {
    authAdmin(req);
    const name = String(body.ad ?? "").trim();
    if (!name) fail(400, "ad_gerekli", "Marka adı gerekli (kampanyadaki adla aynı).");
    const existing = Object.values(db.brands).find(b => b.name === name);
    const id = existing?.id || "m_" + rand(10, "abcdefghijklmnopqrstuvwxyz0123456789");
    const apiKey = "mk_" + crypto.randomBytes(24).toString("hex"), secret = "gz_" + crypto.randomBytes(32).toString("hex");
    db.brands[id] = {id, name, keyHash:sha(apiKey), secret, createdAt:Date.now()}; save();
    return {id, ad:name, apiAnahtari:apiKey, gizliAnahtar:secret, not:"Bu anahtarlar bir daha gösterilmez; markaya güvenli kanaldan iletin. Yeniden oluşturmak eskileri geçersiz kılar."};
  },
  "GET /api/admin/rapor": async (req, body, raw, url) => report(req, url),
  "GET /api/admin/giden-kutusu": async req => { authAdmin(req); return {mesajlar:db.outbox.slice(-200).reverse()}; },
  "GET /api/admin/kuponlar.csv": async (req, body, raw, url) => {
    const {ay} = report(req, url), t = clock();
    const rows = couponList().filter(cp => clock(cp.issuedAt).month === ay);
    const head = ["kod", "marka", "kampanya", "tur", "yeni_uye", "telefon", "verildi", "son_kullanma", "durum", "kasada_dogrulandi", "siparis_no", "siparis_tarihi", "sepet_tl", "indirim_tl", "odenen_tl", "iade_tl", "komisyon_tl", "telafi_ucreti"];
    const iso = ms => ms ? new Date(ms).toISOString() : "";
    const csv = "﻿" + [head, ...rows.map(cp => [cp.code, cp.brand, cp.campId, cp.source, cp.newMember ? 1 : 0, cp.phone, iso(cp.issuedAt), iso(cp.expiresAt), couponStatus(cp, t), iso(cp.validatedAt),
      cp.orderNo ?? "", iso(cp.usedAt), cp.gross ?? "", cp.discount ?? "", cp.paid ?? "", cp.refundTotal ?? "", cp.commission ?? "", cp.fee || ""])].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    return {__raw:csv, type:"text/csv; charset=utf-8"};
  }
};

// Aylık hakediş: marka başına kupon, doğrulama, sipariş, ciro, komisyon + kontrol listesi + telafi gelirleri.
function report(req, url) {
  authAdmin(req);
  const ay = url.searchParams.get("ay") || clock().month;
  if (!/^\d{4}-\d{2}$/.test(ay)) fail(400, "ay_gecersiz", "ay YYYY-AA biçiminde olmalı.");
  const t = clock(), brands = {}, checks = [];
  for (const cp of couponList()) {
    if (clock(cp.issuedAt).month !== ay) continue;
    const b = brands[cp.brand] = brands[cp.brand] || {marka:cp.brand, kupon:0, dogrulanan:0, siparis:0, sepet:0, indirim:0, odenen:0, iade:0, komisyon:0};
    b.kupon++; if (cp.validatedAt) b.dogrulanan++;
    if (cp.usedAt) { b.siparis++; b.sepet = money(b.sepet + cp.gross); b.indirim = money(b.indirim + cp.discount); b.odenen = money(b.odenen + cp.paid); b.iade = money(b.iade + (cp.refundTotal || 0)); b.komisyon = money(b.komisyon + cp.commission); }
    // Kasada doğrulandı ama sipariş bildirilmedi: satın alma gizlenmiş olabilir, markaya sorulmalı.
    if (cp.validatedAt && !cp.usedAt) checks.push({kod:cp.code, marka:cp.brand, dogrulandi:new Date(cp.validatedAt).toISOString(), dogrulamaSayisi:cp.validations || 1, durum:couponStatus(cp, t)});
  }
  const ev = db.events.filter(e => clock(e.at).month === ay);
  const list = Object.values(brands).sort((a, b) => b.komisyon - a.komisyon);
  return {ay, komisyonOrani:RATE, toplam:{kupon:list.reduce((s, b) => s + b.kupon, 0), siparis:list.reduce((s, b) => s + b.siparis, 0),
    odenen:money(list.reduce((s, b) => s + b.odenen, 0)), komisyon:money(list.reduce((s, b) => s + b.komisyon, 0)),
    telafiOdemesi:money(ev.filter(e => e.type === "odeme").reduce((s, e) => s + e.amount, 0)), reklamIzlenme:ev.filter(e => e.type === "reklam").length},
    markalar:list, kontrolEdilecek:checks};
}

/* ---------- statik dosyalar (site) ---------- */
const TYPES = {".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json", ".webmanifest":"application/manifest+json",
  ".png":"image/png", ".svg":"image/svg+xml", ".webp":"image/webp", ".jpg":"image/jpeg", ".md":"text/markdown; charset=utf-8"};
function serveStatic(res, pathname) {
  let rel; try { rel = decodeURIComponent(pathname === "/" ? "/index.html" : pathname); } catch { return send(res, 400, "Geçersiz yol", "text/plain; charset=utf-8"); }
  const file = path.resolve(ROOT, "." + rel);
  if (!file.startsWith(ROOT + path.sep) || file.startsWith(path.join(ROOT, "server") + path.sep) || file.startsWith(path.join(ROOT, "tools") + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile())
    return send(res, 404, "Bulunamadı", "text/plain; charset=utf-8");
  res.writeHead(200, {"Content-Type":TYPES[path.extname(file)] || "application/octet-stream", "X-Content-Type-Options":"nosniff"});
  fs.createReadStream(file).pipe(res);
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (!url.pathname.startsWith("/api/")) return req.method === "GET" ? serveStatic(res, url.pathname) : send(res, 405, {hata:"yontem"});
  const handler = routes[`${req.method} ${url.pathname}`];
  try {
    if (!handler) fail(404, "bulunamadi", "Böyle bir uç nokta yok.");
    const raw = req.method === "POST" ? await readBody(req) : "";
    const out = await handler(req, req.method === "POST" ? parseJson(raw) : {}, raw, url);
    if (out?.__raw !== undefined) return send(res, 200, out.__raw, out.type);
    send(res, 200, out);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, {hata:e.code, mesaj:e.message});
    console.error(e); send(res, 500, {hata:"sunucu", mesaj:"Beklenmeyen hata."});
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!ADMIN_KEY) console.warn("Uyarı: ADMIN_KEY tanımlı değil; yönetim uç noktaları kapalı.");
  if (PAYMENT_MODE === "demo") console.warn("Uyarı: PAYMENT_MODE=demo; ücretli telafi ödemeleri doğrulanmadan kabul edilir.");
  server.listen(PORT, () => console.log(`1 Milyonuncu Marka sunucusu: http://localhost:${PORT}`));
  setInterval(() => runScheduler().catch(e => console.error("zamanlayıcı", e)), 30_000).unref();
}
