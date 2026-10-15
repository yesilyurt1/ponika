// 1 Milyonuncu Marka: ortak iş kuralları. Site (tarayıcı) ve sunucu (server.mjs) aynı dosyayı kullanır.
// data.js ve markalar.js'den sonra yüklenir; window.LB_KURALLAR'ı tanımlar.
(function (root) {
  "use strict";
  const D = root.LB_DATA, LIB = root.LB_MARKALAR || {};
  const CAT = Object.fromEntries(D.categories.map(c => [c.slug, c]));
  const money = n => Math.round(n * 100) / 100;
  const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const pad = n => String(n).padStart(2, "0");
  const hhmm = min => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
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
    const lists = D.categories.map(c => c.slug).filter(s => s !== cat).map(ownBrands);
    for (let i = 0; own.length + others.length < Math.max(D.minPool, own.length) && lists.some(l => i < l.length); i++)
      for (const l of lists) { const b = l[i]; if (b && !seen.has(trKey(b))) { seen.add(trKey(b)); others.push(b); } }
    return POOL[cat] = [...own, ...others];
  }

  /* ---------- kampanya açıklamaları: ürüne özel ---------- */
  // [kampanya cümlesindeki hali, geçerli ürünler satırındaki hali]
  const PRODUCTS = {
    giyim:[["Montlarda", "Seçili montlar"], ["Elbiselerde", "Seçili elbiseler"], ["Kot pantolonlarda", "Seçili kot pantolonlar"], ["Tişörtlerde", "Seçili tişörtler"], ["Ceketlerde", "Seçili ceketler"], ["Sweatshirtlerde", "Seçili sweatshirtler"], ["Takım elbiselerde", "Seçili takım elbiseler"], ["Çocuk giyimde", "Seçili çocuk ürünleri"]],
    ayakkabi:[["Spor ayakkabılarda", "Seçili spor ayakkabılar"], ["Botlarda", "Seçili botlar"], ["Sneaker modellerinde", "Seçili sneaker modelleri"], ["Topuklu ayakkabılarda", "Seçili topuklu ayakkabılar"], ["Çocuk ayakkabılarında", "Seçili çocuk ayakkabıları"], ["Terliklerde", "Seçili terlikler"]],
    "ev-tekstil":[["Nevresim takımlarında", "Seçili nevresim takımları"], ["Havlularda", "Seçili havlular"], ["Yemek takımlarında", "Seçili yemek takımları"], ["Tencere setlerinde", "Seçili tencere setleri"], ["Perdelerde", "Seçili perdeler"], ["Battaniyelerde", "Seçili battaniyeler"]],
    elektronik:[["Akıllı telefonlarda", "Seçili akıllı telefonlar"], ["Kulaklıklarda", "Seçili kulaklıklar"], ["Televizyonlarda", "Seçili televizyonlar"], ["Dizüstü bilgisayarlarda", "Seçili dizüstü bilgisayarlar"], ["Akıllı saatlerde", "Seçili akıllı saatler"], ["Süpürgelerde", "Seçili süpürgeler"]],
    gozluk:[["Güneş gözlüklerinde", "Seçili güneş gözlükleri"], ["Optik çerçevelerde", "Seçili optik çerçeveler"], ["Lenslerde", "Seçili lensler"]],
    canta:[["Sırt çantalarında", "Seçili sırt çantaları"], ["El çantalarında", "Seçili el çantaları"], ["Valizlerde", "Seçili valizler"], ["Cüzdanlarda", "Seçili cüzdanlar"]],
    supermarket:[["Kahvaltılıklarda", "Seçili kahvaltılık ürünler"], ["Temizlik ürünlerinde", "Seçili temizlik ürünleri"], ["Atıştırmalıklarda", "Seçili atıştırmalıklar"], ["İçeceklerde", "Seçili içecekler"], ["Bebek bezlerinde", "Seçili bebek bezleri"], ["Kişisel bakım ürünlerinde", "Seçili kişisel bakım ürünleri"]],
    saat:[["Kol saatlerinde", "Seçili kol saatleri"], ["Akıllı saatlerde", "Seçili akıllı saatler"], ["Kordonlarda", "Seçili kordonlar"]],
    bijuteri:[["Kolyelerde", "Seçili kolyeler"], ["Küpelerde", "Seçili küpeler"], ["Bilekliklerde", "Seçili bileklikler"], ["Yüzüklerde", "Seçili yüzükler"]],
    kozmetik:[["Parfümlerde", "Seçili parfümler"], ["Ruj ve dudak ürünlerinde", "Seçili dudak ürünleri"], ["Cilt bakımında", "Seçili cilt bakım ürünleri"], ["Fondötenlerde", "Seçili fondötenler"], ["Saç bakımında", "Seçili saç bakım ürünleri"], ["Güneş kremlerinde", "Seçili güneş kremleri"]],
    cicek:[["Buketlerde", "Seçili buketler"], ["Saksı çiçeklerinde", "Seçili saksı çiçekleri"], ["Orkidelerde", "Seçili orkideler"]],
    yemek:[["Menülerde", "Seçili menüler"], ["Pizzalarda", "Seçili pizzalar"], ["Burger menülerinde", "Seçili burger menüleri"], ["Tatlılarda", "Seçili tatlılar"]],
    saglik:[["Check-up paketlerinde", "Seçili check-up paketleri"], ["Vitaminlerde", "Seçili vitaminler"], ["Diş tedavilerinde", "Seçili diş tedavileri"], ["Göz muayenesinde", "Göz muayenesi"]],
    "cafe-hastane":[["Kahvelerde", "Seçili kahveler"], ["Tatlılarda", "Seçili tatlılar"], ["Kahvaltı menülerinde", "Seçili kahvaltı menüleri"], ["Muayene paketlerinde", "Seçili muayene paketleri"]],
    "buyuk-firsat":[["Tüm ürünlerde", "Kampanyaya dahil tüm ürünler"], ["Sezon ürünlerinde", "Seçili sezon ürünleri"], ["Çok satanlarda", "Seçili çok satan ürünler"]]
  };
  // Markaya özel ürün (demo ve bilinen markalar)
  const BRAND_PRODUCT = {Civil:["Bebek bezlerinde", "Seçili bebek bezleri"], "Burger King":["Whopper menülerde", "Whopper menüler"], "Kahve Dünyası":["Kahvelerde", "Seçili kahveler"],
    Samsung:["Galaxy telefonlarda", "Seçili Galaxy telefonlar"], "Ray-Ban":["Güneş gözlüklerinde", "Seçili güneş gözlükleri"], Migros:["Kahvaltılıklarda", "Seçili kahvaltılık ürünler"],
    Pandora:["Charm bilekliklerde", "Seçili charm bileklikler"], Casio:["G-Shock modellerinde", "Seçili G-Shock modelleri"], Flormar:["Ruj ve ojelerde", "Seçili ruj ve ojeler"],
    "English Home":["Nevresim takımlarında", "Seçili nevresim takımları"], Hotiç:["Botlarda", "Seçili botlar"], Desa:["Deri çantalarda", "Seçili deri çantalar"],
    "Çiçeksepeti":["Buketlerde", "Seçili buketler"], Acıbadem:["Check-up paketlerinde", "Seçili check-up paketleri"], Adidas:["Tüm ürünlerde", "Kampanyaya dahil tüm ürünler"]};

  /* ---------- kampanya koşulları ---------- */
  // Excel'de indirim oranı yazılı değilse kontenjana göre örnek oran: az kişiye büyük indirim.
  const pctByQuota = q => q <= 5 ? 40 : q <= 10 ? 30 : q <= 15 ? 25 : q <= 20 ? 20 : 15;
  // Ek koşullar her kampanyada yok: bazılarında yalnız temel indirim, bazılarında yeni üye eki ve/veya barem.
  function rulesFor(c, pct) {
    if (c.rules) return c.rules;
    const v = hash(c.id) % 4;
    return {pct, newMember:v === 1 || v === 3 ? D.newMemberBonus : 0, tiers:v >= 2 ? [{min:1000, pct:pct + 5}, {min:2500, pct:pct + 10}] : []};
  }
  // Aynı kategoride farklı türde markalar var (market zinciri / üretici, kafe / hastane, pizzacı / dönerci...):
  // üründen anlamsız eşleşme çıkmasın diye ürün listesi markanın türüne göre seçilir.
  const P = (loc, nom) => [loc, nom];
  const BRAND_GROUPS = [
    [["Pınar", "Sütaş", "İçim"], [P("Süt ürünlerinde", "Seçili süt ürünleri"), P("Peynirlerde", "Seçili peynirler")]],
    [["Ülker", "Eti", "Torku"], [P("Bisküvi ve çikolatalarda", "Seçili bisküvi ve çikolatalar"), P("Atıştırmalıklarda", "Seçili atıştırmalıklar")]],
    [["Coca-Cola", "Pepsi", "Uludağ", "Beypazarı", "Erikli", "Hayat Su", "Saka", "Kızılay"], [P("İçeceklerde", "Seçili içecekler")]],
    [["Lipton", "Çaykur", "Doğuş Çay", "Doğadan", "Kurukahveci Mehmet Efendi", "Jacobs", "Nescafé", "Nespresso", "Lavazza", "Illy", "Segafredo"], [P("Çay ve kahvelerde", "Seçili çay ve kahveler")]],
    [["Tat", "Tamek", "Tukaş"], [P("Salça ve konservelerde", "Seçili salça ve konserveler")]],
    [["Knorr", "Maggi"], [P("Çorba ve bulyonlarda", "Seçili çorba ve bulyonlar")]],
    [["Filiz", "Barilla", "Nuh'un Ankara", "Oba"], [P("Makarnalarda", "Seçili makarnalar")]],
    [["Bağdat Baharat"], [P("Baharatlarda", "Seçili baharatlar")]], [["Bizim Yağ"], [P("Sıvı yağlarda", "Seçili sıvı yağlar")]], [["Nestlé"], [P("Seçili Nestlé ürünlerinde", "Seçili Nestlé ürünleri")]],
    [["Acıbadem", "Memorial", "Medicana", "Medical Park", "Liv Hospital", "Florence Nightingale", "Amerikan Hastanesi", "Koç Üniversitesi Hastanesi", "Medipol", "Bayındır Hastanesi", "Anadolu Sağlık Merkezi", "Kolan Hastanesi", "Medline", "Avrupa Şafak", "Emsey Hastanesi"],
      [P("Check-up paketlerinde", "Seçili check-up paketleri"), P("Muayene paketlerinde", "Seçili muayene paketleri"), P("Diş tedavilerinde", "Seçili diş tedavileri")]],
    [["Dünya Göz"], [P("Göz muayenesinde", "Göz muayenesi"), P("Lazer göz tedavisinde", "Lazer göz tedavisi")]],
    [["Düzen Laboratuvarları", "Synlab"], [P("Tahlil paketlerinde", "Seçili tahlil paketleri")]],
    [["Solgar", "Nature's Supreme", "Ocean", "Orzax", "Supradyn", "Centrum"], [P("Vitaminlerde", "Seçili vitaminler"), P("Takviye ürünlerinde", "Seçili takviye ürünleri")]],
    [["Domino's Pizza", "Pizza Hut", "Little Caesars", "Papa John's", "Sbarro", "Pasaport Pizza", "Pizzabulls"], [P("Pizzalarda", "Seçili pizzalar"), P("Menülerde", "Seçili menüler")]],
    [["Burger King", "McDonald's", "KFC", "Popeyes", "Carl's Jr.", "Shake Shack", "Arby's"], [P("Burger menülerinde", "Seçili burger menüleri"), P("Menülerde", "Seçili menüler")]],
    [["Yemeksepeti", "Getir Yemek", "Trendyol Yemek", "Migros Yemek"], [P("Restoran siparişlerinde", "Seçili restoran siparişleri")]],
    [["Mado", "Hafız Mustafa 1864", "Koska", "Saray Muhallebicisi", "Pelit Pastanesi", "Divan Pastaneleri", "Baylan", "Godiva", "Vakko Patisserie", "Chocolabs", "Krispy Kreme", "Dunkin'"], [P("Tatlılarda", "Seçili tatlılar"), P("Kahvelerde", "Seçili kahveler")]]
  ];
  const GROUP_OF = new Map(BRAND_GROUPS.flatMap(([bs, list]) => bs.map(b => [b, list])));
  // Grupta olmayan markalar için kategoriye göre ürünü anlamsız olan seçenekleri ayıkla
  const CAT_EXCLUDE = {"cafe-hastane":["Muayene paketlerinde"], yemek:["Pizzalarda", "Burger menülerinde"], supermarket:[], saglik:["Vitaminlerde"]};
  function productList(c) {
    if (GROUP_OF.has(c.brand)) return GROUP_OF.get(c.brand);
    const base = PRODUCTS[c.cat] || PRODUCTS["buyuk-firsat"], ex = CAT_EXCLUDE[c.cat] || [];
    return base.filter(x => !ex.includes(x[0]));
  }
  function finalize(c) {
    const m = /%\s?(\d{1,2})/.exec(c.offer || "");
    const pct = c.rules?.pct ?? (m ? +m[1] : pctByQuota(c.quota));
    const rules = rulesFor(c, pct), t = D.telafi;
    const prodList = productList(c);
    const [loc, nom] = BRAND_PRODUCT[c.brand] && (c.demo || !c.offer) ? BRAND_PRODUCT[c.brand] : prodList[hash(c.id + c.brand) % prodList.length];
    return Object.assign({}, c, {
      findSec:c.findSec || D.findSecDefault,
      offer:c.offer || `${loc} %${rules.pct} indirim`,
      products:c.products || (c.offer ? c.offer.replace(/\s*%\s?\d+.*$/, "").trim() : nom),
      validHours:c.validHours || D.couponValidHours,
      boardSize:c.mono ? D.boardSizeMf : D.boardSize,
      rules,
      telafi:c.telafi || {low:Math.max(3, Math.round(rules.pct * t.lowShare)), ad:Math.max(5, Math.round(rules.pct * t.adShare)), paid:Math.round(rules.pct * t.paidShare), fee:t.fee, adSec:t.adSec}
    });
  }

  /* ---------- program ---------- */
  // start: günün dakikası (00:00 = 0). durationMin: en fazla D.maxDurationMin (180). Demolar saatsizdir (sayaç yok).
  // Excel'deki 3 kategori saat başı; diğerleri farklı aralık (15/30/60 dk) ve farklı dakikadan başlar.
  const quotas = D.campaigns.filter(c => c.cat === "giyim").sort((a, b) => a.hour - b.hour).map(c => c.quota);
  const excel = D.campaigns.map(c => ({...c, start:c.hour * 60}));
  const generated = [];
  for (const cat of D.categories) {
    if (D.campaigns.some(c => c.cat === cat.slug)) continue;
    const plan = D.schedules[cat.slug] || {every:60, offset:0, durations:[30, 60]};
    const brands = ownBrands(cat.slug).slice(cat.slug === "buyuk-firsat" ? 7 : 0);
    let i = 0;
    for (let start = plan.offset; start < 1440; start += plan.every, i++) {
      const dur = Math.min(plan.durations[i % plan.durations.length], D.maxDurationMin, 1440 - start);
      const mono = (plan.mf || []).includes(start);
      generated.push({id:`${cat.slug}-${hhmm(start).replace(":", "")}`, cat:cat.slug, start, brand:brands[i % brands.length], offer:null,
        durationMin:dur, quota:quotas[i % quotas.length], ...(mono ? {mono:true, title:"Muhteşem Fırsat"} : {})});
    }
  }
  // Her kategoride günün her saati açık bir demo kampanya (başlangıç saati yok, sayaç gösterilmez).
  const DEMO_BRAND = {giyim:"Civil", ayakkabi:"Hotiç", "ev-tekstil":"English Home", elektronik:"Samsung", gozluk:"Ray-Ban", canta:"Desa",
    supermarket:"Migros", saat:"Casio", bijuteri:"Pandora", kozmetik:"Flormar", cicek:"Çiçeksepeti", yemek:"Burger King", saglik:"Acıbadem",
    "cafe-hastane":"Kahve Dünyası", "buyuk-firsat":"Adidas"};
  const demos = D.categories.map(cat => ({
    id:`${cat.slug}-demo`, cat:cat.slug, start:0, durationMin:1440, quota:1000, demo:true, brand:DEMO_BRAND[cat.slug] || ownBrands(cat.slug)[0], offer:null,
    rules:cat.slug === "buyuk-firsat" ? {pct:35, newMember:D.newMemberBonus, tiers:[{min:1500, pct:40}, {min:3000, pct:50}]}
      : cat.slug === "giyim" ? {pct:20, newMember:D.newMemberBonus, tiers:[{min:1000, pct:25}, {min:2500, pct:30}]} : null,
    ...(cat.slug === "buyuk-firsat" ? {mono:true, title:"Muhteşem Fırsat"} : {})
  })).map(c => c.rules ? c : (delete c.rules, c));
  const CAMPS = [...demos, ...excel, ...generated].map(finalize);
  const BY_ID = new Map(CAMPS.map(c => [c.id, c]));
  const campById = id => BY_ID.get(id);
  // Pencere (gün içi saniye). Demolarda tüm gün.
  const win = c => ({start:c.start * 60, end:(c.start + c.durationMin) * 60});

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
  // Telafi seçenekleri (kazanamayan müşteriye): düşük teklif, reklam izle, ücretli. Kampanya başına bir kez.
  const telafiOptions = c => [
    {kind:"low", pct:c.telafi.low, label:"Daha düşük indirimi kabul et", note:"Hemen, ücretsiz"},
    {kind:"ad", pct:c.telafi.ad, label:`Reklam izle (${c.telafi.adSec} sn)`, note:"Kısa bir reklamın sonunda"},
    {kind:"paid", pct:c.telafi.paid, label:`${c.telafi.fee} ₺ öde`, note:"Kampanyanın tam indirimi"}
  ];
  const isNewMember = (coupons, phone) => !coupons.some(x => x.phone === phone && x.source === "oyun");
  // Muhteşem Fırsat tahtası ekrana göre 50-55 logo; normal kampanyalar 30.
  const boardSizeFor = (c, hint) => c.mono ? Math.max(D.boardSizeMfMin, Math.min(D.boardSizeMf, Number(hint) || D.boardSizeMf)) : c.boardSize;

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
  // Arama: kategori adı, marka ve ürün/kampanya açıklamasında (Türkçe harf ve büyük/küçük harf duyarsız)
  const norm = s => String(s).toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
  // Türkçe ekleri tolere eder: "bebek bezi" → "bebek bezlerinde", "güneş gözlüğü" → "güneş gözlüklerinde".
  // Kelimeler yan yana geçen (öbek) sonuçlar varsa yalnız onlar gösterilir; yoksa tüm kelimeleri içerenler.
  function search(q) {
    const n = norm(q).trim(); if (n.length < 2) return {cats:[], camps:[]};
    const SUF = ["lerinde", "larinda", "leri", "lari", "ler", "lar", "nde", "nda", "si", "su", "de", "da", "i", "u"];
    const toks = n.split(/[^a-z0-9]+/).filter(x => x.length >= 2).map(tk => {
      const st = [tk, ...SUF.filter(x => tk.endsWith(x) && tk.length - x.length >= 3).map(x => tk.slice(0, -x.length))];
      return [...st, ...st.filter(x => /[gb]$/.test(x)).map(x => x.slice(0, -1) + (x.endsWith("g") ? "k" : "p"))];   // ğ/k, b/p yumuşaması
    });
    const words = text => norm(text).split(/[^a-z0-9]+/).filter(Boolean);
    const tokHit = (w, alts) => alts.some(a => w.startsWith(a));
    const phrase = ws => ws.some((_, i) => toks.every((alts, k) => ws[i + k] && tokHit(ws[i + k], alts)));
    const all = ws => toks.every(alts => ws.some(w => tokHit(w, alts)));
    // Öncelik: aranan metnin aynen geçtiği sonuçlar → kelimelerin yan yana geçtiği sonuçlar → tüm kelimeleri içerenler
    const pick = (list, txt) => {
      const exact = list.filter(x => norm(txt(x)).includes(n)); if (exact.length) return exact;
      if (!toks.length) return [];
      const ws = list.map(x => words(txt(x))), p = list.filter((_, i) => phrase(ws[i]));
      return p.length ? p : list.filter((_, i) => all(ws[i]));
    };
    return {cats:pick(D.categories, c => c.name), camps:pick(CAMPS, c => `${c.brand} ${c.offer} ${c.products} ${CAT[c.cat].name} ${c.title || ""}`)};
  }

  root.LB_KURALLAR = {CAT, CAMPS, campById, win, hhmm, ownBrands, poolOf, discount, commission, telafiOptions, isNewMember, boardSizeFor, campaignLinks, search, money};
})(typeof window !== "undefined" ? window : globalThis);
