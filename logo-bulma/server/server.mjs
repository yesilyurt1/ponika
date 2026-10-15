// 1 Milyonuncu Marka: platform sunucusu (bağımlılıksız Node.js 20+). Siteyi de sunar.
// Oyun, kişiye özel kupon, çoklu indirim, telafi, SMS kodlu giriş, hatırlatma/SMS/push zamanlayıcısı,
// marka entegrasyonu (imzalı kod doğrulama + sipariş/iade bildirimi), UTM tıklama takibi ve admin paneli API'si.
// İş kuralları sitenin de kullandığı kurallar.js'den gelir; iki taraf aynı hesabı yapar.
// Çalıştırma: ADMIN_KEY=gizli node server/server.mjs   (ayrıntı: CANLIYA-ALMA.md, ENTEGRASYON.md)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV = process.env;
const PORT = Number(ENV.PORT || 8080);
const DATA_DIR = path.resolve(ENV.DATA_DIR || path.join(ROOT, "server", "data"));
const ADMIN_KEY = ENV.ADMIN_KEY || "";
const SMS_MODE = ENV.SMS_MODE || (ENV.NETGSM_USER ? "netgsm" : ENV.SMS_WEBHOOK_URL ? "webhook" : "outbox");   // netgsm | webhook | dev | outbox
const SMS_WEBHOOK_URL = ENV.SMS_WEBHOOK_URL || "";
const PAYMENT_MODE = ENV.PAYMENT_MODE || "off";                                    // demo | off (ödeme kuruluşu bağlanınca: iyzico vb.)
const TRUST_PROXY = ENV.TRUST_PROXY === "1";                                      // Caddy/Nginx arkasında gerçek IP için
const SIGN_WINDOW_SEC = 300, GRACE_MS = 300, MAX_BODY = 512 * 1024, MAX_LOGO = 300 * 1024;
const SESSION_DAYS = 90, OTP_MIN = 5;

/* ---------- kampanya verisi ve kurallar: sitenin kullandığı dosyaların aynısı ---------- */
const ctx = vm.createContext({window:{}, URL});
for (const f of ["markalar.js", "data.js", "kurallar.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, {filename:f});
const D = ctx.window.LB_DATA, K = ctx.window.LB_KURALLAR;
const RATE = Number(ENV.COMMISSION || D.commissionRate);
const CAMPS = K.CAMPS, campById = K.campById, win = K.win;

/* ---------- saat (Türkiye) ---------- */
const fmtParts = new Intl.DateTimeFormat("en-GB", {timeZone:D.timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23"});
let nowFn = () => Date.now();
export const setNow = fn => { nowFn = fn; };   // testler için
function clock(ms = nowFn()) {
  const p = Object.fromEntries(fmtParts.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const h = +p.hour % 24;
  return {ms, day:`${p.year}-${p.month}-${p.day}`, month:`${p.year}-${p.month}`, sod:h * 3600 + +p.minute * 60 + +p.second};
}
const instKey = (c, t) => `${c.id}@${t.day}`;

/* ---------- depo: tek JSON dosyası, toplu ve atomik yazma, günlük yedek ---------- */
fs.mkdirSync(path.join(DATA_DIR, "logos"), {recursive:true});
fs.mkdirSync(path.join(DATA_DIR, "yedek"), {recursive:true});
const DB_FILE = path.join(DATA_DIR, "db.json");
const fresh = () => ({users:{}, sessions:{}, otps:{}, attempts:{}, coupons:{}, brands:{}, orders:{}, reminders:[], prefs:{}, pushSubs:{}, ads:{}, events:[], clicks:[], notifs:{}, outbox:[], logos:{}, log:[]});
let db = fs.existsSync(DB_FILE) ? Object.assign(fresh(), JSON.parse(fs.readFileSync(DB_FILE, "utf8"))) : fresh();
let dirty = false, writing = false;
function save() { dirty = true; if (!writing) setImmediate(flush); }
function flush() {
  if (!dirty) return;
  writing = true; dirty = false;
  const tmp = DB_FILE + ".tmp";
  try { fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE); }
  catch (e) { console.error("kayıt hatası", e); dirty = true; }
  writing = false;
  if (dirty) setImmediate(flush);
}
export function flushNow() { dirty = true; flush(); }
function backup() {
  const day = clock().day, file = path.join(DATA_DIR, "yedek", `db-${day}.json`);
  if (!fs.existsSync(file) && fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, file);
  const all = fs.readdirSync(path.join(DATA_DIR, "yedek")).filter(f => f.startsWith("db-")).sort();
  for (const f of all.slice(0, Math.max(0, all.length - 14))) fs.rmSync(path.join(DATA_DIR, "yedek", f));
}

const sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");
const rand = (n, abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789") => Array.from(crypto.randomBytes(n), b => abc[b % abc.length]).join("");
const money = K.money;
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const couponList = () => Object.values(db.coupons);
const winners = key => couponList().filter(x => x.key === key && x.source === "oyun" && !x.cancelledAt).length;
function status(c, t) {
  const w = win(c);
  if (t.sod < w.start) return "yakinda";
  if (winners(instKey(c, t)) >= c.quota) return "doldu";
  return t.sod < w.end ? "aktif" : "bitti";
}
function couponStatus(cp, t = clock()) { return cp.cancelledAt ? "iptal" : cp.refundedAt ? "iade" : cp.usedAt ? "kullanildi" : t.ms > cp.expiresAt ? "suresi_doldu" : "aktif"; }
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
const SEC_HEADERS = {"X-Content-Type-Options":"nosniff", "Referrer-Policy":"strict-origin-when-cross-origin", "X-Frame-Options":"DENY", "Permissions-Policy":"camera=(), microphone=(), geolocation=()"};
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
function send(res, status, body, type = "application/json; charset=utf-8", extra = {}) {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {"Content-Type":type, "Cache-Control":"no-store", ...SEC_HEADERS, ...extra});
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
const ipOf = req => (TRUST_PROXY && String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress || "?";

// İstek sınırlama (IP başına, kayan pencere)
const buckets = new Map();
function limit(req, name, max, windowMs) {
  const k = `${name}:${ipOf(req)}`, now = Date.now(), b = buckets.get(k) || [];
  const recent = b.filter(x => now - x < windowMs); recent.push(now); buckets.set(k, recent);
  if (recent.length > max) fail(429, "cok_fazla_istek", "Çok fazla istek; biraz sonra tekrar dene.");
}
setInterval(() => { const now = Date.now(); for (const [k, v] of buckets) if (!v.some(x => now - x < 3600e3)) buckets.delete(k); }, 600e3).unref();

function sessionUser(req) {
  const s = db.sessions[sha(bearer(req))];
  if (!s || s.exp < nowFn()) return null;
  return db.users[s.phone] || null;
}
function authUser(req) { return sessionUser(req) || fail(401, "giris_gerekli", "Giriş yapılmalı."); }
function authAdmin(req) {
  limit(req, "admin", 600, 60e3);
  if (!ADMIN_KEY || !safeEq(req.headers["x-admin-anahtar"] || "", ADMIN_KEY)) fail(401, "yetkisiz", "Yönetici anahtarı geçersiz.");
}
// Marka isteği: API anahtarı + HMAC-SHA256 imzası (gizli anahtar ile "zaman.gövde").
function authBrand(req, raw) {
  limit(req, "marka", 1200, 60e3);
  const brand = Object.values(db.brands).find(b => b.keyHash === sha(bearer(req)));
  if (!brand) fail(401, "yetkisiz", "API anahtarı geçersiz.");
  const ts = Number(req.headers["x-zaman"]), sig = String(req.headers["x-imza"] || "");
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > SIGN_WINDOW_SEC) fail(401, "zaman_asimi", "X-Zaman eksik ya da 5 dakikadan eski.");
  const expected = crypto.createHmac("sha256", brand.secret).update(`${ts}.${raw}`).digest("hex");
  if (!safeEq(sig.replace(/^sha256=/, ""), expected)) fail(401, "imza_gecersiz", "X-İmza doğrulanamadı.");
  return brand;
}
function audit(who, type, code, result, extra = {}) {
  db.log.push({at:Date.now(), who, type, code, result, ...extra});
  if (db.log.length > 50000) db.log.splice(0, db.log.length - 50000);
}

/* ---------- bildirim kanalları ---------- */
// SMS: SMS_MODE=netgsm iken Netgsm HTTP API'si (NETGSM_USER, NETGSM_PASS, NETGSM_HEADER = onaylı başlık);
// SMS_MODE=webhook iken SMS_WEBHOOK_URL'e {to, message} POST edilir (başka sağlayıcı için ara servis). Diğer modlarda giden kutusuna yazılır.
// Push: tarayıcı aboneliği saklanır; Web Push gönderimi için VAPID + "web-push" eklenmeli (ENTEGRASYON.md).
async function sendSms(to, message) {
  if (SMS_MODE === "netgsm") {
    const q = new URLSearchParams({usercode:ENV.NETGSM_USER, password:ENV.NETGSM_PASS || "", gsmno:"9" + to, message, msgheader:ENV.NETGSM_HEADER || "", dil:"TR"});
    try { const r = await fetch(`https://api.netgsm.com.tr/sms/send/get?${q}`, {signal:AbortSignal.timeout(10000)}); const txt = (await r.text()).trim();
      if (r.ok && /^0[012]\b/.test(txt)) return "sms"; console.error("Netgsm hatası:", txt.slice(0, 40)); return "sms_hata"; }
    catch { return "sms_hata"; }
  }
  if (SMS_MODE !== "webhook") return "sms_giden_kutusu";
  try { const r = await fetch(SMS_WEBHOOK_URL, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({to, message}), signal:AbortSignal.timeout(10000)}); return r.ok ? "sms" : "sms_hata"; }
  catch { return "sms_hata"; }
}
async function deliver(u, title, body, link, {forceSms = false} = {}) {
  const p = prefsOf(u.phone), channels = ["uygulama"];
  if ((p.sms || forceSms) && u.consentAt) channels.push(await sendSms(u.phone, `${title}: ${body}`));
  if (p.push && db.pushSubs[u.phone]) channels.push("push_giden_kutusu");
  const n = {id:rand(10), at:nowFn(), title, body, link, channels, read:false};
  (db.notifs[u.phone] = db.notifs[u.phone] || []).unshift(n); db.notifs[u.phone].splice(100);
  db.outbox.unshift({at:n.at, to:u.phone, title, body, link, channels}); db.outbox.splice(20000);
}
// Zamanlayıcı: hatırlatmalar (5 dk kala, başladı) ve kupon bitişi (1 saat kala). Her 30 sn çalışır.
export async function runScheduler(ms = nowFn()) {
  const t = clock(ms), jobs = [];
  for (const r of db.reminders) {
    if (r.day !== t.day) continue;
    const c = campById(r.campId), u = db.users[r.phone], p = prefsOf(r.phone); if (!c || !u) continue;
    const toStart = win(c).start - t.sod;
    if (p.before5 && !r.s5 && toStart > 0 && toStart <= 300) { r.s5 = 1; jobs.push(deliver(u, `${c.brand} 5 dk sonra başlıyor`, `${K.CAT[c.cat].name} kampanyası ${K.hhmm(c.start)}'de açılıyor.`, `#/kampanya/${c.id}`)); }
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
  return fail(501, "odeme_yapilandirilmadi", `Ücretli telafi henüz açık değil (ödeme kuruluşu bağlanmadı; ${amount} TL).`);
}

/* ---------- iş kuralları ---------- */
function issueCoupon(c, key, u, t, {source, pct = null, kind = null, fee = 0, test = false}) {
  const prefix = c.brand.normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  let code; do code = `${prefix}-${rand(6)}`; while (db.coupons[code]);
  const newMember = source === "oyun" && !test && K.isNewMember(couponList(), u.phone);
  return db.coupons[code] = {code, key, campId:c.id, cat:c.cat, brand:c.brand, title:c.title || null,
    offer:source === "telafi" ? `Telafi: ${c.products.toLocaleLowerCase("tr")} için %${pct} indirim` : c.offer,
    products:c.products, rules:source === "telafi" ? {pct, newMember:0, tiers:[]} : c.rules, newMember, source, telafiKind:kind, fee, test,
    phone:u.phone, name:u.name, day:t.day, issuedAt:t.ms, expiresAt:t.ms + c.validHours * 3600e3,
    validatedAt:null, usedAt:null, orderNo:null, gross:null, discount:null, discountPct:null, paid:null, commission:null, refundedAt:null, cancelledAt:null};
}
function couponForBrand(brandName, rawCode, t) {
  const cp = db.coupons[String(rawCode ?? "").trim().toUpperCase()];
  if (!cp || cp.brand !== brandName) return {ok:false, code:"kod_bulunamadi", reason:"Kod bu markaya ait değil ya da yok."};
  const st = couponStatus(cp, t);
  if (st !== "aktif") return {ok:false, code:st, reason:{kullanildi:"Kod daha önce kullanılmış.", suresi_doldu:"Kodun kullanım süresi dolmuş.", iade:"Kod iade edilmiş bir siparişte kullanılmış.", iptal:"Kod iptal edilmiş."}[st]};
  return {ok:true, cp};
}
const publicCoupon = cp => ({kod:cp.code, marka:cp.brand, kampanya:cp.campId, kampanyaMetni:cp.offer, gecerliUrunler:cp.products, tur:cp.source,
  indirim:{temel:cp.rules.pct, yeniUyeEk:cp.newMember ? cp.rules.newMember : 0, barem:cp.rules.tiers}, durum:couponStatus(cp),
  verildi:new Date(cp.issuedAt).toISOString(), sonKullanma:new Date(cp.expiresAt).toISOString()});
const calcOut = c => ({sepet:money(c.pay + c.discount), temelYuzde:c.basePct, baremYuzde:c.tierPct, yeniUyeYuzde:c.bonusPct, toplamYuzde:c.totalPct, indirim:c.discount, odenecek:c.pay});
const amountOf = body => Number(body.sepetTutari ?? body.tutar);
const LOST = ["sure_doldu", "yanlis", "doldu"];
// Marka siparişi (imzalı API ve admin kasa simülatörü aynı kuralı kullanır)
function placeOrder(brandId, brandName, body, who) {
  const t = clock(), orderNo = String(body.siparisNo ?? "").trim(), amount = amountOf(body);
  if (!orderNo || orderNo.length > 100) fail(400, "siparis_no_gecersiz", "siparisNo gerekli (en fazla 100 karakter).");
  if (!(amount > 0) || amount > 10_000_000) fail(400, "tutar_gecersiz", "sepetTutari 0'dan büyük bir sayı olmalı (TL, KDV dahil, indirim öncesi kampanyalı ürünler).");
  const oKey = `${brandId}:${orderNo}`, prev = db.orders[oKey];
  if (prev) {   // aynı sipariş tekrar gönderilirse ikinci kez sayılmaz (idempotent)
    if (prev.code !== String(body.kod ?? "").trim().toUpperCase()) fail(409, "siparis_cakisma", "Bu sipariş numarası başka bir kodla bildirilmiş.");
    return {tekrar:true, cp:db.coupons[prev.code], calc:null};
  }
  const r = couponForBrand(brandName, body.kod, t);
  if (!r.ok) { audit(who, "siparis", String(body.kod ?? ""), r.code, {orderNo, amount}); save(); fail(409, r.code, r.reason); }
  const cp = r.cp, calc = K.discount(cp.rules, amount, cp.newMember);
  Object.assign(cp, {validatedAt:cp.validatedAt || t.ms, usedAt:t.ms, orderNo, gross:money(amount), discount:calc.discount, discountPct:calc.totalPct, paid:calc.pay, commission:money(calc.pay * RATE)});
  db.orders[oKey] = {code:cp.code, brandId, at:t.ms};
  audit(who, "siparis", cp.code, "kaydedildi", {orderNo, amount:cp.gross}); save();
  return {tekrar:false, cp, calc};
}
function validateCode(brandName, body, who) {
  const t = clock(), r = couponForBrand(brandName, body.kod, t);
  if (r.ok) { r.cp.validatedAt = r.cp.validatedAt || t.ms; r.cp.validations = (r.cp.validations || 0) + 1; }
  audit(who, "dogrula", String(body.kod ?? ""), r.ok ? "gecerli" : r.code); save();
  const amount = amountOf(body);
  return r.ok ? {ok:true, cp:r.cp, calc:amount > 0 ? K.discount(r.cp.rules, amount, r.cp.newMember) : null} : {ok:false, code:r.code, reason:r.reason};
}
const LOGO_TYPES = {"image/png":".png", "image/svg+xml":".svg", "image/webp":".webp", "image/jpeg":".jpg"};
const slug = s => s.toLocaleLowerCase("tr").replace(/[çğıöşü]/g, ch => ({ç:"c", ğ:"g", ı:"i", ö:"o", ş:"s", ü:"u"}[ch])).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "marka";

const routes = {
  "GET /api/saglik": async () => ({ok:true, surum:"3", zaman:new Date(nowFn()).toISOString()}),

  /* giriş: SMS ile tek kullanımlık kod */
  "POST /api/giris/kod": async (req, body) => {
    limit(req, "otp", 5, 10 * 60e3);
    const phone = normPhone(body.telefon);
    if (!phone) fail(400, "telefon_gecersiz", "Geçerli bir cep telefonu girin.");
    const prev = db.otps[phone];
    if (prev && nowFn() - prev.at < 60e3) fail(429, "bekle", "Yeni kod için 1 dakika bekle.");
    if (SMS_MODE === "outbox" && !ENV.ALLOW_OUTBOX_LOGIN) fail(503, "sms_yapilandirilmadi", "SMS sağlayıcısı bağlanmadı; giriş kodu gönderilemiyor.");
    const code = String(crypto.randomInt(100000, 1000000));
    db.otps[phone] = {hash:sha(`${phone}:${code}`), at:nowFn(), exp:nowFn() + OTP_MIN * 60e3, tries:0}; save();
    const ch = await sendSms(phone, `1 Milyonuncu Marka giriş kodun: ${code}. ${OTP_MIN} dakika geçerlidir.`);
    db.outbox.unshift({at:nowFn(), to:phone, title:"Giriş kodu", body:"(kod gizli)", channels:[ch]}); db.outbox.splice(20000);
    return {gonderildi:true, ...(SMS_MODE === "dev" ? {gelistirmeKodu:code} : {})};
  },
  "POST /api/giris": async (req, body) => {
    limit(req, "giris", 20, 10 * 60e3);
    const name = String(body.ad ?? "").trim().replace(/\s+/g, " ").slice(0, 60), phone = normPhone(body.telefon);
    if (name.length < 2) fail(400, "ad_gecersiz", "Ad en az 2 harf olmalı.");
    if (!phone) fail(400, "telefon_gecersiz", "Geçerli bir cep telefonu girin.");
    if (body.kvkkOnay !== true) fail(400, "kvkk_gerekli", "KVKK onayı gerekli.");
    const o = db.otps[phone];
    if (!o || o.exp < nowFn()) fail(400, "kod_suresi_doldu", "Kodun süresi doldu; yeni kod iste.");
    if (++o.tries > 5) { delete db.otps[phone]; save(); fail(429, "cok_deneme", "Çok fazla hatalı deneme; yeni kod iste."); }
    if (!safeEq(o.hash, sha(`${phone}:${String(body.kod ?? "").trim()}`))) { save(); fail(400, "kod_hatali", "Kod hatalı."); }
    delete db.otps[phone];
    const now = nowFn();
    db.users[phone] = Object.assign(db.users[phone] || {phone, createdAt:now}, {name, consentAt:now, lastSeen:now});
    const token = rand(40, "abcdefghijklmnopqrstuvwxyz0123456789");
    db.sessions[sha(token)] = {phone, at:now, exp:now + SESSION_DAYS * 86400e3}; save();
    return {token};
  },
  "POST /api/cikis": async req => { delete db.sessions[sha(bearer(req))]; save(); return {ok:true}; },

  /* sitenin anlık durumu: sayaçlar + giriş yapmışsa kişisel veriler */
  "GET /api/durum": async req => {
    const t = clock(), u = sessionUser(req), counts = {};
    for (const cp of couponList()) if (cp.day === t.day && cp.source === "oyun" && !cp.cancelledAt) counts[cp.key] = (counts[cp.key] || 0) + 1;
    const out = {simdi:t.ms, sayaclar:counts, odeme:PAYMENT_MODE !== "off", ben:null};
    if (!u) return out;
    u.lastSeen = t.ms;
    const mine = {};
    for (const [key, m] of Object.entries(db.attempts)) { const a = m[u.phone]; if (a) mine[key] = {result:a.result, ms:a.ms, startedAt:a.startedAt, telafi:a.telafi || null}; }
    return {...out, ben:{phone:u.phone, name:u.name, createdAt:u.createdAt, blocked:!!u.blocked, prefs:prefsOf(u.phone)}, denemeler:mine,
      kuponlar:couponList().filter(x => x.phone === u.phone), hatirlatmalar:db.reminders.filter(r => r.phone === u.phone && r.day >= t.day),
      bildirimler:(db.notifs[u.phone] || []).slice(0, 50)};
  },
  "GET /api/kampanyalar": async () => {
    const t = clock();
    return {saat:new Date(t.ms).toISOString(), kampanyalar:CAMPS.map(c => ({id:c.id, kategori:c.cat, marka:c.brand, baslik:c.title || null, metin:c.offer, gecerliUrunler:c.products,
      baslangic:c.demo ? null : K.hhmm(c.start), sureDk:c.demo ? null : c.durationMin, kontenjan:c.quota, kalan:Math.max(0, c.quota - winners(instKey(c, t))), durum:status(c, t), demo:!!c.demo,
      muhtesemFirsat:!!c.mono, logoSayisi:c.boardSize, indirim:c.rules, kuponGecerlilikSaat:c.validHours, linkler:K.campaignLinks(c)}))};
  },

  /* oyun */
  "POST /api/oyun/basla": async (req, body) => {
    limit(req, "oyun", 120, 60e3);
    const u = authUser(req), c = campById(body.kampanya), t = clock();
    if (!c) fail(404, "kampanya_yok", "Kampanya bulunamadı.");
    if (u.blocked) fail(403, "engelli", "Hesabın kampanyalara katılıma kapatıldı.");
    const st = status(c, t); if (st !== "aktif") fail(409, st, "Kampanya şu an aktif değil.");
    const key = instKey(c, t);
    if (db.attempts[key]?.[u.phone]) fail(409, "hak_kullanildi", "Bu kampanyada hakkını kullandın.");
    const n = K.boardSizeFor(c, body.boyut);
    const board = shuffle([c.brand, ...shuffle(K.poolOf(c.cat).filter(b => b !== c.brand)).slice(0, n - 1)]);
    const tiles = board.map(marka => ({token:rand(12), marka}));
    const att = {campId:c.id, startedAt:t.ms, target:tiles.find(x => x.marka === c.brand).token, result:null};
    (db.attempts[key] = db.attempts[key] || {})[u.phone] = att; save();
    return {deneme:key, logolar:tiles, sureMs:c.findSec * 1000, muhtesemFirsat:!!c.mono};
  },
  "POST /api/oyun/sec": async (req, body) => {
    limit(req, "oyun", 120, 60e3);
    const u = authUser(req), key = String(body.deneme ?? ""), att = db.attempts[key]?.[u.phone], t = clock();
    if (!att || att.result) fail(409, "hak_kullanildi", "Deneme bulunamadı ya da bitti.");
    const c = campById(att.campId), ms = t.ms - att.startedAt;
    att.ms = ms;
    att.result = ms > c.findSec * 1000 + GRACE_MS ? "sure_doldu" : body.token !== att.target ? "yanlis" : winners(key) >= c.quota ? "doldu" : "kazandi";
    const cp = att.result === "kazandi" ? issueCoupon(c, key, u, t, {source:"oyun"}) : null;
    save();
    return {sonuc:att.result, sureMs:ms, kupon:cp, hedef:att.result === "kazandi" ? undefined : att.target,
      telafi:LOST.includes(att.result) ? K.telafiOptions(c).map(o => ({tur:o.kind, yuzde:o.pct, aciklama:o.label})) : []};
  },
  "POST /api/oyun/zaman-asimi": async (req, body) => {
    const u = authUser(req), key = String(body.deneme ?? ""), att = db.attempts[key]?.[u.phone];
    if (!att) fail(404, "deneme_yok", "Deneme bulunamadı.");
    if (!att.result) { att.result = "sure_doldu"; att.ms = nowFn() - att.startedAt; save(); }
    return {sonuc:att.result, hedef:att.result === "kazandi" ? undefined : att.target};
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
    if (!att || !LOST.includes(att.result)) fail(409, "telafi_yok", "Bu deneme için telafi yok.");
    if (att.telafi) fail(409, "telafi_alindi", "Bu kampanya için telafi zaten alındı.");
    const c = campById(att.campId);
    if (key.split("@")[1] !== t.day || t.sod >= win(c).end) fail(409, "kampanya_kapandi", "Kampanya kapandı.");
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
    return {kupon:cp};
  },
  "GET /api/kuponlarim": async req => { const u = authUser(req); return {kuponlar:couponList().filter(x => x.phone === u.phone).map(publicCoupon)}; },
  "GET /api/profil": async req => {
    const u = authUser(req), mine = couponList().filter(x => x.phone === u.phone), used = mine.filter(x => x.usedAt && !x.refundedAt);
    return {ad:u.name, telefon:u.phone, uyelik:new Date(u.createdAt).toISOString(), yeniUye:K.isNewMember(couponList(), u.phone),
      kazanc:money(used.reduce((s, x) => s + x.discount, 0)), alisveris:money(used.reduce((s, x) => s + x.paid, 0)),
      kazanilanKupon:mine.filter(x => x.source === "oyun").length, kullanilan:used.length, telafiKuponu:mine.filter(x => x.source === "telafi").length, bildirimAyarlari:prefsOf(u.phone)};
  },
  "POST /api/hatirlatma": async (req, body) => {
    const u = authUser(req), c = campById(body.kampanya), t = clock();
    if (!c) fail(404, "kampanya_yok", "Kampanya bulunamadı.");
    const i = db.reminders.findIndex(r => r.phone === u.phone && r.campId === c.id && r.day === t.day);
    if (i >= 0) db.reminders.splice(i, 1); else db.reminders.push({phone:u.phone, campId:c.id, day:t.day, at:t.ms});
    save(); return {kurulu:i < 0};
  },
  "POST /api/bildirim-ayarlari": async (req, body) => {
    const u = authUser(req), p = prefsOf(u.phone);
    for (const k of ["push", "sms", "before5", "onStart", "expiry"]) if (typeof body[k] === "boolean") p[k] = body[k];
    save(); return {bildirimAyarlari:p};
  },
  "POST /api/bildirimler/okundu": async req => { const u = authUser(req); (db.notifs[u.phone] || []).forEach(n => n.read = true); save(); return {ok:true}; },
  "POST /api/push-abonelik": async (req, body) => {
    const u = authUser(req);
    if (!body.abonelik?.endpoint) fail(400, "abonelik_gecersiz", "PushSubscription nesnesi gerekli.");
    db.pushSubs[u.phone] = body.abonelik; save(); return {kaydedildi:true};
  },

  /* marka entegrasyonu (imzalı) */
  "POST /api/marka/kupon-dogrula": async (req, body, raw) => {
    const brand = authBrand(req, raw), r = validateCode(brand.name, body, brand.name);
    return r.ok ? {gecerli:true, kupon:publicCoupon(r.cp), hesap:r.calc ? calcOut(r.calc) : null} : {gecerli:false, hata:r.code, mesaj:r.reason};
  },
  "POST /api/marka/siparis": async (req, body, raw) => {
    const brand = authBrand(req, raw), r = placeOrder(brand.id, brand.name, body, brand.name);
    return {kaydedildi:true, tekrar:r.tekrar, ...(r.calc ? {hesap:calcOut(r.calc)} : {}), indirim:r.cp.discount, odenecek:r.cp.paid, komisyon:r.cp.commission, komisyonOrani:RATE};
  },
  "POST /api/marka/iade": async (req, body, raw) => {
    const brand = authBrand(req, raw), orderNo = String(body.siparisNo ?? "").trim();
    const o = db.orders[`${brand.id}:${orderNo}`]; if (!o) fail(404, "siparis_yok", "Sipariş bulunamadı.");
    const cp = db.coupons[o.code];
    const refund = body.iadeTutari === undefined ? cp.paid - (cp.refundTotal || 0) : Number(body.iadeTutari);
    const total = money((cp.refundTotal || 0) + refund);
    if (!(refund > 0) || total > cp.paid) fail(400, "iade_tutari_gecersiz", "iadeTutari 0'dan büyük olmalı; toplam iade ödenen tutarı aşamaz.");
    cp.refundTotal = total; cp.commission = money((cp.paid - cp.refundTotal) * RATE);
    if (cp.refundTotal >= cp.paid) cp.refundedAt = Date.now();
    audit(brand.name, "iade", cp.code, "kaydedildi", {orderNo, refund}); save();
    return {kaydedildi:true, kalanKomisyon:cp.commission};
  },

  /* yönetim */
  "GET /api/admin/veri": async req => {
    authAdmin(req);
    const attempts = [];
    for (const [key, m] of Object.entries(db.attempts)) for (const [phone, a] of Object.entries(m)) attempts.push({key, phone, result:a.result, ms:a.ms, startedAt:a.startedAt, telafi:a.telafi || null});
    return {users:Object.values(db.users), coupons:couponList(), attempts, reminders:db.reminders, clicks:db.clicks, events:db.events, outbox:db.outbox.slice(0, 500),
      brands:Object.values(db.brands).map(b => ({id:b.id, name:b.name, createdAt:b.createdAt}))};
  },
  "POST /api/admin/islem": async (req, body) => {
    authAdmin(req);
    const t = clock(), cp = body.kod && db.coupons[body.kod], u = body.telefon && db.users[body.telefon], tur = body.tur;
    if (tur === "kupon_iptal" && cp) cp.cancelledAt = t.ms;
    else if (tur === "kupon_uzat" && cp) { cp.expiresAt = Math.max(cp.expiresAt, t.ms) + 24 * 3600e3; cp.expNotified = 0; }
    else if (tur === "kupon_kullanildi" && cp) {
      const amount = Number(body.sepetTutari); if (!(amount > 0)) fail(400, "tutar_gecersiz", "Sepet tutarı gerekli.");
      const calc = K.discount(cp.rules, amount, cp.newMember);
      Object.assign(cp, {validatedAt:cp.validatedAt || t.ms, usedAt:t.ms, orderNo:String(body.siparisNo || "ELLE").slice(0, 100), gross:money(amount), discount:calc.discount, discountPct:calc.totalPct, paid:calc.pay, commission:money(calc.pay * RATE), manual:true});
    } else if (tur === "iade" && cp && cp.usedAt && !cp.refundedAt) { cp.refundedAt = t.ms; cp.refundTotal = cp.paid; cp.refundedCommission = cp.commission; cp.commission = 0; }
    else if (tur === "uye_engelle" && u) u.blocked = !u.blocked;
    else if (tur === "uye_sil" && u) {
      const ph = body.telefon;
      delete db.users[ph]; delete db.prefs[ph]; delete db.pushSubs[ph]; delete db.notifs[ph]; delete db.otps[ph];
      for (const [k, s] of Object.entries(db.sessions)) if (s.phone === ph) delete db.sessions[k];
      db.reminders = db.reminders.filter(r => r.phone !== ph);
      const anon = "silindi-" + sha(ph).slice(0, 8);
      for (const x of couponList()) if (x.phone === ph) { x.phone = anon; x.name = "Silinen üye"; }
      for (const m of Object.values(db.attempts)) if (m[ph]) { m[anon] = m[ph]; delete m[ph]; }
      db.outbox.forEach(o => { if (o.to === ph) o.to = anon; });
    } else if (tur === "sms_gonder") {
      const list = body.hedef === "hatirlatma" ? [...new Set(db.reminders.filter(r => r.campId === body.kampanya && r.day === t.day).map(r => r.phone))] : [body.telefon];
      const msg = String(body.mesaj || "").slice(0, 300), title = String(body.baslik || "1 Milyonuncu Marka").slice(0, 80);
      if (!msg) fail(400, "mesaj_gerekli", "Mesaj gerekli.");
      let n = 0; for (const ph of list) { const uu = db.users[ph]; if (uu) { await deliver(uu, title, msg, body.link || "#/", {forceSms:true}); n++; } }
      audit("admin", "sms", null, "gonderildi", {n}); save(); return {gonderilen:n};
    } else fail(400, "islem_gecersiz", "Bilinmeyen işlem ya da kayıt bulunamadı.");
    audit("admin", tur, body.kod || body.telefon, "tamam"); save(); return {ok:true};
  },
  "POST /api/admin/kasa": async (req, body) => {
    authAdmin(req);
    const brandName = String(body.marka || "");
    try {
      if (body.adim === "order") {
        const r = placeOrder(`sim:${brandName}`, brandName, body, "admin-kasa");
        return {ok:true, tekrar:r.tekrar, kupon:r.cp, hesap:r.calc ? calcOut(r.calc) : null};
      }
      const r = validateCode(brandName, body, "admin-kasa");
      return r.ok ? {ok:true, kupon:r.cp, hesap:r.calc ? calcOut(r.calc) : null} : {ok:false, mesaj:r.reason};
    } catch (e) { if (e instanceof HttpError) return {ok:false, mesaj:e.message}; throw e; }
  },
  "POST /api/admin/logo": async (req, body) => {
    authAdmin(req);
    const brand = String(body.marka || "").trim(), m = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(body.dosya || ""));
    if (!brand || brand.length > 80) fail(400, "marka_gerekli", "Marka adı gerekli.");
    if (!m || !LOGO_TYPES[m[1]]) fail(400, "dosya_gecersiz", "PNG, SVG, WebP ya da JPG yükleyin.");
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > MAX_LOGO) fail(413, "dosya_buyuk", "Dosya 300 KB'tan büyük.");
    const old = db.logos[brand]; if (old) fs.rmSync(path.join(DATA_DIR, "logos", path.basename(old)), {force:true});
    const file = `${slug(brand)}-${rand(4, "abcdefghijkmnpqrstuvwxyz23456789")}${LOGO_TYPES[m[1]]}`;
    fs.writeFileSync(path.join(DATA_DIR, "logos", file), buf);
    db.logos[brand] = `yuklenen-logolar/${file}`; audit("admin", "logo", brand, "yuklendi"); save();
    return {yol:db.logos[brand]};
  },
  "POST /api/admin/logo-sil": async (req, body) => {
    authAdmin(req);
    const p = db.logos[body.marka]; if (!p) fail(404, "logo_yok", "Bu markaya yüklenmiş logo yok.");
    fs.rmSync(path.join(DATA_DIR, "logos", path.basename(p)), {force:true}); delete db.logos[body.marka]; save();
    return {ok:true};
  },
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
  "GET /api/admin/giden-kutusu": async req => { authAdmin(req); return {mesajlar:db.outbox.slice(0, 200)}; },
  "GET /api/admin/kuponlar.csv": async (req, body, raw, url) => {
    const {ay} = report(req, url), t = clock();
    const rows = couponList().filter(cp => clock(cp.issuedAt).month === ay);
    const head = ["kod", "marka", "kampanya", "tur", "yeni_uye", "ad", "telefon", "verildi", "son_kullanma", "durum", "link_tiklama", "kasada_dogrulandi", "siparis_no", "siparis_tarihi", "sepet_tl", "indirim_tl", "odenen_tl", "iade_tl", "komisyon_tl", "telafi_ucreti"];
    const iso = ms => ms ? new Date(ms).toISOString() : "";
    const csv = "﻿" + [head, ...rows.map(cp => [cp.code, cp.brand, cp.campId, cp.source, cp.newMember ? 1 : 0, cp.name || "", cp.phone, iso(cp.issuedAt), iso(cp.expiresAt), couponStatus(cp, t),
      db.clicks.filter(k => k.code === cp.code).length, iso(cp.validatedAt), cp.orderNo ?? "", iso(cp.usedAt), cp.gross ?? "", cp.discount ?? "", cp.paid ?? "", cp.refundTotal ?? "", cp.commission ?? "", cp.fee || ""])]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    return {__raw:csv, type:"text/csv; charset=utf-8"};
  }
};

// Aylık hakediş: marka başına kupon, tıklama, doğrulama, sipariş, ciro, komisyon + kontrol listesi + telafi gelirleri.
function report(req, url) {
  authAdmin(req);
  const ay = url.searchParams.get("ay") || clock().month;
  if (!/^\d{4}-\d{2}$/.test(ay)) fail(400, "ay_gecersiz", "ay YYYY-AA biçiminde olmalı.");
  const t = clock(), brands = {}, checks = [];
  for (const cp of couponList()) {
    if (clock(cp.issuedAt).month !== ay || cp.test) continue;
    const b = brands[cp.brand] = brands[cp.brand] || {marka:cp.brand, kupon:0, tiklanan:0, dogrulanan:0, siparis:0, sepet:0, indirim:0, odenen:0, iade:0, komisyon:0};
    b.kupon++; if (db.clicks.some(k => k.code === cp.code)) b.tiklanan++; if (cp.validatedAt) b.dogrulanan++;
    if (cp.usedAt) { b.siparis++; b.sepet = money(b.sepet + cp.gross); b.indirim = money(b.indirim + cp.discount); b.odenen = money(b.odenen + cp.paid); b.iade = money(b.iade + (cp.refundTotal || 0)); b.komisyon = money(b.komisyon + cp.commission); }
    // Kasada doğrulandı ama sipariş bildirilmedi: satın alma gizlenmiş olabilir, markaya sorulmalı.
    if (cp.validatedAt && !cp.usedAt && !cp.cancelledAt) checks.push({kod:cp.code, marka:cp.brand, dogrulandi:new Date(cp.validatedAt).toISOString(), dogrulamaSayisi:cp.validations || 1, durum:couponStatus(cp, t)});
  }
  const ev = db.events.filter(e => clock(e.at).month === ay);
  const list = Object.values(brands).sort((a, b) => b.komisyon - a.komisyon);
  return {ay, komisyonOrani:RATE, toplam:{kupon:list.reduce((s, b) => s + b.kupon, 0), siparis:list.reduce((s, b) => s + b.siparis, 0),
    odenen:money(list.reduce((s, b) => s + b.odenen, 0)), komisyon:money(list.reduce((s, b) => s + b.komisyon, 0)),
    telafiOdemesi:money(ev.filter(e => e.type === "odeme").reduce((s, e) => s + e.amount, 0)), reklamIzlenme:ev.filter(e => e.type === "reklam").length},
    markalar:list, kontrolEdilecek:checks};
}

/* ---------- UTM yönlendirme: /r/KOD/linkNo → tıklamayı kaydet, markanın sitesine UTM'li git ---------- */
function redirect(req, res, url) {
  const [, , code, i] = url.pathname.split("/");
  const cp = db.coupons[decodeURIComponent(code || "")], c = cp && campById(cp.campId);
  const link = c && K.campaignLinks(c, cp.code)[Number(i) || 0];
  if (!link) return send(res, 302, "", "text/plain", {Location:"/#/kuponlarim"});
  db.clicks.push({code:cp.code, at:nowFn(), link:Number(i) || 0, ad:link.ad, ip:sha(ipOf(req)).slice(0, 12)});
  if (db.clicks.length > 200000) db.clicks.splice(0, db.clicks.length - 200000);
  save();
  send(res, 302, "", "text/plain", {Location:link.url});
}

/* ---------- statik dosyalar (site) ---------- */
const TYPES = {".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json", ".webmanifest":"application/manifest+json",
  ".png":"image/png", ".svg":"image/svg+xml", ".webp":"image/webp", ".jpg":"image/jpeg", ".ico":"image/x-icon"};
const PUBLIC = new Set(["index.html", "styles.css", "app.js", "data.js", "kurallar.js", "markalar.js", "sw.js", "manifest.webmanifest"]);
function serveStatic(req, res, pathname) {
  // Sunucu modu bayrağı ve yüklenen logolar dinamik
  if (pathname === "/config.js") return send(res, 200, "window.LB_SERVER = true;\n", "text/javascript; charset=utf-8");
  if (pathname === "/logos/manifest.js") {
    let base = {}; try { const c2 = vm.createContext({window:{}}); vm.runInContext(fs.readFileSync(path.join(ROOT, "logos", "manifest.js"), "utf8"), c2); base = c2.window.LB_LOGOS || {}; } catch { /* yok */ }
    return send(res, 200, `window.LB_LOGOS = ${JSON.stringify({...base, ...db.logos})};\n`, "text/javascript; charset=utf-8");
  }
  if (pathname.startsWith("/yuklenen-logolar/")) {
    const f = path.join(DATA_DIR, "logos", path.basename(decodeURIComponent(pathname)));
    if (!fs.existsSync(f)) return send(res, 404, "Bulunamadı", "text/plain; charset=utf-8");
    res.writeHead(200, {"Content-Type":TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control":"public, max-age=86400", ...SEC_HEADERS, "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; sandbox"});
    return fs.createReadStream(f).pipe(res);
  }
  let rel; try { rel = decodeURIComponent(pathname === "/" ? "/index.html" : pathname).replace(/^\/+/, ""); } catch { return send(res, 400, "Geçersiz yol", "text/plain; charset=utf-8"); }
  const allowed = PUBLIC.has(rel) || /^icons\/[\w.-]+\.png$/.test(rel) || /^logos\/[\w-]+\/[\w.-]+\.(png|svg|webp|jpg)$/.test(rel);
  const file = path.resolve(ROOT, rel);
  if (!allowed || !file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, "Bulunamadı", "text/plain; charset=utf-8");
  const isHtml = rel.endsWith(".html");
  res.writeHead(200, {"Content-Type":TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control":isHtml || rel === "sw.js" ? "no-cache" : "public, max-age=3600", ...SEC_HEADERS, ...(isHtml ? {"Content-Security-Policy":CSP} : {})});
  fs.createReadStream(file).pipe(res);
}

export const server = http.createServer(async (req, res) => {
  let url; try { url = new URL(req.url, "http://x"); } catch { return send(res, 400, {hata:"istek"}); }
  if (url.pathname.startsWith("/r/")) return redirect(req, res, url);
  if (!url.pathname.startsWith("/api/")) return req.method === "GET" || req.method === "HEAD" ? serveStatic(req, res, url.pathname) : send(res, 405, {hata:"yontem"});
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
  if (!ADMIN_KEY || ADMIN_KEY.length < 16) { console.error("Hata: ADMIN_KEY en az 16 karakter olmalı."); process.exit(1); }
  if (SMS_MODE === "dev") console.warn("Uyarı: SMS_MODE=dev; giriş kodları yanıtta görünür. Yalnız test için.");
  if (PAYMENT_MODE === "demo") console.warn("Uyarı: PAYMENT_MODE=demo; ücretli telafi ödemesi doğrulanmadan kabul edilir.");
  server.listen(PORT, () => console.log(`1 Milyonuncu Marka: http://localhost:${PORT} (SMS: ${SMS_MODE}, ödeme: ${PAYMENT_MODE})`));
  setInterval(() => runScheduler().catch(e => console.error("zamanlayıcı", e)), 30_000).unref();
  backup(); setInterval(backup, 3600e3).unref();
  const stop = () => { flushNow(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
}
