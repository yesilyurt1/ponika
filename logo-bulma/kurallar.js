// 1 Milyonuncu Marka: ortak iş kuralları. Site (tarayıcı) ve sunucu (server.mjs) aynı dosyayı kullanır.
// data.js ve markalar.js'den sonra yüklenir; window.LB_KURALLAR'ı tanımlar.
(function (root) {
  "use strict";
  const D = root.LB_DATA, LIB = root.LB_MARKALAR || {};
  const CAT = Object.fromEntries(D.categories.map(c => [c.slug, c]));
  const money = n => Math.round(n * 100) / 100;
  // Aynı marka farklı yazılmışsa ("Jack Jones" / "Jack & Jones") tek marka sayılır; tahtada ikizi çıkmasın.
  const trKey = s => s.toLocaleLowerCase("tr").replace(/\s(&|and|ve)\s/g, " ").replace(/[^a-z0-9çğıöşü]/g, "");

  /* ---------- marka havuzları ---------- */
  const libNames = cat => (LIB[cat] || []).map(x => x.split("|")[0]);
  const uniq = list => { const seen = new Set(); return list.filter(n => { const k = trKey(n); return !seen.has(k) && seen.add(k); }); };
  const excelBrands = cat => D.campaigns.filter(c => c.cat === cat).map(c => c.brand);
  const ALL = uniq(D.categories.flatMap(c => [...excelBrands(c.slug), ...libNames(c.slug)]));
  // Kategorinin kendi markaları (kategori sayfasındaki logo duvarı)
  function ownBrands(cat) { return cat === "buyuk-firsat" ? ALL : uniq([...excelBrands(cat), ...libNames(cat)]); }
  // Oyun havuzu: kendi markaları + diğer kategorilerden çeldiriciler, en az D.minPool logo.
  // Bir kategoride 300 bilinen marka yoksa sayı uydurma markayla değil, diğer sektörlerin gerçek markalarıyla tamamlanır.
  const POOL = {};
  function poolOf(cat) {
    if (POOL[cat]) return POOL[cat];
    const own = ownBrands(cat), seen = new Set(own.map(trKey)), others = [];
    const order = D.categories.map(c => c.slug).filter(s => s !== cat);
    const lists = order.map(ownBrands);
    for (let i = 0; own.length + others.length < Math.max(D.minPool, own.length) && lists.some(l => i < l.length); i++)
      for (const l of lists) { const b = l[i]; if (b && !seen.has(trKey(b))) { seen.add(trKey(b)); others.push(b); } }
    return POOL[cat] = [...own, ...others];
  }

  /* ---------- kampanya koşulları ---------- */
  // Excel'de indirim oranı yazılı değilse kontenjana göre örnek oran: az kişiye büyük indirim.
  const pctByQuota = q => q <= 5 ? 40 : q <= 10 ? 30 : q <= 15 ? 25 : q <= 20 ? 20 : 15;
  function withRules(c) {
    const m = /%\s?(\d{1,2})/.exec(c.offer || "");
    const pct = c.rules?.pct ?? (m ? +m[1] : pctByQuota(c.quota));
    const rules = c.rules || {pct, newMember:D.newMemberBonus, tiers:[{min:1000, pct:pct + 5}, {min:2500, pct:pct + 10}]};
    const t = D.telafi;
    return Object.assign({}, c, {
      findSec:c.findSec || D.findSecDefault,
      offer:c.offer || `Seçili ürünlerde %${rules.pct} indirim`,
      products:c.products || (c.offer ? c.offer.replace(/\s*%\s?\d+.*$/, "").trim() || "Kampanyaya dahil seçili ürünler" : "Kampanyaya dahil seçili ürünler"),
      validHours:c.validHours || D.couponValidHours,
      rules,
      telafi:c.telafi || {low:Math.max(3, Math.round(rules.pct * t.lowShare)), ad:Math.max(5, Math.round(rules.pct * t.adShare)), paid:Math.round(rules.pct * t.paidShare), fee:t.fee, adSec:t.adSec}
    });
  }

  /* ---------- program: Excel + diğer kategoriler + her an açık demolar ---------- */
  // Excel'deki Giyim süre/kontenjan deseni diğer kategorilere de uygulanır.
  const pattern = D.campaigns.filter(c => c.cat === "giyim").sort((a, b) => a.hour - b.hour);
  const generated = [];
  for (const cat of D.categories) {
    if (D.campaigns.some(c => c.cat === cat.slug)) continue;
    const brands = ownBrands(cat.slug).slice(cat.slug === "buyuk-firsat" ? 7 : 0);
    if (!brands.length) continue;
    for (const p of pattern) {
      const mono = cat.slug === "buyuk-firsat" && (p.hour === 12 || p.hour === 20);
      generated.push({id:`${cat.slug}-${String(p.hour).padStart(2, "0")}`, cat:cat.slug, hour:p.hour, brand:brands[p.hour % brands.length],
        offer:null, findSec:D.findSecDefault, durationMin:p.durationMin, quota:p.quota, ...(mono ? {mono:true, title:"Muhteşem Fırsat"} : {})});
    }
  }
  // Her kategoride günün her saati açık bir demo kampanya (müşteri içlerinden seçer).
  const DEMO_BRAND = {giyim:"Civil", ayakkabi:"Hotiç", "ev-tekstil":"English Home", elektronik:"Samsung", gozluk:"Ray-Ban", canta:"Desa",
    supermarket:"Migros", saat:"Casio", bijuteri:"Pandora", kozmetik:"Flormar", cicek:"Çiçeksepeti", yemek:"Burger King", saglik:"Acıbadem",
    "cafe-hastane":"Kahve Dünyası", "buyuk-firsat":"Adidas"};
  const demos = D.categories.map(cat => ({
    id:`${cat.slug}-demo`, cat:cat.slug, hour:0, durationMin:1440, quota:1000, demo:true,
    brand:DEMO_BRAND[cat.slug] || ownBrands(cat.slug)[0],
    offer:null, findSec:D.findSecDefault,
    rules:cat.slug === "buyuk-firsat" ? {pct:35, newMember:D.newMemberBonus, tiers:[{min:1500, pct:40}, {min:3000, pct:50}]}
      : {pct:20, newMember:D.newMemberBonus, tiers:[{min:1000, pct:25}, {min:2500, pct:30}]},
    ...(cat.slug === "buyuk-firsat" ? {mono:true, title:"Muhteşem Fırsat"} : {})
  }));
  const CAMPS = [...demos, ...D.campaigns, ...generated].map(withRules);
  const campById = id => CAMPS.find(c => c.id === id);

  /* ---------- hesaplar ---------- */
  // İndirim: temel oran ya da sepet tutarına göre baremden yüksek olanı + yeni üye ek indirimi.
  function discount(rules, amount, newMember) {
    amount = Number(amount) || 0;
    let pct = rules.pct, tier = null;
    for (const t of rules.tiers || []) if (amount >= t.min && t.pct > pct) { pct = t.pct; tier = t; }
    const bonus = newMember ? (rules.newMember || 0) : 0;
    const totalPct = Math.min(90, pct + bonus), disc = money(amount * totalPct / 100);
    return {basePct:rules.pct, tierPct:tier ? tier.pct : null, tierMin:tier ? tier.min : null, bonusPct:bonus, totalPct, discount:disc, pay:money(amount - disc)};
  }
  const commission = paid => money(paid * D.commissionRate);
  // Telafi seçenekleri (kazanamayan müşteriye): düşük teklif, reklam izle, ücretli.
  const telafiOptions = c => [
    {kind:"low", pct:c.telafi.low, label:"Daha düşük indirimi kabul et", note:"Hemen, ücretsiz"},
    {kind:"ad", pct:c.telafi.ad, label:`Reklam izle (${c.telafi.adSec} sn)`, note:"Kısa bir reklamın sonunda"},
    {kind:"paid", pct:c.telafi.paid, label:`${c.telafi.fee} ₺ öde`, note:"Kampanyanın tam indirimi"}
  ];
  const winsOn = (coupons, phone, day) => coupons.filter(x => x.phone === phone && x.day === day && x.source === "oyun").length;
  const telafiOn = (coupons, phone, day) => coupons.filter(x => x.phone === phone && x.day === day && x.source === "telafi").length;
  const isNewMember = (coupons, phone) => !coupons.some(x => x.phone === phone && x.source === "oyun");

  // Kampanya linkleri: markanın sitesi + pazaryeri mağazaları (marka panelden ekler). UTM eklenir.
  function campaignLinks(c, code) {
    const list = (D.brandLinks && D.brandLinks[c.brand]) || [];
    const site = D.brandUrls && D.brandUrls[c.brand];
    // Demo: markanın pazaryeri mağaza linki yoksa pazaryerinde marka araması gösterilir (gerçekte marka kendi mağaza linkini girer).
    const market = D.marketplaceSearch ? [{ad:"Trendyol", url:`https://www.trendyol.com/sr?q=${encodeURIComponent(c.brand)}`},
      {ad:"Hepsiburada", url:`https://www.hepsiburada.com/ara?q=${encodeURIComponent(c.brand)}`}] : [];
    const all = [...(site ? [{ad:"Web sitesi", url:site}] : []), ...(list.length ? list : market)];
    return all.map(l => {
      try {
        const u = new URL(l.url);
        u.searchParams.set("utm_source", "1milyonuncumarka"); u.searchParams.set("utm_medium", "kupon");
        u.searchParams.set("utm_campaign", c.id); if (code) u.searchParams.set("utm_content", code);
        return {ad:l.ad, url:u.toString()};
      } catch { return null; }
    }).filter(Boolean);
  }

  root.LB_KURALLAR = {CAT, CAMPS, campById, ownBrands, poolOf, discount, commission, telafiOptions, winsOn, telafiOn, isNewMember, campaignLinks, money};
})(typeof window !== "undefined" ? window : globalThis);
