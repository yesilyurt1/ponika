// 1 Milyonuncu Marka: site uygulaması.
// "Api" bölümü sunucunun yapacağı işi taklit eder (localStorage). Aynı kurallar server/server.mjs'de de var;
// iş kuralları (indirim, telafi, günlük hak, logo havuzu) ortak kurallar.js dosyasındadır.
(() => {
"use strict";
const D = window.LB_DATA, K = window.LB_KURALLAR, LOGOS = window.LB_LOGOS || {};
const CAMPS = K.CAMPS, CAT = K.CAT, campById = K.campById;
const GRACE_MS = 300, DAY = 86400, PAGE = 24;
const LOST = ["wrong", "timeout", "full"];

/* ---------- yardımcılar ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[ch]));
const pad = n => String(n).padStart(2, "0");
const hhmm = (h, m = 0) => `${pad(h)}:${pad(m)}`;
const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const tl = n => new Intl.NumberFormat("tr-TR", {style:"currency", currency:"TRY", maximumFractionDigits:2}).format(n || 0);
const tl0 = n => new Intl.NumberFormat("tr-TR", {style:"currency", currency:"TRY", maximumFractionDigits:0}).format(n || 0);
const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function randStr(n, abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789") { const a = new Uint32Array(n); crypto.getRandomValues(a); return Array.from(a, x => abc[x % abc.length]).join(""); }
function shuffle(arr) { const a = arr.slice(), r = new Uint32Array(a.length); crypto.getRandomValues(r); for (let i = a.length - 1; i > 0; i--) { const j = r[i] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function fmtClock(sec) { sec = Math.max(0, Math.ceil(sec)); return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec % 3600 / 60))}:${pad(sec % 60)}`; }
function fmtShort(sec) { sec = Math.max(0, Math.ceil(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return h ? `${h} sa ${pad(m)} dk` : `${pad(m)}:${pad(sec % 60)}`; }
function store(key, val) { try { if (val === undefined) return localStorage.getItem(key); if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); } catch { /* gizli sekme vb. */ } return null; }

/* ---------- ikonlar (24×24, çizgi) ---------- */
const ICONS = {
  shirt:"M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0Z", shoe:"M2 18h20v-2.5c0-1.6-1.3-2.6-3-2.9L14 12l-2.5-5H7L6 9H2Z M2 18v2h20v-2",
  home:"M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z", phone:"M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z M11 18h2",
  glasses:"M2 13a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M14 13a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M10 13h4 M2 13l1.5-6 M22 13l-1.5-6", bag:"M5 8h14l-1 13H6Z M9 8V6a3 3 0 0 1 6 0v2",
  cart:"M3 4h2l2.4 11h11L21 7H6.2 M9 20h.01 M18 20h.01", watch:"M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10 M9 7.5 10 2h4l1 5.5 M9 16.5l1 5.5h4l1-5.5 M12 10v2l1.5 1",
  gem:"M6 3h12l4 6-10 12L2 9Z M2 9h20 M8 3l4 6 4-6 M12 21 8 9 M12 21l4-12", sparkle:"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z",
  flower:"M12 13c-4 0-6-3-6-7l3 2 3-4 3 4 3-2c0 4-2 7-6 7Z M12 13v8 M12 18c-2-2-5-2-6-1 M12 17c2-2 4-2 5-1", burger:"M4 10a8 5.5 0 0 1 16 0Z M3 14h18 M4 17h16a2 2 0 0 1-2 3H6a2 2 0 0 1-2-3Z",
  heart:"M12 20s-7-4.5-9-9a4.5 4.5 0 0 1 9-3a4.5 4.5 0 0 1 9 3c-2 4.5-9 9-9 9Z M3 12h4l2-3 3 6 2-3h7", coffee:"M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z M17 10h1.5a2.5 2.5 0 0 1 0 5H17 M8 2v3 M12 2v3",
  gift:"M3 8h18v4H3Z M5 12h14v9H5Z M12 8v13 M12 8C10 4 6 4 6 6.5S10 8 12 8 M12 8c2-4 6-4 6-1.5S14 8 12 8", bell:"M6 16v-5a6 6 0 0 1 12 0v5l2 2H4Z M10 21h4",
  clock:"M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 7v5l3 2", trophy:"M7 4h10v4a5 5 0 0 1-10 0Z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4 M12 13v4 M9 21h6 M10 17h4v4h-4Z",
  ticket:"M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4Z M14 7v10", user:"M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8 M4 21a8 8 0 0 1 16 0",
  wallet:"M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z M3 7l12-4 2 4 M16 13.5h2", play:"M7 4l13 8-13 8Z",
  info:"M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 11v6 M12 7.5v.5", bolt:"M13 2 4 14h7l-1 8 9-12h-7Z", x:"M6 6l12 12 M18 6 6 18", check:"M4 12l5 5L20 6",
  copy:"M9 9h11v11H9Z M5 15H4V4h11v1", store:"M3 9l2-5h14l2 5 M3 9a3 3 0 0 0 6 0a3 3 0 0 0 6 0a3 3 0 0 0 6 0 M5 12v8h14v-8",
  film:"M3 5h18v14H3Z M7 5v14 M17 5v14 M3 9h4 M3 15h4 M17 9h4 M17 15h4", card:"M2 6h20v12H2Z M2 10h20 M6 15h4",
  fire:"M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8a7 7 0 0 0 7 7Z", arrow:"M5 12h14 M13 6l6 6-6 6", back:"M15 6l-6 6 6 6",
  star:"M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5l-5.5 2.9 1-6.3L3 9.7l6.2-.9Z", target:"M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10 M12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2",
  percent:"M19 5 5 19 M7 5a2 2 0 1 0 0 4a2 2 0 1 0 0-4 M17 15a2 2 0 1 0 0 4a2 2 0 1 0 0-4", filter:"M3 5h18l-7 8v6l-4 2v-8Z", download:"M12 3v12 M7 10l5 5 5-5 M4 21h16",
  chart:"M4 20V10 M10 20V4 M16 20v-7 M22 20H2", calendar:"M3 5h18v16H3Z M3 10h18 M8 3v4 M16 3v4", lock:"M5 11h14v10H5Z M8 11V7a4 4 0 0 1 8 0v4", sms:"M4 4h16v12H8l-4 4Z M8 9h8 M8 12h5"
};
const icon = (name, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICONS[name] || ICONS.star}"/></svg>`;
const catIcon = (slug, cls = "") => `<span class="cat-ic ${cls}" style="--c:${CAT[slug].color}">${icon(CAT[slug].icon)}</span>`;

/* ---------- saat (Türkiye + demo kaydırma) ---------- */
const fmtParts = new Intl.DateTimeFormat("en-GB", {timeZone:D.timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23"});
let demoOffset = Number(store("lb:demoOffset")) || 0;
function clock(ms = Date.now() + demoOffset) {
  const p = Object.fromEntries(fmtParts.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const h = +p.hour % 24, mi = +p.minute, s = +p.second;
  return {ms, day:`${p.year}-${p.month}-${p.day}`, h, mi, s, sod:h * 3600 + mi * 60 + s};
}
const fmtDT = ms => new Intl.DateTimeFormat("tr-TR", {timeZone:D.timeZone, day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"}).format(new Date(ms));
const fmtDay = day => new Intl.DateTimeFormat("tr-TR", {day:"numeric", month:"long"}).format(new Date(day + "T12:00:00"));
function setDemoTime(h, m) { const t = clock(Date.now()); demoOffset = ((h * 3600 + m * 60) - t.sod) * 1000; store("lb:demoOffset", demoOffset ? String(demoOffset) : null); }

/* ---------- veri deposu (sunucu yerine) ---------- */
const KEY = "lb:v2";
const fresh = () => ({users:{}, session:null, attempts:{}, coupons:[], clicks:[], reminders:[], notifs:[], prefs:{}, bonus:{}, events:[]});
let db = load();
function load() { try { return Object.assign(fresh(), JSON.parse(store(KEY)) || {}); } catch { return fresh(); } }
function save() { store(KEY, JSON.stringify(db)); }

const win = c => ({start:c.hour * 3600, end:c.hour * 3600 + c.durationMin * 60});
const instKey = (c, t) => `${c.id}@${t.day}`;
const winners = key => db.coupons.filter(x => x.key === key && x.source === "oyun").length;
function status(c, t = clock()) {
  const w = win(c);
  if (t.sod < w.start) return "upcoming";
  if (winners(instKey(c, t)) >= c.quota) return "full";
  return t.sod < w.end ? "active" : "ended";
}
const remaining = (c, t = clock()) => Math.max(0, c.quota - winners(instKey(c, t)));
const startsAt = (c, t) => t.ms + (win(c).start - t.sod) * 1000;
const endsAt = (c, t) => t.ms + (win(c).end - t.sod) * 1000;
function nextStart(t = clock()) {
  const timed = CAMPS.filter(c => !c.demo), future = timed.map(c => win(c).start).filter(s => s > t.sod);
  const s = future.length ? Math.min(...future) : DAY + Math.min(...timed.map(c => win(c).start));
  return {inSec:s - t.sod, hour:(s / 3600) % 24, ms:t.ms + (s - t.sod) * 1000};
}
const user = () => db.session && db.users[db.session] || null;
const myCoupons = () => { const u = user(); return u ? db.coupons.filter(x => x.phone === u.phone) : []; };
const winLimit = (u, t) => D.dailyWinLimit + (db.bonus[`${u.phone}@${t.day}`] || 0);
const winsLeft = (u, t = clock()) => Math.max(0, winLimit(u, t) - K.winsOn(db.coupons, u.phone, t.day));
const attemptOf = (c, t = clock()) => { const u = user(); return u ? db.attempts[instKey(c, t)]?.[u.phone] || null : null; };
function couponStatus(cp, t = clock()) { return cp.refundedAt ? "refunded" : cp.usedAt ? "used" : t.ms > cp.expiresAt ? "expired" : "active"; }
const COUPON_TXT = {active:"Kullanılabilir", used:"Kullanıldı", expired:"Süresi doldu", refunded:"İade edildi"};
const needsCheck = cp => cp.validatedAt && !cp.usedAt && !cp.test;
const prefsOf = u => db.prefs[u.phone] = db.prefs[u.phone] || {push:false, sms:true, before5:true, onStart:true, expiry:true};
const hasReminder = (c, t = clock()) => { const u = user(); return !!u && db.reminders.some(r => r.phone === u.phone && r.campId === c.id && r.day === t.day); };
function telafiState(c, key, t = clock()) {
  const u = user(), att = u && db.attempts[key]?.[u.phone];
  if (!att || !LOST.includes(att.result)) return {ok:false, why:"none"};
  if (att.telafi) return {ok:false, why:"taken"};
  if (key.split("@")[1] !== t.day || t.sod >= win(c).end) return {ok:false, why:"closed"};
  if (K.telafiOn(db.coupons, u.phone, t.day) >= D.dailyTelafiLimit) return {ok:false, why:"limit"};
  return {ok:true};
}
function normPhone(raw) { let d = String(raw).replace(/\D/g, ""); if (d.startsWith("90") && d.length === 12) d = d.slice(2); if (d.startsWith("0")) d = d.slice(1); return /^5\d{9}$/.test(d) ? "0" + d : null; }
const fmtPhone = p => p.replace(/^(\d{4})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3 $4");
const maskPhone = p => p.replace(/^(\d{4})\d{3}(\d{2})(\d{2})$/, "$1 *** $2 $3");

const Api = {
  login(name, phone) {
    name = name.trim().replace(/\s+/g, " "); const p = normPhone(phone);
    if (name.length < 2) return {error:"name"};
    if (!p) return {error:"phone"};
    const now = clock().ms;
    db.users[p] = db.users[p] || {phone:p, name, createdAt:now, consentAt:now};
    db.users[p].name = name; db.session = p; save();
    return {user:db.users[p]};
  },
  logout() { db.session = null; save(); },
  // Oyun başlar: logo sırası ve hedef "sunucuda" belirlenir; tarayıcıya yalnızca anlamsız tokenler gider.
  start(campId) {
    const c = campById(campId), u = user(), t = clock();
    if (!c) return {error:"missing"};
    if (!u) return {error:"login"};
    const st = status(c, t); if (st !== "active") return {error:st};
    const key = instKey(c, t);
    if (db.attempts[key]?.[u.phone]) return {error:"used"};
    if (!winsLeft(u, t)) return {error:"daily"};
    const board = shuffle([c.brand, ...shuffle(K.poolOf(c.cat).filter(b => b !== c.brand)).slice(0, D.boardSize - 1)]);
    const tiles = board.map(brand => ({token:randStr(10), brand}));
    const att = {startedAt:t.ms, target:tiles.find(x => x.brand === c.brand).token, result:null};
    (db.attempts[key] = db.attempts[key] || {})[u.phone] = att; save();
    return {key, tiles, deadline:t.ms + c.findSec * 1000, startedAt:t.ms};
  },
  pick(campId, key, token) {
    const c = campById(campId), u = user(), t = clock(), att = u && db.attempts[key]?.[u.phone];
    if (!att || att.result) return {error:"used"};
    const ms = t.ms - att.startedAt; att.ms = ms;
    if (ms > c.findSec * 1000 + GRACE_MS) att.result = "timeout";
    else if (token !== att.target) att.result = "wrong";
    else if (winners(key) >= c.quota) att.result = "full";
    else if (!winsLeft(u, t)) att.result = "daily";
    else att.result = "won";
    const coupon = att.result === "won" ? issueCoupon(c, key, u, t, {source:"oyun"}) : null;
    save();
    return {result:att.result, ms, coupon, target:att.target};
  },
  timeout(key) { const u = user(), att = u && db.attempts[key]?.[u.phone]; if (att && !att.result) { att.result = "timeout"; att.ms = clock().ms - att.startedAt; save(); } },
  // Telafi kuponu: düşük teklif / reklam / ücretli. Kontenjandan düşmez, günde D.dailyTelafiLimit kez.
  telafi(campId, key, kind) {
    const c = campById(campId), u = user(), t = clock(), ts = telafiState(c, key, t);
    if (!ts.ok) return {error:ts.why};
    const opt = K.telafiOptions(c).find(o => o.kind === kind); if (!opt) return {error:"kind"};
    db.attempts[key][u.phone].telafi = kind;
    if (kind !== "low") db.events.push({type:kind === "ad" ? "reklam" : "odeme", phone:u.phone, campId:c.id, at:t.ms, amount:kind === "paid" ? c.telafi.fee : 0});
    const cp = issueCoupon(c, key, u, t, {source:"telafi", pct:opt.pct, kind, fee:kind === "paid" ? c.telafi.fee : 0});
    save(); return {coupon:cp};
  },
  toggleReminder(campId) {
    const u = user(), t = clock(), i = db.reminders.findIndex(r => r.phone === u.phone && r.campId === campId && r.day === t.day);
    if (i >= 0) db.reminders.splice(i, 1); else db.reminders.push({phone:u.phone, campId, day:t.day, at:t.ms});
    save(); return i < 0;
  },
  // Marka entegrasyonu (canlıda markanın sitesi sunucuya yapar; ENTEGRASYON.md)
  brandValidate(brand, rawCode, amount) {
    const code = String(rawCode).trim().toUpperCase(), cp = db.coupons.find(x => x.code === code);
    if (!cp) return {ok:false, reason:"Kod bulunamadı."};
    if (cp.brand !== brand) return {ok:false, reason:`Bu kod ${cp.brand} kuponu; ${brand} kasasında geçmez.`};
    const st = couponStatus(cp);
    if (st !== "active") return {ok:false, reason:{used:"Kod daha önce kullanılmış.", expired:"Kodun kullanım süresi dolmuş.", refunded:"Kod iade edilen bir siparişte kullanılmış."}[st]};
    cp.validatedAt = cp.validatedAt || clock().ms; save();
    return {ok:true, coupon:cp, calc:amount > 0 ? K.discount(cp.rules, amount, cp.newMember) : null};
  },
  brandOrder(brand, rawCode, orderNo, amount) {
    const code = String(rawCode).trim().toUpperCase(); orderNo = String(orderNo).trim();
    if (!orderNo) return {ok:false, reason:"Sipariş numarası gerekli."};
    const same = db.coupons.find(x => x.brand === brand && x.orderNo === orderNo);
    if (same) return same.code === code ? {ok:true, coupon:same, repeat:true} : {ok:false, reason:"Bu sipariş numarası başka bir kodla bildirilmiş."};
    if (!(amount > 0)) return {ok:false, reason:"Sepet tutarı 0'dan büyük olmalı."};
    const v = this.brandValidate(brand, code, amount); if (!v.ok) return v;
    const cp = v.coupon, calc = v.calc;
    Object.assign(cp, {usedAt:clock().ms, orderNo, gross:K.money(amount), discount:calc.discount, discountPct:calc.totalPct, sale:calc.pay, commission:K.commission(calc.pay)});
    save(); return {ok:true, coupon:cp, calc};
  },
  brandRefund(code) {
    const cp = db.coupons.find(x => x.code === code);
    if (!cp || !cp.usedAt || cp.refundedAt) return {ok:false};
    cp.refundedAt = clock().ms; cp.refundedCommission = cp.commission; cp.commission = 0; save();
    return {ok:true};
  },
  fillWithTestUsers(campId) {
    const c = campById(campId), t = clock(); if (status(c, t) !== "active") return 0;
    const key = instKey(c, t); let n = 0;
    while (winners(key) < c.quota) { issueCoupon(c, key, {phone:"test", name:"Test katılımcı"}, t, {source:"oyun", test:true}); n++; }
    save(); return n;
  },
  resetDaily() { const u = user(), t = clock(), k = `${u.phone}@${t.day}`; db.bonus[k] = (db.bonus[k] || 0) + 1; save(); },
  reset() { db = fresh(); save(); }
};
function issueCoupon(c, key, u, t, {source, pct, kind, fee = 0, test = false}) {
  const prefix = c.brand.normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  // Prototip kodları DEMO- ile başlar; gerçek bir marka kuponuyla karışmasın.
  let code; do code = `DEMO-${prefix}-${randStr(5)}`; while (db.coupons.some(x => x.code === code));
  const newMember = source === "oyun" && !test && K.isNewMember(db.coupons, u.phone);
  const rules = source === "telafi" ? {pct, newMember:0, tiers:[]} : c.rules;
  const cp = {code, key, campId:c.id, cat:c.cat, brand:c.brand, title:c.title || null, offer:source === "telafi" ? `Telafi: seçili ürünlerde %${pct} indirim` : c.offer,
    products:c.products, rules, newMember, source, telafiKind:kind || null, fee, phone:u.phone, name:u.name, day:t.day,
    issuedAt:t.ms, expiresAt:t.ms + c.validHours * 3600e3, validatedAt:null, usedAt:null, orderNo:null, gross:null, discount:null, sale:null, commission:null, test};
  db.coupons.push(cp); return cp;
}

/* ---------- bildirimler (hatırlatma, başladı, kupon bitiyor) ---------- */
function notify(u, title, body, link) {
  const p = prefsOf(u), channels = ["Uygulama"];
  if (p.push && "Notification" in window && Notification.permission === "granted") {
    try { new Notification(title, {body, tag:link || title}); channels.push("Tarayıcı"); } catch { /* bazı ortamlarda kapalı */ }
  }
  if (p.sms) channels.push(`SMS ${maskPhone(u.phone)} (demo)`);
  db.notifs.unshift({id:randStr(8), phone:u.phone, at:clock().ms, title, body, link, channels, read:false});
  db.notifs = db.notifs.slice(0, 100); save();
  toast(`🔔 ${title}`);
}
function runSchedulers(t) {
  const u = user(); if (!u) return;
  const p = prefsOf(u);
  for (const r of db.reminders) {
    if (r.phone !== u.phone || r.day !== t.day) continue;
    const c = campById(r.campId), toStart = win(c).start - t.sod;
    if (p.before5 && !r.s5 && toStart > 0 && toStart <= 300) { r.s5 = 1; notify(u, `${c.brand} 5 dk sonra başlıyor`, `${CAT[c.cat].name} kampanyası ${hhmm(c.hour)}'da açılıyor. Hazır ol!`, `#/kampanya/${c.id}`); }
    if (p.onStart && !r.s0 && toStart <= 0 && t.sod < win(c).end) { r.s0 = 1; notify(u, `${c.brand} kampanyası başladı`, `${remaining(c, t)} kupon var, logoyu 5 saniyede bul!`, `#/kampanya/${c.id}`); }
  }
  for (const cp of myCoupons()) {
    if (p.expiry && !cp.expNotified && couponStatus(cp, t) === "active" && cp.expiresAt - t.ms <= 3600e3) {
      cp.expNotified = 1; notify(u, `${cp.brand} kuponunun süresi bitiyor`, `Kuponunu kullanmak için 1 saatten az kaldı (${cp.code}).`, "#/kuponlarim");
    }
  }
}

/* ---------- arayüz parçaları ---------- */
const PALETTE = [["#111111","#FFFFFF"],["#E30613","#FFFFFF"],["#0B3D91","#FFFFFF"],["#F5F0E6","#1A1A1A"],["#FFD400","#111111"],["#00704A","#FFFFFF"],
  ["#FFFFFF","#C8102E"],["#3B2A20","#F3E3C3"],["#6D28D9","#FFFFFF"],["#F28C28","#111111"],["#0E7490","#FFFFFF"],["#FFFFFF","#111111"]];
// Orijinal logo dosyası varsa (logos/manifest.js) o gösterilir, yoksa yazı rozeti.
// mono: Muhteşem Fırsat'ta tüm logolar bordo/siyah ve aynı yazı tipinde; müşteri yalnız isme ve ikona bakar.
function logo(brand, {tag = "div", attrs = "", mono = false, i = 0} = {}) {
  const src = LOGOS[brand];
  const longest = Math.max(...brand.split(/\s+/).map(w => w.length)), s = Math.min(1, 7 / longest).toFixed(2);
  const lang = /[çğıöşüÇĞİÖŞÜ]/.test(brand) ? "tr" : "en";
  if (mono) {
    const bg = i % 2 ? "#0B0B0D" : "#6E0B24";
    return src ? `<${tag} class="logo mono has-img" style="background:${bg}" ${attrs}><img src="${esc(src)}" alt="${tag === "button" ? "" : esc(brand)}" loading="lazy" draggable="false"></${tag}>`
      : `<${tag} class="logo mono" lang="${lang}" style="background:${bg};color:#fff" ${attrs}><span class="w" style="--s:${s}">${esc(brand)}</span></${tag}>`;
  }
  if (src) return `<${tag} class="logo has-img" ${attrs}><img src="${esc(src)}" alt="${tag === "button" ? "" : esc(brand)}" loading="lazy" draggable="false"></${tag}>`;
  const h = hash(brand), [bg, fg] = PALETTE[h % PALETTE.length];
  return `<${tag} class="logo f${(h >>> 4) % 6}" lang="${lang}" style="background:${bg};color:${fg}" ${attrs}><span class="w" style="--s:${s}">${esc(brand)}</span></${tag}>`;
}
const STATUS_TXT = {active:"Canlı", upcoming:"Yakında", full:"Kontenjan doldu", ended:"Sona erdi"};
const badge = st => `<span class="badge b-${st}">${st === "active" ? '<i class="pulse"></i>' : ""}${STATUS_TXT[st]}</span>`;
function ruleChips(r) {
  return `<div class="chips">
    <span class="chip hot">${icon("percent")}%${r.pct} indirim</span>
    ${r.newMember ? `<span class="chip">${icon("star")}Yeni üyeye +%${r.newMember}</span>` : ""}
    ${(r.tiers || []).map(x => `<span class="chip">${icon("chart")}${tl0(x.min)} üstü %${x.pct}</span>`).join("")}
  </div>`;
}
function countdown(c, t, st, big = false) {
  if (st === "upcoming") return `<div class="cd ${big ? "big" : ""}"><span class="cd-l">${icon("clock")}Başlamasına</span><b class="cd-v" data-cd="${startsAt(c, t)}">${fmtClock(win(c).start - t.sod)}</b></div>`;
  if (st === "active") {
    const w = win(c), pct = Math.min(100, (t.sod - w.start) / (w.end - w.start) * 100);
    return `<div class="cd live ${big ? "big" : ""}"><span class="cd-l">${icon("fire")}${c.demo ? "Gün sonuna" : "Bitmesine"}</span><b class="cd-v" data-cd="${endsAt(c, t)}">${fmtClock(w.end - t.sod)}</b>
      <div class="prog"><i data-prog="${startsAt(c, t)},${endsAt(c, t)}" style="width:${100 - pct}%"></i></div></div>`;
  }
  return `<div class="cd off ${big ? "big" : ""}"><span class="cd-l">${icon("lock")}${st === "full" ? "Kontenjan doldu" : "Süre doldu"}</span><b class="cd-v">${st === "full" ? "Tükendi" : "Bitti"}</b></div>`;
}
// Kart ve detaydaki eylem düğmeleri: Detay + Başla yan yana; duruma göre Hatırlat / Kuponu gör / Telafi
function actions(c, t, {detail = true} = {}) {
  const st = status(c, t), att = attemptOf(c, t), u = user(), key = instKey(c, t);
  const det = detail ? `<a class="btn ghost" href="#/kampanya/${c.id}">${icon("info")}Detay</a>` : "";
  let main;
  if (att?.result === "won") main = `<a class="btn win" href="#/kuponlarim">${icon("ticket")}Kuponu gör</a>`;
  else if (att && telafiState(c, key, t).ok) main = `<button class="btn telafi" type="button" data-act="telafi" data-id="${c.id}">${icon("gift")}Telafi al</button>`;
  else if (att) main = `<button class="btn" type="button" disabled>${icon("check")}Hakkını kullandın</button>`;
  else if (st === "upcoming") main = hasReminder(c, t) ? `<button class="btn on" type="button" data-act="remind" data-id="${c.id}">${icon("bell")}Hatırlatma kurulu</button>`
    : `<button class="btn alt" type="button" data-act="remind" data-id="${c.id}">${icon("bell")}Hatırlat</button>`;
  else if (st === "active") main = u && !winsLeft(u, t) ? `<button class="btn" type="button" disabled title="Günlük kupon hakkın yarın yenilenir">${icon("lock")}Günlük hak doldu</button>`
    : `<button class="btn primary shine" type="button" data-act="start" data-id="${c.id}">${icon("play")}Başla</button>`;
  else main = `<button class="btn" type="button" disabled>${icon("lock")}Kapandı</button>`;
  return `<div class="acts">${det}${main}</div>`;
}
function campCard(c, t, extra = "") {
  const st = status(c, t), cat = CAT[c.cat], left = remaining(c, t), att = attemptOf(c, t);
  return `<article class="card camp ${c.mono ? "mf" : ""} st-${st}" style="--c:${cat.color}">
    ${c.mono ? `<div class="mf-ribbon">${icon("bolt")}MUHTEŞEM FIRSAT${icon("bolt")}</div>` : ""}
    <header class="camp-h">${catIcon(c.cat)}<span class="camp-cat">${esc(cat.name)} · ${c.demo ? "Tüm gün" : hhmm(c.hour)}</span>${c.demo ? '<span class="tag">demo</span>' : ""}${badge(st)}</header>
    <div class="camp-b">${logo(c.brand, {mono:c.mono})}<div class="camp-m"><h3>${esc(c.title ? `${c.title}: ${c.brand}` : c.brand)}</h3><p class="offer">${esc(c.offer)}</p></div></div>
    ${att ? `<p class="mine ${att.result === "won" ? "won" : "lost"}">${att.result === "won" ? `${icon("trophy")}Kazandın` : `${icon("x")}Bu kampanyayı kaçırdın`}${att.telafi ? " · telafi alındı" : ""}</p>` : ""}
    ${countdown(c, t, st)}
    <div class="quota"><div class="quota-t"><span>${icon("ticket")}${left} / ${c.quota} kupon kaldı</span><span>${Math.round((c.quota - left) / c.quota * 100)}%</span></div>
      <div class="bar"><i style="width:${(c.quota - left) / c.quota * 100}%"></i></div></div>
    ${extra}
    ${actions(c, t)}
  </article>`;
}
function historyCard(c, day, att) {
  const cat = CAT[c.cat], won = att.result === "won", t = clock(), key = `${c.id}@${day}`;
  const reason = {wrong:"Yanlış logo", timeout:"Süre doldu", full:"Kontenjan doldu", daily:"Günlük hak dolu"}[att.result] || "";
  const ts = !won ? telafiState(c, key, t) : {ok:false};
  return `<article class="card camp hist ${won ? "won" : "lost"}" style="--c:${cat.color}">
    <header class="camp-h">${catIcon(c.cat)}<span class="camp-cat">${esc(cat.name)} · ${fmtDay(day)}</span><span class="badge ${won ? "b-won" : "b-lost"}">${won ? "Kazandın" : "Kazanamadın"}</span></header>
    <div class="camp-b">${logo(c.brand, {mono:c.mono})}<div class="camp-m"><h3>${esc(c.title ? `${c.title}: ${c.brand}` : c.brand)}</h3><p class="offer">${esc(c.offer)}</p></div></div>
    <p class="mine ${won ? "won" : "lost"}">${won ? `${icon("trophy")}${(att.ms / 1000).toFixed(2)} sn'de buldun` : `${icon("x")}${reason}${att.telafi ? " · telafi kuponu alındı" : ""}`}</p>
    <div class="acts"><a class="btn ghost" href="#/kampanya/${c.id}">${icon("info")}Detay</a>${won ? `<a class="btn win" href="#/kuponlarim">${icon("ticket")}Kuponlarım</a>` :
      ts.ok ? `<button class="btn telafi" type="button" data-act="telafi" data-id="${c.id}">${icon("gift")}Telafi al</button>` : ""}</div>
  </article>`;
}

/* ---------- görünümler ---------- */
const views = {};
const FILTERS = [["active", "Aktif", "fire"], ["upcoming", "Yaklaşan", "clock"], ["won", "Kazandıklarım", "trophy"], ["lost", "Kazanamadıklarım", "x"], ["ended", "Sona eren", "lock"], ["remind", "Hatırlatmalarım", "bell"]];
let shown = PAGE;
function homeLists(t) {
  const u = user(), catF = store("lb:cat") || "all", inCat = c => catF === "all" || c.cat === catF;
  const hist = [];
  if (u) for (const [key, m] of Object.entries(db.attempts)) { const a = m[u.phone]; if (!a || !a.result) continue; const [id, day] = key.split("@"); const c = campById(id); if (c && inCat(c)) hist.push({c, day, a}); }
  hist.sort((x, y) => y.a.startedAt - x.a.startedAt);
  const byStatus = s => CAMPS.filter(c => inCat(c) && s.includes(status(c, t)));
  return {
    active:byStatus(["active"]).sort((a, b) => (b.mono ? 2 : 0) + (b.demo ? 1 : 0) - (a.mono ? 2 : 0) - (a.demo ? 1 : 0) || win(a).end - win(b).end),
    upcoming:byStatus(["upcoming"]).sort((a, b) => a.hour - b.hour),
    ended:byStatus(["ended", "full"]).sort((a, b) => b.hour - a.hour),
    won:hist.filter(h => h.a.result === "won"), lost:hist.filter(h => h.a.result !== "won"),
    remind:u ? db.reminders.filter(r => r.phone === u.phone && r.day === t.day).map(r => campById(r.campId)).filter(c => c && inCat(c)) : [],
    catF
  };
}
views.home = () => {
  const t = clock(), nx = nextStart(t), L = homeLists(t), f = store("lb:filter") || "active";
  const mf = CAMPS.filter(c => c.mono && status(c, t) === "active");
  const todayCoupons = CAMPS.filter(c => !c.demo).reduce((s, c) => s + c.quota, 0);
  const items = L[f] || [];
  const list = f === "won" || f === "lost" ? items.slice(0, shown).map(h => historyCard(h.c, h.day, h.a)).join("") : items.slice(0, shown).map(c => campCard(c, t)).join("");
  const empty = {active:"Bu filtrede şu an aktif kampanya yok.", upcoming:"Bugün başka kampanya kalmadı; yarın 00:00'da yenileri açılıyor.",
    won:user() ? "Henüz kazandığın kampanya yok. İlk kuponun bir logo uzağında!" : "Kazandığın kampanyaları görmek için giriş yap.",
    lost:"Kaçırdığın kampanya yok. Böyle devam!", ended:"Bugün sona eren kampanya yok.", remind:"Hatırlatma kurmadın. Yaklaşan kampanyalarda zil ikonuna dokun."}[f];
  return `
  <section class="hero">
    <div class="hero-txt">
      <span class="eyebrow"><i class="pulse"></i>Her saat başı yeni marka · ${CAMPS.filter(c => status(c, t) === "active").length} kampanya canlı</span>
      <h1>Logoyu <span class="grad">5 saniyede</span> bul,<br>indirimi <span class="hl">kap!</span></h1>
      <p>Her kategoride her saat yeni bir marka. Logolar arasında hedefi ilk bulanlar kişiye özel indirim kuponunu kazanır.</p>
      <div class="hero-cta"><a class="btn primary big shine" href="#kampanyalar" data-act="scroll">${icon("play")}Hemen oyna</a><a class="btn ghost big" href="#/nasil">${icon("info")}Nasıl çalışır?</a></div>
    </div>
    <div class="hero-card">
      <span class="hc-l">${icon("clock")}Sıradaki kampanyalara</span>
      <b class="hc-cd" data-cd="${nx.ms}">${fmtClock(nx.inSec)}</b>
      <span class="hc-s">${hhmm(nx.hour)}'da ${CAMPS.filter(c => !c.demo && c.hour === nx.hour).length} kategori birden açılıyor</span>
      <div class="hc-stats"><div><b>${CAMPS.length}</b><span>kampanya</span></div><div><b>${new Intl.NumberFormat("tr-TR").format(todayCoupons)}</b><span>günlük kupon</span></div><div><b>${D.categories.length}</b><span>kategori</span></div></div>
    </div>
  </section>
  <div class="marquee" aria-hidden="true"><div class="mq-track">${[0, 1].map(() => K.ownBrands("buyuk-firsat").slice(0, 40).map(b => logo(b)).join("")).join("")}</div></div>
  ${mf.map(c => `<a class="mf-banner" href="#/kampanya/${c.id}"><span class="mf-tag">${icon("bolt")}MUHTEŞEM FIRSAT</span>
    <b>${esc(c.brand)}: ${esc(c.offer)}</b><span class="mf-sub">Logolar bordo-siyah! Sadece isme ve ikona odaklan. <u>Hemen katıl</u></span>
    <span class="mf-cd">${icon("fire")}<b data-cd="${endsAt(c, t)}">${fmtClock(win(c).end - t.sod)}</b></span></a>`).join("")}
  <section class="section" id="kampanyalar" aria-labelledby="campH">
    <div class="sec-head"><h2 id="campH">${icon("ticket")}Kampanyalar</h2><span class="muted small">Türkiye saati · ${hhmm(t.h, t.mi)}</span></div>
    <div class="cat-row" aria-label="Kategori filtresi">
      <button class="cchip ${L.catF === "all" ? "on" : ""}" type="button" data-act="catf" data-v="all" aria-pressed="${L.catF === "all"}" style="--c:#FF3D7F">${icon("star")}Tümü</button>
      ${D.categories.map(c => `<button class="cchip ${L.catF === c.slug ? "on" : ""}" type="button" data-act="catf" data-v="${c.slug}" aria-pressed="${L.catF === c.slug}" style="--c:${c.color}">${icon(c.icon)}${esc(c.name)}</button>`).join("")}
    </div>
    <div class="filters" aria-label="Durum filtresi">${FILTERS.map(([k, n, ic]) => `<button class="ftab ${f === k ? "on" : ""}" type="button" aria-pressed="${f === k}" data-act="filter" data-v="${k}">${icon(ic)}${n}<span class="fcount">${(L[k] || []).length}</span></button>`).join("")}</div>
    ${items.length ? `<div class="grid-cards">${list}</div>${items.length > shown ? `<button class="btn ghost more" type="button" data-act="more">${items.length - shown} kampanya daha göster</button>` : ""}`
      : `<div class="empty">${icon(FILTERS.find(x => x[0] === f)[2], "big")}<b>${empty}</b>${f === "won" && !user() ? `<button class="btn primary" type="button" data-act="login">Giriş yap</button>` : ""}</div>`}
  </section>
  <section class="section" aria-labelledby="catH">
    <h2 id="catH">${icon("store")}Kategoriler</h2>
    <div class="cats">${D.categories.map(cat => {
      const live = CAMPS.filter(c => c.cat === cat.slug && status(c, t) === "active").length;
      return `<a class="cat-tile" href="#/kategori/${cat.slug}" style="--c:${cat.color}">${catIcon(cat.slug, "lg")}<b>${esc(cat.name)}</b>
        <span>${K.poolOf(cat.slug).length} logo · ${live} canlı</span></a>`;
    }).join("")}</div>
  </section>`;
};

views.category = slug => {
  const cat = CAT[slug]; if (!cat) return views.notFound();
  const t = clock(), list = CAMPS.filter(c => c.cat === slug), own = K.ownBrands(slug), pool = K.poolOf(slug);
  const live = list.filter(c => status(c, t) === "active");
  const showAll = store("lb:wall") === slug;
  const wall = showAll ? pool : own.slice(0, 60);
  return `<section class="cat-hero" style="--c:${cat.color}"><a href="#/" class="back">${icon("back")}Kampanyalar</a>
    <div class="ch-row">${catIcon(slug, "xl")}<div><h1>${esc(cat.name)}</h1><p>${own.length} marka · oyunda ${pool.length} logo · günde ${list.filter(c => !c.demo).length} kampanya, ${list.filter(c => !c.demo).reduce((s, c) => s + c.quota, 0)} kupon</p></div></div></section>
  ${live.length ? `<section class="section"><h2>${icon("fire")}Şu an canlı</h2><div class="grid-cards">${live.map(c => campCard(c, t)).join("")}</div></section>` : ""}
  <section class="section"><div class="sec-head"><h2>${icon("calendar")}Bugünün programı</h2></div>
    <div class="tablewrap"><table><thead><tr><th>Saat</th><th>Marka / kampanya</th><th class="num">Kupon</th><th>Durum</th></tr></thead><tbody>
    ${list.map(c => { const st = status(c, t);
      return `<tr class="${st === "active" ? "is-now" : st === "upcoming" ? "" : "is-past"}"><td class="nowrap">${c.demo ? "Tüm gün" : `${hhmm(c.hour)}–${hhmm(c.hour, c.durationMin)}`}</td>
      <td><a href="#/kampanya/${c.id}"><b>${esc(c.title ? `${c.title}: ${c.brand}` : c.brand)}</b></a><br><span class="small muted">${esc(c.offer)}</span></td>
      <td class="num nowrap">${remaining(c, t)} / ${c.quota}</td><td>${badge(st)}</td></tr>`; }).join("")}
    </tbody></table></div></section>
  <section class="section"><div class="sec-head"><h2>${icon("star")}Logo duvarı</h2><span class="muted small">Her oyunda ${pool.length} logodan ${D.boardSize} tanesi karışık gelir</span></div>
    <div class="logo-wall">${wall.map(b => logo(b)).join("")}</div>
    <button class="btn ghost more" type="button" data-act="wall" data-v="${showAll ? "" : slug}">${showAll ? "Daha az göster" : `Tüm ${pool.length} logoyu göster`}</button></section>`;
};

views.campaign = id => {
  const c = campById(id); if (!c) return views.notFound();
  const t = clock(), st = status(c, t), cat = CAT[c.cat], att = attemptOf(c, t), links = K.campaignLinks(c);
  const myCp = att?.result === "won" ? myCoupons().find(x => x.key === instKey(c, t) && x.source === "oyun") : null;
  return `<section class="detail ${c.mono ? "mf" : ""}" style="--c:${cat.color}">
    <a href="#/kategori/${c.cat}" class="back">${icon("back")}${esc(cat.name)}</a>
    ${c.mono ? `<div class="mf-ribbon">${icon("bolt")}MUHTEŞEM FIRSAT · LOGOLAR BORDO-SİYAH${icon("bolt")}</div>` : ""}
    <div class="d-head">${logo(c.brand, {mono:c.mono})}<div><span class="eyebrow">${catIcon(c.cat, "sm")}${esc(cat.name)} · ${c.demo ? "Tüm gün (demo)" : `${hhmm(c.hour)}–${hhmm(c.hour, c.durationMin)}`}</span>
      <h1>${esc(c.title ? `${c.title}: ${c.brand}` : c.brand)}</h1><p class="offer big">${esc(c.offer)}</p>${badge(st)}</div></div>
    <div class="d-grid">
      <div class="d-main">
        ${countdown(c, t, st, true)}
        <div class="quota"><div class="quota-t"><span>${icon("ticket")}${remaining(c, t)} / ${c.quota} kupon kaldı</span></div><div class="bar"><i style="width:${(c.quota - remaining(c, t)) / c.quota * 100}%"></i></div></div>
        ${att ? `<p class="mine ${att.result === "won" ? "won" : "lost"}">${att.result === "won" ? `${icon("trophy")}Kazandın! Kodun: <b>${esc(myCp?.code || "")}</b>` : `${icon("x")}Bu kampanyada hakkını kullandın${att.telafi ? " · telafi kuponu alındı" : ""}.`}</p>` : ""}
        ${actions(c, t, {detail:false})}
      </div>
      <div class="d-box"><h2>${icon("percent")}Kampanya koşulları</h2>
        ${ruleChips(c.rules)}
        <ul class="ticks">
          <li>${icon("check")}<span><b>Temel indirim %${c.rules.pct}.</b> Sepet tutarı arttıkça indirim büyür: ${(c.rules.tiers || []).map(x => `${tl0(x.min)} ve üzeri %${x.pct}`).join(", ") || "barem yok"}.</span></li>
          ${c.rules.newMember ? `<li>${icon("star")}<span><b>Yeni üyeye +%${c.rules.newMember} ekstra.</b> İlk kuponunu kazanan üyeye otomatik eklenir.</span></li>` : ""}
          <li>${icon("bag")}<span><b>Geçerli ürünler:</b> ${esc(c.products)}. Kupon yalnızca kampanya detayında belirtilen seçili ürünlerde geçerlidir.</span></li>
          <li>${icon("clock")}<span><b>Kullanım süresi:</b> Kazandıktan sonra ${c.validHours} saat.</span></li>
          <li>${icon("ticket")}<span><b>Kupon sayısı:</b> ${c.quota}. Firmanın belirlediği adete göre değişir; dolunca kampanya kapanır.</span></li>
          ${c.mono ? `<li class="mf-note">${icon("bolt")}<span><b>Muhteşem Fırsat:</b> Oyunda tüm logolar <b>bordo ve siyah</b> renkte, aynı yazı tipiyle gösterilir. Renklere değil, yalnızca markanın <b>ismine ve ikonuna</b> odaklan.</span></li>` : ""}
        </ul>
        <h3>Nerede kullanılır?</h3>
        <div class="links">${links.length ? links.map(l => `<a class="btn ghost sm" href="${esc(l.url)}" target="_blank" rel="noopener">${icon(l.ad === "Web sitesi" ? "store" : "cart")}${esc(l.ad)}</a>`).join("") : `<span class="muted small">Markanın web sitesi ve pazaryeri mağazaları (marka panelden ekler).</span>`}
          <a class="btn ghost sm" href="#/marka-kasasi${myCp ? "/" + esc(myCp.code) : ""}">${icon("card")}Marka kasası (demo)</a></div>
        <p class="small muted" style="margin:0">Kampanya belirlenen süre boyunca açık kalır. Firma değişiklik yapma hakkını saklı tutar.</p>
      </div>
      <div class="d-box"><h2>${icon("target")}Oyun kuralları</h2>
        <ol class="steps-l">
          <li><b>Başla</b>'ya bas, 3-2-1 sayımından sonra ${D.boardSize} logo karışık dizilir.</li>
          <li><b>${esc(c.brand)}</b> logosuna <b>${c.findSec} saniye</b> içinde dokun.</li>
          <li>Her kampanyada <b>tek hakkın</b> var: yanlış logo ya da süre dolması hakkı bitirir.</li>
          <li>Her müşterinin <b>günde ${D.dailyWinLimit} kupon</b> kazanma hakkı vardır.</li>
          <li>Kazanamazsan <b>telafi kuponu</b> alabilirsin: reklam izle, ${c.telafi.fee} ₺ öde ya da daha düşük indirimi kabul et.</li>
        </ol></div>
    </div></section>`;
};

const COUPON_CLS = {active:"b-active", used:"b-won", expired:"b-ended", refunded:"b-ended"};
function ticket(cp, t) {
  const st = couponStatus(cp, t), c = campById(cp.campId), links = c ? K.campaignLinks(c, cp.code) : [];
  return `<article class="ticket ${st}" style="--c:${CAT[cp.cat].color}">
    <div class="tk-l">${logo(cp.brand, {mono:!!cp.title})}<span class="tk-pct">%${cp.rules.pct}${cp.newMember ? `<small>+${cp.rules.newMember}</small>` : ""}</span></div>
    <div class="tk-r">
      <div class="tk-h"><b>${esc(cp.brand)}</b><span class="badge ${COUPON_CLS[st]}">${COUPON_TXT[st]}</span>${cp.source === "telafi" ? '<span class="tag">telafi</span>' : ""}</div>
      <p class="offer">${esc(cp.offer)}</p>
      ${ruleChips(cp.rules)}
      <div class="code-row"><span class="code">${esc(cp.code)}</span><button class="btn dark sm" type="button" data-copy="${esc(cp.code)}" ${st === "active" ? "" : "disabled"}>${icon("copy")}Kopyala</button></div>
      ${st === "active" ? `<div class="kv">${icon("clock")}<span>Kullanım için</span><b data-cd="${cp.expiresAt}" data-fmt="short">${fmtShort((cp.expiresAt - t.ms) / 1000)}</b></div>` :
        st === "expired" ? `<div class="kv"><span>Son kullanma</span><b>${fmtDT(cp.expiresAt)}</b></div>` :
        `<div class="kv"><span>Kullanıldı · ${fmtDT(cp.usedAt)}</span><b class="save">${cp.discount ? `${tl(cp.discount)} kazandın` : ""}</b></div>`}
      ${st === "active" ? `<div class="links">${links.map(l => `<a class="btn ghost sm" href="${esc(l.url)}" target="_blank" rel="noopener" data-utm="${esc(cp.code)}">${icon(l.ad === "Web sitesi" ? "store" : "cart")}${esc(l.ad)}</a>`).join("")}
        <a class="btn primary sm" href="#/marka-kasasi/${esc(cp.code)}">${icon("card")}Kasada kullan (demo)</a></div>` : ""}
    </div></article>`;
}
views.coupons = () => {
  if (!user()) return `<section class="section"><h1>${icon("ticket")}Kuponlarım</h1><div class="empty">${icon("lock", "big")}<b>Kuponlarını görmek için giriş yap</b><button class="btn primary" type="button" data-act="login">Giriş yap</button></div></section>`;
  const t = clock(), tab = store("lb:ctab") || "active", all = myCoupons();
  const groups = {active:all.filter(x => couponStatus(x, t) === "active"), used:all.filter(x => ["used", "refunded"].includes(couponStatus(x, t))), expired:all.filter(x => couponStatus(x, t) === "expired")};
  const list = groups[tab].slice().sort((a, b) => tab === "active" ? a.expiresAt - b.expiresAt : b.issuedAt - a.issuedAt);
  return `<section class="section"><h1>${icon("ticket")}Kuponlarım</h1>
    <p class="muted" style="margin:0">Kuponu kazandıktan sonra belirlenen süre içinde markanın sitesinde ya da pazaryeri mağazasında, kampanyalı üründe kullanılır. Kupon, kampanya detaylarında iletilen seçili ürünlerde geçerlidir.</p></section>
  <div class="filters">${[["active", "Aktif", "fire"], ["used", "Kullanılan", "check"], ["expired", "Süresi dolan", "clock"]].map(([k, n, ic]) => `<button class="ftab ${tab === k ? "on" : ""}" type="button" aria-pressed="${tab === k}" data-act="ctab" data-v="${k}">${icon(ic)}${n}<span class="fcount">${groups[k].length}</span></button>`).join("")}</div>
  ${list.length ? `<div class="tickets">${list.map(cp => ticket(cp, t)).join("")}</div>` :
    `<div class="empty">${icon("ticket", "big")}<b>${tab === "active" ? "Aktif kuponun yok" : "Burada henüz kupon yok"}</b><span>Canlı bir kampanyada logoyu 5 saniyede bul, kuponun burada görünsün.</span><a class="btn primary" href="#/">${icon("play")}Canlı kampanyalar</a></div>`}`;
};

views.profile = () => {
  const u = user();
  if (!u) return `<section class="section"><h1>${icon("user")}Profil</h1><div class="empty">${icon("user", "big")}<b>Profilini görmek için giriş yap</b><button class="btn primary" type="button" data-act="login">Giriş yap</button></div></section>`;
  const t = clock(), all = myCoupons(), used = all.filter(x => x.usedAt && !x.refundedAt);
  const saved = used.reduce((s, x) => s + (x.discount || 0), 0), spent = used.reduce((s, x) => s + (x.sale || 0), 0);
  const p = prefsOf(u), left = winsLeft(u, t), rem = db.reminders.filter(r => r.phone === u.phone && r.day === t.day);
  const toggle = (k, label, ic) => `<button class="switch-row" type="button" data-act="pref" data-v="${k}" aria-pressed="${!!p[k]}">${icon(ic)}<span>${label}</span><i class="sw" aria-hidden="true"></i></button>`;
  return `<section class="profile">
    <div class="p-head"><span class="avatar">${esc(u.name.split(" ").map(x => x[0]).join("").slice(0, 2).toLocaleUpperCase("tr"))}</span>
      <div><h1>${esc(u.name)}</h1><p class="muted">${esc(fmtPhone(u.phone))} · ${fmtDay(new Date(u.createdAt).toISOString().slice(0, 10))} tarihinden beri üye</p>
      ${K.isNewMember(db.coupons, u.phone) ? `<span class="chip hot">${icon("star")}Yeni üye: ilk kuponunda +%${D.newMemberBonus}</span>` : ""}</div></div>
    <div class="earn" aria-labelledby="earnH">
      <span class="earn-l" id="earnH">${icon("wallet")}Kazancım</span>
      <b class="earn-v">${tl(saved)}</b>
      <span class="earn-s">Kuponlarınla toplam kazandığın indirim</span>
      <div class="earn-g"><div><b>${all.filter(x => x.source === "oyun").length}</b><span>kazanılan kupon</span></div><div><b>${used.length}</b><span>kullanılan</span></div>
        <div><b>${tl0(spent)}</b><span>alışveriş</span></div><div><b>${all.filter(x => x.source === "telafi").length}</b><span>telafi kuponu</span></div></div>
    </div>
    <div class="p-grid">
      <div class="card section"><h2>${icon("ticket")}Günlük hakkın</h2>
        <p class="big-num">${left} / ${winLimit(u, t)}</p><p class="muted small" style="margin:0">${left ? "Bugün kupon kazanabilirsin." : `Bugünkü kupon hakkını kullandın. Yenilenmesine <b data-cd="${t.ms + (DAY - t.sod) * 1000}">${fmtClock(DAY - t.sod)}</b>.`}</p></div>
      <div class="card section"><h2>${icon("bell")}Hatırlatmalarım</h2>
        ${rem.length ? `<ul class="rem">${rem.map(r => { const c = campById(r.campId), st = status(c, t);
          return `<li><a href="#/kampanya/${c.id}">${catIcon(c.cat, "sm")}<b>${esc(c.brand)}</b> · ${hhmm(c.hour)}</a>${badge(st)}<button class="icon-btn" type="button" data-act="remind" data-id="${c.id}" aria-label="${esc(c.brand)} hatırlatmasını kaldır">${icon("x")}</button></li>`; }).join("")}</ul>`
          : `<p class="muted small" style="margin:0">Yaklaşan kampanyalarda <b>Hatırlat</b>'a dokun; 5 dk kala ve başladığında haber verelim.</p>`}</div>
      <div class="card section"><h2>${icon("sms")}Bildirim ayarları</h2>
        ${toggle("push", "Tarayıcı / uygulama bildirimi", "bell")}${toggle("sms", "SMS bildirimi", "sms")}
        ${toggle("before5", "Kampanyaya 5 dk kala", "clock")}${toggle("onStart", "Kampanya başladığında", "play")}${toggle("expiry", "Kuponun bitmesine 1 saat kala", "ticket")}
        <p class="small muted" style="margin:0">SMS'ler prototipte gönderilmez, bildirim merkezinde "SMS (demo)" olarak görünür. Canlıda İYS onayıyla gönderilir.</p></div>
    </div>
    <div class="acts"><a class="btn ghost" href="#/kuponlarim">${icon("ticket")}Kuponlarım</a><button class="btn ghost" type="button" data-act="install" hidden id="installBtn">${icon("download")}Uygulamayı yükle</button><button class="btn ghost" type="button" data-act="logout">${icon("x")}Çıkış yap</button></div>
  </section>`;
};

views.how = () => `<section class="prose">
  <h1>${icon("info")}Nasıl çalışır?</h1>
  <div class="how-steps">${[["target", "Kampanyayı seç", "Her kategoride her saat başı yeni bir marka kampanyası açılır."], ["play", "Logoyu 5 sn'de bul", `${D.boardSize} logo arasında hedefe dokun.`], ["ticket", "Kuponu al", "Kişiye özel kodun anında çıkar, kopyala."], ["store", "Markada kullan", "Markanın sitesinde ya da pazaryeri mağazasında."]].map(([ic, h, p], i) => `<div class="how-step"><span class="hs-n">${i + 1}</span>${icon(ic, "big")}<b>${h}</b><span>${p}</span></div>`).join("")}</div>
  <h2>Kampanyalar</h2>
  <ul><li>Her kategoride her saat başı bir marka kampanyası açılır.</li>
  <li>Kampanya belirlenen süre boyunca açık kalır. Firma değişiklik yapma hakkını saklı tutar.</li>
  <li>Her kampanyanın kupon sayısı firmanın belirleyeceği adete göre değişiklik gösterir.</li>
  <li>Her müşterinin günlük ${D.dailyWinLimit === 1 ? "bir" : D.dailyWinLimit} kupon kazanım hakkı vardır.</li>
  <li>Kontenjan dolduğunda ya da süre bittiğinde kampanya ana sayfadan otomatik kalkar ve kategoride de kapanır.</li>
  <li>Firmalar yalnızca web sitesi linklerini değil, pazaryeri mağazalarının linklerini de gönderebilir ve kampanyaya dahil edebilir.</li></ul>
  <h2>Oyun</h2>
  <ol><li>Giriş yap, kampanyanın <b>Detay</b> sayfasından koşulları incele ya da doğrudan <b>Başla</b>'ya bas.</li>
  <li>Kurallar penceresinde <b>Hazırım</b> dediğinde 3-2-1 sayılır ve kategorinin logolarından ${D.boardSize} tanesi karışık dizilir.</li>
  <li>Hedef markanın logosuna <b>5 saniye</b> içinde dokun. Her kampanyada tek deneme hakkın var.</li>
  <li><b>Muhteşem Fırsat</b> kampanyalarında tüm logolar bordo ve siyah görünür; yalnızca isme ve ikona odaklanmalısın.</li></ol>
  <h2>Kupon ve indirimler</h2>
  <ul><li>Kazandığında ekranda kişiye özel kupon kodu çıkar; tek dokunuşla kopyalayabilirsin. Kupon <b>Kuponlarım</b>'a da kaydedilir.</li>
  <li>Kuponu kazandıktan sonra belirlenen süre içinde markanın sitesinde, kampanyalı üründe kullanılır. Kupon, kampanya detaylarında iletilen seçili ürünlerde geçerlidir.</li>
  <li>Bir kupon birden fazla koşula bağlı indirim taşıyabilir: temel indirim, <b>yeni üyeye ek indirim</b> ve sepet tutarına göre artan <b>baremli indirim</b>.</li>
  <li>Kazanamazsan <b>telafi kuponu</b> alabilirsin: reklam izleyerek, küçük bir ücret ödeyerek ya da daha düşük bir indirimi kabul ederek.</li></ul>
  <h2>Bildirimler</h2>
  <ul><li>Yaklaşan kampanyalarda <b>Hatırlat</b>'a dokun: 5 dk kala ve başladığında bildirim ya da SMS gelir.</li>
  <li>Kuponunun bitmesine 1 saat kala da haber veririz.</li></ul>
  <h2>Sık sorulanlar</h2>
  <p><b>Neden tek hak var?</b> Sırayla tüm logolara dokunarak kazanmayı engellemek için.</p>
  <p><b>Kupon kodu başkasıyla paylaşılabilir mi?</b> Kod kişiye özeldir ve tek kullanımlıktır.</p>
  <p><b>Üstteki sayaç ne?</b> Bir sonraki saat başı kampanyalarının başlamasına kalan süre (Türkiye saati).</p></section>`;

views.panel = () => {
  const t = clock(), all = db.coupons, sel = store("lb:panelCat") || "giyim";
  const real = all.filter(x => !x.test), used = real.filter(x => x.usedAt && !x.refundedAt), check = real.filter(needsCheck);
  const sales = used.reduce((s, x) => s + x.sale, 0), comm = used.reduce((s, x) => s + x.commission, 0);
  const fees = db.events.filter(e => e.type === "odeme").reduce((s, e) => s + e.amount, 0), ads = db.events.filter(e => e.type === "reklam").length;
  const clicksOf = code => db.clicks.filter(k => k.code === code).length;
  const byBrand = {};
  for (const cp of real) {
    const b = byBrand[cp.brand] = byBrand[cp.brand] || {n:0, checked:0, orders:0, sale:0, comm:0};
    b.n++; if (cp.validatedAt) b.checked++;
    if (cp.usedAt && !cp.refundedAt) { b.orders++; b.sale += cp.sale; b.comm += cp.commission; }
  }
  const stCell = cp => needsCheck(cp) ? `<span class="badge b-lost">Doğrulandı, sipariş yok</span>` : esc(COUPON_TXT[couponStatus(cp, t)]);
  const camps = CAMPS.filter(c => sel === "all" || c.cat === sel);
  return `<section class="section"><h1>${icon("chart")}Kupon takip</h1><p class="muted" style="margin:0">Kampanya doluluğu, markaların bildirdiği siparişler, %${D.commissionRate * 100} komisyon ve telafi gelirleri.</p></section>
  <div class="stats">
    ${[["Verilen kupon", real.length, "ticket"], ["Siparişe dönen", used.length, "check"], ["Dönüşüm", (real.length ? Math.round(used.length / real.length * 100) : 0) + "%", "chart"],
      ["Kontrol edilecek", check.length, "info", check.length ? "warn" : ""], ["Net satış", tl(sales), "cart"], [`Komisyon (%${D.commissionRate * 100})`, tl(comm), "wallet"],
      ["Telafi ödemesi", tl(fees), "card"], ["Reklam izlenme", ads, "film"]].map(([l, v, ic, cls]) => `<div class="card stat ${cls || ""}">${icon(ic)}<span class="eyebrow">${l}</span><b>${v}</b></div>`).join("")}
  </div>
  <section class="card section"><h2>${icon("lock")}Komisyonu nasıl kontrol ediyorsun?</h2>
    <ul class="ticks small"><li>${icon("check")}<span>Her kazanana <b>kişiye özel, tek kullanımlık</b> kod; her kod tek kazanana ve tek siparişe bağlanır.</span></li>
    <li>${icon("check")}<span>Markanın sitesi kodu ödeme sayfasında <b>bizim sunucumuza sorarak doğrular</b>; hangi kodun kasaya geldiğini biz de görürüz.</span></li>
    <li>${icon("check")}<span>Sipariş tamamlanınca marka <b>sipariş no + tutar</b> bildirir; komisyon indirim sonrası ödenen tutardan hesaplanır, iade olursa geri alınır.</span></li>
    <li>${icon("check")}<span><b>Kontrol edilecek</b>: kasada doğrulanıp siparişi bildirilmeyen kodlar; ay sonu mutabakatında markaya sorulur.</span></li></ul></section>
  <section class="section"><h2>${icon("store")}Marka hakedişleri</h2>
    ${Object.keys(byBrand).length ? `<div class="tablewrap"><table><thead><tr><th>Marka</th><th class="num">Kupon</th><th class="num">Kasada doğrulanan</th><th class="num">Sipariş</th><th class="num">Net satış</th><th class="num">Komisyon</th></tr></thead><tbody>
    ${Object.entries(byBrand).sort((a, b) => b[1].comm - a[1].comm).map(([k, b]) => `<tr><td><b>${esc(k)}</b></td><td class="num">${b.n}</td><td class="num">${b.checked}</td><td class="num">${b.orders}</td><td class="num nowrap">${tl(b.sale)}</td><td class="num nowrap"><b>${tl(b.comm)}</b></td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty"><b>Henüz kupon verilmedi</b></div>`}</section>
  <section class="card section"><h2>${icon("clock")}Test araçları</h2>
    <form class="toolbar" data-form="demo"><div class="field"><label for="demoAt">Demo saati (Türkiye)</label><input id="demoAt" type="time" required value="${hhmm(t.h, t.mi)}"></div>
      <button class="btn dark" type="submit">Saati uygula</button><button class="btn ghost" type="button" data-act="realtime" ${demoOffset ? "" : "disabled"}>Gerçek saat</button>
      ${user() ? `<button class="btn ghost" type="button" data-act="resetDaily">Günlük hakkıma +1 ekle</button>` : ""}
      <button class="btn ghost" type="button" data-act="reset">Tüm verileri sıfırla</button></form>
    <p class="small muted" style="margin:0">Demo saati herhangi bir kampanyayı şimdi denemeni sağlar. "Günlük hakkıma +1 ekle" aynı gün başka kampanya denemek içindir. "Doldur" kontenjanı test katılımcılarıyla doldurur.</p></section>
  <section class="section"><div class="sec-head"><h2>${icon("calendar")}Bugünün kampanyaları</h2>
    <div class="field" style="min-width:200px"><label for="catSel">Kategori</label><select id="catSel" data-act="cat">${[["all", "Tümü"], ...D.categories.map(c => [c.slug, c.name])].map(([v, n]) => `<option value="${v}" ${v === sel ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div></div>
    <div class="tablewrap"><table><thead><tr><th>Saat</th><th>Kategori</th><th>Marka</th><th class="num">Süre</th><th class="num">Kazanan</th><th>Durum</th><th></th></tr></thead><tbody>
    ${camps.map(c => { const st = status(c, t);
      return `<tr class="${st === "active" ? "is-now" : ""}"><td class="nowrap">${c.demo ? "Tüm gün" : hhmm(c.hour)}</td><td>${esc(CAT[c.cat].name)}</td><td><b>${esc(c.brand)}</b>${c.mono ? ' <span class="tag mfx">MF</span>' : ""}</td><td class="num nowrap">${c.demo ? "–" : c.durationMin + " dk"}</td>
      <td class="num nowrap">${c.quota - remaining(c, t)} / ${c.quota}</td><td>${badge(st)}</td><td>${st === "active" && !c.demo ? `<button class="btn ghost sm" type="button" data-act="fill" data-id="${c.id}">Doldur</button>` : ""}</td></tr>`; }).join("")}
    </tbody></table></div></section>
  <section class="section"><div class="sec-head"><h2>${icon("ticket")}Kuponlar</h2>${D.allowDownload === false ? "" : `<button class="btn ghost sm" type="button" data-act="csv" ${all.length ? "" : "disabled"}>${icon("download")}CSV indir</button>`}</div>
    ${all.length ? `<div class="tablewrap"><table><thead><tr><th>Kod</th><th>Marka</th><th>Kullanıcı</th><th>Tür</th><th>Verildi</th><th>Durum</th><th class="num">Tık</th><th>Sipariş</th><th class="num">Sepet</th><th class="num">İndirim</th><th class="num">Net</th><th class="num">Komisyon</th><th></th></tr></thead><tbody>
    ${all.slice().reverse().slice(0, 300).map(cp => `<tr class="${needsCheck(cp) ? "is-flag" : ""}"><td class="nowrap"><b>${esc(cp.code)}</b></td><td>${esc(cp.brand)}</td>
      <td>${cp.test ? '<span class="muted">Test</span>' : esc(cp.name) + `<br><span class="small muted">${esc(fmtPhone(cp.phone))}</span>`}</td>
      <td class="nowrap">${cp.source === "telafi" ? `Telafi (${{low:"düşük", ad:"reklam", paid:"ücretli"}[cp.telafiKind]})` : "Oyun"}${cp.newMember ? " · yeni üye" : ""}</td>
      <td class="nowrap">${fmtDT(cp.issuedAt)}</td><td>${stCell(cp)}</td><td class="num">${clicksOf(cp.code)}</td><td class="nowrap">${cp.orderNo ? esc(cp.orderNo) : "–"}</td>
      <td class="num nowrap">${cp.gross ? tl(cp.gross) : "–"}</td><td class="num nowrap">${cp.discount ? `${tl(cp.discount)} (%${cp.discountPct})` : "–"}</td><td class="num nowrap">${cp.sale ? tl(cp.sale) : "–"}</td>
      <td class="num nowrap">${cp.refundedAt ? `<s>${tl(cp.refundedCommission)}</s>` : cp.usedAt ? `<b>${tl(cp.commission)}</b>` : "–"}</td>
      <td>${cp.usedAt && !cp.refundedAt ? `<button class="btn ghost sm" type="button" data-act="refund" data-code="${esc(cp.code)}">İade</button>` : ""}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty"><b>Henüz kupon verilmedi</b></div>`}</section>`;
};

// Marka kasası: markanın ödeme sayfasının simülasyonu (canlıda markanın sitesi API ile yapar).
let kasaMsg = null;
views.kasa = code => {
  const cp = code ? db.coupons.find(x => x.code === code) : null;
  const brands = [...new Set(CAMPS.map(c => c.brand))].sort((a, b) => a.localeCompare(b, "tr"));
  const sel = cp?.brand || kasaMsg?.brand || brands[0];
  const msg = kasaMsg ? `<div class="kasa-out ${kasaMsg.ok ? "ok" : "bad"}" role="status">${kasaMsg.html}</div>` : "";
  return `<section class="section"><h1>${icon("card")}Marka kasası <span class="tag">demo</span></h1>
    <p class="muted" style="margin:0;max-width:66ch">Bu ekran markanın sitesindeki ödeme sayfasını taklit eder. Canlıda markanın sitesi kodu bizden <b>doğrular</b>, indirimi koşullara göre hesaplar (temel, baremli, yeni üye) ve ödeme bitince <b>sipariş bildirimi</b> gönderir. %${D.commissionRate * 100} komisyon indirim sonrası ödenen tutardan hesaplanır.</p></section>
  <form class="card section kasa" data-form="kasa" novalidate>
    <div class="field"><label for="kBrand">Mağaza (marka)</label><select id="kBrand" name="brand">${brands.map(b => `<option ${b === sel ? "selected" : ""}>${esc(b)}</option>`).join("")}</select></div>
    <div class="field"><label for="kCode">Kupon kodu</label><input id="kCode" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="DEMO-CIV-XXXXX" value="${esc(cp?.code || kasaMsg?.code || "")}"></div>
    <div class="frow"><div class="field"><label for="kAmount">Sepet tutarı (₺)</label><input id="kAmount" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="1000" value="${esc(kasaMsg?.amount || "")}"></div>
      <div class="field"><label for="kOrder">Sipariş no</label><input id="kOrder" name="order" value="SIP-${randStr(6, "0123456789")}"></div></div>
    <div class="acts"><button class="btn ghost" type="submit" name="step" value="validate">${icon("check")}Kodu doğrula</button><button class="btn primary" type="submit" name="step" value="order">${icon("card")}Siparişi tamamla</button></div>
    ${msg}
  </form>`;
};
const calcHtml = (calc, cp) => `<table class="calc"><tbody>
  <tr><td>Sepet</td><td class="num">${tl(calc.pay + calc.discount)}</td></tr>
  <tr><td>Temel indirim</td><td class="num">%${calc.basePct}</td></tr>
  ${calc.tierPct ? `<tr><td>Barem (${tl0(calc.tierMin)} üstü)</td><td class="num">%${calc.tierPct}</td></tr>` : ""}
  ${calc.bonusPct ? `<tr><td>Yeni üye ekstra</td><td class="num">+%${calc.bonusPct}</td></tr>` : ""}
  <tr class="sum"><td>Toplam indirim (%${calc.totalPct})</td><td class="num">−${tl(calc.discount)}</td></tr>
  <tr class="sum"><td>Ödenecek</td><td class="num">${tl(calc.pay)}</td></tr>
  ${cp ? `<tr><td>Platform komisyonu (%${D.commissionRate * 100})</td><td class="num">${tl(K.commission(calc.pay))}</td></tr>` : ""}</tbody></table>`;

views.notFound = () => `<section class="section"><h1>Sayfa bulunamadı</h1><a class="btn dark" href="#/">Ana sayfaya dön</a></section>`;

/* ---------- oyun ---------- */
let game = null; // {campId,key,deadline,raf,done,pre}
function rulesModal(id) {
  const c = campById(id), u = user(), t = clock();
  if (!u) return loginModal(() => rulesModal(id));
  if (status(c, t) !== "active") return toast("Kampanya şu an aktif değil.");
  if (attemptOf(c, t)) return toast("Bu kampanyada hakkını kullandın.");
  if (!winsLeft(u, t)) return toast("Bugünkü kupon hakkını kullandın; yarın yenilenir.");
  modal(`<div class="modal rules ${c.mono ? "mf" : ""}" role="dialog" aria-modal="true" aria-labelledby="rT" style="--c:${CAT[c.cat].color}">
    ${c.mono ? `<div class="mf-ribbon">${icon("bolt")}MUHTEŞEM FIRSAT${icon("bolt")}</div>` : ""}
    <div class="r-target">${logo(c.brand, {mono:c.mono})}<div><span class="eyebrow">Hedef logo</span><h2 id="rT">${esc(c.brand)}</h2><p class="offer">${esc(c.offer)}</p></div></div>
    <ul class="ticks">
      <li>${icon("clock")}<span><b>${c.findSec} saniye</b> içinde hedef logoya dokun.</span></li>
      <li>${icon("target")}<span>3-2-1'den sonra <b>${D.boardSize} logo</b> karışık dizilir.</span></li>
      <li>${icon("lock")}<span><b>Tek hak:</b> yanlış logo ya da süre dolması hakkı bitirir.</span></li>
      <li>${icon("ticket")}<span>Günlük kupon hakkın: <b>${winsLeft(u, t)} / ${winLimit(u, t)}</b>. Kalan kupon: <b>${remaining(c, t)}</b>.</span></li>
      ${c.mono ? `<li class="mf-note">${icon("bolt")}<span>Tüm logolar <b>bordo ve siyah</b>. Renklere değil, <b>isme ve ikona</b> odaklan!</span></li>` : ""}
    </ul>
    ${ruleChips(c.rules)}
    <div class="acts"><button class="btn ghost" type="button" data-close>Vazgeç</button><button class="btn primary big shine" type="button" data-act="go" data-id="${c.id}">${icon("play")}Hazırım, başlat</button></div></div>`);
}
function startGame(id) {
  closeModal();
  const c = campById(id);
  const ov = document.createElement("div");
  ov.className = `game ${c.mono ? "mf" : ""}`; ov.id = "game"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", `${c.brand} logosunu bul`);
  ov.innerHTML = `<div class="g-count" aria-live="assertive"><b id="gCount" class="pop">3</b><span>Hazır ol: ${esc(c.brand)}</span></div>`;
  document.body.append(ov); document.body.classList.add("playing");
  game = {campId:id, done:false, raf:0, pre:true};
  let n = 3;
  const step = () => {
    if (!game || game.campId !== id) return;
    if (--n > 0) { const el = $("#gCount"); el.textContent = n; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); game.preT = setTimeout(step, 700); }
    else showBoard(id);
  };
  game.preT = setTimeout(step, reduceMotion() ? 300 : 700);
}
function showBoard(id) {
  const r = Api.start(id);
  if (r.error) { endOverlay(); toast({login:"Önce giriş yap.", used:"Bu kampanyada hakkını kullandın.", daily:"Bugünkü kupon hakkını kullandın."}[r.error] || "Kampanya şu an aktif değil."); return render(); }
  const c = campById(id), total = r.deadline - r.startedAt;
  Object.assign(game, {key:r.key, deadline:r.deadline, pre:false});
  $("#game").innerHTML = `<div class="g-top"><div class="g-target">${logo(c.brand, {mono:c.mono})}<div><span>Bul</span><b>${esc(c.brand)}</b></div></div>
      <div class="g-timer" id="timer"><b id="tLeft">${(total / 1000).toFixed(1)}</b><span>sn</span><div class="bar"><i id="tBar"></i></div></div></div>
    ${c.mono ? `<p class="g-mf">${icon("bolt")}Muhteşem Fırsat: logolar bordo-siyah, isme odaklan!</p>` : ""}
    <div class="board ${c.mono ? "mono" : ""}" id="board">${r.tiles.map((x, i) => logo(x.brand, {tag:"button", attrs:`type="button" data-token="${x.token}" aria-label="${esc(x.brand)}"`, mono:c.mono, i})).join("")}</div>`;
  const tick = () => {
    if (!game || game.done) return;
    const left = game.deadline - clock().ms;
    $("#tLeft").textContent = (Math.max(0, left) / 1000).toFixed(1);
    $("#tBar").style.transform = `scaleX(${Math.max(0, left) / total})`;
    $("#timer").classList.toggle("low", left < 2000);
    if (left <= 0) return finish(null);
    game.raf = requestAnimationFrame(tick);
  };
  game.raf = requestAnimationFrame(tick);
}
function endOverlay() { if (game) { clearTimeout(game.preT); cancelAnimationFrame(game.raf); } game = null; document.body.classList.remove("playing"); $("#game")?.remove(); }
function finish(btn) {
  if (!game || game.done) return;
  game.done = true; cancelAnimationFrame(game.raf);
  const board = $("#board"); board.classList.add("locked"); board.querySelectorAll("button").forEach(b => b.disabled = true);
  let r;
  if (btn) r = Api.pick(game.campId, game.key, btn.dataset.token); else { Api.timeout(game.key); r = {result:"timeout"}; }
  if (btn) btn.classList.add(r.result === "won" ? "hit" : "miss");
  if (r.target) board.querySelector(`[data-token="${r.target}"]`)?.classList.add("hit");
  if (r.result !== "won") $("#game").classList.add("shake");
  const id = game.campId, key = game.key;
  setTimeout(() => { endOverlay(); if (r.result === "won") wonModal(r.coupon, r.ms); else lostModal(id, key, r.result); }, r.result === "won" ? 450 : 900);
}
function couponBox(cp) {
  const c = campById(cp.campId), links = c ? K.campaignLinks(c, cp.code) : [];
  return `<div class="won-ticket" style="--c:${CAT[cp.cat].color}"><div class="wt-pct">%${cp.rules.pct}${cp.newMember ? `<small>+%${cp.rules.newMember} yeni üye</small>` : ""}</div>
    <div class="code-row"><span class="code" id="wonCode">${esc(cp.code)}</span><button class="btn dark" type="button" data-copy="${esc(cp.code)}">${icon("copy")}Kopyala</button></div></div>
    ${ruleChips(cp.rules)}
    <p class="small muted" style="margin:0">${esc(cp.products)} için geçerli. Son kullanma: <b>${fmtDT(cp.expiresAt)}</b>. Kupon Kuponlarım'a kaydedildi.</p>
    <div class="acts col">${links.map(l => `<a class="btn ghost" href="${esc(l.url)}" target="_blank" rel="noopener" data-utm="${esc(cp.code)}">${icon(l.ad === "Web sitesi" ? "store" : "cart")}${esc(l.ad)}${icon("arrow")}</a>`).join("")}
      <a class="btn primary" href="#/marka-kasasi/${esc(cp.code)}" data-close>${icon("card")}Marka kasasında kullan (demo)</a>
      <a class="btn ghost" href="#/kuponlarim" data-close>${icon("ticket")}Kuponlarım</a></div>`;
}
function wonModal(cp, ms) {
  modal(`<div class="modal center won" role="dialog" aria-modal="true" aria-labelledby="mT"><div class="burst">${icon("trophy", "big")}</div>
    <h2 id="mT">Tebrikler, kazandın!</h2>
    <p class="muted" style="margin:0">${esc(cp.brand)} logosunu <b>${(ms / 1000).toFixed(2)} sn</b>'de buldun.</p>${couponBox(cp)}</div>`, render);
  confetti();
}
function lostModal(id, key, result) {
  const c = campById(id), ts = telafiState(c, key);
  const msg = {wrong:["Yanlış logo", "Doğru logo yeşil çerçeveyle gösterildi."], timeout:["Süre doldu", `${c.findSec} saniye içinde logoya dokunulmadı.`],
    full:["Kontenjan doldu", "Logoyu buldun ama sen tıklarken son kupon da verildi."], daily:["Günlük hakkın dolu", "Bugün zaten bir kupon kazandın."]}[result] || ["Kazanamadın", ""];
  modal(`<div class="modal center lost" role="dialog" aria-modal="true" aria-labelledby="mT"><div class="burst sad">${icon(result === "timeout" ? "clock" : "x", "big")}</div>
    <h2 id="mT">${msg[0]}</h2><p class="muted" style="margin:0">${msg[1]} Bu kampanyadaki hakkın bitti.</p>
    ${ts.ok ? telafiBox(c) : ts.why === "limit" ? `<p class="small muted" style="margin:0">Bugünkü telafi hakkını kullandın.</p>` : ""}
    <div class="acts"><a class="btn ghost" href="#/" data-close>Diğer kampanyalar</a><button class="btn ghost" type="button" data-close>Kapat</button></div></div>`, render);
}
const telafiBox = c => `<div class="telafi-box"><h3>${icon("gift")}Telafi kuponu al</h3><p class="small muted" style="margin:0">Kazanamadın ama eli boş dönme. Birini seç (günde ${D.dailyTelafiLimit} kez):</p>
  <div class="t-opts">${K.telafiOptions(c).map(o => `<button class="t-opt k-${o.kind}" type="button" data-act="telafiPick" data-id="${c.id}" data-kind="${o.kind}">
    <b>%${o.pct}</b><span>${esc(o.label)}</span><small>${esc(o.note)}</small></button>`).join("")}</div></div>`;
function telafiModal(id) {
  const c = campById(id), key = instKey(c, clock()), ts = telafiState(c, key);
  if (!ts.ok) return toast(ts.why === "limit" ? "Bugünkü telafi hakkını kullandın." : "Telafi bu kampanya için artık alınamaz.");
  modal(`<div class="modal center" role="dialog" aria-modal="true" aria-labelledby="tT"><h2 id="tT">${icon("gift")}Telafi: ${esc(c.brand)}</h2>${telafiBox(c)}<button class="btn ghost" type="button" data-close>Vazgeç</button></div>`);
}
function grantTelafi(id, kind) {
  const c = campById(id), r = Api.telafi(id, instKey(c, clock()), kind);
  if (r.error) { closeModal(); return toast("Telafi alınamadı: hak dolmuş ya da kampanya kapanmış."); }
  modal(`<div class="modal center won" role="dialog" aria-modal="true" aria-labelledby="mT"><div class="burst">${icon("gift", "big")}</div><h2 id="mT">${kind === "paid" ? "Ödeme alındı, kuponun hazır!" : "Telafi kuponun hazır!"}</h2>${couponBox(r.coupon)}</div>`, render);
  confetti(50);
}
function telafiPick(id, kind) {
  const c = campById(id);
  if (kind === "low") return grantTelafi(id, kind);
  if (kind === "ad") {
    const sec = c.telafi.adSec;
    modal(`<div class="modal center ad" role="dialog" aria-modal="true" aria-labelledby="adT"><span class="tag">Reklam</span>
      <div class="ad-screen"><b>1 Milyonuncu Marka</b><span>Her saat başı ${D.categories.length} kategoride yeni fırsat. Bildirimleri aç, hiçbirini kaçırma!</span>${icon("bell", "big")}</div>
      <h2 id="adT">Reklam bitince kuponun gelecek</h2><div class="bar ad-bar"><i id="adBar"></i></div><p class="small muted" style="margin:0"><b id="adLeft">${sec}</b> sn</p>
      <button class="btn ghost" type="button" data-close>Vazgeç</button></div>`);
    const t0 = Date.now(), iv = setInterval(() => {
      const left = sec - (Date.now() - t0) / 1000;
      if (!$("#adBar")) return clearInterval(iv);
      $("#adBar").style.transform = `scaleX(${1 - Math.max(0, left) / sec})`; $("#adLeft").textContent = Math.max(0, Math.ceil(left));
      if (left <= 0) { clearInterval(iv); grantTelafi(id, kind); }
    }, 200);
    return;
  }
  modal(`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="pT" data-form="pay" data-id="${id}"><h2 id="pT">${icon("card")}${c.telafi.fee} ₺ öde, %${c.telafi.paid} indirim al</h2>
    <p class="muted small" style="margin:0">Demo ödeme: gerçek tahsilat yapılmaz. Canlıda ödeme iyzico / PayTR gibi bir ödeme kuruluşu üzerinden alınır.</p>
    <div class="field"><label for="pCard">Kart numarası (demo)</label><input id="pCard" inputmode="numeric" autocomplete="off" value="4242 4242 4242 4242" readonly></div>
    <div class="acts"><button class="btn ghost" type="button" data-close>Vazgeç</button><button class="btn primary" type="submit">${icon("lock")}${c.telafi.fee} ₺ öde (demo)</button></div></form>`);
}

/* ---------- konfeti ---------- */
function confetti(n = 140) {
  if (reduceMotion()) return;
  const cv = document.createElement("canvas"); cv.className = "confetti"; document.body.append(cv);
  const ctx = cv.getContext("2d"), W = cv.width = innerWidth, H = cv.height = innerHeight;
  const cols = ["#FF3D7F", "#FFC21A", "#2EC5FF", "#D4FF2A", "#8B5CFF", "#22D37A"];
  const ps = Array.from({length:n}, () => ({x:W / 2 + (Math.random() - .5) * 80, y:H * .35, vx:(Math.random() - .5) * 14, vy:-Math.random() * 14 - 4, r:Math.random() * 6 + 4, c:cols[Math.floor(Math.random() * cols.length)], a:Math.random() * 6, va:(Math.random() - .5) * .3}));
  const t0 = performance.now();
  (function f(now) {
    const el = now - t0; ctx.clearRect(0, 0, W, H);
    for (const p of ps) { p.vy += .35; p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - el / 2200); ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); }
    if (el < 2200) requestAnimationFrame(f); else cv.remove();
  })(t0);
}

/* ---------- modal, toast, kopyalama, giriş ---------- */
let modalClose = null;
function modal(html, onClose) {
  closeModal();
  const root = $("#modalRoot"), prev = document.activeElement;
  root.innerHTML = `<div class="scrim">${html}</div>`;
  const scrim = root.firstElementChild;
  scrim.addEventListener("click", e => { if (e.target === scrim || e.target.closest("[data-close]")) closeModal(); });
  modalClose = () => { root.innerHTML = ""; modalClose = null; onClose?.(); if (prev?.isConnected) prev.focus?.(); };
  (scrim.querySelector(".btn.primary, input:not([readonly]), button, a") || scrim).focus();
  return scrim;
}
function closeModal() { modalClose?.(); }
let toastT;
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2600); }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* izin yok */ }
  const ta = Object.assign(document.createElement("textarea"), {value:text, readOnly:true});
  ta.style.cssText = "position:fixed;opacity:0;left:-9999px"; document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove(); return ok;
}
let afterLogin = null;
function loginModal(next) {
  afterLogin = typeof next === "function" ? next : null;
  const s = modal(`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="lT" data-form="login" novalidate>
    <h2 id="lT">${icon("user")}Giriş yap / Üye ol</h2><p class="muted small" style="margin:0">Kuponların hesabına tanımlanır. Yeni üyelere ilk kuponda <b>+%${D.newMemberBonus}</b> ekstra indirim! Prototipte SMS doğrulaması yok; canlıda telefonla tek kullanımlık kod istenir.</p>
    <div class="field"><label for="lName">Ad soyad</label><input id="lName" name="name" autocomplete="name" required minlength="2" maxlength="60"></div>
    <div class="field"><label for="lPhone">Cep telefonu</label><input id="lPhone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="05xx xxx xx xx" required></div>
    <label class="check"><input type="checkbox" name="kvkk" required><span>KVKK aydınlatma metnini okudum, kampanya iletişimi (SMS/bildirim) için verilerimin işlenmesini kabul ediyorum.</span></label>
    <p class="err" id="lErr" role="alert"></p>
    <div class="acts"><button class="btn ghost" type="button" data-close>Vazgeç</button><button class="btn primary" type="submit">Devam et</button></div></form>`, render);
  s.querySelector("#lName").focus();
}
function notifDrawer() {
  const u = user(); if (!u) return loginModal();
  const list = db.notifs.filter(n => n.phone === u.phone);
  modal(`<div class="modal drawer" role="dialog" aria-modal="true" aria-labelledby="nT"><div class="sec-head"><h2 id="nT">${icon("bell")}Bildirimler</h2><button class="icon-btn" type="button" data-close aria-label="Kapat">${icon("x")}</button></div>
    ${list.length ? `<ul class="notifs">${list.map(n => `<li class="${n.read ? "" : "unread"}"><a href="${esc(n.link || "#/")}" data-close><b>${esc(n.title)}</b><span>${esc(n.body)}</span><small>${fmtDT(n.at)} · ${esc(n.channels.join(", "))}</small></a></li>`).join("")}</ul>`
      : `<div class="empty">${icon("bell", "big")}<b>Henüz bildirim yok</b><span>Yaklaşan bir kampanyada Hatırlat'a dokun.</span></div>`}</div>`, render);
  list.forEach(n => n.read = true); save(); updateChrome();
}
function downloadCsv() {
  const head = ["kod", "kampanya", "kategori", "marka", "tur", "yeni_uye", "ad", "telefon", "verildi", "son_kullanma", "durum", "kasada_dogrulandi", "siparis_no", "kullanildi", "sepet_tl", "indirim_tl", "indirim_yuzde", "net_tl", "komisyon_tl", "telafi_ucreti", "iade", "utm_tiklama", "test"];
  const iso = ms => ms ? new Date(ms).toISOString() : "";
  const rows = db.coupons.map(cp => [cp.code, cp.campId, cp.cat, cp.brand, cp.source, cp.newMember ? 1 : 0, cp.name, cp.phone, iso(cp.issuedAt), iso(cp.expiresAt), couponStatus(cp), iso(cp.validatedAt), cp.orderNo ?? "", iso(cp.usedAt),
    cp.gross ?? "", cp.discount ?? "", cp.discountPct ?? "", cp.sale ?? "", cp.commission ?? "", cp.fee || "", iso(cp.refundedAt), db.clicks.filter(k => k.code === cp.code).length, cp.test ? 1 : 0]);
  const csv = "﻿" + [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const a = Object.assign(document.createElement("a"), {href:URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"})), download:`kuponlar-${clock().day}.csv`});
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- yönlendirme ve döngü ---------- */
let route = {name:"home", arg:null};
function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const map = {"":"home", kampanyalar:"home", kategori:"category", kampanya:"campaign", oyna:"campaign", kuponlarim:"coupons", profil:"profile", nasil:"how", panel:"panel", "marka-kasasi":"kasa"};
  const name = map[parts[0] || ""];
  return name ? {name, arg:parts[1] || null} : {name:"notFound", arg:null};
}
let lastSig = "";
function signature() {
  const t = clock(), u = user();
  return [route.name, route.arg, db.session, db.coupons.length, db.coupons.filter(x => x.usedAt).length, db.reminders.length, Object.keys(db.attempts).length,
    CAMPS.map(c => status(c, t)[0]).join(""), myCoupons().map(x => couponStatus(x, t)[0]).join(""), u ? winsLeft(u, t) : ""].join("|");
}
function render(focusMain = false) {
  if (game) return;
  const main = $("#main");
  main.innerHTML = views[route.name](route.arg);
  lastSig = signature();
  const navName = {home:"home", category:"home", campaign:"home", coupons:"coupons", profile:"profile", how:"how", panel:"panel", kasa:"kasa"}[route.name];
  document.querySelectorAll("[data-nav]").forEach(a => a.dataset.nav === navName ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  const titles = {home:"Kampanyalar", category:CAT[route.arg]?.name, campaign:campById(route.arg)?.brand, coupons:"Kuponlarım", profile:"Profil", how:"Nasıl çalışır", panel:"Kupon takip", kasa:"Marka kasası"};
  document.title = (titles[route.name] ? titles[route.name] + " · " : "") + "1 Milyonuncu Marka";
  if (installEvt) { const b = $("#installBtn"); if (b) b.hidden = false; }
  updateChrome();
  if (focusMain) { main.focus({preventScroll:true}); window.scrollTo(0, 0); }
}
function updateChrome() {
  const u = user(), t = clock();
  const ub = $("#userBtn");
  const html = u ? `<span class="avatar sm">${esc(u.name.split(" ").map(x => x[0]).join("").slice(0, 2).toLocaleUpperCase("tr"))}</span><span class="un">${esc(u.name.split(" ")[0])}</span>` : `${icon("user")}<span class="un">Giriş yap</span>`;
  if (ub.innerHTML !== html) ub.innerHTML = html;
  ub.setAttribute("aria-label", u ? `Profil: ${u.name}` : "Giriş yap");
  const n = myCoupons().filter(x => couponStatus(x, t) === "active").length;
  document.querySelectorAll("[data-count-coupons]").forEach(cc => { cc.hidden = !n; cc.textContent = n; });
  const un = u ? db.notifs.filter(x => x.phone === u.phone && !x.read).length : 0;
  const nb = $("#notifCount"); nb.hidden = !un; nb.textContent = un;
  $("#demoBanner").hidden = !demoOffset;
  if (demoOffset) $("#demoTime").textContent = hhmm(t.h, t.mi);
}
function tick() {
  const t = clock(), nx = nextStart(t);
  $("#nextCd").textContent = fmtClock(nx.inSec);
  $("#nextAt").textContent = hhmm(nx.hour);
  runSchedulers(t);
  if (game) return;
  if (signature() !== lastSig && !$("#modalRoot").children.length && !document.activeElement?.matches("input,select")) { const y = scrollY; render(); scrollTo(0, y); return; }
  document.querySelectorAll("[data-cd]").forEach(el => { const s = (+el.dataset.cd - t.ms) / 1000; el.textContent = el.dataset.fmt === "short" ? fmtShort(s) : fmtClock(s); });
  document.querySelectorAll("[data-prog]").forEach(el => { const [a, b] = el.dataset.prog.split(",").map(Number); el.style.width = `${Math.max(0, Math.min(100, (b - t.ms) / (b - a) * 100))}%`; });
  updateChrome();
}

window.addEventListener("hashchange", () => {
  if (game) { const key = game.key; endOverlay(); if (key) { Api.timeout(key); toast("Oyundan çıktın, bu kampanyadaki hakkın kullanıldı."); } }
  closeModal(); kasaMsg = null; shown = PAGE; route = parseRoute(); render(true);
});
window.addEventListener("storage", e => { if (e.key === KEY) { db = load(); if (!game) render(); } if (e.key === "lb:demoOffset") { demoOffset = Number(e.newValue) || 0; render(); } });
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (modalClose) closeModal(); else if (game?.pre) endOverlay(); } });
let installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; const b = $("#installBtn"); if (b) b.hidden = false; });

document.addEventListener("click", async e => {
  const tile = e.target.closest("#board button[data-token]");
  if (tile && game && !game.done) return finish(tile);
  const cp = e.target.closest("[data-copy]");
  if (cp) { const ok = await copyText(cp.dataset.copy); const old = cp.innerHTML; cp.innerHTML = ok ? `${icon("check")}Kopyalandı` : "Kopyalanamadı"; toast(ok ? "Kupon kodu kopyalandı." : "Kopyalanamadı; kodu basılı tutup kopyala."); setTimeout(() => { if (cp.isConnected) cp.innerHTML = old; }, 1800); return; }
  const utm = e.target.closest("[data-utm]");
  if (utm) { db.clicks.push({code:utm.dataset.utm, at:clock().ms}); save(); return; }
  if (e.target.closest("#userBtn")) { if (user()) location.hash = "#/profil"; else loginModal(); return; }
  if (e.target.closest("#notifBtn")) return notifDrawer();
  if (e.target.closest("#demoReset")) { demoOffset = 0; store("lb:demoOffset", null); return render(); }
  const act = e.target.closest("[data-act]"); if (!act || act.tagName === "SELECT") return;
  const a = act.dataset.act, v = act.dataset.v;
  if (a === "scroll") { e.preventDefault(); $("#kampanyalar")?.scrollIntoView({behavior:reduceMotion() ? "auto" : "smooth"}); }
  else if (a === "login") loginModal();
  else if (a === "logout") { Api.logout(); toast("Çıkış yapıldı."); location.hash = "#/"; render(); }
  else if (a === "start") rulesModal(act.dataset.id);
  else if (a === "go") startGame(act.dataset.id);
  else if (a === "remind") {
    const id = act.dataset.id;
    if (!user()) return loginModal(() => { Api.toggleReminder(id); render(); });
    const on = Api.toggleReminder(id); toast(on ? "Hatırlatma kuruldu: 5 dk kala ve başladığında haber vereceğiz." : "Hatırlatma kaldırıldı."); render();
  }
  else if (a === "telafi") telafiModal(act.dataset.id);
  else if (a === "telafiPick") telafiPick(act.dataset.id, act.dataset.kind);
  else if (a === "filter") { store("lb:filter", v); shown = PAGE; render(); }
  else if (a === "catf") { store("lb:cat", v); shown = PAGE; render(); }
  else if (a === "ctab") { store("lb:ctab", v); render(); }
  else if (a === "wall") { store("lb:wall", v || null); render(); }
  else if (a === "more") { shown += PAGE; const y = scrollY; render(); scrollTo(0, y); }
  else if (a === "pref") {
    const u = user(), p = prefsOf(u); p[v] = !p[v];
    if (v === "push" && p.push && "Notification" in window && Notification.permission !== "granted") {
      try { const perm = await Notification.requestPermission(); if (perm !== "granted") { p.push = false; toast("Tarayıcı bildirim izni verilmedi; bildirimler uygulama içinde görünür."); } } catch { p.push = false; toast("Bu tarayıcı bildirim desteklemiyor."); }
    } else if (v === "push" && p.push && !("Notification" in window)) { p.push = false; toast("Bu tarayıcı bildirim desteklemiyor; bildirimler uygulama içinde görünür."); }
    save(); render();
  }
  else if (a === "install") { installEvt?.prompt(); installEvt = null; act.hidden = true; }
  else if (a === "fill") { const n = Api.fillWithTestUsers(act.dataset.id); toast(`${n} test katılımcısı eklendi, kampanya kapandı.`); render(); }
  else if (a === "realtime") { demoOffset = 0; store("lb:demoOffset", null); render(); }
  else if (a === "resetDaily") { Api.resetDaily(); toast("Günlük hakkına +1 eklendi (test)."); render(); }
  else if (a === "refund") { const r = Api.brandRefund(act.dataset.code); toast(r.ok ? "İade kaydedildi, komisyon geri alındı." : "Bu kupon iade edilemez."); render(); }
  else if (a === "csv") downloadCsv();
  else if (a === "reset") modal(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="rsT"><h2 id="rsT">Tüm veriler silinsin mi?</h2><p class="muted" style="margin:0">Kullanıcılar, kuponlar, hatırlatmalar ve deneme kayıtları bu tarayıcıdan silinir.</p>
      <div class="acts"><button class="btn ghost" type="button" data-close>Vazgeç</button><button class="btn primary" type="button" data-act="resetYes">Evet, sıfırla</button></div></div>`);
  else if (a === "resetYes") { Api.reset(); closeModal(); toast("Veriler sıfırlandı."); render(); }
});
document.addEventListener("change", e => { if (e.target.matches("select[data-act=cat]")) { store("lb:panelCat", e.target.value); e.target.blur(); render(); } });
document.addEventListener("submit", e => {
  const f = e.target.closest("form[data-form]"); if (!f) return;
  e.preventDefault();
  const kind = f.dataset.form;
  if (kind === "login") {
    const err = $("#lErr"), nameEl = f.name, phoneEl = f.phone;
    [nameEl, phoneEl].forEach(x => x.removeAttribute("aria-invalid"));
    if (!f.kvkk.checked) { err.textContent = "Devam etmek için KVKK onayı gerekli."; return; }
    const r = Api.login(nameEl.value, phoneEl.value);
    if (r.error === "name") { err.textContent = "Adını en az 2 harf olarak yaz."; nameEl.setAttribute("aria-invalid", "true"); nameEl.focus(); return; }
    if (r.error === "phone") { err.textContent = "Geçerli bir cep telefonu yaz (05xx xxx xx xx)."; phoneEl.setAttribute("aria-invalid", "true"); phoneEl.focus(); return; }
    const next = afterLogin; afterLogin = null;
    closeModal(); toast(`Hoş geldin, ${r.user.name.split(" ")[0]}!`);
    if (next) next();
  } else if (kind === "demo") {
    const [h, m] = f.querySelector("#demoAt").value.split(":").map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) { setDemoTime(h, m); document.activeElement?.blur(); render(); toast(`Demo saati ${hhmm(h, m)} olarak ayarlandı.`); }
  } else if (kind === "pay") {
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Ödeme işleniyor…";
    const id = f.dataset.id; setTimeout(() => grantTelafi(id, "paid"), 900);
  } else if (kind === "kasa") {
    const brand = f.brand.value, code = f.code.value.trim().toUpperCase(), step = e.submitter?.value || "validate", amount = parseFloat(f.amount.value);
    const v = step === "order" ? Api.brandOrder(brand, code, f.order.value, amount) : Api.brandValidate(brand, code, amount);
    const cp = v.coupon;
    kasaMsg = {brand, code, amount:f.amount.value, ok:v.ok, html:!v.ok ? `<b>Reddedildi.</b> ${esc(v.reason)}` : step === "order" ?
      `<b>Sipariş ${esc(cp.orderNo)} alındı${v.repeat ? " (tekrar bildirim, ikinci kez sayılmadı)" : ""}.</b> Kupon kullanıldı olarak işaretlendi.${v.calc ? calcHtml(v.calc, cp) : ""}<a href="#/panel">Kupon takipte gör</a>` :
      `<b>Kod geçerli.</b> ${esc(cp.brand)} · ${esc(cp.products)} · son kullanma ${fmtDT(cp.expiresAt)}.${v.calc ? calcHtml(v.calc) : " Sepet tutarını girersen indirimi hesaplarım."}`};
    if (step === "order" && v.ok) kasaMsg.amount = "";
    document.activeElement?.blur(); render();
  }
});

if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !D.noServiceWorker) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* yayın ortamında service worker yok */ });
}
route = parseRoute();
render();
tick();
setInterval(tick, 1000);
})();
