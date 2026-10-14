// 1 Milyonuncu Marka: platform sunucusu (bağımlılıksız Node.js 20+).
// Oyun kuralları, kişiye özel kupon, marka entegrasyonu (kod doğrulama + sipariş/iade bildirimi) ve komisyon raporu.
// Çalıştırma: ADMIN_KEY=gizli node server/server.mjs   (ayrıntı: ENTEGRASYON.md)
// Not: Veriler tek bir JSON dosyasında tutulur; canlıda PostgreSQL + Redis ve SMS doğrulaması gerekir.
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
const SIGN_WINDOW_SEC = 300;   // imzalı isteklerin geçerlilik süresi (tekrar gönderme saldırısına karşı)
const GRACE_MS = 300;          // ağ gecikmesi payı
const MAX_BODY = 64 * 1024;

/* ---------- kampanya verisi: sitenin kullandığı dosyalarla aynı ---------- */
function loadScript(file) {
  const ctx = {window:{}}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, {filename:file});
  return ctx.window;
}
const D = loadScript("data.js").LB_DATA;
const LIB = loadScript("markalar.js").LB_MARKALAR || {};
const RATE = Number(process.env.COMMISSION || D.commissionRate);
const CAMPS = D.campaigns;
const campById = id => CAMPS.find(c => c.id === id);
const libNames = cat => (LIB[cat] || []).map(x => x.split("|")[0]);
function brandsOf(cat) {
  const names = cat === "buyuk-firsat" ? Object.keys(LIB).flatMap(libNames) : [...CAMPS.filter(c => c.cat === cat).map(c => c.brand), ...libNames(cat)];
  const seen = new Set();
  return names.filter(n => { const k = n.toLocaleLowerCase("tr"); return !seen.has(k) && seen.add(k); });
}

/* ---------- saat (Türkiye) ---------- */
const fmtParts = new Intl.DateTimeFormat("en-GB", {timeZone:D.timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23"});
function clock(ms = Date.now()) {
  const p = Object.fromEntries(fmtParts.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const h = +p.hour % 24;
  return {ms, day:`${p.year}-${p.month}-${p.day}`, month:`${p.year}-${p.month}`, sod:h * 3600 + +p.minute * 60 + +p.second};
}
const win = c => ({start:c.hour * 3600, end:c.hour * 3600 + c.durationMin * 60});
const instKey = (c, t) => `${c.id}@${t.day}`;

/* ---------- depo ---------- */
fs.mkdirSync(DATA_DIR, {recursive:true});
const DB_FILE = path.join(DATA_DIR, "db.json");
const fresh = () => ({users:{}, sessions:{}, attempts:{}, coupons:{}, brands:{}, orders:{}, log:[]});
let db = fs.existsSync(DB_FILE) ? Object.assign(fresh(), JSON.parse(fs.readFileSync(DB_FILE, "utf8"))) : fresh();
function save() { const tmp = DB_FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE); }

const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const rand = (n, abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789") => Array.from(crypto.randomBytes(n), b => abc[b % abc.length]).join("");
const money = n => Math.round(n * 100) / 100;
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const winners = key => Object.values(db.coupons).filter(x => x.key === key).length;
function status(c, t) {
  const w = win(c);
  if (t.sod < w.start) return "yakinda";
  if (winners(instKey(c, t)) >= c.quota) return "doldu";
  return t.sod < w.end ? "aktif" : "bitti";
}
function couponStatus(cp, t = clock()) { return cp.refundedAt ? "iade" : cp.usedAt ? "kullanildi" : t.ms > cp.expiresAt ? "suresi_doldu" : "aktif"; }
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

/* ---------- iş kuralları ---------- */
function issueCoupon(c, key, u, t) {
  const prefix = c.brand.normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  let code; do code = `${prefix}-${rand(6)}`; while (db.coupons[code]);
  return db.coupons[code] = {code, key, campId:c.id, cat:c.cat, brand:c.brand, offer:c.offer, phone:u.phone,
    issuedAt:t.ms, expiresAt:t.ms + D.couponValidHours * 3600e3, validatedAt:null, usedAt:null, orderNo:null, amount:null, commission:null, refundedAt:null};
}
function couponForBrand(brand, rawCode, t) {
  const cp = db.coupons[String(rawCode ?? "").trim().toUpperCase()];
  if (!cp || cp.brand !== brand.name) return {ok:false, code:"kod_bulunamadi", reason:"Kod bu markaya ait değil ya da yok."};
  const st = couponStatus(cp, t);
  if (st !== "aktif") return {ok:false, code:st, reason:{kullanildi:"Kod daha önce kullanılmış.", suresi_doldu:"Kodun 24 saatlik süresi dolmuş.", iade:"Kod iade edilmiş bir siparişte kullanılmış."}[st]};
  return {ok:true, cp};
}
const publicCoupon = cp => ({kod:cp.code, marka:cp.brand, kampanya:cp.campId, kampanyaMetni:cp.offer, durum:couponStatus(cp),
  verildi:new Date(cp.issuedAt).toISOString(), sonKullanma:new Date(cp.expiresAt).toISOString()});

const routes = {
  /* kullanıcı */
  "POST /api/giris": async (req, body) => {
    const name = String(body.ad ?? "").trim().replace(/\s+/g, " "), phone = normPhone(body.telefon);
    if (name.length < 2) fail(400, "ad_gecersiz", "Ad en az 2 harf olmalı.");
    if (!phone) fail(400, "telefon_gecersiz", "Geçerli bir cep telefonu girin.");
    if (body.kvkkOnay !== true) fail(400, "kvkk_gerekli", "KVKK onayı gerekli.");
    // Canlıda burada SMS ile tek kullanımlık kod gönderilir ve doğrulanmadan oturum açılmaz.
    db.users[phone] = Object.assign(db.users[phone] || {phone, createdAt:Date.now()}, {name, consentAt:Date.now()});
    const token = rand(32, "abcdefghijklmnopqrstuvwxyz0123456789");
    db.sessions[sha(token)] = {phone, at:Date.now()}; save();
    return {token};
  },
  "GET /api/kampanyalar": async () => {
    const t = clock();
    return {saat:new Date(t.ms).toISOString(), kampanyalar:CAMPS.map(c => ({id:c.id, kategori:c.cat, marka:c.brand, metin:c.offer, saat:c.hour,
      sureDk:c.durationMin, kontenjan:c.quota, kalan:Math.max(0, c.quota - winners(instKey(c, t))), durum:status(c, t), demo:!!c.demo}))};
  },
  "POST /api/oyun/basla": async (req, body) => {
    const u = authUser(req), c = campById(body.kampanya), t = clock();
    if (!c) fail(404, "kampanya_yok", "Kampanya bulunamadı.");
    const st = status(c, t); if (st !== "aktif") fail(409, st, "Kampanya şu an aktif değil.");
    const key = instKey(c, t);
    if (db.attempts[key]?.[u.phone]) fail(409, "hak_kullanildi", "Bu kampanyada hakkını kullandın.");
    const board = shuffle([c.brand, ...shuffle(brandsOf(c.cat).filter(b => b !== c.brand)).slice(0, D.boardSize - 1)]);
    const tiles = board.map(marka => ({token:rand(12), marka}));
    const att = {campId:c.id, startedAt:t.ms, target:tiles.find(x => x.marka === c.brand).token, result:null};
    (db.attempts[key] = db.attempts[key] || {})[u.phone] = att; save();
    return {deneme:key, logolar:tiles, bitis:new Date(t.ms + c.findSec * 1000).toISOString()};
  },
  "POST /api/oyun/sec": async (req, body) => {
    const u = authUser(req), key = String(body.deneme ?? ""), att = db.attempts[key]?.[u.phone], t = clock();
    if (!att || att.result) fail(409, "hak_kullanildi", "Deneme bulunamadı ya da bitti.");
    const c = campById(att.campId), ms = t.ms - att.startedAt;
    att.ms = ms;
    att.result = ms > c.findSec * 1000 + GRACE_MS ? "sure_doldu" : body.token !== att.target ? "yanlis" : winners(key) >= c.quota ? "doldu" : "kazandi";
    const cp = att.result === "kazandi" ? issueCoupon(c, key, u, t) : null;
    save();
    return {sonuc:att.result, sureMs:ms, kupon:cp && publicCoupon(cp)};
  },
  "GET /api/kuponlarim": async req => {
    const u = authUser(req);
    return {kuponlar:Object.values(db.coupons).filter(x => x.phone === u.phone).map(publicCoupon)};
  },

  /* marka entegrasyonu */
  "POST /api/marka/kupon-dogrula": async (req, body, raw) => {
    const brand = authBrand(req, raw), t = clock(), r = couponForBrand(brand, body.kod, t);
    if (r.ok) { r.cp.validatedAt = r.cp.validatedAt || t.ms; r.cp.validations = (r.cp.validations || 0) + 1; }
    audit(brand, "dogrula", String(body.kod ?? ""), r.ok ? "gecerli" : r.code); save();
    return r.ok ? {gecerli:true, kupon:publicCoupon(r.cp)} : {gecerli:false, hata:r.code, mesaj:r.reason};
  },
  "POST /api/marka/siparis": async (req, body, raw) => {
    const brand = authBrand(req, raw), t = clock();
    const orderNo = String(body.siparisNo ?? "").trim(), amount = Number(body.tutar);
    if (!orderNo || orderNo.length > 100) fail(400, "siparis_no_gecersiz", "siparisNo gerekli (en fazla 100 karakter).");
    if (!(amount > 0) || amount > 10_000_000) fail(400, "tutar_gecersiz", "tutar 0'dan büyük bir sayı olmalı (TL, KDV dahil, indirim sonrası).");
    const oKey = `${brand.id}:${orderNo}`, prev = db.orders[oKey];
    if (prev) {   // aynı sipariş tekrar gönderilirse ikinci kez sayılmaz (idempotent)
      if (prev.code !== String(body.kod ?? "").trim().toUpperCase()) fail(409, "siparis_cakisma", "Bu sipariş numarası başka bir kodla bildirilmiş.");
      return {kaydedildi:true, tekrar:true, komisyon:db.coupons[prev.code].commission};
    }
    const r = couponForBrand(brand, body.kod, t);
    if (!r.ok) { audit(brand, "siparis", String(body.kod ?? ""), r.code, {orderNo, amount}); save(); fail(409, r.code, r.reason); }
    const cp = r.cp;
    Object.assign(cp, {validatedAt:cp.validatedAt || t.ms, usedAt:t.ms, orderNo, amount:money(amount), commission:money(amount * RATE)});
    db.orders[oKey] = {code:cp.code, brandId:brand.id, at:t.ms};
    audit(brand, "siparis", cp.code, "kaydedildi", {orderNo, amount:cp.amount}); save();
    return {kaydedildi:true, tekrar:false, komisyon:cp.commission, komisyonOrani:RATE};
  },
  "POST /api/marka/iade": async (req, body, raw) => {
    const brand = authBrand(req, raw), orderNo = String(body.siparisNo ?? "").trim();
    const o = db.orders[`${brand.id}:${orderNo}`]; if (!o) fail(404, "siparis_yok", "Sipariş bulunamadı.");
    const cp = db.coupons[o.code];
    const refund = body.iadeTutari === undefined ? cp.amount : Number(body.iadeTutari);
    if (!(refund > 0) || refund > cp.amount) fail(400, "iade_tutari_gecersiz", "iadeTutari 0'dan büyük ve sipariş tutarından küçük olmalı.");
    const total = money((cp.refundTotal || 0) + refund);
    if (total > cp.amount) fail(400, "iade_tutari_gecersiz", "Toplam iade sipariş tutarını aşamaz.");
    cp.refundTotal = total;
    cp.commission = money((cp.amount - cp.refundTotal) * RATE);
    if (cp.refundTotal >= cp.amount) cp.refundedAt = Date.now();
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
  "GET /api/admin/kuponlar.csv": async (req, body, raw, url) => {
    const {month} = report(req, url), t = clock();
    const rows = Object.values(db.coupons).filter(cp => clock(cp.issuedAt).month === month);
    const head = ["kod", "marka", "kampanya", "telefon", "verildi", "son_kullanma", "durum", "kasada_dogrulandi", "siparis_no", "siparis_tarihi", "tutar_tl", "iade_tl", "komisyon_tl"];
    const iso = ms => ms ? new Date(ms).toISOString() : "";
    const csv = "﻿" + [head, ...rows.map(cp => [cp.code, cp.brand, cp.campId, cp.phone, iso(cp.issuedAt), iso(cp.expiresAt), couponStatus(cp, t), iso(cp.validatedAt),
      cp.orderNo ?? "", iso(cp.usedAt), cp.amount ?? "", cp.refundTotal ?? "", cp.commission ?? ""])].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    return {__raw:csv, type:"text/csv; charset=utf-8"};
  }
};

// Aylık hakediş: marka başına kupon, doğrulama, sipariş, ciro, komisyon + kontrol listesi.
function report(req, url) {
  authAdmin(req);
  const month = url.searchParams.get("ay") || clock().month;
  if (!/^\d{4}-\d{2}$/.test(month)) fail(400, "ay_gecersiz", "ay YYYY-AA biçiminde olmalı.");
  const t = clock(), brands = {}, checks = [];
  for (const cp of Object.values(db.coupons)) {
    if (clock(cp.issuedAt).month !== month) continue;
    const b = brands[cp.brand] = brands[cp.brand] || {marka:cp.brand, kupon:0, dogrulanan:0, siparis:0, ciro:0, iade:0, komisyon:0};
    b.kupon++; if (cp.validatedAt) b.dogrulanan++;
    if (cp.usedAt) { b.siparis++; b.ciro = money(b.ciro + cp.amount); b.iade = money(b.iade + (cp.refundTotal || 0)); b.komisyon = money(b.komisyon + cp.commission); }
    // Kasada doğrulandı ama sipariş bildirilmedi: satın alma gizlenmiş olabilir, markaya sorulmalı.
    if (cp.validatedAt && !cp.usedAt) checks.push({kod:cp.code, marka:cp.brand, dogrulandi:new Date(cp.validatedAt).toISOString(), dogrulamaSayisi:cp.validations || 1, durum:couponStatus(cp, t)});
  }
  const list = Object.values(brands).sort((a, b) => b.komisyon - a.komisyon);
  return {month, ay:month, komisyonOrani:RATE, toplam:{kupon:list.reduce((s, b) => s + b.kupon, 0), siparis:list.reduce((s, b) => s + b.siparis, 0),
    ciro:money(list.reduce((s, b) => s + b.ciro, 0)), komisyon:money(list.reduce((s, b) => s + b.komisyon, 0))}, markalar:list, kontrolEdilecek:checks};
}

/* ---------- statik dosyalar (site) ---------- */
const TYPES = {".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json",
  ".png":"image/png", ".svg":"image/svg+xml", ".webp":"image/webp", ".jpg":"image/jpeg", ".md":"text/markdown; charset=utf-8"};
function serveStatic(res, pathname) {
  const rel = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  const file = path.resolve(ROOT, "." + rel);
  if (!file.startsWith(ROOT + path.sep) || file.startsWith(path.join(ROOT, "server") + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile())
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
  server.listen(PORT, () => console.log(`1 Milyonuncu Marka sunucusu: http://localhost:${PORT}`));
}
