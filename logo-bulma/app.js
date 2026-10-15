// 1 Milyonuncu Marka: site uygulaması.
// İki modda çalışır:
//  - Sunucu modu (canlı): sayfa server/server.mjs tarafından sunulduğunda /api'ye bağlanır; tüm kurallar sunucuda uygulanır.
//  - Yerel mod (demo): sunucu yoksa veriler bu tarayıcıda (localStorage) tutulur; aynı kurallar burada taklit edilir.
// İş kuralları (program, indirim, telafi, logo havuzu) ortak kurallar.js dosyasındadır.
(() => {
"use strict";
const D = window.LB_DATA, K = window.LB_KURALLAR;
const CAMPS = K.CAMPS, CAT = K.CAT, campById = K.campById, win = K.win;
const GRACE_MS = 300, DAY = 86400, PAGE = 24;
const LOST = ["wrong", "timeout", "full"];
const RES = {kazandi:"won", yanlis:"wrong", sure_doldu:"timeout", doldu:"full"};

/* ---------- yardımcılar ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[ch]));
const pad = n => String(n).padStart(2, "0");
const hhmm = (h, m = 0) => `${pad(h)}:${pad(m)}`;
const startTxt = c => K.hhmm(c.start);
const endTxt = c => { const e = c.start + c.durationMin; return e >= 1440 ? "24:00" : K.hhmm(e); };
const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const tl = n => new Intl.NumberFormat("tr-TR", {style:"currency", currency:"TRY", maximumFractionDigits:2}).format(n || 0);
const tl0 = n => new Intl.NumberFormat("tr-TR", {style:"currency", currency:"TRY", maximumFractionDigits:0}).format(n || 0);
const num = n => new Intl.NumberFormat("tr-TR").format(n || 0);
const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function randStr(n, abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789") { const a = new Uint32Array(n); crypto.getRandomValues(a); return Array.from(a, x => abc[x % abc.length]).join(""); }
function shuffle(arr) { const a = arr.slice(), r = new Uint32Array(a.length); crypto.getRandomValues(r); for (let i = a.length - 1; i > 0; i--) { const j = r[i] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function fmtClock(sec) { sec = Math.max(0, Math.ceil(sec)); return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec % 3600 / 60))}:${pad(sec % 60)}`; }
function fmtShort(sec) { sec = Math.max(0, Math.ceil(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return h ? `${h} sa ${pad(m)} dk` : `${pad(m)}:${pad(sec % 60)}`; }
function store(key, val) { try { if (val === undefined) return localStorage.getItem(key); if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); } catch { /* gizli sekme vb. */ } return null; }
function sstore(key, val) { try { if (val === undefined) return sessionStorage.getItem(key); if (val === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, val); } catch { /* kapalı */ } return null; }
const initials = name => esc(String(name || "?").split(" ").map(x => x[0]).join("").slice(0, 2).toLocaleUpperCase("tr"));
function csvDownload(name, head, rows) {
  const csv = "﻿" + [head, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const a = Object.assign(document.createElement("a"), {href:URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"})), download:name});
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

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
  users:"M9 11a4 4 0 1 0 0-8a4 4 0 1 0 0 8 M2 21a7 7 0 0 1 14 0 M16 3.5a4 4 0 0 1 0 7.5 M18 14a6 6 0 0 1 4 7",
  wallet:"M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z M3 7l12-4 2 4 M16 13.5h2", play:"M7 4l13 8-13 8Z",
  info:"M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 11v6 M12 7.5v.5", bolt:"M13 2 4 14h7l-1 8 9-12h-7Z", x:"M6 6l12 12 M18 6 6 18", check:"M4 12l5 5L20 6",
  copy:"M9 9h11v11H9Z M5 15H4V4h11v1", store:"M3 9l2-5h14l2 5 M3 9a3 3 0 0 0 6 0a3 3 0 0 0 6 0a3 3 0 0 0 6 0 M5 12v8h14v-8",
  film:"M3 5h18v14H3Z M7 5v14 M17 5v14 M3 9h4 M3 15h4 M17 9h4 M17 15h4", card:"M2 6h20v12H2Z M2 10h20 M6 15h4",
  fire:"M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8a7 7 0 0 0 7 7Z", arrow:"M5 12h14 M13 6l6 6-6 6", back:"M15 6l-6 6 6 6",
  star:"M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5l-5.5 2.9 1-6.3L3 9.7l6.2-.9Z", target:"M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10 M12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2",
  percent:"M19 5 5 19 M7 5a2 2 0 1 0 0 4a2 2 0 1 0 0-4 M17 15a2 2 0 1 0 0 4a2 2 0 1 0 0-4", download:"M12 3v12 M7 10l5 5 5-5 M4 21h16", upload:"M12 21V9 M7 14l5-5 5 5 M4 3h16",
  chart:"M4 20V10 M10 20V4 M16 20v-7 M22 20H2", calendar:"M3 5h18v16H3Z M3 10h18 M8 3v4 M16 3v4", lock:"M5 11h14v10H5Z M8 11V7a4 4 0 0 1 8 0v4", sms:"M4 4h16v12H8l-4 4Z M8 9h8 M8 12h5",
  search:"M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14 M20 20l-4-4", shield:"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6Z", image:"M3 5h18v14H3Z M3 16l5-5 4 4 3-3 6 6 M15.5 8.5h.01",
  link:"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1", ban:"M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M5.6 5.6l12.8 12.8", trash:"M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13"
};
const icon = (name, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICONS[name] || ICONS.star}"/></svg>`;
const catIcon = (slug, cls = "") => `<span class="cat-ic ${cls}" style="--c:${CAT[slug].color}">${icon(CAT[slug].icon)}</span>`;

/* ---------- mod, saat ---------- */
let MODE = "local";                       // "local" | "remote"
let token = store("lb:token"), adminKey = sstore("lb:admin");
let clockOffset = 0;                      // sunucu modunda: sunucu saati - cihaz saati
let demoOffset = Number(store("lb:demoOffset")) || 0;
const fmtParts = new Intl.DateTimeFormat("en-GB", {timeZone:D.timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23"});
function clock(ms = Date.now() + (MODE === "remote" ? clockOffset : demoOffset)) {
  const p = Object.fromEntries(fmtParts.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const h = +p.hour % 24, mi = +p.minute, s = +p.second;
  return {ms, day:`${p.year}-${p.month}-${p.day}`, h, mi, s, sod:h * 3600 + mi * 60 + s};
}
const fmtDT = ms => ms ? new Intl.DateTimeFormat("tr-TR", {timeZone:D.timeZone, day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"}).format(new Date(ms)) : "–";
const fmtDay = day => new Intl.DateTimeFormat("tr-TR", {day:"numeric", month:"long"}).format(new Date(day + "T12:00:00"));
function setDemoTime(h, m) { const t = clock(Date.now()); demoOffset = ((h * 3600 + m * 60) - t.sod) * 1000; store("lb:demoOffset", demoOffset ? String(demoOffset) : null); }

/* ---------- veri (yerel modda tam depo, sunucu modunda kişisel önbellek) ---------- */
const KEY = "lb:v3";
const fresh = () => ({users:{}, session:null, attempts:{}, coupons:[], clicks:[], reminders:[], notifs:[], prefs:{}, events:[], outbox:[], kasaLog:[]});
let db = load();
function load() { try { return Object.assign(fresh(), JSON.parse(store(KEY)) || {}); } catch { return fresh(); } }
function save() { if (MODE === "local") store(KEY, JSON.stringify(db)); countsCache = null; }
let LOGOS = {...(window.LB_LOGOS || {})};
try { Object.assign(LOGOS, JSON.parse(store("lb:logos")) || {}); } catch { /* yok */ }
let remoteCounts = {}, syncVer = 0, countsCache = null, paymentOn = true;   // canlıda ödeme kuruluşu bağlı değilse ücretli telafi gizlenir

const instKey = (c, t) => `${c.id}@${t.day}`;
function winners(key) {
  if (MODE === "remote") return remoteCounts[key] || 0;
  if (!countsCache) { countsCache = {}; for (const x of db.coupons) if (x.source === "oyun" && !x.cancelledAt) countsCache[x.key] = (countsCache[x.key] || 0) + 1; }
  return countsCache[key] || 0;
}
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
  return {inSec:s - t.sod, min:Math.round(s / 60) % 1440, ms:t.ms + (s - t.sod) * 1000};
}
const user = () => db.session && db.users[db.session] || null;
const myCoupons = () => { const u = user(); return u ? db.coupons.filter(x => x.phone === u.phone) : []; };
const attemptOf = (c, t = clock()) => { const u = user(); return u ? db.attempts[instKey(c, t)]?.[u.phone] || null : null; };
function couponStatus(cp, t = clock()) { return cp.cancelledAt ? "cancelled" : cp.refundedAt ? "refunded" : cp.usedAt ? "used" : t.ms > cp.expiresAt ? "expired" : "active"; }
const COUPON_TXT = {active:"Kullanılabilir", used:"Kullanıldı", expired:"Süresi doldu", refunded:"İade edildi", cancelled:"İptal edildi"};
const needsCheck = cp => cp.validatedAt && !cp.usedAt && !cp.test && !cp.cancelledAt;
const prefsOf = u => db.prefs[u.phone] = db.prefs[u.phone] || {push:false, sms:true, before5:true, onStart:true, expiry:true};
const hasReminder = (c, t = clock()) => { const u = user(); return !!u && db.reminders.some(r => r.phone === u.phone && r.campId === c.id && r.day === t.day); };
function telafiState(c, key, t = clock()) {
  const u = user(), att = u && db.attempts[key]?.[u.phone];
  if (!att || !LOST.includes(att.result)) return {ok:false, why:"none"};
  if (att.telafi) return {ok:false, why:"taken"};
  if (key.split("@")[1] !== t.day || t.sod >= win(c).end) return {ok:false, why:"closed"};
  return {ok:true};
}
function normPhone(raw) { let d = String(raw).replace(/\D/g, ""); if (d.startsWith("90") && d.length === 12) d = d.slice(2); if (d.startsWith("0")) d = d.slice(1); return /^5\d{9}$/.test(d) ? "0" + d : null; }
const fmtPhone = p => String(p || "").replace(/^(\d{4})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3 $4");
const maskPhone = p => String(p || "").replace(/^(\d{4})\d{3}(\d{2})(\d{2})$/, "$1 *** $2 $3");
const boardHint = () => (innerWidth < 700 ? D.boardSizeMfMin : D.boardSizeMf);
const linkHref = (cp, i, url) => MODE === "remote" ? `r/${encodeURIComponent(cp.code)}/${i}` : url;

/* ---------- sunucu bağlantısı ---------- */
async function http(method, path, body, {admin = false} = {}) {
  const headers = {"Content-Type":"application/json"};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (admin && adminKey) headers["X-Admin-Anahtar"] = adminKey;
  const r = await fetch(`api/${path}`, {method, headers, body:body === undefined ? undefined : JSON.stringify(body)});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.mesaj || "Sunucuya ulaşılamadı."); e.code = j.hata; e.status = r.status; throw e; }
  return j;
}
const fromServerCoupon = cp => ({...cp, sale:cp.paid ?? cp.sale ?? null});
async function sync() {
  const s = await http("GET", "durum");
  clockOffset = s.simdi - Date.now();
  remoteCounts = s.sayaclar || {}; paymentOn = s.odeme !== false;
  const me = s.ben;
  if (me) { db.users = {[me.phone]:me}; db.session = me.phone; db.prefs = {[me.phone]:me.prefs}; }
  else { db.users = {}; db.session = null; if (token) { token = null; store("lb:token", null); } }
  db.attempts = {};
  for (const [k, a] of Object.entries(s.denemeler || {})) db.attempts[k] = {[me.phone]:{...a, result:RES[a.result] || a.result}};
  db.coupons = (s.kuponlar || []).map(fromServerCoupon);
  db.reminders = s.hatirlatmalar || [];
  const seen = new Set(db.notifs.map(n => n.id)), incoming = (s.bildirimler || []).filter(n => !seen.has(n.id) && !n.read);
  db.notifs = s.bildirimler || [];
  if (syncVer > 0 && me) incoming.slice(0, 2).forEach(n => { toast(`🔔 ${n.title}`); try { if (prefsOf(me).push && Notification.permission === "granted") new Notification(n.title, {body:n.body}); } catch { /* yok */ } });
  syncVer++; countsCache = null;
}
// Canlı sunucu config.js'i "window.LB_SERVER = true" olarak üretir; statik yayında dosya false döner (yerel mod).
async function detectMode() {
  if (!window.LB_SERVER || D.forceLocal) return;
  MODE = "remote"; db = fresh();
  try { await sync(); } catch { toast("Sunucuya ulaşılamadı; sayfayı yenile."); }
}

/* ---------- işlemler (yerel ya da sunucu) ---------- */
const Local = {
  login(name, phone) {
    name = name.trim().replace(/\s+/g, " "); const p = normPhone(phone);
    if (name.length < 2) return {error:"name"};
    if (!p) return {error:"phone"};
    const now = clock().ms;
    db.users[p] = db.users[p] || {phone:p, name, createdAt:now, consentAt:now};
    db.users[p].name = name; db.users[p].lastSeen = now; db.session = p; save();
    return {user:db.users[p]};
  },
  start(campId, size) {
    const c = campById(campId), u = user(), t = clock();
    if (!c) return {error:"missing"};
    if (!u) return {error:"login"};
    if (u.blocked) return {error:"blocked"};
    const st = status(c, t); if (st !== "active") return {error:st};
    const key = instKey(c, t);
    if (db.attempts[key]?.[u.phone]) return {error:"used"};
    const n = K.boardSizeFor(c, size);
    const board = shuffle([c.brand, ...shuffle(K.poolOf(c.cat).filter(b => b !== c.brand)).slice(0, n - 1)]);
    const tiles = board.map(brand => ({token:randStr(10), brand}));
    const att = {startedAt:t.ms, target:tiles.find(x => x.brand === c.brand).token, result:null};
    (db.attempts[key] = db.attempts[key] || {})[u.phone] = att; save();
    return {key, tiles, totalMs:c.findSec * 1000};
  },
  pick(campId, key, token) {
    const c = campById(campId), u = user(), t = clock(), att = u && db.attempts[key]?.[u.phone];
    if (!att || att.result) return {error:"used"};
    const ms = t.ms - att.startedAt; att.ms = ms;
    if (ms > c.findSec * 1000 + GRACE_MS) att.result = "timeout";
    else if (token !== att.target) att.result = "wrong";
    else if (winners(key) >= c.quota) att.result = "full";
    else att.result = "won";
    const coupon = att.result === "won" ? issueCoupon(c, key, u, t, {source:"oyun"}) : null;
    save();
    return {result:att.result, ms, coupon, target:att.target};
  },
  timeout(key) { const u = user(), att = u && db.attempts[key]?.[u.phone]; if (att && !att.result) { att.result = "timeout"; att.ms = clock().ms - att.startedAt; save(); } return {target:att?.target}; },
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
  // Marka entegrasyonu simülasyonu (canlıda markanın sitesi imzalı API ile yapar; ENTEGRASYON.md)
  kasa(step, brand, rawCode, orderNo, amount) {
    const code = String(rawCode).trim().toUpperCase(), cp = db.coupons.find(x => x.code === code);
    const t = clock();
    if (step === "order") {
      orderNo = String(orderNo).trim();
      if (!orderNo) return {ok:false, reason:"Sipariş numarası gerekli."};
      const same = db.coupons.find(x => x.brand === brand && x.orderNo === orderNo);
      if (same) return same.code === code ? {ok:true, coupon:same, repeat:true} : {ok:false, reason:"Bu sipariş numarası başka bir kodla bildirilmiş."};
      if (!(amount > 0)) return {ok:false, reason:"Sepet tutarı 0'dan büyük olmalı."};
    }
    if (!cp) return {ok:false, reason:"Kod bulunamadı."};
    if (cp.brand !== brand) return {ok:false, reason:`Bu kod ${cp.brand} kuponu; ${brand} kasasında geçmez.`};
    const st = couponStatus(cp, t);
    if (st !== "active") return {ok:false, reason:{used:"Kod daha önce kullanılmış.", expired:"Kodun kullanım süresi dolmuş.", refunded:"Kod iade edilen bir siparişte kullanılmış.", cancelled:"Kod iptal edilmiş."}[st]};
    cp.validatedAt = cp.validatedAt || t.ms;
    const calc = amount > 0 ? K.discount(cp.rules, amount, cp.newMember) : null;
    if (step === "order") Object.assign(cp, {usedAt:t.ms, orderNo, gross:K.money(amount), discount:calc.discount, discountPct:calc.totalPct, sale:calc.pay, commission:K.commission(calc.pay)});
    save(); return {ok:true, coupon:cp, calc};
  },
  adminAction(tur, p) {
    const t = clock(), cp = p.kod && db.coupons.find(x => x.code === p.kod), u = p.telefon && db.users[p.telefon];
    if (tur === "kupon_iptal" && cp) cp.cancelledAt = t.ms;
    else if (tur === "kupon_uzat" && cp) { cp.expiresAt = Math.max(cp.expiresAt, t.ms) + 24 * 3600e3; cp.expNotified = 0; }
    else if (tur === "kupon_kullanildi" && cp) {
      if (!(p.sepetTutari > 0)) return {error:"tutar"};
      const calc = K.discount(cp.rules, p.sepetTutari, cp.newMember);
      Object.assign(cp, {validatedAt:cp.validatedAt || t.ms, usedAt:t.ms, orderNo:p.siparisNo || "ELLE", gross:K.money(p.sepetTutari), discount:calc.discount, discountPct:calc.totalPct, sale:calc.pay, commission:K.commission(calc.pay), manual:true});
    } else if (tur === "iade" && cp && cp.usedAt && !cp.refundedAt) { cp.refundedAt = t.ms; cp.refundedCommission = cp.commission; cp.commission = 0; }
    else if (tur === "uye_engelle" && u) u.blocked = !u.blocked;
    else if (tur === "uye_sil" && u) {
      delete db.users[p.telefon]; if (db.session === p.telefon) db.session = null;
      db.reminders = db.reminders.filter(r => r.phone !== p.telefon); db.notifs = db.notifs.filter(n => n.phone !== p.telefon);
      db.coupons.forEach(x => { if (x.phone === p.telefon) { x.phone = "silindi"; x.name = "Silinen üye"; } });
    } else if (tur === "sms_gonder") {
      const list = p.hedef === "hatirlatma" ? [...new Set(db.reminders.filter(r => r.campId === p.kampanya && r.day === t.day).map(r => r.phone))] : [p.telefon];
      for (const ph of list) { const uu = db.users[ph]; if (uu) deliverLocal(uu, p.baslik || "1 Milyonuncu Marka", p.mesaj, p.link || "#/", true); }
      return {gonderilen:list.length};
    } else if (tur === "fill") {
      const c = campById(p.kampanya); if (status(c, t) !== "active") return {n:0};
      const key = instKey(c, t); let n = 0;
      while (winners(key) < c.quota) { issueCoupon(c, key, {phone:"test", name:"Test katılımcı"}, t, {source:"oyun", test:true}); n++; }
      save(); return {n};
    } else return {error:"bilinmeyen"};
    save(); return {ok:true};
  },
  adminData() {
    const attempts = [];
    for (const [key, m] of Object.entries(db.attempts)) for (const [phone, a] of Object.entries(m)) attempts.push({key, phone, ...a});
    return {users:Object.values(db.users), coupons:db.coupons, attempts, reminders:db.reminders, clicks:db.clicks, events:db.events, outbox:db.outbox, brands:[]};
  }
};
function issueCoupon(c, key, u, t, {source, pct, kind, fee = 0, test = false}) {
  const prefix = c.brand.normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  // Prototip kodları DEMO- ile başlar; gerçek bir marka kuponuyla karışmasın.
  let code; do code = `DEMO-${prefix}-${randStr(5)}`; while (db.coupons.some(x => x.code === code));
  const newMember = source === "oyun" && !test && K.isNewMember(db.coupons, u.phone);
  const rules = source === "telafi" ? {pct, newMember:0, tiers:[]} : c.rules;
  const cp = {code, key, campId:c.id, cat:c.cat, brand:c.brand, title:c.title || null, offer:source === "telafi" ? `Telafi: ${c.products.toLocaleLowerCase("tr")} için %${pct} indirim` : c.offer,
    products:c.products, rules, newMember, source, telafiKind:kind || null, fee, phone:u.phone, name:u.name, day:t.day,
    issuedAt:t.ms, expiresAt:t.ms + c.validHours * 3600e3, validatedAt:null, usedAt:null, orderNo:null, gross:null, discount:null, sale:null, commission:null, test};
  db.coupons.push(cp); countsCache = null; return cp;
}

const Api = {
  async sendCode(phone) {
    if (MODE === "local") return {ok:true};
    return http("POST", "giris/kod", {telefon:phone});
  },
  async login(name, phone, code) {
    if (MODE === "local") return Local.login(name, phone);
    const r = await http("POST", "giris", {ad:name, telefon:phone, kod:code, kvkkOnay:true});
    token = r.token; store("lb:token", token); await sync();
    return {user:user()};
  },
  async logout() { if (MODE === "remote") { await http("POST", "cikis").catch(() => {}); token = null; store("lb:token", null); await sync(); } else { db.session = null; save(); } },
  async start(campId, size) {
    if (MODE === "local") return Local.start(campId, size);
    try { const r = await http("POST", "oyun/basla", {kampanya:campId, boyut:size}); return {key:r.deneme, tiles:r.logolar.map(x => ({token:x.token, brand:x.marka})), totalMs:r.sureMs}; }
    catch (e) { return {error:{giris_gerekli:"login", hak_kullanildi:"used", engelli:"blocked"}[e.code] || e.code || "network"}; }
  },
  async pick(campId, key, tok) {
    if (MODE === "local") return Local.pick(campId, key, tok);
    const r = await http("POST", "oyun/sec", {deneme:key, token:tok}); await sync().catch(() => {});
    return {result:RES[r.sonuc] || r.sonuc, ms:r.sureMs, coupon:r.kupon ? db.coupons.find(x => x.code === r.kupon.code) || fromServerCoupon(r.kupon) : null, target:r.hedef};
  },
  async timeout(key) {
    if (MODE === "local") return Local.timeout(key);
    const r = await http("POST", "oyun/zaman-asimi", {deneme:key}).catch(() => ({})); await sync().catch(() => {});
    return {target:r.hedef};
  },
  async startAd(key) { return MODE === "local" ? {id:null} : http("POST", "reklam/basla", {deneme:key}).then(r => ({id:r.reklamId})); },
  async telafi(campId, key, kind, extra = {}) {
    if (MODE === "local") return Local.telafi(campId, key, kind);
    try {
      const r = await http("POST", "oyun/telafi", {deneme:key, tur:{low:"dusuk", ad:"reklam", paid:"ucretli"}[kind], ...extra}); await sync();
      return {coupon:db.coupons.find(x => x.code === r.kupon.code) || fromServerCoupon(r.kupon)};
    } catch (e) { return {error:e.code || "network"}; }
  },
  async toggleReminder(campId) {
    if (MODE === "local") return Local.toggleReminder(campId);
    const r = await http("POST", "hatirlatma", {kampanya:campId}); await sync(); return r.kurulu;
  },
  async setPrefs(p) { if (MODE === "remote") { await http("POST", "bildirim-ayarlari", p); await sync(); } else save(); },
  async markRead() { if (MODE === "remote") await http("POST", "bildirimler/okundu", {}).catch(() => {}); else save(); },
  async kasa(step, brand, code, orderNo, amount) {
    if (MODE === "local") return Local.kasa(step, brand, code, orderNo, amount);
    try {
      const r = await http("POST", "admin/kasa", {adim:step, marka:brand, kod:code, siparisNo:orderNo, sepetTutari:amount}, {admin:true});
      if (!r.ok) return {ok:false, reason:r.mesaj};
      return {ok:true, repeat:r.tekrar, coupon:fromServerCoupon(r.kupon), calc:r.hesap};
    } catch (e) { return {ok:false, reason:e.message}; }
  },
  async adminData() { return MODE === "local" ? Local.adminData() : http("GET", "admin/veri", undefined, {admin:true}); },
  async adminAction(tur, p) { return MODE === "local" ? Local.adminAction(tur, p) : http("POST", "admin/islem", {tur, ...p}, {admin:true}); },
  async uploadLogo(brand, dataUrl) {
    if (MODE === "local") {
      const up = (() => { try { return JSON.parse(store("lb:logos")) || {}; } catch { return {}; } })(); up[brand] = dataUrl;
      const json = JSON.stringify(up);
      if (json.length > 4.5e6) return {error:"Tarayıcı depolama alanı doldu; canlıda logolar sunucuya kaydedilir."};
      store("lb:logos", json); LOGOS[brand] = dataUrl;
      return {ok:true};
    }
    const r = await http("POST", "admin/logo", {marka:brand, dosya:dataUrl}, {admin:true}); LOGOS[brand] = r.yol; return {ok:true};
  },
  async removeLogo(brand) {
    if (MODE === "local") { delete LOGOS[brand]; const up = (() => { try { return JSON.parse(store("lb:logos")) || {}; } catch { return {}; } })(); delete up[brand]; store("lb:logos", JSON.stringify(up)); return {ok:true}; }
    await http("POST", "admin/logo-sil", {marka:brand}, {admin:true}); delete LOGOS[brand]; return {ok:true};
  },
  async createBrandKey(name) { return http("POST", "admin/marka", {ad:name}, {admin:true}); }
};

/* ---------- bildirimler (yerel mod; sunucu modunda sunucunun zamanlayıcısı gönderir) ---------- */
function deliverLocal(u, title, body, link, fromAdmin = false) {
  const p = prefsOf(u), channels = ["Uygulama"];
  if (u.phone === db.session && p.push && "Notification" in window && Notification.permission === "granted") {
    try { new Notification(title, {body, tag:link || title}); channels.push("Tarayıcı"); } catch { /* kapalı */ }
  }
  if (p.sms || fromAdmin) channels.push(`SMS ${maskPhone(u.phone)} (demo)`);
  const n = {id:randStr(8), phone:u.phone, at:clock().ms, title, body, link, channels, read:false};
  db.notifs.unshift(n); db.notifs = db.notifs.slice(0, 300);
  db.outbox.unshift({at:n.at, to:u.phone, title, body, channels}); db.outbox = db.outbox.slice(0, 500);
  save();
  if (u.phone === db.session) toast(`🔔 ${title}`);
}
function runSchedulers(t) {
  if (MODE !== "local") return;
  const u = user(); if (!u) return;
  const p = prefsOf(u);
  for (const r of db.reminders) {
    if (r.phone !== u.phone || r.day !== t.day) continue;
    const c = campById(r.campId); if (!c) continue;
    const toStart = win(c).start - t.sod;
    if (p.before5 && !r.s5 && toStart > 0 && toStart <= 300) { r.s5 = 1; deliverLocal(u, `${c.brand} 5 dk sonra başlıyor`, `${CAT[c.cat].name} kampanyası ${startTxt(c)}'de açılıyor. Hazır ol!`, `#/kampanya/${c.id}`); }
    if (p.onStart && !r.s0 && toStart <= 0 && t.sod < win(c).end) { r.s0 = 1; deliverLocal(u, `${c.brand} kampanyası başladı`, `${remaining(c, t)} kupon var, logoyu 5 saniyede bul!`, `#/kampanya/${c.id}`); }
  }
  for (const cp of myCoupons()) {
    if (p.expiry && !cp.expNotified && couponStatus(cp, t) === "active" && cp.expiresAt - t.ms <= 3600e3) {
      cp.expNotified = 1; deliverLocal(u, `${cp.brand} kuponunun süresi bitiyor`, `Kuponunu kullanmak için 1 saatten az kaldı (${cp.code}).`, "#/kuponlarim");
    }
  }
}

/* ---------- arayüz parçaları ---------- */
const PALETTE = [["#111111","#FFFFFF"],["#E30613","#FFFFFF"],["#0B3D91","#FFFFFF"],["#F5F0E6","#1A1A1A"],["#FFD400","#111111"],["#00704A","#FFFFFF"],
  ["#FFFFFF","#C8102E"],["#3B2A20","#F3E3C3"],["#6D28D9","#FFFFFF"],["#F28C28","#111111"],["#0E7490","#FFFFFF"],["#FFFFFF","#111111"]];
// Orijinal logo dosyası varsa (yüklenen ya da logos/manifest.js) o gösterilir, yoksa yazı rozeti.
// mono: Muhteşem Fırsat'ta tüm logolar bordo/siyah ve aynı yazı tipinde; müşteri yalnız isme ve ikona bakar.
function logo(brand, {tag = "div", attrs = "", mono = false, i = 0} = {}) {
  const src = LOGOS[brand];
  const longest = Math.max(...brand.split(/\s+/).map(w => w.length)), s = Math.min(1, 7 / longest).toFixed(2);
  const lang = /[çğıöşüÇĞİÖŞÜ]/.test(brand) ? "tr" : "en";
  const alt = tag === "button" ? "" : esc(brand);
  if (mono) {
    const bg = i % 2 ? "#0B0B0D" : "#6E0B24";
    return src ? `<${tag} class="logo mono has-img" style="background:${bg}" ${attrs}><img src="${esc(src)}" alt="${alt}" loading="lazy" draggable="false"></${tag}>`
      : `<${tag} class="logo mono" lang="${lang}" style="background:${bg};color:#fff" ${attrs}><span class="w" style="--s:${s}">${esc(brand)}</span></${tag}>`;
  }
  if (src) return `<${tag} class="logo has-img" ${attrs}><img src="${esc(src)}" alt="${alt}" loading="lazy" draggable="false"></${tag}>`;
  const h = hash(brand), [bg, fg] = PALETTE[h % PALETTE.length];
  return `<${tag} class="logo f${(h >>> 4) % 6}" lang="${lang}" style="background:${bg};color:${fg}" ${attrs}><span class="w" style="--s:${s}">${esc(brand)}</span></${tag}>`;
}
const STATUS_TXT = {active:"Canlı", upcoming:"Yakında", full:"Kontenjan doldu", ended:"Sona erdi"};
const badge = st => `<span class="badge b-${st}">${st === "active" ? '<i class="pulse"></i>' : ""}${STATUS_TXT[st]}</span>`;
// Koşul çipleri; base:false iken temel oran (büyük yazıyla zaten gösteriliyorsa) tekrar edilmez.
function ruleChips(r, {base = true} = {}) {
  const items = [
    base ? `<span class="chip hot">${icon("percent")}%${r.pct} indirim</span>` : "",
    r.newMember ? `<span class="chip">${icon("star")}Yeni üyeye +%${r.newMember} indirim</span>` : "",
    ...(r.tiers || []).map(x => `<span class="chip">${icon("chart")}${tl0(x.min)} üstü %${x.pct} indirim</span>`)
  ].join("");
  return items ? `<div class="chips">${items}</div>` : "";
}
function countdown(c, t, st, big = false) {
  // Başlangıç saati olmayan (tüm gün açık) kampanyalarda sayaç çalışmaz.
  if (c.demo) return `<div class="cd allday ${big ? "big" : ""}"><span class="cd-l">${icon("clock")}Başlangıç saati yok</span><b class="cd-v">Tüm gün açık</b></div>`;
  if (st === "upcoming") return `<div class="cd ${big ? "big" : ""}"><span class="cd-l">${icon("clock")}${startTxt(c)}'de başlıyor</span><b class="cd-v" data-cd="${startsAt(c, t)}">${fmtClock(win(c).start - t.sod)}</b>
    <span class="cd-s">${c.durationMin} dk sürecek</span></div>`;
  if (st === "active") {
    const w = win(c), pct = Math.min(100, (t.sod - w.start) / (w.end - w.start) * 100);
    return `<div class="cd live ${big ? "big" : ""}"><span class="cd-l">${icon("fire")}Bitmesine (${endTxt(c)})</span><b class="cd-v" data-cd="${endsAt(c, t)}">${fmtClock(w.end - t.sod)}</b>
      <div class="prog"><i data-prog="${startsAt(c, t)},${endsAt(c, t)}" style="width:${100 - pct}%"></i></div></div>`;
  }
  return `<div class="cd off ${big ? "big" : ""}"><span class="cd-l">${icon("lock")}${st === "full" ? "Kontenjan doldu" : "Süre doldu"}</span><b class="cd-v">${st === "full" ? "Tükendi" : "Bitti"}</b></div>`;
}
const timeLabel = c => c.demo ? "Tüm gün" : `${startTxt(c)}–${endTxt(c)}`;
// Kart ve detaydaki eylem düğmeleri: Detay + Başla yan yana; duruma göre Hatırlat / Kuponu gör / Telafi
function actions(c, t, {detail = true} = {}) {
  const st = status(c, t), att = attemptOf(c, t), key = instKey(c, t);
  const det = detail ? `<a class="btn ghost" href="#/kampanya/${c.id}">${icon("info")}Detay</a>` : "";
  let main;
  if (att?.result === "won") main = `<a class="btn win" href="#/kuponlarim">${icon("ticket")}Kuponu gör</a>`;
  else if (att && telafiState(c, key, t).ok) main = `<button class="btn telafi" type="button" data-act="telafi" data-id="${c.id}">${icon("gift")}Telafi al</button>`;
  else if (att) main = `<button class="btn" type="button" disabled>${icon("check")}Hakkını kullandın</button>`;
  else if (st === "upcoming") main = hasReminder(c, t) ? `<button class="btn on" type="button" data-act="remind" data-id="${c.id}">${icon("bell")}Hatırlatma kurulu</button>`
    : `<button class="btn alt" type="button" data-act="remind" data-id="${c.id}">${icon("bell")}Hatırlat</button>`;
  else if (st === "active") main = `<button class="btn primary shine" type="button" data-act="start" data-id="${c.id}">${icon("play")}Başla</button>`;
  else main = `<button class="btn" type="button" disabled>${icon("lock")}Kapandı</button>`;
  return `<div class="acts">${det}${main}</div>`;
}
const campTitle = c => c.title ? `${c.title}: ${c.brand}` : c.brand;
function campCard(c, t) {
  const st = status(c, t), cat = CAT[c.cat], left = remaining(c, t), att = attemptOf(c, t);
  return `<article class="card camp ${c.mono ? "mf" : ""} st-${st}" style="--c:${cat.color}">
    ${c.mono ? `<div class="mf-ribbon">${icon("bolt")}MUHTEŞEM FIRSAT${icon("bolt")}</div>` : ""}
    <header class="camp-h">${catIcon(c.cat)}<span class="camp-cat">${esc(cat.name)} · ${timeLabel(c)}</span>${c.demo ? '<span class="tag">demo</span>' : ""}${badge(st)}</header>
    <div class="camp-b">${logo(c.brand, {mono:c.mono})}<div class="camp-m"><h3>${esc(campTitle(c))}</h3><p class="offer">${esc(c.offer)}</p></div></div>
    ${att ? `<p class="mine ${att.result === "won" ? "won" : "lost"}">${att.result === "won" ? `${icon("trophy")}Kazandın` : `${icon("x")}Bu kampanyayı kaçırdın`}${att.telafi ? " · telafi alındı" : ""}</p>` : ""}
    ${countdown(c, t, st)}
    <div class="quota"><div class="quota-t"><span>${icon("ticket")}${left} / ${c.quota} kupon kaldı</span><span>${Math.round((c.quota - left) / c.quota * 100)}%</span></div>
      <div class="bar"><i style="width:${(c.quota - left) / c.quota * 100}%"></i></div></div>
    ${actions(c, t)}
  </article>`;
}
function historyCard(c, day, att) {
  const cat = CAT[c.cat], won = att.result === "won", t = clock(), key = `${c.id}@${day}`;
  const reason = {wrong:"Yanlış logo", timeout:"Süre doldu", full:"Kontenjan doldu"}[att.result] || "";
  const ts = !won ? telafiState(c, key, t) : {ok:false};
  return `<article class="card camp hist ${won ? "won" : "lost"}" style="--c:${cat.color}">
    <header class="camp-h">${catIcon(c.cat)}<span class="camp-cat">${esc(cat.name)} · ${fmtDay(day)}</span><span class="badge ${won ? "b-won" : "b-lost"}">${won ? "Kazandın" : "Kazanamadın"}</span></header>
    <div class="camp-b">${logo(c.brand, {mono:c.mono})}<div class="camp-m"><h3>${esc(campTitle(c))}</h3><p class="offer">${esc(c.offer)}</p></div></div>
    <p class="mine ${won ? "won" : "lost"}">${won ? `${icon("trophy")}${((att.ms || 0) / 1000).toFixed(2)} sn'de buldun` : `${icon("x")}${reason}${att.telafi ? " · telafi kuponu alındı" : ""}`}</p>
    <div class="acts"><a class="btn ghost" href="#/kampanya/${c.id}">${icon("info")}Detay</a>${won ? `<a class="btn win" href="#/kuponlarim">${icon("ticket")}Kuponlarım</a>` :
      ts.ok ? `<button class="btn telafi" type="button" data-act="telafi" data-id="${c.id}">${icon("gift")}Telafi al</button>` : ""}</div>
  </article>`;
}
// Müşterinin kuponu nerede kullanacağı: markanın sitesi ve pazaryeri mağazaları (UTM'li). Link yoksa açıklama.
function useLinks(cp, {big = false} = {}) {
  const c = campById(cp.campId), links = c ? K.campaignLinks(c, cp.code) : [];
  if (!links.length) return `<p class="use-note">${icon("info")}<span>Kodu <b>${esc(cp.brand)}</b> web sitesinde ya da pazaryeri mağazasında, ödeme adımındaki <b>indirim kodu</b> alanına gir.</span></p>`;
  return `<div class="${big ? "acts col" : "links"}">${links.map((l, i) => `<a class="btn ${big && i === 0 ? "primary" : "ghost"} ${big ? "" : "sm"}" href="${esc(linkHref(cp, i, l.url))}" target="_blank" rel="noopener" data-utm="${esc(cp.code)}" data-i="${i}">${icon(l.ad === "Web sitesi" ? "store" : "cart")}${esc(l.ad)}'${l.ad === "Web sitesi" ? "nde" : "da"} kullan${icon("arrow")}</a>`).join("")}</div>`;
}

/* ---------- görünümler ---------- */
const views = {};
const FILTERS = [["active", "Aktif", "fire"], ["upcoming", "Yaklaşan", "clock"], ["won", "Kazandıklarım", "trophy"], ["lost", "Kazanamadıklarım", "x"], ["ended", "Sona eren", "lock"], ["remind", "Hatırlatmalarım", "bell"]];
let shown = PAGE, searchQ = "";
function homeLists(t) {
  const u = user(), catF = store("lb:cat") || "all", inCat = c => catF === "all" || c.cat === catF;
  const hist = [];
  if (u) for (const [key, m] of Object.entries(db.attempts)) { const a = m[u.phone]; if (!a || !a.result) continue; const [id, day] = key.split("@"); const c = campById(id); if (c && inCat(c)) hist.push({c, day, a}); }
  hist.sort((x, y) => (y.a.startedAt || 0) - (x.a.startedAt || 0));
  const byStatus = s => CAMPS.filter(c => inCat(c) && s.includes(status(c, t)));
  return {
    active:byStatus(["active"]).sort((a, b) => (b.mono ? 2 : 0) + (b.demo ? 1 : 0) - (a.mono ? 2 : 0) - (a.demo ? 1 : 0) || win(a).end - win(b).end),
    upcoming:byStatus(["upcoming"]).sort((a, b) => a.start - b.start),
    ended:byStatus(["ended", "full"]).sort((a, b) => b.start - a.start),
    won:hist.filter(h => h.a.result === "won"), lost:hist.filter(h => h.a.result !== "won"),
    remind:u ? db.reminders.filter(r => r.phone === u.phone && r.day === t.day).map(r => campById(r.campId)).filter(c => c && inCat(c)) : [],
    catF
  };
}
const ST_ORDER = {active:0, upcoming:1, full:2, ended:3};
function searchResults(t) {
  const r = K.search(searchQ);
  const camps = r.camps.slice().sort((a, b) => ST_ORDER[status(a, t)] - ST_ORDER[status(b, t)] || a.start - b.start);
  if (!r.cats.length && !camps.length) return `<div class="empty">${icon("search", "big")}<b>"${esc(searchQ)}" için sonuç yok</b><span>Kategori (ör. Ayakkabı), marka (ör. Civil) ya da ürün (ör. bebek bezi) yazabilirsin.</span></div>`;
  return `<p class="muted small" style="margin:0">"${esc(searchQ)}": ${r.cats.length} kategori, ${camps.length} kampanya</p>
    ${r.cats.length ? `<div class="cat-row">${r.cats.map(c => `<a class="cchip" href="#/kategori/${c.slug}" style="--c:${c.color}">${icon(c.icon)}${esc(c.name)}</a>`).join("")}</div>` : ""}
    ${camps.length ? `<div class="grid-cards">${camps.slice(0, shown).map(c => campCard(c, t)).join("")}</div>${camps.length > shown ? `<button class="btn ghost more" type="button" data-act="more">${camps.length - shown} kampanya daha göster</button>` : ""}` : ""}`;
}
views.home = () => {
  const t = clock(), nx = nextStart(t), L = homeLists(t), f = store("lb:filter") || "active";
  const mf = CAMPS.filter(c => c.mono && status(c, t) === "active");
  const todayCoupons = CAMPS.filter(c => !c.demo).reduce((s, c) => s + c.quota, 0);
  const items = L[f] || [];
  const list = f === "won" || f === "lost" ? items.slice(0, shown).map(h => historyCard(h.c, h.day, h.a)).join("") : items.slice(0, shown).map(c => campCard(c, t)).join("");
  const empty = {active:"Bu filtrede şu an aktif kampanya yok.", upcoming:"Bugün başka kampanya kalmadı; yarın 00:00'dan itibaren yenileri açılıyor.",
    won:user() ? "Henüz kazandığın kampanya yok. İlk kuponun bir logo uzağında!" : "Kazandığın kampanyaları görmek için giriş yap.",
    lost:"Kaçırdığın kampanya yok. Böyle devam!", ended:"Bugün sona eren kampanya yok.", remind:"Hatırlatma kurmadın. Yaklaşan kampanyalarda zil ikonuna dokun."}[f];
  const nextCount = CAMPS.filter(c => !c.demo && c.start === nx.min).length;
  return `
  <section class="hero">
    <div class="hero-txt">
      <span class="eyebrow"><i class="pulse"></i>Gün boyu yeni markalar · ${CAMPS.filter(c => status(c, t) === "active").length} kampanya canlı</span>
      <h1>Logoyu <span class="grad">5 saniyede</span> bul,<br>indirimi <span class="hl">kap!</span></h1>
      <p>Her kategoride gün boyu yeni marka kampanyaları açılır. Logolar arasında hedefi ilk bulanlar kişiye özel indirim kuponunu kazanır.</p>
      <div class="hero-cta"><a class="btn primary big shine" href="#kampanyalar" data-act="scroll">${icon("play")}Hemen oyna</a><a class="btn ghost big" href="#/nasil">${icon("info")}Nasıl çalışır?</a></div>
    </div>
    <div class="hero-card">
      <span class="hc-l">${icon("clock")}Sıradaki kampanyaya</span>
      <b class="hc-cd" data-cd="${nx.ms}">${fmtClock(nx.inSec)}</b>
      <span class="hc-s">${K.hhmm(nx.min)}'de ${nextCount} kampanya birden açılıyor</span>
      <div class="hc-stats"><div><b>${num(CAMPS.length)}</b><span>kampanya</span></div><div><b>${num(todayCoupons)}</b><span>günlük kupon</span></div><div><b>${D.categories.length}</b><span>kategori</span></div></div>
    </div>
  </section>
  <div class="marquee" aria-hidden="true"><div class="mq-track">${[0, 1].map(() => K.ownBrands("buyuk-firsat").slice(0, 40).map(b => logo(b)).join("")).join("")}</div></div>
  ${mf.map(c => `<a class="mf-banner" href="#/kampanya/${c.id}"><span class="mf-tag">${icon("bolt")}MUHTEŞEM FIRSAT</span>
    <b>${esc(c.brand)}: ${esc(c.offer)}</b><span class="mf-sub">${K.boardSizeFor(c, boardHint())} logo, hepsi bordo-siyah! Sadece isme ve ikona odaklan. <u>Hemen katıl</u></span>
    ${c.demo ? `<span class="mf-cd">${icon("fire")}<b>Tüm gün</b></span>` : `<span class="mf-cd">${icon("fire")}<b data-cd="${endsAt(c, t)}">${fmtClock(win(c).end - t.sod)}</b></span>`}</a>`).join("")}
  <section class="section" id="kampanyalar" aria-labelledby="campH">
    <div class="sec-head"><h2 id="campH">${icon("ticket")}Kampanyalar</h2><span class="muted small">Türkiye saati · ${hhmm(t.h, t.mi)}</span></div>
    <form class="search" role="search" data-form="search"><label class="sr" for="q">Kampanya ara</label>${icon("search")}
      <input id="q" name="q" type="search" placeholder="Kategori, marka ya da ürün ara (ör. Civil, bebek bezi, Ayakkabı)" autocomplete="off" value="${esc(searchQ)}">
      ${searchQ ? `<button class="icon-btn" type="button" data-act="clearSearch" aria-label="Aramayı temizle">${icon("x")}</button>` : ""}</form>
    ${searchQ.trim().length >= 2 ? searchResults(t) : `
    <div class="cat-row" aria-label="Kategori filtresi">
      <button class="cchip ${L.catF === "all" ? "on" : ""}" type="button" data-act="catf" data-v="all" aria-pressed="${L.catF === "all"}" style="--c:#FF3D7F">${icon("star")}Tümü</button>
      ${D.categories.map(c => `<button class="cchip ${L.catF === c.slug ? "on" : ""}" type="button" data-act="catf" data-v="${c.slug}" aria-pressed="${L.catF === c.slug}" style="--c:${c.color}">${icon(c.icon)}${esc(c.name)}</button>`).join("")}
    </div>
    <div class="filters" aria-label="Durum filtresi">${FILTERS.map(([k, n, ic]) => `<button class="ftab ${f === k ? "on" : ""}" type="button" aria-pressed="${f === k}" data-act="filter" data-v="${k}">${icon(ic)}${n}<span class="fcount">${(L[k] || []).length}</span></button>`).join("")}</div>
    ${items.length ? `<div class="grid-cards">${list}</div>${items.length > shown ? `<button class="btn ghost more" type="button" data-act="more">${items.length - shown} kampanya daha göster</button>` : ""}`
      : `<div class="empty">${icon(FILTERS.find(x => x[0] === f)[2], "big")}<b>${empty}</b>${f === "won" && !user() ? `<button class="btn primary" type="button" data-act="login">Giriş yap</button>` : ""}</div>`}`}
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
  const showAll = store("lb:wall") === slug, wall = showAll ? pool : own.slice(0, 60);
  const timed = list.filter(c => !c.demo);
  return `<section class="cat-hero" style="--c:${cat.color}"><a href="#/" class="back">${icon("back")}Kampanyalar</a>
    <div class="ch-row">${catIcon(slug, "xl")}<div><h1>${esc(cat.name)}</h1><p>${own.length} marka · oyunda ${pool.length} logo · günde ${timed.length} kampanya, ${num(timed.reduce((s, c) => s + c.quota, 0))} kupon</p></div></div></section>
  ${live.length ? `<section class="section"><h2>${icon("fire")}Şu an canlı</h2><div class="grid-cards">${live.slice(0, 12).map(c => campCard(c, t)).join("")}</div></section>` : ""}
  <section class="section"><div class="sec-head"><h2>${icon("calendar")}Bugünün programı</h2></div>
    <div class="tablewrap"><table><thead><tr><th>Saat</th><th>Marka / kampanya</th><th class="num">Kupon</th><th>Durum</th></tr></thead><tbody>
    ${list.map(c => { const st = status(c, t);
      return `<tr class="${st === "active" ? "is-now" : st === "upcoming" ? "" : "is-past"}"><td class="nowrap">${timeLabel(c)}<br><span class="small muted">${c.demo ? "demo" : c.durationMin + " dk"}</span></td>
      <td><a href="#/kampanya/${c.id}"><b>${esc(campTitle(c))}</b></a><br><span class="small muted">${esc(c.offer)}</span></td>
      <td class="num nowrap">${remaining(c, t)} / ${c.quota}</td><td>${badge(st)}</td></tr>`; }).join("")}
    </tbody></table></div></section>
  <section class="section"><div class="sec-head"><h2>${icon("star")}Logo duvarı</h2><span class="muted small">Her oyunda ${pool.length} logodan ${D.boardSize} tanesi (Muhteşem Fırsat'ta ${D.boardSizeMfMin}-${D.boardSizeMf}) karışık gelir</span></div>
    <div class="logo-wall">${wall.map(b => logo(b)).join("")}</div>
    <button class="btn ghost more" type="button" data-act="wall" data-v="${showAll ? "" : slug}">${showAll ? "Daha az göster" : `Tüm ${pool.length} logoyu göster`}</button></section>`;
};

views.campaign = id => {
  const c = campById(id); if (!c) return views.notFound();
  const t = clock(), st = status(c, t), cat = CAT[c.cat], att = attemptOf(c, t), n = K.boardSizeFor(c, boardHint());
  const myCp = att?.result === "won" ? myCoupons().find(x => x.key === instKey(c, t) && x.source === "oyun") : null;
  const r = c.rules;
  return `<section class="detail ${c.mono ? "mf" : ""}" style="--c:${cat.color}">
    <a href="#/kategori/${c.cat}" class="back">${icon("back")}${esc(cat.name)}</a>
    ${c.mono ? `<div class="mf-ribbon">${icon("bolt")}MUHTEŞEM FIRSAT · ${n} LOGO · BORDO-SİYAH${icon("bolt")}</div>` : ""}
    <div class="d-head">${logo(c.brand, {mono:c.mono})}<div><span class="eyebrow">${catIcon(c.cat, "sm")}${esc(cat.name)} · ${c.demo ? "Tüm gün (demo)" : timeLabel(c)}</span>
      <h1>${esc(campTitle(c))}</h1><p class="offer big">${esc(c.offer)}</p>${badge(st)}</div></div>
    <div class="d-grid">
      <div class="d-main">
        ${countdown(c, t, st, true)}
        <div class="quota"><div class="quota-t"><span>${icon("ticket")}${remaining(c, t)} / ${c.quota} kupon kaldı</span></div><div class="bar"><i style="width:${(c.quota - remaining(c, t)) / c.quota * 100}%"></i></div></div>
        ${att ? `<p class="mine ${att.result === "won" ? "won" : "lost"}">${att.result === "won" ? `${icon("trophy")}Kazandın! Kodun: <b>${esc(myCp?.code || "")}</b>` : `${icon("x")}Bu kampanyada hakkını kullandın${att.telafi ? " · telafi kuponu alındı" : ""}.`}</p>` : ""}
        ${actions(c, t, {detail:false})}
      </div>
      <div class="d-box"><h2>${icon("percent")}Kampanya koşulları</h2>
        ${ruleChips(r)}
        <ul class="ticks">
          <li>${icon("check")}<span><b>%${r.pct} indirim.</b>${r.tiers?.length ? ` Sepet tutarı arttıkça indirim büyür: ${r.tiers.map(x => `${tl0(x.min)} ve üzeri %${x.pct} indirim`).join(", ")}.` : ""}</span></li>
          ${r.newMember ? `<li>${icon("star")}<span><b>Yeni üyeye +%${r.newMember} indirim.</b> İlk kuponunu kazanan üyeye otomatik eklenir.</span></li>` : ""}
          <li>${icon("bag")}<span><b>Geçerli ürünler:</b> ${esc(c.products)}. Kupon yalnızca kampanya detayında belirtilen seçili ürünlerde geçerlidir.</span></li>
          <li>${icon("clock")}<span><b>Kampanya süresi:</b> ${c.demo ? "tüm gün" : `${timeLabel(c)} (${c.durationMin} dk)`}. <b>Kullanım süresi:</b> kazandıktan sonra ${c.validHours} saat.</span></li>
          <li>${icon("ticket")}<span><b>Kupon sayısı:</b> ${c.quota}. Firmanın belirlediği adete göre değişir; dolunca kampanya kapanır.</span></li>
          ${c.mono ? `<li class="mf-note">${icon("bolt")}<span><b>Muhteşem Fırsat:</b> Oyunda ${n} logo var ve hepsi <b>bordo ve siyah</b> renkte, aynı yazı tipiyle gösterilir. Renklere değil, yalnızca markanın <b>ismine ve ikonuna</b> odaklan.</span></li>` : ""}
        </ul>
        <h3>Nerede kullanılır?</h3>
        ${myCp ? useLinks(myCp) : `<p class="use-note">${icon("store")}<span>Kazandığın kodu markanın web sitesinde ya da pazaryeri mağazasında, ödeme adımında kullanırsın.</span></p>`}
        <p class="small muted" style="margin:0">Kampanya belirlenen süre boyunca açık kalır. Firma değişiklik yapma hakkını saklı tutar.</p>
      </div>
      <div class="d-box"><h2>${icon("target")}Oyun kuralları</h2>
        <ol class="steps-l">
          <li><b>Başla</b>'ya bas, 3-2-1 sayımından sonra <b>${n} logo</b> karışık dizilir.</li>
          <li><b>${esc(c.brand)}</b> logosuna <b>${c.findSec} saniye</b> içinde dokun.</li>
          <li>Her kampanyada <b>bir kez</b> oynayabilirsin: yanlış logo ya da süre dolması hakkı bitirir.</li>
          <li>Kupon hakkın sınırsız: istediğin kadar farklı kampanyaya katılabilirsin.</li>
          <li>Bulamazsan doğru logo <b>neon renkle</b> işaretlenir; nerede olduğunu görürsün.</li>
          <li>Kazanamazsan <b>telafi kuponu</b> alabilirsin: reklam izle, ${c.telafi.fee} ₺ öde ya da daha düşük indirimi kabul et.</li>
        </ol></div>
    </div></section>`;
};

const COUPON_CLS = {active:"b-active", used:"b-won", expired:"b-ended", refunded:"b-ended", cancelled:"b-lost"};
function ticket(cp, t) {
  const st = couponStatus(cp, t);
  return `<article class="ticket ${st}" style="--c:${CAT[cp.cat].color}">
    <div class="tk-l">${logo(cp.brand, {mono:!!cp.title})}<span class="tk-pct">%${cp.rules.pct}<small>indirim</small></span></div>
    <div class="tk-r">
      <div class="tk-h"><b>${esc(cp.brand)}</b><span class="badge ${COUPON_CLS[st]}">${COUPON_TXT[st]}</span>${cp.source === "telafi" ? '<span class="tag">telafi</span>' : ""}</div>
      <p class="offer">${esc(cp.offer)}</p>
      ${ruleChips({...cp.rules, newMember:cp.newMember ? cp.rules.newMember : 0}, {base:false})}
      <div class="code-row"><span class="code">${esc(cp.code)}</span><button class="btn dark sm" type="button" data-copy="${esc(cp.code)}" ${st === "active" ? "" : "disabled"}>${icon("copy")}Kopyala</button></div>
      ${st === "active" ? `<div class="kv">${icon("clock")}<span>Kullanım için</span><b data-cd="${cp.expiresAt}" data-fmt="short">${fmtShort((cp.expiresAt - t.ms) / 1000)}</b></div>` :
        st === "expired" ? `<div class="kv"><span>Son kullanma</span><b>${fmtDT(cp.expiresAt)}</b></div>` : st === "cancelled" ? "" :
        `<div class="kv"><span>Kullanıldı · ${fmtDT(cp.usedAt)}</span><b class="save">${cp.discount ? `${tl(cp.discount)} kazandın` : ""}</b></div>`}
      ${st === "active" ? useLinks(cp) : ""}
    </div></article>`;
}
views.coupons = () => {
  if (!user()) return `<section class="section"><h1>${icon("ticket")}Kuponlarım</h1><div class="empty">${icon("lock", "big")}<b>Kuponlarını görmek için giriş yap</b><button class="btn primary" type="button" data-act="login">Giriş yap</button></div></section>`;
  const t = clock(), tab = store("lb:ctab") || "active", all = myCoupons();
  const groups = {active:all.filter(x => couponStatus(x, t) === "active"), used:all.filter(x => ["used", "refunded"].includes(couponStatus(x, t))), expired:all.filter(x => ["expired", "cancelled"].includes(couponStatus(x, t)))};
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
  const p = prefsOf(u), rem = db.reminders.filter(r => r.phone === u.phone && r.day === t.day);
  const toggle = (k, label, ic) => `<button class="switch-row" type="button" data-act="pref" data-v="${k}" aria-pressed="${!!p[k]}">${icon(ic)}<span>${label}</span><i class="sw" aria-hidden="true"></i></button>`;
  return `<section class="profile">
    <div class="p-head"><span class="avatar">${initials(u.name)}</span>
      <div><h1>${esc(u.name)}</h1><p class="muted">${esc(fmtPhone(u.phone))} · ${fmtDay(new Date(u.createdAt).toISOString().slice(0, 10))} tarihinden beri üye</p>
      ${K.isNewMember(db.coupons, u.phone) ? `<span class="chip hot">${icon("star")}Yeni üye: ilk kuponunda +%${D.newMemberBonus} indirim (geçerli kampanyalarda)</span>` : ""}</div></div>
    <div class="earn" aria-labelledby="earnH">
      <span class="earn-l" id="earnH">${icon("wallet")}Kazancım</span>
      <b class="earn-v">${tl(saved)}</b>
      <span class="earn-s">Kuponlarınla toplam kazandığın indirim</span>
      <div class="earn-g"><div><b>${all.filter(x => x.source === "oyun").length}</b><span>kazanılan kupon</span></div><div><b>${used.length}</b><span>kullanılan</span></div>
        <div><b>${tl0(spent)}</b><span>alışveriş</span></div><div><b>${all.filter(x => x.source === "telafi").length}</b><span>telafi kuponu</span></div></div>
    </div>
    <div class="p-grid">
      <div class="card section"><h2>${icon("bell")}Hatırlatmalarım</h2>
        ${rem.length ? `<ul class="rem">${rem.map(r => { const c = campById(r.campId); if (!c) return ""; const st = status(c, t);
          return `<li><a href="#/kampanya/${c.id}">${catIcon(c.cat, "sm")}<b>${esc(c.brand)}</b> · ${startTxt(c)}</a>${badge(st)}<button class="icon-btn" type="button" data-act="remind" data-id="${c.id}" aria-label="${esc(c.brand)} hatırlatmasını kaldır">${icon("x")}</button></li>`; }).join("")}</ul>`
          : `<p class="muted small" style="margin:0">Yaklaşan kampanyalarda <b>Hatırlat</b>'a dokun; 5 dk kala ve başladığında haber verelim.</p>`}</div>
      <div class="card section"><h2>${icon("sms")}Bildirim ayarları</h2>
        ${toggle("push", "Tarayıcı / uygulama bildirimi", "bell")}${toggle("sms", "SMS bildirimi", "sms")}
        ${toggle("before5", "Kampanyaya 5 dk kala", "clock")}${toggle("onStart", "Kampanya başladığında", "play")}${toggle("expiry", "Kuponun bitmesine 1 saat kala", "ticket")}
        <p class="small muted" style="margin:0">${MODE === "remote" ? "SMS'ler İYS onayınla, kayıtlı numarana gönderilir." : "Demo modunda SMS gönderilmez; bildirim merkezinde \"SMS (demo)\" olarak görünür."}</p></div>
    </div>
    <div class="acts"><a class="btn ghost" href="#/kuponlarim">${icon("ticket")}Kuponlarım</a><button class="btn ghost" type="button" data-act="install" hidden id="installBtn">${icon("download")}Uygulamayı yükle</button><button class="btn ghost" type="button" data-act="logout">${icon("x")}Çıkış yap</button></div>
  </section>`;
};

views.how = () => `<section class="prose">
  <h1>${icon("info")}Nasıl çalışır?</h1>
  <div class="how-steps">${[["target", "Kampanyayı seç", "Her kategoride gün boyu farklı saatlerde marka kampanyaları açılır."], ["play", "Logoyu 5 sn'de bul", `${D.boardSize} logo arasında hedefe dokun.`], ["ticket", "Kuponu al", "Kişiye özel kodun anında çıkar, kopyala."], ["store", "Markada kullan", "Markanın sitesinde ya da pazaryeri mağazasında."]].map(([ic, h, p], i) => `<div class="how-step"><span class="hs-n">${i + 1}</span>${icon(ic, "big")}<b>${h}</b><span>${p}</span></div>`).join("")}</div>
  <h2>Kampanyalar</h2>
  <ul><li>Her kategoride farklı başlangıç saatlerinde marka kampanyaları açılır (15, 30 ya da 60 dakikada bir).</li>
  <li>Kampanya belirlenen süre boyunca açık kalır (en fazla 3 saat). Firma değişiklik yapma hakkını saklı tutar.</li>
  <li>Her kampanyanın kupon sayısı firmanın belirleyeceği adete göre değişiklik gösterir.</li>
  <li>Kupon hakkın sınırsızdır; her kampanyada yalnızca bir kez oynayabilirsin.</li>
  <li>Kontenjan dolduğunda ya da süre bittiğinde kampanya ana sayfadan otomatik kalkar ve kategoride de kapanır.</li>
  <li>Firmalar yalnızca web sitesi linklerini değil, pazaryeri mağazalarının linklerini de gönderebilir ve kampanyaya dahil edebilir.</li></ul>
  <h2>Oyun</h2>
  <ol><li>Giriş yap, kampanyanın <b>Detay</b> sayfasından koşulları incele ya da doğrudan <b>Başla</b>'ya bas.</li>
  <li>Kurallar penceresinde <b>Hazırım</b> dediğinde 3-2-1 sayılır ve ${D.boardSize} logo karışık dizilir.</li>
  <li>Hedef markanın logosuna <b>5 saniye</b> içinde dokun.</li>
  <li>Bulamazsan doğru logo <b>neon renkle</b> işaretlenir; nerede olduğunu görürsün.</li>
  <li><b>Muhteşem Fırsat</b> kampanyalarında ${D.boardSizeMfMin}-${D.boardSizeMf} logo vardır ve hepsi bordo-siyah görünür; yalnızca isme ve ikona odaklanmalısın.</li></ol>
  <h2>Kupon ve indirimler</h2>
  <ul><li>Kazandığında ekranda kişiye özel kupon kodu çıkar; tek dokunuşla kopyalayabilirsin. Kupon <b>Kuponlarım</b>'a da kaydedilir.</li>
  <li>Kuponu kazandıktan sonra belirlenen süre içinde markanın sitesinde, kampanyalı üründe kullanılır. Kupon, kampanya detaylarında iletilen seçili ürünlerde geçerlidir.</li>
  <li>Bazı kampanyalarda ek koşullar vardır: <b>yeni üyeye ek indirim</b> ve sepet tutarına göre artan <b>baremli indirim</b>. Hangi koşulların geçerli olduğu kampanya detayında yazar.</li>
  <li>Kazanamazsan <b>telafi kuponu</b> alabilirsin: reklam izleyerek, küçük bir ücret ödeyerek ya da daha düşük bir indirimi kabul ederek.</li></ul>
  <h2>Bildirimler</h2>
  <ul><li>Yaklaşan kampanyalarda <b>Hatırlat</b>'a dokun: 5 dk kala ve başladığında bildirim ya da SMS gelir.</li>
  <li>Kuponunun bitmesine 1 saat kala da haber veririz.</li></ul>
  <h2>Sık sorulanlar</h2>
  <p><b>Neden kampanya başına tek hak var?</b> Sırayla tüm logolara dokunarak kazanmayı engellemek için.</p>
  <p><b>Kupon kodu başkasıyla paylaşılabilir mi?</b> Kod kişiye özeldir ve tek kullanımlıktır.</p>
  <p><b>Üstteki sayaç ne?</b> Bir sonraki kampanyanın başlamasına kalan süre (Türkiye saati).</p></section>`;

views.notFound = () => `<section class="section"><h1>Sayfa bulunamadı</h1><a class="btn dark" href="#/">Ana sayfaya dön</a></section>`;

/* ---------- admin paneli ---------- */
let adminCache = null, adminLoading = false, kasaMsg = null, logoBrand = "", logoPreview = null;
const ADMIN_TABS = [["ozet", "Özet", "chart"], ["uyeler", "Üyeler", "users"], ["kuponlar", "Kuponlar", "ticket"], ["takip", "Satın alma takibi", "link"], ["hatirlatmalar", "Hatırlatmalar", "bell"],
  ["bildirimler", "Gönderilen bildirimler", "sms"], ["kampanyalar", "Kampanyalar", "calendar"], ["logolar", "Logolar", "image"], ["kasa", "Kasa simülatörü", "card"], ["markalar", "Marka API", "shield"]];
async function loadAdmin(force = false) {
  if (adminLoading || (adminCache && !force)) return;
  adminLoading = true;
  try { adminCache = await Api.adminData(); adminCache.at = Date.now(); }
  catch (e) { if (e.status === 401) { adminKey = null; sstore("lb:admin", null); toast("Yönetici anahtarı geçersiz."); } else toast(e.message); adminCache = null; }
  adminLoading = false; render();
}
function funnelOf(cp, clicks) {
  const n = clicks.filter(k => k.code === cp.code).length;
  return {clicks:n, step:cp.usedAt ? 3 : cp.validatedAt ? 2 : n ? 1 : 0};
}
views.admin = tab => {
  tab = ADMIN_TABS.some(x => x[0] === tab) ? tab : "ozet";
  if (MODE === "remote" && !adminKey) return `<section class="section admin-login"><h1>${icon("shield")}Yönetim paneli</h1>
    <form class="card section" data-form="adminLogin" style="max-width:420px"><div class="field"><label for="aKey">Yönetici anahtarı</label><input id="aKey" name="key" type="password" autocomplete="current-password" required></div>
    <button class="btn primary" type="submit">${icon("lock")}Giriş</button><p class="small muted" style="margin:0">Anahtar sunucudaki ADMIN_KEY ortam değişkenidir.</p></form></section>`;
  if (!adminCache) { setTimeout(() => loadAdmin()); return `<section class="section"><h1>${icon("shield")}Yönetim paneli</h1><div class="empty"><b>Veriler yükleniyor…</b></div></section>`; }
  const A = adminCache, t = clock(), q = (store("lb:aq") || "").toLocaleLowerCase("tr");
  const real = A.coupons.filter(x => !x.test), used = real.filter(x => x.usedAt && !x.refundedAt), check = real.filter(needsCheck);
  const sales = used.reduce((s, x) => s + (x.sale ?? x.paid ?? 0), 0), comm = used.reduce((s, x) => s + (x.commission || 0), 0);
  const fees = A.events.filter(e => e.type === "odeme").reduce((s, e) => s + e.amount, 0), ads = A.events.filter(e => e.type === "reklam").length;
  const nav = `<nav class="admin-tabs" aria-label="Yönetim bölümleri">${ADMIN_TABS.map(([k, n, ic]) => `<a href="#/admin/${k}" class="${k === tab ? "on" : ""}" ${k === tab ? 'aria-current="page"' : ""}>${icon(ic)}${n}</a>`).join("")}</nav>`;
  const head = `<section class="section"><div class="sec-head"><h1>${icon("shield")}Yönetim paneli</h1>
    <div class="acts inline"><button class="btn ghost sm" type="button" data-act="adminRefresh">${icon("clock")}Yenile</button>${MODE === "remote" ? `<button class="btn ghost sm" type="button" data-act="adminLogout">${icon("x")}Çıkış</button>` : ""}</div></div>
    <p class="muted small" style="margin:0">${MODE === "remote" ? `Canlı veriler · son yenileme ${fmtDT(A.at)}` : "Demo modu: bu tarayıcıdaki veriler gösterilir. Canlıda tüm kullanıcıların verisi sunucudan gelir."}</p></section>${nav}`;
  const search = ph => `<form class="search" data-form="adminSearch" role="search">${icon("search")}<input name="q" type="search" aria-label="${ph}" placeholder="${ph}" value="${esc(store("lb:aq") || "")}" autocomplete="off"></form>`;
  const userOf = ph => A.users.find(u => u.phone === ph);
  let body = "";
  if (tab === "ozet") {
    const today = A.coupons.filter(x => x.day === t.day && !x.test);
    body = `<div class="stats">
      ${[["Üye", A.users.length, "users"], ["Bugün verilen kupon", today.length, "ticket"], ["Toplam kupon", real.length, "ticket"], ["Siparişe dönen", used.length, "check"],
        ["Dönüşüm", (real.length ? Math.round(used.length / real.length * 100) : 0) + "%", "chart"], ["Kontrol edilecek", check.length, "info", check.length ? "warn" : ""],
        ["Net satış", tl(sales), "cart"], [`Komisyon (%${D.commissionRate * 100})`, tl(comm), "wallet"], ["Telafi ödemesi", tl(fees), "card"], ["Reklam izlenme", ads, "film"],
        ["Hatırlatma (bugün)", A.reminders.filter(r => r.day === t.day).length, "bell"], ["Link tıklaması", A.clicks.length, "link"]].map(([l, v, ic, cls]) => `<div class="card stat ${cls || ""}">${icon(ic)}<span class="eyebrow">${l}</span><b>${v}</b></div>`).join("")}
    </div>
    <section class="card section"><h2>${icon("lock")}Komisyonu nasıl kontrol ediyorsun?</h2>
      <ul class="ticks small"><li>${icon("check")}<span><b>Kişiye özel kod + UTM:</b> müşteri kuponundaki linke tıklayınca markanın sitesine <code>utm_content=KOD</code> ile gider; tıklama burada kaydedilir.</span></li>
      <li>${icon("check")}<span><b>Kasada doğrulama:</b> markanın sitesi kodu ödeme sayfasında bizim sunucumuza sorar; hangi kodun kasaya geldiğini görürsün.</span></li>
      <li>${icon("check")}<span><b>Sipariş bildirimi:</b> ödeme bitince marka sipariş no + tutarı bildirir; komisyon indirim sonrası ödenen tutardan hesaplanır.</span></li>
      <li>${icon("check")}<span><b>Kontrol edilecek:</b> kasada doğrulanıp siparişi bildirilmeyen kodlar; markaya sorulur, gerekirse elle "kullanıldı" işaretlenir.</span></li></ul>
      <a class="btn ghost sm" href="#/admin/takip" style="justify-self:start">${icon("link")}Satın alma takibine git</a></section>`;
  } else if (tab === "uyeler") {
    const rows = A.users.filter(u => !q || `${u.name} ${u.phone}`.toLocaleLowerCase("tr").includes(q)).map(u => {
      const cps = A.coupons.filter(x => x.phone === u.phone), us = cps.filter(x => x.usedAt && !x.refundedAt);
      return {u, plays:A.attempts.filter(a => a.phone === u.phone).length, won:cps.filter(x => x.source === "oyun").length, used:us.length,
        saved:us.reduce((s, x) => s + (x.discount || 0), 0), rem:A.reminders.filter(r => r.phone === u.phone).length};
    });
    body = `<div class="sec-head">${search("Ad ya da telefon ara")}<button class="btn ghost sm" type="button" data-act="csvUsers">${icon("download")}CSV</button></div>
    ${rows.length ? `<div class="tablewrap"><table><thead><tr><th>Üye</th><th>Telefon</th><th>Üyelik</th><th>KVKK/İYS onayı</th><th class="num">Oyun</th><th class="num">Kazanılan</th><th class="num">Kullanılan</th><th class="num">Kazanç</th><th class="num">Hatırlatma</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>
    ${rows.map(({u, plays, won, used:ud, saved, rem}) => `<tr class="${u.blocked ? "is-past" : ""}"><td><b>${esc(u.name)}</b></td><td class="nowrap">${esc(fmtPhone(u.phone))}</td><td class="nowrap">${fmtDT(u.createdAt)}</td><td class="nowrap">${fmtDT(u.consentAt)}</td>
      <td class="num">${plays}</td><td class="num">${won}</td><td class="num">${ud}</td><td class="num nowrap">${tl(saved)}</td><td class="num">${rem}</td><td>${u.blocked ? '<span class="badge b-lost">Engelli</span>' : '<span class="badge b-active">Aktif</span>'}</td>
      <td class="nowrap"><button class="btn ghost sm" type="button" data-act="aSms" data-phone="${esc(u.phone)}">${icon("sms")}SMS</button>
        <button class="btn ghost sm" type="button" data-act="aDo" data-tur="uye_engelle" data-telefon="${esc(u.phone)}">${icon("ban")}${u.blocked ? "Engeli kaldır" : "Engelle"}</button>
        <button class="btn ghost sm danger" type="button" data-act="aDelUser" data-phone="${esc(u.phone)}">${icon("trash")}Sil</button></td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty"><b>Henüz üye yok</b></div>`}`;
  } else if (tab === "kuponlar" || tab === "takip") {
    const f = store(`lb:akf-${tab}`) || "all";
    const filters = tab === "kuponlar" ? [["all", "Tümü"], ["active", "Kullanılmadı"], ["used", "Kullanıldı"], ["check", "Kontrol edilecek"], ["expired", "Süresi doldu"], ["cancelled", "İptal"]]
      : [["all", "Tümü"], ["0", "Tıklanmadı"], ["1", "Linke tıkladı"], ["2", "Kasada doğrulandı"], ["3", "Satın aldı"]];
    let list = A.coupons.slice().reverse().filter(cp => !q || `${cp.code} ${cp.brand} ${cp.name || ""} ${cp.phone}`.toLocaleLowerCase("tr").includes(q));
    if (tab === "kuponlar") list = list.filter(cp => f === "all" || (f === "check" ? needsCheck(cp) : f === "used" ? ["used", "refunded"].includes(couponStatus(cp, t)) : couponStatus(cp, t) === f));
    else list = list.filter(cp => !cp.test && (f === "all" || String(funnelOf(cp, A.clicks).step) === f));
    const fn = A.coupons.filter(x => !x.test).map(cp => funnelOf(cp, A.clicks).step);
    const steps = [["Kupon kazandı", fn.length], ["Linke tıkladı (UTM)", fn.filter(s => s >= 1).length], ["Kasada doğrulandı", fn.filter(s => s >= 2).length], ["Satın aldı", fn.filter(s => s >= 3).length]];
    body = `${tab === "takip" ? `<section class="card section"><h2>${icon("link")}Satın alma hunisi</h2>
      <div class="funnel">${steps.map(([l, n]) => `<div><span>${l}</span><b>${n}</b><i style="width:${steps[0][1] ? Math.max(4, n / steps[0][1] * 100) : 0}%"></i></div>`).join("")}</div>
      <p class="small muted" style="margin:0">Linke tıklama UTM yönlendirmesiyle, kasada doğrulama ve satın alma markanın API bildirimiyle kaydedilir. "Kasada doğrulandı" aşamasında kalıp satın alma görünmeyen kodları markaya sor.</p></section>` : ""}
    <div class="sec-head">${search("Kod, marka, üye ya da telefon ara")}<div class="acts inline">${filters.map(([k, n]) => `<button class="btn sm ${f === k ? "dark" : "ghost"}" type="button" data-act="akf" data-tab="${tab}" data-v="${k}">${n}</button>`).join("")}<button class="btn ghost sm" type="button" data-act="csvCoupons">${icon("download")}CSV</button></div></div>
    ${list.length ? `<div class="tablewrap"><table><thead><tr><th>Kod</th><th>Marka</th><th>Üye</th><th>Tür</th><th>Kazandı</th><th>Durum</th><th class="num">Tık</th><th>Doğrulama</th><th>Sipariş</th><th class="num">Sepet</th><th class="num">İndirim</th><th class="num">Net</th><th class="num">Komisyon</th><th>İşlem</th></tr></thead><tbody>
    ${list.slice(0, 400).map(cp => { const st = couponStatus(cp, t), fu = funnelOf(cp, A.clicks), u = userOf(cp.phone), net = cp.sale ?? cp.paid;
      return `<tr class="${needsCheck(cp) ? "is-flag" : ""}"><td class="nowrap"><b>${esc(cp.code)}</b></td><td>${esc(cp.brand)}</td>
      <td>${cp.test ? '<span class="muted">Test</span>' : `${esc(u?.name || cp.name || "–")}<br><span class="small muted">${esc(fmtPhone(cp.phone))}</span>`}</td>
      <td class="nowrap">${cp.source === "telafi" ? `Telafi (${{low:"düşük", ad:"reklam", paid:"ücretli"}[cp.telafiKind] || ""})` : "Oyun"}${cp.newMember ? " · yeni üye" : ""}</td>
      <td class="nowrap">${fmtDT(cp.issuedAt)}</td><td>${needsCheck(cp) ? '<span class="badge b-lost">Doğrulandı, sipariş yok</span>' : esc(COUPON_TXT[st])}</td>
      <td class="num">${fu.clicks}</td><td class="nowrap">${fmtDT(cp.validatedAt)}</td><td class="nowrap">${cp.orderNo ? esc(cp.orderNo) + (cp.manual ? " (elle)" : "") : "–"}</td>
      <td class="num nowrap">${cp.gross ? tl(cp.gross) : "–"}</td><td class="num nowrap">${cp.discount ? `${tl(cp.discount)} (%${cp.discountPct})` : "–"}</td><td class="num nowrap">${net ? tl(net) : "–"}</td>
      <td class="num nowrap">${cp.refundedAt ? `<s>${tl(cp.refundedCommission)}</s>` : cp.usedAt ? `<b>${tl(cp.commission)}</b>` : "–"}</td>
      <td class="nowrap">${st === "active" ? `<button class="btn ghost sm" type="button" data-act="aUsed" data-kod="${esc(cp.code)}">Kullanıldı</button><button class="btn ghost sm" type="button" data-act="aDo" data-tur="kupon_uzat" data-kod="${esc(cp.code)}">+24 sa</button><button class="btn ghost sm danger" type="button" data-act="aDo" data-tur="kupon_iptal" data-kod="${esc(cp.code)}">İptal</button>` :
        st === "expired" ? `<button class="btn ghost sm" type="button" data-act="aDo" data-tur="kupon_uzat" data-kod="${esc(cp.code)}">+24 sa</button>` :
        st === "used" ? `<button class="btn ghost sm" type="button" data-act="aDo" data-tur="iade" data-kod="${esc(cp.code)}">İade</button>` : ""}</td></tr>`; }).join("")}
    </tbody></table></div>` : `<div class="empty"><b>Bu filtrede kupon yok</b></div>`}`;
  } else if (tab === "hatirlatmalar") {
    const groups = {};
    for (const r of A.reminders.filter(r => r.day === t.day)) (groups[r.campId] = groups[r.campId] || []).push(r);
    const list = Object.entries(groups).map(([id, rs]) => ({c:campById(id), rs})).filter(x => x.c).sort((a, b) => a.c.start - b.c.start);
    body = list.length ? `<div class="tablewrap"><table><thead><tr><th>Kampanya</th><th>Başlangıç</th><th>Durum</th><th class="num">Kişi</th><th>Kimler</th><th>İşlem</th></tr></thead><tbody>
      ${list.map(({c, rs}) => `<tr><td><b>${esc(c.brand)}</b><br><span class="small muted">${esc(CAT[c.cat].name)} · ${esc(c.offer)}</span></td><td class="nowrap">${startTxt(c)}</td><td>${badge(status(c, t))}</td><td class="num">${rs.length}</td>
        <td>${rs.map(r => `${esc(userOf(r.phone)?.name || "–")} <span class="small muted">${esc(fmtPhone(r.phone))}</span>`).join("<br>")}</td>
        <td><button class="btn ghost sm" type="button" data-act="aSmsCamp" data-id="${c.id}">${icon("sms")}Hepsine bildir</button></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty"><b>Bugün hatırlatma kuran yok</b></div>`;
  } else if (tab === "bildirimler") {
    body = A.outbox.length ? `<div class="tablewrap"><table><thead><tr><th>Zaman</th><th>Alıcı</th><th>Başlık</th><th>Mesaj</th><th>Kanal</th></tr></thead><tbody>
      ${A.outbox.slice(0, 300).map(m => `<tr><td class="nowrap">${fmtDT(m.at)}</td><td class="nowrap">${esc(userOf(m.to)?.name || "")} <span class="small muted">${esc(fmtPhone(m.to))}</span></td><td><b>${esc(m.title)}</b></td><td>${esc(m.body)}</td><td class="small">${esc((m.channels || []).join(", "))}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty"><b>Henüz bildirim gönderilmedi</b></div>`;
  } else if (tab === "kampanyalar") {
    const sel = store("lb:panelCat") || "giyim", camps = CAMPS.filter(c => sel === "all" || c.cat === sel);
    body = `<div class="sec-head"><div class="field" style="min-width:200px"><label for="catSel">Kategori</label><select id="catSel" data-act="cat">${[["all", "Tümü"], ...D.categories.map(c => [c.slug, c.name])].map(([v, n]) => `<option value="${v}" ${v === sel ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div></div>
    <div class="tablewrap"><table><thead><tr><th>Saat</th><th>Kategori</th><th>Marka / kampanya</th><th class="num">Süre</th><th class="num">Kazanan</th><th class="num">Hatırlatma</th><th>Durum</th><th></th></tr></thead><tbody>
    ${camps.map(c => { const st = status(c, t);
      return `<tr class="${st === "active" ? "is-now" : ""}"><td class="nowrap">${timeLabel(c)}</td><td>${esc(CAT[c.cat].name)}</td><td><b>${esc(c.brand)}</b>${c.mono ? ' <span class="tag mfx">MF</span>' : ""}<br><span class="small muted">${esc(c.offer)}</span></td>
      <td class="num nowrap">${c.demo ? "–" : c.durationMin + " dk"}</td><td class="num nowrap">${c.quota - remaining(c, t)} / ${c.quota}</td><td class="num">${A.reminders.filter(r => r.campId === c.id && r.day === t.day).length}</td>
      <td>${badge(st)}</td><td>${MODE === "local" && st === "active" && !c.demo ? `<button class="btn ghost sm" type="button" data-act="aDo" data-tur="fill" data-kampanya="${c.id}">Doldur (test)</button>` : ""}</td></tr>`; }).join("")}
    </tbody></table></div>
    ${MODE === "local" ? `<section class="card section"><h2>${icon("clock")}Test araçları (yalnız demo)</h2>
      <form class="toolbar" data-form="demo"><div class="field"><label for="demoAt">Demo saati (Türkiye)</label><input id="demoAt" type="time" required value="${hhmm(t.h, t.mi)}"></div>
        <button class="btn dark" type="submit">Saati uygula</button><button class="btn ghost" type="button" data-act="realtime" ${demoOffset ? "" : "disabled"}>Gerçek saat</button>
        <button class="btn ghost" type="button" data-act="reset">Tüm verileri sıfırla</button></form></section>` : ""}`;
  } else if (tab === "logolar") {
    const brands = [...new Set([...CAMPS.map(c => c.brand), ...K.ownBrands("buyuk-firsat")])].sort((a, b) => a.localeCompare(b, "tr"));
    const uploaded = Object.keys(LOGOS).sort((a, b) => a.localeCompare(b, "tr"));
    body = `<section class="card section"><h2>${icon("upload")}Orijinal logo yükle</h2>
      <p class="small muted" style="margin:0">Markanın gönderdiği logo dosyasını (PNG, SVG, WebP ya da JPG; en fazla 300 KB) seç. Yüklenen logo oyunda, kartlarda ve logo duvarında hemen kullanılır. ${MODE === "local" ? "Demo modunda yalnız bu tarayıcıda saklanır." : "Sunucuya kaydedilir, tüm kullanıcılar görür."}</p>
      <form class="logo-form" data-form="logo"><div class="field"><label for="lgBrand">Marka</label><input id="lgBrand" name="brand" list="brandList" required value="${esc(logoBrand)}" placeholder="Marka adı yaz ve seç"><datalist id="brandList">${brands.map(b => `<option value="${esc(b)}">`).join("")}</datalist></div>
        <div class="field"><label for="lgFile">Logo dosyası</label><input id="lgFile" name="file" type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" required></div>
        <div class="lg-prev">${logoPreview ? `<div class="logo has-img"><img src="${esc(logoPreview)}" alt="Önizleme"></div>` : `<span class="muted small">Önizleme</span>`}</div>
        <button class="btn primary" type="submit">${icon("upload")}Yükle</button></form></section>
      <section class="section"><h2>${icon("image")}Yüklü logolar (${uploaded.length})</h2>
      ${uploaded.length ? `<div class="logo-wall">${uploaded.map(b => `<div class="lg-item">${logo(b)}<span>${esc(b)}</span><button class="icon-btn" type="button" data-act="aLogoDel" data-brand="${esc(b)}" aria-label="${esc(b)} logosunu kaldır">${icon("trash")}</button></div>`).join("")}</div>` : `<div class="empty"><b>Henüz logo yüklenmedi</b><span>Yüklenmeyen markalar renkli yazı rozetiyle görünür.</span></div>`}</section>`;
  } else if (tab === "kasa") {
    const brands = [...new Set(CAMPS.map(c => c.brand))].sort((a, b) => a.localeCompare(b, "tr")), sel = kasaMsg?.brand || brands[0];
    body = `<section class="section"><p class="muted" style="margin:0;max-width:72ch"><b>Bu ekran müşteriler için değildir.</b> Markanın ödeme sayfasında olacakları taklit eder, entegrasyonu ve komisyon hesabını test etmen içindir. Canlıda markanın sitesi kodu bizim sunucumuza sorar (doğrulama, indirim hesabı) ve ödeme bitince sipariş bildirir; sonuç Kuponlar ve Satın alma takibi sekmelerine düşer.</p></section>
    <form class="card section kasa" data-form="kasa" novalidate>
      <div class="field"><label for="kBrand">Mağaza (marka)</label><select id="kBrand" name="brand">${brands.map(b => `<option ${b === sel ? "selected" : ""}>${esc(b)}</option>`).join("")}</select></div>
      <div class="field"><label for="kCode">Kupon kodu</label><input id="kCode" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(kasaMsg?.code || "")}"></div>
      <div class="frow"><div class="field"><label for="kAmount">Sepet tutarı (₺)</label><input id="kAmount" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="1000" value="${esc(kasaMsg?.amount || "")}"></div>
        <div class="field"><label for="kOrder">Sipariş no</label><input id="kOrder" name="order" value="SIP-${randStr(6, "0123456789")}"></div></div>
      <div class="acts"><button class="btn ghost" type="submit" name="step" value="validate">${icon("check")}Kodu doğrula</button><button class="btn primary" type="submit" name="step" value="order">${icon("card")}Siparişi tamamla</button></div>
      ${kasaMsg ? `<div class="kasa-out ${kasaMsg.ok ? "ok" : "bad"}" role="status">${kasaMsg.html}</div>` : ""}
    </form>`;
  } else if (tab === "markalar") {
    body = MODE === "remote" ? `<section class="card section"><h2>${icon("shield")}Marka API anahtarı oluştur</h2>
      <p class="small muted" style="margin:0">Markanın yazılım ekibi bu anahtarlarla kodu doğrular ve siparişi bildirir (ENTEGRASYON.md). Gizli anahtar yalnızca bir kez gösterilir.</p>
      <form class="toolbar" data-form="brandKey"><div class="field" style="flex:1"><label for="bkName">Marka adı (kampanyadaki gibi)</label><input id="bkName" name="name" list="brandList2" required><datalist id="brandList2">${[...new Set(CAMPS.map(c => c.brand))].map(b => `<option value="${esc(b)}">`).join("")}</datalist></div><button class="btn primary" type="submit">Anahtar oluştur</button></form>
      <div id="bkOut"></div></section>
      ${A.brands?.length ? `<div class="tablewrap"><table><thead><tr><th>Marka</th><th>Oluşturuldu</th></tr></thead><tbody>${A.brands.map(b => `<tr><td><b>${esc(b.name)}</b></td><td>${fmtDT(b.createdAt)}</td></tr>`).join("")}</tbody></table></div>` : ""}`
      : `<div class="empty"><b>Marka API anahtarları canlı sunucuda oluşturulur</b><span>Demo modunda marka entegrasyonunu Kasa simülatörü ile deneyebilirsin.</span></div>`;
  }
  return `${head}<div class="admin-body">${body}</div>`;
};
const calcHtml = (calc, withComm) => `<table class="calc"><tbody>
  <tr><td>Sepet</td><td class="num">${tl(calc.pay + calc.discount)}</td></tr>
  <tr><td>Temel indirim</td><td class="num">%${calc.basePct}</td></tr>
  ${calc.tierPct ? `<tr><td>Barem${calc.tierMin ? ` (${tl0(calc.tierMin)} üstü)` : ""}</td><td class="num">%${calc.tierPct}</td></tr>` : ""}
  ${calc.bonusPct ? `<tr><td>Yeni üye ekstra</td><td class="num">+%${calc.bonusPct}</td></tr>` : ""}
  <tr class="sum"><td>Toplam indirim (%${calc.totalPct})</td><td class="num">−${tl(calc.discount)}</td></tr>
  <tr class="sum"><td>Ödenecek</td><td class="num">${tl(calc.pay)}</td></tr>
  ${withComm ? `<tr><td>Platform komisyonu (%${D.commissionRate * 100})</td><td class="num">${tl(K.commission(calc.pay))}</td></tr>` : ""}</tbody></table>`;
const fromServerCalc = h => h && ("indirim" in h) ? {basePct:h.temelYuzde, tierPct:h.baremYuzde, tierMin:null, bonusPct:h.yeniUyeYuzde, totalPct:h.toplamYuzde, discount:h.indirim, pay:h.odenecek} : h;

/* ---------- oyun ---------- */
let game = null; // {campId,key,t0,total,raf,done,pre}
function rulesModal(id) {
  const c = campById(id), u = user(), t = clock();
  if (!u) return loginModal(() => rulesModal(id));
  if (status(c, t) !== "active") return toast("Kampanya şu an aktif değil.");
  if (attemptOf(c, t)) return toast("Bu kampanyada hakkını kullandın.");
  const n = K.boardSizeFor(c, boardHint());
  modal(`<div class="modal rules ${c.mono ? "mf" : ""}" role="dialog" aria-modal="true" aria-labelledby="rT" style="--c:${CAT[c.cat].color}">
    ${c.mono ? `<div class="mf-ribbon">${icon("bolt")}MUHTEŞEM FIRSAT${icon("bolt")}</div>` : ""}
    <div class="r-target">${logo(c.brand, {mono:c.mono})}<div><span class="eyebrow">Hedef logo</span><h2 id="rT">${esc(c.brand)}</h2><p class="offer">${esc(c.offer)}</p></div></div>
    <ul class="ticks">
      <li>${icon("clock")}<span><b>${c.findSec} saniye</b> içinde hedef logoya dokun.</span></li>
      <li>${icon("target")}<span>3-2-1'den sonra <b>${n} logo</b> karışık dizilir.</span></li>
      <li>${icon("lock")}<span><b>Bu kampanyada tek hakkın var:</b> yanlış logo ya da süre dolması hakkı bitirir.</span></li>
      <li>${icon("ticket")}<span>Bu kampanyada kalan kupon: <b>${remaining(c, t)}</b>.</span></li>
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
async function showBoard(id) {
  const c = campById(id), r = await Api.start(id, boardHint());
  if (!game || game.campId !== id) return;
  if (r.error) { endOverlay(); toast({login:"Önce giriş yap.", used:"Bu kampanyada hakkını kullandın.", blocked:"Hesabın kampanyalara katılıma kapatıldı.", network:"Sunucuya ulaşılamadı."}[r.error] || "Kampanya şu an aktif değil."); return render(); }
  const total = r.totalMs || c.findSec * 1000;
  Object.assign(game, {key:r.key, total, t0:performance.now(), pre:false});
  $("#game").innerHTML = `<div class="g-top"><div class="g-target">${logo(c.brand, {mono:c.mono})}<div><span>Bul</span><b>${esc(c.brand)}</b></div></div>
      <div class="g-timer" id="timer"><b id="tLeft">${(total / 1000).toFixed(1)}</b><span>sn</span><div class="bar"><i id="tBar"></i></div></div></div>
    ${c.mono ? `<p class="g-mf">${icon("bolt")}Muhteşem Fırsat: ${r.tiles.length} logo, hepsi bordo-siyah. İsme odaklan!</p>` : ""}
    <div class="board ${c.mono ? "mono big-board" : ""}" id="board">${r.tiles.map((x, i) => logo(x.brand, {tag:"button", attrs:`type="button" data-token="${x.token}" aria-label="${esc(x.brand)}"`, mono:c.mono, i})).join("")}</div>`;
  const tick = () => {
    if (!game || game.done) return;
    const left = game.total - (performance.now() - game.t0);
    $("#tLeft").textContent = (Math.max(0, left) / 1000).toFixed(1);
    $("#tBar").style.transform = `scaleX(${Math.max(0, left) / game.total})`;
    $("#timer").classList.toggle("low", left < 2000);
    if (left <= 0) return finish(null);
    game.raf = requestAnimationFrame(tick);
  };
  game.raf = requestAnimationFrame(tick);
}
function endOverlay() { if (game) { clearTimeout(game.preT); clearTimeout(game.revealT); cancelAnimationFrame(game.raf); } game = null; document.body.classList.remove("playing"); $("#game")?.remove(); }
async function finish(btn) {
  if (!game || game.done) return;
  game.done = true; cancelAnimationFrame(game.raf);
  const board = $("#board"); board.classList.add("locked"); board.querySelectorAll("button").forEach(b => b.disabled = true);
  const id = game.campId, key = game.key;
  let r;
  try { r = btn ? await Api.pick(id, key, btn.dataset.token) : {result:"timeout", ...(await Api.timeout(key))}; }
  catch { r = {result:"error"}; }
  if (!game) return;
  if (btn) btn.classList.add(r.result === "won" ? "hit" : "miss");
  if (r.result === "won") { setTimeout(() => { endOverlay(); wonModal(r.coupon, r.ms); }, 450); return; }
  // Bulunamayan logo neon renkle işaretlenir; müşteri nerede olduğunu görür.
  const target = r.target && board.querySelector(`[data-token="${r.target}"]`);
  if (target) {
    target.classList.add("reveal");
    $("#game").classList.add("shake");
    const bar = document.createElement("div"); bar.className = "g-reveal"; bar.setAttribute("role", "status");
    bar.innerHTML = `<span>${icon("target")}<b>${r.result === "timeout" ? "Süre doldu!" : "Yanlış logo!"}</b> Aradığın logo neonla işaretli.</span><button class="btn primary sm" type="button" data-act="revealNext">Devam${icon("arrow")}</button>`;
    $("#game").insertBefore(bar, board);
    target.scrollIntoView({block:"nearest"});
    game.after = () => { endOverlay(); lostModal(id, key, r.result); };
    game.revealT = setTimeout(() => game?.after?.(), 4500);
  } else setTimeout(() => { endOverlay(); lostModal(id, key, r.result); }, 700);
}
function couponBox(cp) {
  const r = cp.rules, extra = cp.newMember && r.newMember ? `+%${r.newMember} yeni üye indirimi` : "";
  return `<div class="won-ticket" style="--c:${CAT[cp.cat].color}"><div class="wt-pct">%${r.pct} indirim${extra ? `<small>${extra}</small>` : ""}</div>
    <div class="code-row"><span class="code" id="wonCode">${esc(cp.code)}</span><button class="btn dark" type="button" data-copy="${esc(cp.code)}">${icon("copy")}Kopyala</button></div></div>
    ${ruleChips({...r, newMember:0}, {base:false})}
    <p class="small muted" style="margin:0">${esc(cp.products)} için geçerli. Son kullanma: <b>${fmtDT(cp.expiresAt)}</b>. Kupon Kuponlarım'a kaydedildi.</p>
    ${useLinks(cp, {big:true})}
    <div class="acts col"><a class="btn ghost" href="#/kuponlarim" data-close>${icon("ticket")}Kuponlarım</a></div>`;
}
function wonModal(cp, ms) {
  modal(`<div class="modal center won" role="dialog" aria-modal="true" aria-labelledby="mT"><div class="burst">${icon("trophy", "big")}</div>
    <h2 id="mT">Tebrikler, kazandın!</h2>
    <p class="muted" style="margin:0">${esc(cp.brand)} logosunu <b>${((ms || 0) / 1000).toFixed(2)} sn</b>'de buldun.</p>${couponBox(cp)}</div>`, render);
  confetti();
}
function lostModal(id, key, result) {
  const c = campById(id), ts = telafiState(c, key);
  const msg = {wrong:["Yanlış logo", "Doğru logoyu neonla gösterdik."], timeout:["Süre doldu", `${c.findSec} saniye içinde logoya dokunulmadı.`],
    full:["Kontenjan doldu", "Logoyu buldun ama sen tıklarken son kupon da verildi."], error:["Bağlantı sorunu", "Sonuç alınamadı; Kuponlarım'ı kontrol et."]}[result] || ["Kazanamadın", ""];
  modal(`<div class="modal center lost" role="dialog" aria-modal="true" aria-labelledby="mT"><div class="burst sad">${icon(result === "timeout" ? "clock" : "x", "big")}</div>
    <h2 id="mT">${msg[0]}</h2><p class="muted" style="margin:0">${msg[1]} Bu kampanyadaki hakkın bitti; diğer kampanyalara katılabilirsin.</p>
    ${ts.ok ? telafiBox(c) : ""}
    <div class="acts"><a class="btn ghost" href="#/" data-close>Diğer kampanyalar</a><button class="btn ghost" type="button" data-close>Kapat</button></div></div>`, render);
}
const telafiBox = c => `<div class="telafi-box"><h3>${icon("gift")}Telafi kuponu al</h3><p class="small muted" style="margin:0">Kazanamadın ama eli boş dönme. Birini seç (bu kampanya için bir kez):</p>
  <div class="t-opts">${K.telafiOptions(c).filter(o => o.kind !== "paid" || paymentOn).map(o => `<button class="t-opt k-${o.kind}" type="button" data-act="telafiPick" data-id="${c.id}" data-kind="${o.kind}">
    <b>%${o.pct}</b><span>${esc(o.label)}</span><small>${esc(o.note)}</small></button>`).join("")}</div></div>`;
function telafiModal(id) {
  const c = campById(id), key = instKey(c, clock()), ts = telafiState(c, key);
  if (!ts.ok) return toast("Telafi bu kampanya için artık alınamaz.");
  modal(`<div class="modal center" role="dialog" aria-modal="true" aria-labelledby="tT"><h2 id="tT">${icon("gift")}Telafi: ${esc(c.brand)}</h2>${telafiBox(c)}<button class="btn ghost" type="button" data-close>Vazgeç</button></div>`);
}
async function grantTelafi(id, kind, extra) {
  const c = campById(id), r = await Api.telafi(id, instKey(c, clock()), kind, extra);
  if (r.error) { closeModal(); return toast("Telafi alınamadı: kampanya kapanmış ya da telafi daha önce alınmış."); }
  render();   // arkadaki sayfada "Telafi al" düğmesi kalmasın
  modal(`<div class="modal center won" role="dialog" aria-modal="true" aria-labelledby="mT"><div class="burst">${icon("gift", "big")}</div><h2 id="mT">${kind === "paid" ? "Ödeme alındı, kuponun hazır!" : "Telafi kuponun hazır!"}</h2>${couponBox(r.coupon)}</div>`, render);
  confetti(50);
}
async function telafiPick(id, kind) {
  const c = campById(id);
  if (kind === "low") return grantTelafi(id, kind);
  if (kind === "ad") {
    let ad; try { ad = await Api.startAd(instKey(c, clock())); } catch { return toast("Reklam başlatılamadı."); }
    const sec = c.telafi.adSec;
    modal(`<div class="modal center ad" role="dialog" aria-modal="true" aria-labelledby="adT"><span class="tag">Reklam</span>
      <div class="ad-screen"><b>1 Milyonuncu Marka</b><span>Gün boyu ${D.categories.length} kategoride yeni fırsat. Bildirimleri aç, hiçbirini kaçırma!</span>${icon("bell", "big")}</div>
      <h2 id="adT">Reklam bitince kuponun gelecek</h2><div class="bar ad-bar"><i id="adBar"></i></div><p class="small muted" style="margin:0"><b id="adLeft">${sec}</b> sn</p>
      <button class="btn ghost" type="button" data-close>Vazgeç</button></div>`);
    const t0 = Date.now(), iv = setInterval(() => {
      const left = sec - (Date.now() - t0) / 1000;
      if (!$("#adBar")) return clearInterval(iv);
      $("#adBar").style.transform = `scaleX(${1 - Math.max(0, left) / sec})`; $("#adLeft").textContent = Math.max(0, Math.ceil(left));
      if (left <= -0.3) { clearInterval(iv); grantTelafi(id, kind, {reklamId:ad.id}); }
    }, 200);
    return;
  }
  modal(`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="pT" data-form="pay" data-id="${id}"><h2 id="pT">${icon("card")}${c.telafi.fee} ₺ öde, %${c.telafi.paid} indirim al</h2>
    <p class="muted small" style="margin:0">${MODE === "remote" ? "Ödeme, ödeme kuruluşunun güvenli sayfasında alınır." : "Demo ödeme: gerçek tahsilat yapılmaz. Canlıda ödeme iyzico / PayTR gibi bir ödeme kuruluşu üzerinden alınır."}</p>
    <div class="field"><label for="pCard">Kart numarası (demo)</label><input id="pCard" inputmode="numeric" autocomplete="off" value="4242 4242 4242 4242" readonly></div>
    <div class="acts"><button class="btn ghost" type="button" data-close>Vazgeç</button><button class="btn primary" type="submit">${icon("lock")}${c.telafi.fee} ₺ öde${MODE === "local" ? " (demo)" : ""}</button></div></form>`);
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
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2800); }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* izin yok */ }
  const ta = Object.assign(document.createElement("textarea"), {value:text, readOnly:true});
  ta.style.cssText = "position:fixed;opacity:0;left:-9999px"; document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove(); return ok;
}
let afterLogin = null, loginState = null, loginSwap = false;
function loginModal(next) {
  if (typeof next === "function") afterLogin = next; else if (next !== "keep") afterLogin = null;
  const st = loginState || {};
  const codeStep = MODE === "remote" && st.sent;
  const s = modal(`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="lT" data-form="login" novalidate>
    <h2 id="lT">${icon("user")}Giriş yap / Üye ol</h2><p class="muted small" style="margin:0">Kuponların hesabına tanımlanır. ${MODE === "remote" ? "Telefonuna gelen tek kullanımlık kodla giriş yaparsın." : "Demo modunda SMS doğrulaması yok."}</p>
    <div class="field"><label for="lName">Ad soyad</label><input id="lName" name="name" autocomplete="name" required minlength="2" maxlength="60" value="${esc(st.name || "")}" ${codeStep ? "readonly" : ""}></div>
    <div class="field"><label for="lPhone">Cep telefonu</label><input id="lPhone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="05xx xxx xx xx" required value="${esc(st.phone || "")}" ${codeStep ? "readonly" : ""}></div>
    ${codeStep ? `<div class="field"><label for="lCode">SMS ile gelen 6 haneli kod</label><input id="lCode" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required>${st.dev ? `<span class="small muted">Geliştirme modu kodu: <b>${esc(st.dev)}</b></span>` : ""}</div>` : ""}
    <label class="check"><input type="checkbox" name="kvkk" required ${st.kvkk ? "checked" : ""}><span>KVKK aydınlatma metnini okudum; kampanya iletişimi (SMS/bildirim, İYS) için verilerimin işlenmesini kabul ediyorum.</span></label>
    <p class="err" id="lErr" role="alert"></p>
    <div class="acts"><button class="btn ghost" type="button" data-close>Vazgeç</button><button class="btn primary" type="submit">${MODE === "remote" && !codeStep ? "Kod gönder" : "Devam et"}</button></div></form>`,
    () => { if (loginSwap) { loginSwap = false; return; } loginState = null; render(); });   // kod adımına geçerken durumu koru
  s.querySelector(codeStep ? "#lCode" : "#lName").focus();
}
function notifDrawer() {
  const u = user(); if (!u) return loginModal();
  const list = db.notifs.filter(n => n.phone === u.phone || MODE === "remote");
  modal(`<div class="modal drawer" role="dialog" aria-modal="true" aria-labelledby="nT"><div class="sec-head"><h2 id="nT">${icon("bell")}Bildirimler</h2><button class="icon-btn" type="button" data-close aria-label="Kapat">${icon("x")}</button></div>
    ${list.length ? `<ul class="notifs">${list.map(n => `<li class="${n.read ? "" : "unread"}"><a href="${esc(n.link || "#/")}" data-close><b>${esc(n.title)}</b><span>${esc(n.body)}</span><small>${fmtDT(n.at)} · ${esc((n.channels || []).join(", "))}</small></a></li>`).join("")}</ul>`
      : `<div class="empty">${icon("bell", "big")}<b>Henüz bildirim yok</b><span>Yaklaşan bir kampanyada Hatırlat'a dokun.</span></div>`}</div>`, render);
  list.forEach(n => n.read = true); Api.markRead(); updateChrome();
}

/* ---------- yönlendirme ve döngü ---------- */
let route = {name:"home", arg:null};
function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "marka-kasasi") return {name:"admin", arg:"kasa"};
  if (parts[0] === "panel") return {name:"admin", arg:"ozet"};
  const map = {"":"home", kampanyalar:"home", kategori:"category", kampanya:"campaign", oyna:"campaign", kuponlarim:"coupons", profil:"profile", nasil:"how", admin:"admin"};
  const name = map[parts[0] || ""];
  return name ? {name, arg:parts[1] || null} : {name:"notFound", arg:null};
}
let lastSig = "";
function signature() {
  const t = clock();
  return [route.name, route.arg, db.session, syncVer, db.coupons.length, db.coupons.filter(x => x.usedAt).length, db.reminders.length, Object.keys(db.attempts).length,
    CAMPS.map(c => status(c, t)[0]).join(""), myCoupons().map(x => couponStatus(x, t)[0]).join(""), adminCache?.at || 0].join("|");
}
function render(focusMain = false) {
  if (game) return;
  const main = $("#main");
  main.innerHTML = views[route.name](route.arg);
  lastSig = signature();
  const navName = {home:"home", category:"home", campaign:"home", coupons:"coupons", profile:"profile", how:"how", admin:"admin"}[route.name];
  document.querySelectorAll("[data-nav]").forEach(a => a.dataset.nav === navName ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  const titles = {home:"Kampanyalar", category:CAT[route.arg]?.name, campaign:campById(route.arg)?.brand, coupons:"Kuponlarım", profile:"Profil", how:"Nasıl çalışır", admin:"Yönetim"};
  document.title = (titles[route.name] ? titles[route.name] + " · " : "") + "1 Milyonuncu Marka";
  if (installEvt) { const b = $("#installBtn"); if (b) b.hidden = false; }
  document.body.classList.toggle("is-admin", route.name === "admin");
  updateChrome();
  if (focusMain) { main.focus({preventScroll:true}); window.scrollTo(0, 0); }
}
function updateChrome() {
  const u = user(), t = clock();
  const ub = $("#userBtn");
  const html = u ? `<span class="avatar sm">${initials(u.name)}</span><span class="un">${esc(u.name.split(" ")[0])}</span>` : `${icon("user")}<span class="un">Giriş yap</span>`;
  if (ub.innerHTML !== html) ub.innerHTML = html;
  ub.setAttribute("aria-label", u ? `Profil: ${u.name}` : "Giriş yap");
  const n = myCoupons().filter(x => couponStatus(x, t) === "active").length;
  document.querySelectorAll("[data-count-coupons]").forEach(cc => { cc.hidden = !n; cc.textContent = n; });
  const un = u ? db.notifs.filter(x => (x.phone === u.phone || MODE === "remote") && !x.read).length : 0;
  const nb = $("#notifCount"); nb.hidden = !un; nb.textContent = un;
  $("#demoBanner").hidden = !(MODE === "local" && demoOffset);
  if (MODE === "local" && demoOffset) $("#demoTime").textContent = hhmm(t.h, t.mi);
  $("#protoNote").hidden = MODE === "remote";
  if (MODE === "remote") $("#footNote").textContent = "Kuponlar kişiye özeldir ve tek kullanımlıktır. İndirim, markanın kendi sitesinde ya da mağazasında kupon koduyla uygulanır. Kişisel veriler KVKK kapsamında işlenir.";
}
function tick() {
  const t = clock(), nx = nextStart(t);
  $("#nextCd").textContent = fmtClock(nx.inSec);
  $("#nextAt").textContent = K.hhmm(nx.min);
  runSchedulers(t);
  if (game) return;
  const busy = $("#modalRoot").children.length || document.activeElement?.matches("input,select,textarea");
  if (signature() !== lastSig && !busy) { const y = scrollY; render(); scrollTo(0, y); return; }
  document.querySelectorAll("[data-cd]").forEach(el => { const s = (+el.dataset.cd - t.ms) / 1000; el.textContent = el.dataset.fmt === "short" ? fmtShort(s) : fmtClock(s); });
  document.querySelectorAll("[data-prog]").forEach(el => { const [a, b] = el.dataset.prog.split(",").map(Number); el.style.width = `${Math.max(0, Math.min(100, (b - t.ms) / (b - a) * 100))}%`; });
  updateChrome();
}

window.addEventListener("hashchange", () => {
  if (game) { const key = game.key; endOverlay(); if (key) { Api.timeout(key); toast("Oyundan çıktın, bu kampanyadaki hakkın kullanıldı."); } }
  closeModal(); kasaMsg = null; shown = PAGE; route = parseRoute(); render(true);
});
window.addEventListener("storage", e => { if (MODE !== "local") return; if (e.key === KEY) { db = load(); countsCache = null; if (!game) render(); } if (e.key === "lb:demoOffset") { demoOffset = Number(e.newValue) || 0; render(); } });
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (modalClose) closeModal(); else if (game?.pre) endOverlay(); else if (game?.after) game.after(); } });
let installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; const b = $("#installBtn"); if (b) b.hidden = false; });

async function adminDo(tur, p, msg) {
  try { const r = await Api.adminAction(tur, p); if (r?.error) return toast("İşlem yapılamadı."); toast(msg || "İşlem tamam."); if (MODE === "remote") await sync().catch(() => {}); await loadAdmin(true); }
  catch (e) { toast(e.message); }
}
document.addEventListener("click", async e => {
  const tile = e.target.closest("#board button[data-token]");
  if (tile && game && !game.done) return finish(tile);
  const cp = e.target.closest("[data-copy]");
  if (cp) { const ok = await copyText(cp.dataset.copy); const old = cp.innerHTML; cp.innerHTML = ok ? `${icon("check")}Kopyalandı` : "Kopyalanamadı"; toast(ok ? "Kupon kodu kopyalandı." : "Kopyalanamadı; kodu basılı tutup kopyala."); setTimeout(() => { if (cp.isConnected) cp.innerHTML = old; }, 1800); return; }
  const utm = e.target.closest("[data-utm]");
  if (utm) { if (MODE === "local") { db.clicks.push({code:utm.dataset.utm, at:clock().ms, link:+utm.dataset.i}); save(); } return; }
  if (e.target.closest("#userBtn")) { if (user()) location.hash = "#/profil"; else loginModal(); return; }
  if (e.target.closest("#notifBtn")) return notifDrawer();
  if (e.target.closest("#demoReset")) { demoOffset = 0; store("lb:demoOffset", null); return render(); }
  const act = e.target.closest("[data-act]"); if (!act || act.tagName === "SELECT") return;
  const a = act.dataset.act, v = act.dataset.v;
  if (a === "scroll") { e.preventDefault(); $("#kampanyalar")?.scrollIntoView({behavior:reduceMotion() ? "auto" : "smooth"}); }
  else if (a === "login") loginModal();
  else if (a === "logout") { await Api.logout(); toast("Çıkış yapıldı."); location.hash = "#/"; render(); }
  else if (a === "start") rulesModal(act.dataset.id);
  else if (a === "go") startGame(act.dataset.id);
  else if (a === "revealNext") game?.after?.();
  else if (a === "remind") {
    const id = act.dataset.id;
    const doIt = async () => { try { const on = await Api.toggleReminder(id); toast(on ? "Hatırlatma kuruldu: 5 dk kala ve başladığında haber vereceğiz." : "Hatırlatma kaldırıldı."); } catch (er) { toast(er.message); } render(); };
    if (!user()) return loginModal(doIt);
    doIt();
  }
  else if (a === "telafi") telafiModal(act.dataset.id);
  else if (a === "telafiPick") telafiPick(act.dataset.id, act.dataset.kind);
  else if (a === "filter") { store("lb:filter", v); shown = PAGE; render(); }
  else if (a === "catf") { store("lb:cat", v); shown = PAGE; render(); }
  else if (a === "clearSearch") { searchQ = ""; shown = PAGE; render(); }
  else if (a === "ctab") { store("lb:ctab", v); render(); }
  else if (a === "wall") { store("lb:wall", v || null); render(); }
  else if (a === "more") { shown += PAGE; const y = scrollY; render(); scrollTo(0, y); }
  else if (a === "pref") {
    const u = user(), p = prefsOf(u); p[v] = !p[v];
    if (v === "push" && p.push) {
      if (!("Notification" in window)) { p.push = false; toast("Bu tarayıcı bildirim desteklemiyor; bildirimler uygulama içinde görünür."); }
      else if (Notification.permission !== "granted") {
        try { const perm = await Notification.requestPermission(); if (perm !== "granted") { p.push = false; toast("Tarayıcı bildirim izni verilmedi; bildirimler uygulama içinde görünür."); } } catch { p.push = false; toast("Bu tarayıcı bildirim desteklemiyor."); }
      }
    }
    await Api.setPrefs(p).catch(er => toast(er.message)); render();
  }
  else if (a === "install") { installEvt?.prompt(); installEvt = null; act.hidden = true; }
  else if (a === "realtime") { demoOffset = 0; store("lb:demoOffset", null); render(); }
  else if (a === "reset") modal(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="rsT"><h2 id="rsT">Tüm veriler silinsin mi?</h2><p class="muted" style="margin:0">Kullanıcılar, kuponlar, hatırlatmalar ve deneme kayıtları bu tarayıcıdan silinir.</p>
      <div class="acts"><button class="btn ghost" type="button" data-close>Vazgeç</button><button class="btn primary" type="button" data-act="resetYes">Evet, sıfırla</button></div></div>`);
  else if (a === "resetYes") { db = fresh(); save(); adminCache = null; closeModal(); toast("Veriler sıfırlandı."); render(); }
  /* admin */
  else if (a === "adminRefresh") loadAdmin(true);
  else if (a === "adminLogout") { adminKey = null; sstore("lb:admin", null); adminCache = null; render(); }
  else if (a === "akf") { store(`lb:akf-${act.dataset.tab}`, v); render(); }
  else if (a === "aDo") adminDo(act.dataset.tur, {kod:act.dataset.kod, telefon:act.dataset.telefon, kampanya:act.dataset.kampanya}, {kupon_iptal:"Kupon iptal edildi.", kupon_uzat:"Kupon süresi 24 saat uzatıldı.", iade:"İade kaydedildi, komisyon geri alındı.", uye_engelle:"Üye durumu güncellendi.", fill:"Kontenjan test katılımcılarıyla dolduruldu."}[act.dataset.tur]);
  else if (a === "aUsed") modal(`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="auT" data-form="aUsed" data-kod="${esc(act.dataset.kod)}"><h2 id="auT">${icon("check")}Elle "kullanıldı" işaretle</h2>
      <p class="muted small" style="margin:0">Markanın bildirmediği ama mutabakatta doğrulanan satış için. Komisyon indirim sonrası tutardan hesaplanır.</p>
      <div class="frow"><div class="field"><label for="auAmt">Sepet tutarı (₺)</label><input id="auAmt" name="amount" type="number" min="0.01" step="0.01" required></div><div class="field"><label for="auOrd">Sipariş no</label><input id="auOrd" name="order" required></div></div>
      <div class="acts"><button class="btn ghost" type="button" data-close>Vazgeç</button><button class="btn primary" type="submit">Kaydet</button></div></form>`);
  else if (a === "aSms" || a === "aSmsCamp") {
    const camp = a === "aSmsCamp" ? campById(act.dataset.id) : null;
    modal(`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="asT" data-form="aSms" data-phone="${esc(act.dataset.phone || "")}" data-camp="${camp ? camp.id : ""}"><h2 id="asT">${icon("sms")}${camp ? `${esc(camp.brand)} hatırlatma listesine bildir` : "SMS / bildirim gönder"}</h2>
      <div class="field"><label for="asTitle">Başlık</label><input id="asTitle" name="title" required value="${camp ? esc(`${camp.brand} kampanyası`) : "1 Milyonuncu Marka"}"></div>
      <div class="field"><label for="asMsg">Mesaj</label><textarea id="asMsg" name="msg" rows="3" required maxlength="300">${camp ? esc(`${camp.offer}. ${startTxt(camp)}'de başlıyor, logoyu 5 saniyede bul!`) : ""}</textarea></div>
      <p class="small muted" style="margin:0">Yalnızca İYS onayı olan üyelere SMS gider; uygulama içi bildirim herkese düşer.</p>
      <div class="acts"><button class="btn ghost" type="button" data-close>Vazgeç</button><button class="btn primary" type="submit">Gönder</button></div></form>`);
  }
  else if (a === "aDelUser") modal(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="adT"><h2 id="adT">${icon("trash")}Üye silinsin mi?</h2><p class="muted" style="margin:0">KVKK kapsamında kişisel veriler silinir; kupon kayıtları muhasebe için anonim olarak kalır. Bu işlem geri alınamaz.</p>
      <div class="acts"><button class="btn ghost" type="button" data-close>Vazgeç</button><button class="btn primary" type="button" data-act="aDelUserYes" data-phone="${esc(act.dataset.phone)}">Evet, sil</button></div></div>`);
  else if (a === "aDelUserYes") { closeModal(); adminDo("uye_sil", {telefon:act.dataset.phone}, "Üye silindi."); }
  else if (a === "aLogoDel") { try { await Api.removeLogo(act.dataset.brand); toast("Logo kaldırıldı."); } catch (er) { toast(er.message); } render(); }
  else if (a === "csvUsers" && adminCache) {
    const A = adminCache;
    csvDownload(`uyeler-${clock().day}.csv`, ["ad", "telefon", "uyelik", "kvkk_onay", "oyun", "kazanilan", "kullanilan", "hatirlatma", "engelli"],
      A.users.map(u => [u.name, u.phone, new Date(u.createdAt).toISOString(), u.consentAt ? new Date(u.consentAt).toISOString() : "", A.attempts.filter(x => x.phone === u.phone).length,
        A.coupons.filter(x => x.phone === u.phone && x.source === "oyun").length, A.coupons.filter(x => x.phone === u.phone && x.usedAt).length, A.reminders.filter(r => r.phone === u.phone).length, u.blocked ? 1 : 0]));
  }
  else if (a === "csvCoupons" && adminCache) {
    const A = adminCache, iso = ms => ms ? new Date(ms).toISOString() : "";
    csvDownload(`kuponlar-${clock().day}.csv`, ["kod", "kampanya", "marka", "tur", "yeni_uye", "ad", "telefon", "verildi", "son_kullanma", "durum", "link_tiklama", "kasada_dogrulandi", "siparis_no", "kullanildi", "sepet_tl", "indirim_tl", "net_tl", "komisyon_tl", "telafi_ucreti", "iade"],
      A.coupons.map(cp => [cp.code, cp.campId, cp.brand, cp.source, cp.newMember ? 1 : 0, cp.name || "", cp.phone, iso(cp.issuedAt), iso(cp.expiresAt), couponStatus(cp), A.clicks.filter(k => k.code === cp.code).length,
        iso(cp.validatedAt), cp.orderNo || "", iso(cp.usedAt), cp.gross ?? "", cp.discount ?? "", cp.sale ?? cp.paid ?? "", cp.commission ?? "", cp.fee || "", iso(cp.refundedAt)]));
  }
});
document.addEventListener("change", e => {
  if (e.target.matches("select[data-act=cat]")) { store("lb:panelCat", e.target.value); e.target.blur(); render(); }
  if (e.target.matches("#lgFile")) {
    const f = e.target.files[0]; logoBrand = $("#lgBrand").value;
    if (!f) return;
    if (f.size > 300 * 1024) { toast("Dosya 300 KB'tan büyük."); e.target.value = ""; return; }
    const rd = new FileReader(); rd.onload = () => { logoPreview = rd.result; const pv = $(".lg-prev"); if (pv) pv.innerHTML = `<div class="logo has-img"><img src="${esc(logoPreview)}" alt="Önizleme"></div>`; }; rd.readAsDataURL(f);
  }
});
let searchT;
document.addEventListener("input", e => {
  if (e.target.id === "q") { clearTimeout(searchT); searchT = setTimeout(() => { searchQ = e.target.value; shown = PAGE; render(); const q = $("#q"); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 250); }
});
document.addEventListener("submit", async e => {
  const f = e.target.closest("form[data-form]"); if (!f) return;
  e.preventDefault();
  const kind = f.dataset.form;
  if (kind === "search") { searchQ = f.q.value; shown = PAGE; render(); }
  else if (kind === "login") {
    const err = $("#lErr"), nameEl = f.name, phoneEl = f.phone;
    [nameEl, phoneEl].forEach(x => x.removeAttribute("aria-invalid"));
    if (!f.kvkk.checked) { err.textContent = "Devam etmek için KVKK onayı gerekli."; return; }
    const name = nameEl.value.trim(), phone = normPhone(phoneEl.value);
    if (name.length < 2) { err.textContent = "Adını en az 2 harf olarak yaz."; nameEl.setAttribute("aria-invalid", "true"); nameEl.focus(); return; }
    if (!phone) { err.textContent = "Geçerli bir cep telefonu yaz (05xx xxx xx xx)."; phoneEl.setAttribute("aria-invalid", "true"); phoneEl.focus(); return; }
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
    try {
      if (MODE === "remote" && !loginState?.sent) {
        const r = await Api.sendCode(phone);
        loginState = {name, phone, kvkk:true, sent:true, dev:r.gelistirmeKodu}; loginSwap = true; return loginModal("keep");
      }
      const r = await Api.login(name, phone, f.code?.value.trim());
      if (r.error) { err.textContent = "Bilgileri kontrol et."; btn.disabled = false; return; }
      const next = afterLogin; afterLogin = null; loginState = null;
      closeModal(); toast(`Hoş geldin, ${name.split(" ")[0]}!`);
      if (next) next();
    } catch (er) { err.textContent = er.message; btn.disabled = false; }
  } else if (kind === "demo") {
    const [h, m] = f.querySelector("#demoAt").value.split(":").map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) { setDemoTime(h, m); document.activeElement?.blur(); render(); toast(`Demo saati ${hhmm(h, m)} olarak ayarlandı.`); }
  } else if (kind === "pay") {
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Ödeme işleniyor…";
    const id = f.dataset.id; setTimeout(() => grantTelafi(id, "paid", {odemeRef:`demo-${randStr(8)}`}), 900);
  } else if (kind === "kasa") {
    const brand = f.brand.value, code = f.code.value.trim().toUpperCase(), step = e.submitter?.value || "validate", amount = parseFloat(f.amount.value);
    const v = await Api.kasa(step, brand, code, f.order.value, amount);
    const cp = v.coupon, calc = fromServerCalc(v.calc);
    kasaMsg = {brand, code, amount:f.amount.value, ok:v.ok, html:!v.ok ? `<b>Reddedildi.</b> ${esc(v.reason)}` : step === "order" ?
      `<b>Sipariş ${esc(cp.orderNo)} alındı${v.repeat ? " (tekrar bildirim, ikinci kez sayılmadı)" : ""}.</b> Kupon kullanıldı olarak işaretlendi.${calc ? calcHtml(calc, true) : ""}<a href="#/admin/takip">Satın alma takibinde gör</a>` :
      `<b>Kod geçerli.</b> ${esc(cp.brand)} · ${esc(cp.products)} · son kullanma ${fmtDT(cp.expiresAt)}.${calc ? calcHtml(calc) : " Sepet tutarını girersen indirimi hesaplarım."}`};
    if (step === "order" && v.ok) kasaMsg.amount = "";
    document.activeElement?.blur(); await loadAdmin(true);
  } else if (kind === "adminLogin") {
    adminKey = f.key.value; sstore("lb:admin", adminKey); adminCache = null; render();
  } else if (kind === "adminSearch") { store("lb:aq", f.q.value); render(); }
  else if (kind === "aUsed") { closeModal(); adminDo("kupon_kullanildi", {kod:f.dataset.kod, sepetTutari:parseFloat(f.amount.value), siparisNo:f.order.value}, "Kupon kullanıldı olarak işaretlendi."); }
  else if (kind === "aSms") {
    closeModal();
    const p = f.dataset.camp ? {hedef:"hatirlatma", kampanya:f.dataset.camp} : {telefon:f.dataset.phone};
    try { const r = await Api.adminAction("sms_gonder", {...p, baslik:f.title.value, mesaj:f.msg.value, link:f.dataset.camp ? `#/kampanya/${f.dataset.camp}` : "#/"}); toast(`${r.gonderilen ?? 1} kişiye gönderildi.`); await loadAdmin(true); } catch (er) { toast(er.message); }
  } else if (kind === "logo") {
    const brand = f.brand.value.trim();
    if (!brand) return toast("Marka seç.");
    if (!logoPreview) return toast("Logo dosyası seç.");
    try { const r = await Api.uploadLogo(brand, logoPreview); if (r.error) return toast(r.error); toast(`${brand} logosu yüklendi.`); logoBrand = ""; logoPreview = null; render(); } catch (er) { toast(er.message); }
  } else if (kind === "brandKey") {
    try { const r = await Api.createBrandKey(f.name.value.trim());
      $("#bkOut").innerHTML = `<div class="kasa-out ok"><b>${esc(r.ad)} için anahtarlar</b><span>API anahtarı: <code>${esc(r.apiAnahtari)}</code></span><span>Gizli anahtar: <code>${esc(r.gizliAnahtar)}</code></span><span class="small">${esc(r.not)}</span></div>`;
    } catch (er) { toast(er.message); }
  }
});

if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !D.noServiceWorker) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* yayın ortamında service worker yok */ });
}
(async () => {
  route = parseRoute();
  await detectMode();
  document.documentElement.dataset.mode = MODE;
  render(); tick();
  setInterval(tick, 1000);
  if (MODE === "remote") setInterval(() => { if (!document.hidden && !game) sync().catch(() => {}); }, 15000);
})();
})();
