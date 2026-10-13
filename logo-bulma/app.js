// 1 Milyonuncu Marka: prototip uygulama.
// "Api" bölümü sunucunun yapacağı işi taklit eder (localStorage üzerinde).
// Gerçek yayında aynı kurallar sunucuda uygulanmalı; tarayıcıya güvenilmez.
(() => {
"use strict";
const D = window.LB_DATA;
const CAMPS = D.campaigns;
const CAT = Object.fromEntries(D.categories.map(c => [c.slug, c]));
const GRACE_MS = 300;          // ağ gecikmesi payı (sunucu tarafında da olmalı)
const DAY = 86400;

/* ---------- yardımcılar ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const pad = n => String(n).padStart(2, "0");
const hhmm = (h, m = 0) => `${pad(h)}:${pad(m)}`;
const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const tl = n => new Intl.NumberFormat("tr-TR", {style:"currency", currency:"TRY"}).format(n);
function randStr(n, abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789") {
  const a = new Uint32Array(n); crypto.getRandomValues(a);
  return Array.from(a, x => abc[x % abc.length]).join("");
}
function shuffle(arr) {
  const a = arr.slice(), r = new Uint32Array(a.length); crypto.getRandomValues(r);
  for (let i = a.length - 1; i > 0; i--) { const j = r[i] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function fmtDur(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h ? `${h} sa ${pad(m)} dk` : `${pad(m)}:${pad(s)}`;
}
function store(key, val) { try { if (val === undefined) return localStorage.getItem(key); if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); } catch { /* gizli sekme vb. */ } return null; }

/* ---------- saat (Türkiye saati + demo kaydırma) ---------- */
const fmtParts = new Intl.DateTimeFormat("en-GB", {timeZone:D.timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23"});
let demoOffset = Number(store("lb:demoOffset")) || 0;
function clock(ms = Date.now() + demoOffset) {
  const p = Object.fromEntries(fmtParts.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const h = +p.hour % 24, mi = +p.minute, s = +p.second;
  return {ms, day:`${p.year}-${p.month}-${p.day}`, h, mi, s, sod:h * 3600 + mi * 60 + s};
}
const fmtDateTime = ms => new Intl.DateTimeFormat("tr-TR", {timeZone:D.timeZone, day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"}).format(new Date(ms));
function setDemoTime(h, m) {
  const t = clock(Date.now());
  demoOffset = ((h * 3600 + m * 60) - t.sod) * 1000;
  store("lb:demoOffset", demoOffset ? String(demoOffset) : null);
}

/* ---------- veri deposu (sunucu yerine) ---------- */
const KEY = "lb:v1";
const fresh = () => ({users:{}, session:null, attempts:{}, coupons:[], clicks:[]});
let db = load();
function load() { try { return Object.assign(fresh(), JSON.parse(store(KEY)) || {}); } catch { return fresh(); } }
function save() { store(KEY, JSON.stringify(db)); }

const campById = id => CAMPS.find(c => c.id === id);
const brandsOf = cat => [...new Set([...CAMPS.filter(c => c.cat === cat).map(c => c.brand), ...(D.extraBrands[cat] || [])])];
const win = c => ({start:c.hour * 3600, end:c.hour * 3600 + c.durationMin * 60});
const instKey = (c, t) => `${c.id}@${t.day}`;
const winners = key => db.coupons.filter(x => x.key === key).length;
function status(c, t = clock()) {
  const w = win(c);
  if (t.sod < w.start) return "upcoming";
  if (winners(instKey(c, t)) >= c.quota) return "full";
  return t.sod < w.end ? "active" : "ended";
}
const remaining = (c, t = clock()) => Math.max(0, c.quota - winners(instKey(c, t)));
const endsAtMs = (c, t = clock()) => t.ms + (win(c).end - t.sod) * 1000;
function nextStart(t = clock()) {
  const future = CAMPS.map(c => win(c).start).filter(s => s > t.sod);
  const s = future.length ? Math.min(...future) : DAY + Math.min(...CAMPS.map(c => win(c).start));
  return {inSec:s - t.sod, hour:(s / 3600) % 24};
}
const user = () => db.session && db.users[db.session] || null;
function couponStatus(cp, t = clock()) { return cp.usedAt ? "used" : t.ms > cp.expiresAt ? "expired" : "active"; }
function brandUrl(cp) {
  const base = D.brandUrls[cp.brand]; if (!base) return null;
  const u = new URL(base);
  u.searchParams.set("utm_source", "1milyonuncumarka"); u.searchParams.set("utm_medium", "kupon");
  u.searchParams.set("utm_campaign", cp.campId); u.searchParams.set("utm_content", cp.code);
  return u.toString();
}
function normPhone(raw) {
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("90") && d.length === 12) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return /^5\d{9}$/.test(d) ? "0" + d : null;
}
const fmtPhone = p => p.replace(/^(\d{4})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3 $4");

const Api = {
  login(name, phone) {
    name = name.trim().replace(/\s+/g, " ");
    const p = normPhone(phone);
    if (name.length < 2) return {error:"name"};
    if (!p) return {error:"phone"};
    db.users[p] = db.users[p] || {phone:p, name, createdAt:clock().ms, consentAt:clock().ms};
    db.users[p].name = name; db.session = p; save();
    return {user:db.users[p]};
  },
  logout() { db.session = null; save(); },
  attemptOf(c, t = clock()) { const u = user(); return u ? db.attempts[instKey(c, t)]?.[u.phone] || null : null; },
  // Oyun başlar: logo sırası ve hedef tokeni "sunucuda" belirlenir, tarayıcıya yalnızca token gider.
  start(campId) {
    const c = campById(campId), u = user(), t = clock();
    if (!c) return {error:"missing"};
    if (!u) return {error:"login"};
    const st = status(c, t); if (st !== "active") return {error:st};
    const key = instKey(c, t);
    if (db.attempts[key]?.[u.phone]) return {error:"used"};
    const tiles = shuffle(brandsOf(c.cat)).map(brand => ({token:randStr(10), brand}));
    const att = {startedAt:t.ms, deadline:t.ms + c.findSec * 1000, target:tiles.find(x => x.brand === c.brand).token, result:null};
    (db.attempts[key] = db.attempts[key] || {})[u.phone] = att; save();
    return {key, tiles, deadline:att.deadline, startedAt:att.startedAt};
  },
  pick(campId, key, token) {
    const c = campById(campId), u = user(), t = clock();
    const att = u && db.attempts[key]?.[u.phone];
    if (!att || att.result) return {error:"used"};
    const ms = t.ms - att.startedAt;
    att.ms = ms;
    if (ms > c.findSec * 1000 + GRACE_MS) att.result = "timeout";
    else if (token !== att.target) att.result = "wrong";
    else if (winners(key) >= c.quota) att.result = "full";
    else att.result = "won";
    let coupon = null;
    if (att.result === "won") coupon = issueCoupon(c, key, u, t);
    save();
    return {result:att.result, ms, coupon, target:att.target};
  },
  timeout(key) {
    const u = user(), att = u && db.attempts[key]?.[u.phone];
    if (att && !att.result) { att.result = "timeout"; att.ms = clock().ms - att.startedAt; save(); }
  },
  myCoupons() { const u = user(); return u ? db.coupons.filter(x => x.phone === u.phone) : []; },
  click(cp) { db.clicks.push({code:cp.code, at:clock().ms}); save(); },
  redeem(code, sale) {
    const cp = db.coupons.find(x => x.code === code);
    if (!cp || couponStatus(cp) !== "active") return {error:"status"};
    if (!(sale > 0)) return {error:"sale"};
    cp.usedAt = clock().ms; cp.sale = Math.round(sale * 100) / 100;
    cp.commission = Math.round(cp.sale * D.commissionRate * 100) / 100; save();
    return {coupon:cp};
  },
  fillWithTestUsers(campId) {
    const c = campById(campId), t = clock();
    if (status(c, t) !== "active") return 0;
    const key = instKey(c, t); let n = 0;
    while (winners(key) < c.quota) { issueCoupon(c, key, {phone:"test", name:"Test katılımcı"}, t, true); n++; }
    save(); return n;
  },
  reset() { db = fresh(); save(); }
};
function issueCoupon(c, key, u, t, test = false) {
  const prefix = c.brand.normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  let code; do code = `${prefix}-${randStr(6)}`; while (db.coupons.some(x => x.code === code));
  const cp = {code, key, campId:c.id, cat:c.cat, brand:c.brand, offer:c.offer, phone:u.phone, name:u.name,
    issuedAt:t.ms, expiresAt:t.ms + D.couponValidHours * 3600e3, usedAt:null, sale:null, commission:null, test};
  db.coupons.push(cp); return cp;
}

/* ---------- arayüz parçaları ---------- */
const PALETTE = [["#111111","#FFFFFF"],["#E30613","#FFFFFF"],["#0B3D91","#FFFFFF"],["#F5F0E6","#1A1A1A"],["#FFD400","#111111"],["#00704A","#FFFFFF"],
  ["#FFFFFF","#C8102E"],["#3B2A20","#F3E3C3"],["#6D28D9","#FFFFFF"],["#F28C28","#111111"],["#0E7490","#FFFFFF"],["#FFFFFF","#111111"]];
// Uzun kelimeler bölünmesin diye en uzun kelimeye göre küçültülür; Türkçe harf yoksa
// büyük/küçük harf dönüşümü İngilizce kurala göre yapılır (ADİDAS değil ADIDAS).
function logo(brand, tag = "div", attrs = "") {
  const h = hash(brand), [bg, fg] = PALETTE[h % PALETTE.length];
  const longest = Math.max(...brand.split(/\s+/).map(w => w.length));
  const s = Math.min(1, 7 / longest).toFixed(2);
  const lang = /[çğıöşüÇĞİÖŞÜ]/.test(brand) ? "tr" : "en";
  return `<${tag} class="logo f${(h >>> 4) % 6}" lang="${lang}" style="background:${bg};color:${fg}" ${attrs}><span class="w" style="--s:${s}">${esc(brand)}</span></${tag}>`;
}
const offerText = c => c.offer ? esc(c.offer) : `<span class="tbd">Sürpriz indirim (detay markayla netleşecek)</span>`;
const STATUS_TXT = {active:"Aktif", upcoming:"Yakında", full:"Kontenjan doldu", ended:"Sona erdi"};
const badge = st => `<span class="status st-${st}">${STATUS_TXT[st]}</span>`;

function campCard(c, t) {
  const st = status(c, t), left = remaining(c, t), att = Api.attemptOf(c, t);
  const pct = Math.round((c.quota - left) / c.quota * 100);
  let cta;
  if (att) cta = `<a class="btn ghost block" href="#/oyna/${c.id}">${att.result === "won" ? "Kazandın, kuponu gör" : "Hakkını kullandın"}</a>`;
  else if (st === "active") cta = `<a class="btn primary block" href="#/oyna/${c.id}">Logoyu bul, kuponu kap</a>`;
  else cta = `<a class="btn ghost block" href="#/oyna/${c.id}">Detay</a>`;
  return `<article class="card camp">
    <div class="camp-top">${logo(c.brand)}
      <div class="camp-meta"><span class="cat">${CAT[c.cat].icon} ${esc(CAT[c.cat].name)} · ${hhmm(c.hour)}</span><h3>${esc(c.brand)}</h3>${badge(st)}</div>
    </div>
    <p class="offer" style="margin:0">${offerText(c)}</p>
    ${st === "active" ? `<div class="kv"><span>Kalan süre</span><b data-cd="${endsAtMs(c, t)}">${fmtDur(win(c).end - t.sod)}</b></div>` :
      st === "upcoming" ? `<div class="kv"><span>Başlamasına</span><b data-cd="${t.ms + (win(c).start - t.sod) * 1000}">${fmtDur(win(c).start - t.sod)}</b></div>` : ""}
    <div class="kv"><span>Kontenjan</span><b>${left} / ${c.quota} kişi kaldı</b></div>
    <div class="quota" role="img" aria-label="Kontenjanın yüzde ${pct} doldu"><i style="width:${pct}%"></i></div>
    ${cta}
  </article>`;
}

/* ---------- görünümler ---------- */
const views = {};
views.home = () => {
  const t = clock();
  const live = CAMPS.filter(c => status(c, t) === "active").sort((a, b) => win(a).end - win(b).end);
  const nx = nextStart(t);
  const upcoming = CAMPS.filter(c => c.hour === nx.hour);
  return `
  <section class="hero">
    <span class="eyebrow">Her saat başı yeni marka</span>
    <h1>Logoyu <em>5 saniyede</em> bul,<br>indirimi kap.</h1>
    <p>Her kategoride saat başı bir marka kampanyası açılır. Logolar arasında hedef markayı 5 saniye içinde bulan ilk kişiler kuponu kazanır. Kupon 24 saat geçerlidir.</p>
    <div class="steps"><span class="step">1. Kampanyayı seç</span><span class="step">2. Logoyu 5 sn'de bul</span><span class="step">3. Kupon kodunu kopyala</span><span class="step">4. Markanın sitesinde kullan</span></div>
  </section>
  <section class="section" aria-labelledby="liveH">
    <div class="sec-head"><h2 id="liveH"><span class="live-dot" aria-hidden="true"></span>Şu an aktif</h2><span class="muted small">${live.length} kampanya</span></div>
    ${live.length ? `<div class="grid-cards">${live.map(c => campCard(c, t)).join("")}</div>` :
      `<div class="empty"><b>Şu an aktif kampanya yok</b><span>Sıradaki kampanyalar <b data-cd="${t.ms + nx.inSec * 1000}">${fmtDur(nx.inSec)}</b> sonra (${hhmm(nx.hour)}) başlıyor.</span></div>`}
  </section>
  <section class="section" aria-labelledby="nextH">
    <div class="sec-head"><h2 id="nextH">Sıradaki: ${hhmm(nx.hour)}</h2><span class="muted small">${nx.inSec >= DAY - t.sod ? "yarın" : "bugün"}</span></div>
    <div class="grid-cards">${upcoming.map(c => campCard(c, t)).join("")}</div>
  </section>
  <section class="section" aria-labelledby="catH">
    <h2 id="catH">Kategoriler</h2>
    <div class="cats">${D.categories.map(cat => {
      const list = CAMPS.filter(c => c.cat === cat.slug), isLive = list.some(c => status(c, t) === "active");
      return `<a class="cat-tile ${list.length ? "" : "soon"} ${isLive ? "has-live" : ""}" href="#/kategori/${cat.slug}">
        <span class="ic" aria-hidden="true">${cat.icon}</span><b>${esc(cat.name)}</b>
        <span>${list.length ? `${brandsOf(cat.slug).length} marka · ${list.length} kampanya${isLive ? " · şu an aktif" : ""}` : "Yakında"}</span></a>`;
    }).join("")}</div>
  </section>`;
};

views.category = slug => {
  const cat = CAT[slug]; if (!cat) return views.notFound();
  const t = clock(), list = CAMPS.filter(c => c.cat === slug);
  if (!list.length) return `<section class="section"><a href="#/" class="muted small">← Kampanyalar</a><h1>${cat.icon} ${esc(cat.name)}</h1>
    <div class="empty"><b>Bu kategori yakında açılacak</b><span>Bu kategori için henüz marka ve kampanya tanımlanmadı.</span></div></section>`;
  const live = list.filter(c => status(c, t) === "active");
  return `<section class="section"><a href="#/" class="muted small">← Kampanyalar</a><h1>${cat.icon} ${esc(cat.name)}</h1>
    <p class="muted" style="margin:0">${brandsOf(slug).length} marka, günde ${list.length} kampanya, toplam ${list.reduce((s, c) => s + c.quota, 0)} kupon.</p></section>
  ${live.length ? `<section class="section"><h2><span class="live-dot" aria-hidden="true"></span>Şu an aktif</h2><div class="grid-cards">${live.map(c => campCard(c, t)).join("")}</div></section>` : ""}
  <section class="section"><div class="sec-head"><h2>Kategorideki markalar</h2><span class="muted small">Oyunda bu logolar karışık dizilir</span></div>
    <div class="logo-wall">${brandsOf(slug).map(b => logo(b)).join("")}</div></section>
  <section class="section"><h2>Bugünün programı</h2>
    <div class="tablewrap"><table><thead><tr><th class="nowrap">Saat</th><th>Marka / kampanya</th><th class="nowrap">Kontenjan</th><th>Durum</th></tr></thead><tbody>
    ${list.map(c => { const st = status(c, t);
      return `<tr class="${st === "active" ? "is-now" : st === "upcoming" ? "" : "is-past"}"><td class="nowrap">${hhmm(c.hour)}–${hhmm(c.hour, c.durationMin)}<br><span class="small muted">${c.durationMin} dk</span></td>
      <td><a href="#/oyna/${c.id}"><b>${esc(c.brand)}</b></a><br><span class="small ${c.offer ? "" : "muted"}">${c.offer ? esc(c.offer) : "Sürpriz indirim"}</span></td>
      <td class="nowrap">${remaining(c, t)} / ${c.quota}</td><td>${badge(st)}</td></tr>`; }).join("")}
    </tbody></table></div></section>`;
};

let game = null; // oynanan tur: {campId,key,deadline,raf,done}
views.play = id => {
  const c = campById(id); if (!c) return views.notFound();
  const t = clock(), st = status(c, t), att = Api.attemptOf(c, t), u = user();
  const head = `<a href="#/kategori/${c.cat}" class="muted small">← ${esc(CAT[c.cat].name)}</a>
    <div class="target">${logo(c.brand)}<div><span class="eyebrow">${hhmm(c.hour)} kampanyası · hedef logo</span><h2>${esc(c.brand)}</h2><div class="offer">${offerText(c)}</div></div></div>`;
  let body;
  if (att && att.result === "won") {
    const cp = Api.myCoupons().find(x => x.key === instKey(c, t));
    body = `<div class="card"><h3>Bu kampanyayı kazandın 🎉</h3><p class="muted">Kuponun Kuponlarım sayfasında. ${cp ? `Kod: <b>${esc(cp.code)}</b>` : ""}</p><a class="btn primary" href="#/kuponlarim">Kuponlarıma git</a></div>`;
  } else if (att) {
    body = `<div class="card"><h3>Bu kampanyada hakkını kullandın</h3><p class="muted">Her kampanyada tek deneme hakkı var. Sıradaki kampanyaları kaçırma.</p><a class="btn dark" href="#/">Diğer kampanyalar</a></div>`;
  } else if (st === "upcoming") {
    body = `<div class="card"><h3>Kampanya ${hhmm(c.hour)}'da başlıyor</h3><p class="muted">Başlamasına <b data-cd="${t.ms + (win(c).start - t.sod) * 1000}">${fmtDur(win(c).start - t.sod)}</b> var. Bu sayfayı açık tutabilirsin; süre dolunca oyun açılır.</p></div>`;
  } else if (st !== "active") {
    body = `<div class="card"><h3>${st === "full" ? "Kontenjan doldu" : "Kampanya sona erdi"}</h3><p class="muted">${st === "full" ? `${c.quota} kişilik kontenjan doldu, kampanya otomatik kapandı.` : "Bu kampanyanın süresi doldu."}</p><a class="btn dark" href="#/">Aktif kampanyalar</a></div>`;
  } else if (!u) {
    body = `<div class="card"><h3>Katılmak için giriş yap</h3><p class="muted">Kuponlar hesabına tanımlanır, bu yüzden oyuna başlamadan önce giriş yapman gerekiyor.</p><button class="btn primary" type="button" data-act="login">Giriş yap</button></div>`;
  } else {
    body = `<div class="card section"><h3>Hazır mısın?</h3>
      <ul class="rules"><li><b>Başla</b>'ya bastığında ${brandsOf(c.cat).length} logo karışık dizilir.</li><li><b>${esc(c.brand)}</b> logosuna <b>${c.findSec} saniye</b> içinde dokun.</li>
      <li>Tek hakkın var: yanlış logo ya da süre dolması hakkını bitirir.</li><li>Kalan kontenjan: <b>${remaining(c, t)} / ${c.quota}</b> · kampanyanın bitmesine <b data-cd="${endsAtMs(c, t)}">${fmtDur(win(c).end - t.sod)}</b></li></ul>
      <button class="btn primary block" type="button" data-act="start" data-id="${c.id}">Başla</button></div>`;
  }
  return `<section class="play">${head}<div id="stage">${body}</div></section>`;
};

function startGame(id) {
  const r = Api.start(id);
  if (r.error) { toast(r.error === "login" ? "Önce giriş yap." : r.error === "used" ? "Bu kampanyada hakkını kullandın." : "Kampanya şu an aktif değil."); return render(); }
  const c = campById(id), total = r.deadline - r.startedAt;
  game = {campId:id, key:r.key, deadline:r.deadline, done:false, raf:0};
  $("#stage").innerHTML = `<div class="section">
    <div class="timer" id="timer"><div class="timer-row"><span>${esc(c.brand)} logosunu bul</span><b id="tLeft">${(total / 1000).toFixed(1)}</b></div>
      <div class="bar" role="progressbar" aria-label="Kalan süre" aria-valuemin="0" aria-valuemax="${total / 1000}"><i id="tBar"></i></div></div>
    <div class="board" id="board">${r.tiles.map(x => logo(x.brand, "button", `type="button" data-token="${x.token}" aria-label="${esc(x.brand)}"`)).join("")}</div></div>`;
  // Oyun sırasında üst menü sabit kalmaz; küçük ekranlarda da tüm logolar kaydırmadan görünür.
  document.body.classList.add("playing");
  window.scrollTo({top:$(".play").getBoundingClientRect().top + window.scrollY - 8, behavior:"instant"});
  const tick = () => {
    if (game?.done) return;
    const left = game.deadline - clock().ms;
    $("#tLeft").textContent = (Math.max(0, left) / 1000).toFixed(1);
    $("#tBar").style.transform = `scaleX(${Math.max(0, left) / total})`;
    $("#timer").classList.toggle("low", left < 2000);
    if (left <= 0) return finish(null);
    game.raf = requestAnimationFrame(tick);
  };
  game.raf = requestAnimationFrame(tick);
}
function finish(btn) {
  if (!game || game.done) return;
  game.done = true; cancelAnimationFrame(game.raf); document.body.classList.remove("playing");
  const board = $("#board"); board?.classList.add("locked");
  board?.querySelectorAll("button").forEach(b => b.disabled = true);
  let r;
  if (btn) r = Api.pick(game.campId, game.key, btn.dataset.token);
  else { Api.timeout(game.key); r = {result:"timeout"}; }
  if (btn) btn.classList.add(r.result === "won" ? "hit" : "miss");
  if (r.target) board?.querySelector(`[data-token="${r.target}"]`)?.classList.add("hit");
  const c = campById(game.campId); game = null;
  if (r.result === "won") return setTimeout(() => wonModal(r.coupon, r.ms), 350);
  const msg = {wrong:["Yanlış logo", `Doğru logo yeşil çerçeveyle gösterildi. Bu kampanyada hakkın bitti.`],
    timeout:["Süre doldu", `${c.findSec} saniye içinde logoya dokunulmadı. Bu kampanyada hakkın bitti.`],
    full:["Kontenjan doldu", "Logoyu buldun ama sen tıklarken son kupon da verildi."],
    used:["Hakkını kullandın", "Bu kampanyada tek deneme hakkı var."]}[r.result] || ["Bir sorun oluştu", "Lütfen tekrar dene."];
  setTimeout(() => modal(`<div class="modal center" role="dialog" aria-modal="true" aria-labelledby="mT"><div class="big-emoji" aria-hidden="true">${r.result === "timeout" ? "⏱️" : "😕"}</div>
    <h2 id="mT">${msg[0]}</h2><p class="muted" style="margin:0">${msg[1]}</p>
    <div class="actions"><a class="btn dark" href="#/" data-close>Diğer kampanyalar</a><button class="btn ghost" type="button" data-close>Kapat</button></div></div>`, render), 450);
}
function wonModal(cp, ms) {
  modal(`<div class="modal center" role="dialog" aria-modal="true" aria-labelledby="mT"><div class="big-emoji" aria-hidden="true">🎉</div>
    <h2 id="mT">Tebrikler, kazandın!</h2>
    <p class="muted" style="margin:0">${esc(cp.brand)} logosunu <b>${(ms / 1000).toFixed(2)} sn</b>'de buldun. ${cp.offer ? esc(cp.offer) + "." : ""}</p>
    <div class="code-row"><span class="code" id="wonCode">${esc(cp.code)}</span><button class="btn dark" type="button" data-copy="${esc(cp.code)}">Kopyala</button></div>
    <p class="small muted" style="margin:0">Son kullanma: <b>${fmtDateTime(cp.expiresAt)}</b> (24 saat). Kupon Kuponlarım sayfasına kaydedildi.</p>
    <div class="actions">${brandUrl(cp) ? `<a class="btn primary" href="${esc(brandUrl(cp))}" target="_blank" rel="noopener" data-utm="${esc(cp.code)}">${esc(cp.brand)} sitesine git</a>` : ""}
    <a class="btn ghost" href="#/kuponlarim" data-close>Kuponlarım</a></div></div>`, render);
}

views.coupons = () => {
  if (!user()) return `<section class="section"><h1>Kuponlarım</h1><div class="empty"><b>Kuponlarını görmek için giriş yap</b><button class="btn primary" type="button" data-act="login">Giriş yap</button></div></section>`;
  const t = clock(), order = {active:0, used:1, expired:2};
  const list = Api.myCoupons().slice().sort((a, b) => order[couponStatus(a, t)] - order[couponStatus(b, t)] || b.issuedAt - a.issuedAt);
  return `<section class="section"><h1>Kuponlarım</h1><p class="muted" style="margin:0">Kupon kodunu kopyala, markanın sitesinde kampanyalı ürünü sepete ekleyip kodu gir. Kuponlar 24 saat geçerlidir.</p></section>
  ${list.length ? `<div class="grid-cards">${list.map(cp => { const st = couponStatus(cp, t), url = brandUrl(cp);
    return `<article class="card coupon ${st === "active" ? "" : "inactive"}">
      <div class="camp-top">${logo(cp.brand)}<div class="camp-meta"><span class="cat">${esc(CAT[cp.cat].name)} · ${fmtDateTime(cp.issuedAt)}</span><h3>${esc(cp.brand)}</h3>
      <span class="status ${st === "active" ? "st-active" : st === "used" ? "st-won" : "st-ended"}">${{active:"Kullanılabilir", used:"Kullanıldı", expired:"Süresi doldu"}[st]}</span></div></div>
      <p class="offer" style="margin:0">${cp.offer ? esc(cp.offer) : '<span class="tbd">Kampanya ürününde geçerli</span>'}</p>
      <div class="code-row"><span class="code">${esc(cp.code)}</span><button class="btn dark sm" type="button" data-copy="${esc(cp.code)}" ${st === "active" ? "" : "disabled"}>Kopyala</button></div>
      ${st === "active" ? `<div class="kv"><span>Kalan süre</span><b data-cd="${cp.expiresAt}">${fmtDur((cp.expiresAt - t.ms) / 1000)}</b></div>` :
        st === "used" ? `<div class="kv"><span>Kullanım</span><b>${fmtDateTime(cp.usedAt)}</b></div>` : `<div class="kv"><span>Son kullanma</span><b>${fmtDateTime(cp.expiresAt)}</b></div>`}
      ${st !== "active" ? "" : url ? `<a class="btn primary block" href="${esc(url)}" target="_blank" rel="noopener" data-utm="${esc(cp.code)}">${esc(cp.brand)} sitesine git</a>` :
        `<span class="btn ghost block" aria-disabled="true">Marka bağlantısı henüz eklenmedi</span>`}
    </article>`; }).join("")}</div>` :
    `<div class="empty"><b>Henüz kuponun yok</b><span>Aktif bir kampanyada logoyu 5 saniyede bul, kuponun burada görünsün.</span><a class="btn primary" href="#/">Aktif kampanyalar</a></div>`}`;
};

views.how = () => `<section class="prose">
  <h1>Nasıl çalışır?</h1>
  <h2>Kampanyalar</h2>
  <ul><li>Her kategoride her saat başı bir marka kampanyası açılır (ör. 00:00 Giyim: LC Waikiki).</li>
  <li>Kampanya belirlenen süre boyunca (10–30 dk) açık kalır.</li>
  <li>Her kampanyanın bir kişi kontenjanı vardır (5–50 kişi). Kontenjan dolduğunda ya da süre bittiğinde kampanya ana sayfadan otomatik kalkar ve kategoride de kapanır.</li></ul>
  <h2>Oyun</h2>
  <ol><li>Giriş yap ve aktif bir kampanya seç.</li><li><b>Başla</b>'ya bastığında kategorideki tüm marka logoları karışık sırayla ekrana gelir.</li>
  <li>Hedef markanın logosuna <b>5 saniye</b> içinde dokun.</li><li>Her kampanyada tek deneme hakkın var. Yanlış logo veya süre dolması hakkını bitirir.</li></ol>
  <h2>Kupon</h2>
  <ul><li>Kazandığında ekranda kişiye özel kupon kodu çıkar; tek dokunuşla kopyalayabilirsin.</li>
  <li>Kupon <b>Kuponlarım</b> sayfasına da kaydedilir.</li><li>Kuponu kazandıktan sonra <b>24 saat</b> içinde markanın sitesinde, kampanyalı üründe kullanmalısın.</li></ul>
  <h2>Sık sorulanlar</h2>
  <p><b>Neden tek hak var?</b> Sırayla tüm logolara dokunarak kazanmayı engellemek için.</p>
  <p><b>Kupon kodu başkasıyla paylaşılabilir mi?</b> Kod kişiye özeldir ve tek kullanımlıktır.</p>
  <p><b>Saatler hangi saat dilimine göre?</b> Türkiye saati (UTC+3).</p></section>`;

views.panel = () => {
  const t = clock(), all = db.coupons;
  const sel = store("lb:panelCat") || "all";
  const real = all.filter(x => !x.test), used = real.filter(x => x.usedAt);
  const sales = used.reduce((s, x) => s + x.sale, 0), comm = used.reduce((s, x) => s + x.commission, 0);
  const clicksOf = code => db.clicks.filter(k => k.code === code).length;
  const camps = CAMPS.filter(c => sel === "all" || c.cat === sel);
  return `<section class="section"><h1>Kupon takip</h1><p class="muted" style="margin:0">Platform yönetimi için prototip panel: kampanya doluluk, kupon kullanımı, UTM tıklamaları ve %${D.commissionRate * 100} komisyon.</p></section>
  <div class="stats">
    <div class="card stat"><span class="eyebrow">Verilen kupon</span><b>${real.length}</b></div>
    <div class="card stat"><span class="eyebrow">Kullanılan</span><b>${used.length}</b></div>
    <div class="card stat"><span class="eyebrow">Dönüşüm</span><b>${real.length ? Math.round(used.length / real.length * 100) : 0}%</b></div>
    <div class="card stat"><span class="eyebrow">UTM tıklama</span><b>${db.clicks.length}</b></div>
    <div class="card stat"><span class="eyebrow">Satış tutarı</span><b>${tl(sales)}</b></div>
    <div class="card stat"><span class="eyebrow">Komisyon (%${D.commissionRate * 100})</span><b>${tl(comm)}</b></div>
  </div>
  <section class="card section"><h2>Test araçları</h2>
    <form class="toolbar" data-form="demo"><div class="field"><label for="demoAt">Demo saati (Türkiye)</label><input id="demoAt" type="time" required value="${hhmm(t.h, t.mi)}"></div>
      <button class="btn dark" type="submit">Saati uygula</button><button class="btn ghost" type="button" data-act="realtime" ${demoOffset ? "" : "disabled"}>Gerçek saat</button>
      <button class="btn ghost" type="button" data-act="reset">Tüm verileri sıfırla</button></form>
    <p class="small muted" style="margin:0">Demo saati herhangi bir kampanyayı şimdi denemeni sağlar. "Doldur" düğmesi kontenjanı test katılımcılarıyla doldurur (kapanma davranışını görmek için).</p></section>
  <section class="section"><div class="sec-head"><h2>Bugünün kampanyaları</h2>
    <div class="field" style="min-width:180px"><label for="catSel">Kategori</label><select id="catSel" data-act="cat">${[["all", "Tümü"], ...D.categories.filter(c => CAMPS.some(x => x.cat === c.slug)).map(c => [c.slug, c.name])].map(([v, n]) => `<option value="${v}" ${v === sel ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div></div>
    <div class="tablewrap"><table><thead><tr><th>Saat</th><th>Kategori</th><th>Marka</th><th class="num">Süre</th><th class="num">Kazanan</th><th>Durum</th><th></th></tr></thead><tbody>
    ${camps.map(c => { const st = status(c, t);
      return `<tr class="${st === "active" ? "is-now" : ""}"><td class="nowrap">${hhmm(c.hour)}</td><td>${esc(CAT[c.cat].name)}</td><td><b>${esc(c.brand)}</b></td><td class="num nowrap">${c.durationMin} dk</td>
      <td class="num nowrap">${c.quota - remaining(c, t)} / ${c.quota}</td><td>${badge(st)}</td><td>${st === "active" ? `<button class="btn ghost sm" type="button" data-act="fill" data-id="${c.id}">Doldur</button>` : ""}</td></tr>`; }).join("")}
    </tbody></table></div></section>
  <section class="section"><div class="sec-head"><h2>Kuponlar</h2><button class="btn ghost sm" type="button" data-act="csv" ${all.length ? "" : "disabled"}>CSV indir</button></div>
    ${all.length ? `<div class="tablewrap"><table><thead><tr><th>Kod</th><th>Marka</th><th>Kullanıcı</th><th>Verildi</th><th>Durum</th><th class="num">Tık</th><th>Satış / komisyon</th></tr></thead><tbody>
    ${all.slice().reverse().map(cp => { const st = couponStatus(cp, t);
      return `<tr><td class="nowrap"><b>${esc(cp.code)}</b></td><td>${esc(cp.brand)}</td><td>${cp.test ? '<span class="muted">Test</span>' : esc(cp.name) + `<br><span class="small muted">${esc(fmtPhone(cp.phone))}</span>`}</td>
      <td class="nowrap">${fmtDateTime(cp.issuedAt)}</td><td>${{active:"Aktif", used:"Kullanıldı", expired:"Süresi doldu"}[st]}</td><td class="num">${clicksOf(cp.code)}</td>
      <td class="nowrap">${st === "used" ? `${tl(cp.sale)} / <b>${tl(cp.commission)}</b>` : st === "active" && !cp.test ?
        `<form data-form="redeem" data-code="${esc(cp.code)}" style="display:flex;gap:6px"><input class="salein" name="sale" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Satış ₺" aria-label="${esc(cp.code)} satış tutarı" required><button class="btn ghost sm" type="submit">Kullanıldı</button></form>` : "–"}</td></tr>`; }).join("")}
    </tbody></table></div>` : `<div class="empty"><b>Henüz kupon verilmedi</b></div>`}</section>`;
};

views.notFound = () => `<section class="section"><h1>Sayfa bulunamadı</h1><a class="btn dark" href="#/">Ana sayfaya dön</a></section>`;

/* ---------- modal, toast, kopyalama ---------- */
let modalClose = null;
function modal(html, onClose) {
  closeModal();
  const root = $("#modalRoot"), prev = document.activeElement;
  root.innerHTML = `<div class="scrim">${html}</div>`;
  const scrim = root.firstElementChild;
  scrim.addEventListener("click", e => { if (e.target === scrim || e.target.closest("[data-close]")) closeModal(); });
  modalClose = () => { root.innerHTML = ""; modalClose = null; onClose?.(); prev?.focus?.(); };
  (scrim.querySelector("input,button,a") || scrim).focus();
  return scrim;
}
function closeModal() { modalClose?.(); }
let toastT;
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2200); }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* izin yok ya da güvenli bağlam değil */ }
  const ta = Object.assign(document.createElement("textarea"), {value:text, readOnly:true});
  ta.style.cssText = "position:fixed;opacity:0;left:-9999px"; document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove(); return ok;
}
function loginModal() {
  const s = modal(`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="lT" data-form="login" novalidate>
    <h2 id="lT">Giriş yap</h2><p class="muted small" style="margin:0">Kuponların hesabına tanımlanır. Prototipte SMS doğrulaması yok; gerçek sürümde telefonla tek kullanımlık kod istenir.</p>
    <div class="field"><label for="lName">Ad soyad</label><input id="lName" name="name" autocomplete="name" required minlength="2" maxlength="60"></div>
    <div class="field"><label for="lPhone">Cep telefonu</label><input id="lPhone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="05xx xxx xx xx" required></div>
    <label class="check"><input type="checkbox" name="kvkk" required><span>KVKK aydınlatma metnini okudum, kampanya iletişimi için verilerimin işlenmesini kabul ediyorum.</span></label>
    <p class="err" id="lErr" role="alert"></p>
    <div class="actions"><button class="btn primary" type="submit">Devam et</button><button class="btn ghost" type="button" data-close>Vazgeç</button></div></form>`, render);
  s.querySelector("#lName").focus();
}
function accountModal() {
  const u = user();
  modal(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="aT"><h2 id="aT">${esc(u.name)}</h2><p class="muted" style="margin:0">${esc(fmtPhone(u.phone))}</p>
    <div class="actions"><a class="btn dark" href="#/kuponlarim" data-close>Kuponlarım</a><button class="btn ghost" type="button" data-act="logout">Çıkış yap</button></div></div>`, render);
}
function downloadCsv() {
  const head = ["kod", "kampanya", "kategori", "marka", "ad", "telefon", "verildi", "son_kullanma", "durum", "kullanildi", "satis_tl", "komisyon_tl", "utm_tiklama", "test"];
  const iso = ms => ms ? new Date(ms).toISOString() : "";
  const rows = db.coupons.map(cp => [cp.code, cp.campId, cp.cat, cp.brand, cp.name, cp.phone, iso(cp.issuedAt), iso(cp.expiresAt), couponStatus(cp), iso(cp.usedAt), cp.sale ?? "", cp.commission ?? "", db.clicks.filter(k => k.code === cp.code).length, cp.test ? 1 : 0]);
  const csv = "﻿" + [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const a = Object.assign(document.createElement("a"), {href:URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"})), download:`kuponlar-${clock().day}.csv`});
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- yönlendirme ve döngü ---------- */
let route = {name:"home", arg:null};
function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const map = {"":"home", kategori:"category", oyna:"play", kuponlarim:"coupons", nasil:"how", panel:"panel"};
  const name = map[parts[0] || ""];
  return name ? {name, arg:parts[1] || null} : {name:"notFound", arg:null};
}
let lastSig = "";
function signature() {
  const t = clock();
  return [route.name, route.arg, db.session, db.coupons.length, db.coupons.filter(x => x.usedAt).length, db.clicks.length,
    CAMPS.map(c => status(c, t)[0]).join(""), Api.myCoupons().map(x => couponStatus(x, t)[0]).join("")].join("|");
}
function render(focusMain = false) {
  if (game) return;
  const main = $("#main");
  main.innerHTML = views[route.name](route.arg);
  lastSig = signature();
  const navName = {home:"home", category:"home", play:"home", coupons:"coupons", how:"how", panel:"panel"}[route.name];
  document.querySelectorAll("[data-nav]").forEach(a => a.dataset.nav === navName ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  const titles = {home:"Kampanyalar", category:CAT[route.arg]?.name, play:campById(route.arg)?.brand, coupons:"Kuponlarım", how:"Nasıl çalışır", panel:"Kupon takip"};
  document.title = (titles[route.name] ? titles[route.name] + " · " : "") + "1 Milyonuncu Marka";
  updateChrome();
  if (focusMain) { main.focus({preventScroll:true}); window.scrollTo(0, 0); }
}
function updateChrome() {
  const u = user(), t = clock();
  $("#userBtn").textContent = u ? u.name.split(" ")[0] : "Giriş yap";
  const n = Api.myCoupons().filter(x => couponStatus(x, t) === "active").length;
  const cc = $("#couponCount"); cc.hidden = !n; cc.textContent = n;
  $("#demoBanner").hidden = !demoOffset;
  if (demoOffset) $("#demoTime").textContent = hhmm(t.h, t.mi);
}
function tick() {
  const t = clock();
  $("#clock").textContent = `${hhmm(t.h, t.mi)}:${pad(t.s)}`;
  if (demoOffset) $("#demoTime").textContent = hhmm(t.h, t.mi);
  if (game) return;
  if (signature() !== lastSig && !$("#modalRoot").children.length && !document.activeElement?.matches("input,select")) return render();
  document.querySelectorAll("[data-cd]").forEach(el => { el.textContent = fmtDur((+el.dataset.cd - t.ms) / 1000); });
}

window.addEventListener("hashchange", () => {
  if (game) { document.body.classList.remove("playing"); cancelAnimationFrame(game.raf); Api.timeout(game.key); game = null; toast("Oyundan çıktın, bu kampanyadaki hakkın kullanıldı."); }
  closeModal(); route = parseRoute(); render(true);
});
window.addEventListener("storage", e => { if (e.key === KEY) { db = load(); if (!game) render(); } if (e.key === "lb:demoOffset") { demoOffset = Number(e.newValue) || 0; render(); } });
document.addEventListener("keydown", e => { if (e.key === "Escape" && modalClose) closeModal(); });

document.addEventListener("click", async e => {
  const tile = e.target.closest("#board button[data-token]");
  if (tile && game && !game.done) return finish(tile);
  const cp = e.target.closest("[data-copy]");
  if (cp) { const ok = await copyText(cp.dataset.copy); cp.textContent = ok ? "Kopyalandı ✓" : "Kopyalanamadı"; toast(ok ? "Kupon kodu kopyalandı." : "Kopyalanamadı; kodu basılı tutup kopyala."); setTimeout(() => { if (cp.isConnected) cp.textContent = "Kopyala"; }, 1800); return; }
  const utm = e.target.closest("[data-utm]");
  if (utm) { const c = db.coupons.find(x => x.code === utm.dataset.utm); if (c) Api.click(c); return; }
  if (e.target.closest("#userBtn")) return user() ? accountModal() : loginModal();
  if (e.target.closest("#demoReset")) { demoOffset = 0; store("lb:demoOffset", null); return render(); }
  const act = e.target.closest("[data-act]"); if (!act || act.tagName === "SELECT") return;
  const a = act.dataset.act;
  if (a === "login") loginModal();
  else if (a === "logout") { Api.logout(); closeModal(); toast("Çıkış yapıldı."); }
  else if (a === "start") startGame(act.dataset.id);
  else if (a === "fill") { const n = Api.fillWithTestUsers(act.dataset.id); toast(`${n} test katılımcısı eklendi, kampanya kapandı.`); render(); }
  else if (a === "realtime") { demoOffset = 0; store("lb:demoOffset", null); render(); }
  else if (a === "csv") downloadCsv();
  else if (a === "reset") {
    modal(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="rT"><h2 id="rT">Tüm veriler silinsin mi?</h2><p class="muted" style="margin:0">Kullanıcılar, kuponlar ve deneme kayıtları bu tarayıcıdan silinir.</p>
      <div class="actions"><button class="btn primary" type="button" data-act="resetYes">Evet, sıfırla</button><button class="btn ghost" type="button" data-close>Vazgeç</button></div></div>`);
  } else if (a === "resetYes") { Api.reset(); closeModal(); toast("Veriler sıfırlandı."); render(); }
});
document.addEventListener("change", e => { if (e.target.matches("select[data-act=cat]")) { store("lb:panelCat", e.target.value); e.target.blur(); render(); } });
document.addEventListener("submit", e => {
  const f = e.target.closest("form[data-form]"); if (!f) return;
  e.preventDefault();
  if (f.dataset.form === "login") {
    const err = $("#lErr"), nameEl = f.name, phoneEl = f.phone;
    [nameEl, phoneEl].forEach(x => x.removeAttribute("aria-invalid"));
    if (!f.kvkk.checked) { err.textContent = "Devam etmek için KVKK onayı gerekli."; return; }
    const r = Api.login(nameEl.value, phoneEl.value);
    if (r.error === "name") { err.textContent = "Adını en az 2 harf olarak yaz."; nameEl.setAttribute("aria-invalid", "true"); nameEl.focus(); return; }
    if (r.error === "phone") { err.textContent = "Geçerli bir cep telefonu yaz (05xx xxx xx xx)."; phoneEl.setAttribute("aria-invalid", "true"); phoneEl.focus(); return; }
    closeModal(); toast(`Hoş geldin, ${r.user.name.split(" ")[0]}!`);
  } else if (f.dataset.form === "demo") {
    const [h, m] = f.querySelector("#demoAt").value.split(":").map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) { setDemoTime(h, m); document.activeElement?.blur(); render(); toast(`Demo saati ${hhmm(h, m)} olarak ayarlandı.`); }
  } else if (f.dataset.form === "redeem") {
    const r = Api.redeem(f.dataset.code, parseFloat(f.sale.value));
    if (r.error) return toast(r.error === "sale" ? "Satış tutarını gir." : "Bu kupon artık kullanılamaz.");
    document.activeElement?.blur(); toast(`Komisyon: ${tl(r.coupon.commission)}`); render();
  }
});

route = parseRoute();
render();
tick();
setInterval(tick, 1000);
})();
