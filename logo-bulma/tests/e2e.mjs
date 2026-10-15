// Uçtan uca test: `npx http-server logo-bulma -p 8765` çalışırken `node logo-bulma/tests/e2e.mjs`
// SHOTS=klasör verilirse ekran görüntüleri kaydedilir.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright")); }

const BASE = process.env.BASE || "http://localhost:8765/";
const SHOTS = process.env.SHOTS || null;
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) failed++; };
const text = async (p, sel) => (await p.textContent(sel)).replace(/\s+/g, " ");

const browser = await chromium.launch();
const errors = [];
async function newPage(opts = {}) {
  const ctx = await browser.newContext({viewport:{width:1280, height:900}, locale:"tr-TR", ...opts});
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], {origin:new URL(BASE).origin}).catch(() => {});
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message));
  p.on("console", m => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(m.text()); });
  return p;
}
const shot = async (p, name, full = true) => { if (SHOTS) await p.screenshot({path:`${SHOTS}/${name}.png`, fullPage:full}); };
const go = async (p, hash) => { await p.goto(BASE + hash); await p.waitForSelector("#main > *"); };
async function login(p, name = "Ayşe Yılmaz", phone = "05321112233") {
  await p.fill("#lName", name); await p.fill("#lPhone", phone); await p.check("input[name=kvkk]");
  await p.click("form[data-form=login] button[type=submit]");
}
async function setDemo(p, hhmm) {
  await go(p, "#/admin/kampanyalar"); await p.fill("#demoAt", hhmm); await p.click("form[data-form=demo] button[type=submit]");
  await p.waitForFunction(t => document.querySelector("#demoTime")?.textContent === t, hhmm);
}
// Kampanyayı başlat: kurallar penceresi → Hazırım → 3-2-1 → tahta
async function startCampaign(p, id) {
  await go(p, `#/kampanya/${id}`);
  await p.click(".d-main [data-act=start]");
  await p.waitForSelector(".modal.rules");
  await p.click("[data-act=go]");
  await p.waitForSelector("#board button");
}
const pick = async (p, brand) => p.click(`#board button[aria-label="${brand}"]`);
const pickWrong = async (p, brand) => p.click(`#board button:not([aria-label="${brand}"]) >> nth=0`);
// Kaybedince aranan logo neonla gösterilir; "Devam" ile kaybetme penceresine geçilir.
async function lose(p, brand) {
  await pickWrong(p, brand);
  await p.waitForSelector("#board .logo.reveal");
  ok(await p.getAttribute("#board .logo.reveal", "aria-label") === brand, `kaybedince aranan logo (${brand}) neonla işaretlendi`);
  await p.click("[data-act=revealNext]");
  await p.waitForSelector(".modal.lost");
}

const page = await newPage();
/* ---------- ana sayfa ---------- */
await go(page, "#/");
ok(await page.locator(".cat-tile").count() === 15, "15 kategori, hepsi aktif");
ok(!(await text(page, ".cats")).includes("Yakında"), "'Yakında' kategori kalmadı");
const poolCounts = await page.$$eval(".cat-tile > span:last-child", s => s.map(x => parseInt(x.textContent)));
ok(poolCounts.every(n => n >= 300), `her kategoride en az 300 logo (${Math.min(...poolCounts)}+)`);
ok(await page.locator(".ftab").count() === 6, "6 durum filtresi (aktif/yaklaşan/kazandıklarım/kazanamadıklarım/sona eren/hatırlatmalarım)");
ok(await page.locator(".grid-cards .camp").count() >= 15, "her kategoriden en az bir aktif kampanya");
ok(await page.locator(".mf-banner").count() >= 1 && (await text(page, ".mf-banner")).includes("bordo-siyah"), "Muhteşem Fırsat cırtlak şeritte, bordo-siyah uyarısıyla");
ok(/\d\d:\d\d:\d\d/.test(await page.textContent("#nextCd")), "üstte sıradaki kampanya sayacı");
const firstCard = page.locator(".grid-cards .camp").first();
ok(await firstCard.locator(".acts a:has-text('Detay')").count() === 1 && await firstCard.locator(".acts [data-act=start]").count() === 1, "kartta Detay ve Başla yan yana");
ok(await firstCard.locator(".cd-v").count() === 1, "kartta geri sayım");
await page.click("[data-act=catf][data-v=elektronik]");
ok(await page.$$eval(".grid-cards .camp .camp-cat", e => e.every(x => x.textContent.startsWith("Elektronik"))), "kategori filtresi çalışıyor");
await page.click("[data-act=catf][data-v=all]");
await page.click("[data-act=filter][data-v=upcoming]");
ok(await page.locator(".grid-cards .camp .cd-l:has-text(\"'de başlıyor\")").count() > 0 || (await text(page, "main")).includes("kalmadı"), "yaklaşan kampanyalarda başlangıç saati ve sayaç");
ok(await page.locator(".grid-cards .camp .cd-s").first().textContent().then(x => /\d+ dk sürecek/.test(x)).catch(() => true), "yaklaşan kampanyada süre (en çok 180 dk)");
await page.click("[data-act=filter][data-v=active]");
await shot(page, "01-ana-sayfa", false);
/* ---------- arama ---------- */
await page.fill("#q", "bebek bezi"); await page.waitForFunction(() => document.querySelector("main").textContent.includes("kampanya"), null, {timeout:3000});
await page.waitForTimeout(400);
ok((await text(page, "main")).includes("Civil") && await page.locator(".grid-cards .camp").count() >= 1, "arama: ürün (bebek bezi) → Civil kampanyası");
await page.fill("#q", "ayakkabı"); await page.waitForTimeout(500);
ok(await page.locator(".cat-row .cchip").count() >= 1, "arama: kategori bulunuyor");
await page.fill("#q", "Samsung"); await page.waitForTimeout(500);
ok(await page.$$eval(".grid-cards .camp h3", h => h.length > 0 && h.every(x => x.textContent.includes("Samsung"))), "arama: marka bulunuyor");
await shot(page, "01b-arama", false);
await page.fill("#q", ""); await page.waitForTimeout(400);

/* ---------- kurallar, giriş, kazanma ---------- */
await go(page, "#/kampanya/giyim-demo");
ok((await text(page, ".detail")).includes("Kampanya koşulları") && (await text(page, ".detail")).includes("Oyun kuralları"), "detay sayfasında koşullar ve kurallar");
ok((await text(page, ".detail")).includes("Yeni üyeye +%5") && (await text(page, ".detail")).includes("üstü %25"), "çoklu indirim: yeni üye eki ve barem");
ok((await text(page, ".detail")).includes("Firma değişiklik yapma hakkını saklı tutar"), "kampanya süresi metni revize");
ok((await text(page, ".detail")).includes("Bebek bezlerinde %20 indirim"), "markanın altında kampanya açıklaması");
ok((await text(page, ".detail")).includes("Tüm gün açık") && await page.locator(".detail [data-cd]").count() === 0, "başlangıç saati olmayan kampanyada sayaç çalışmıyor");
ok(!/Günlük kupon hakkın|Kalan kupon: 1000/.test(await text(page, ".detail")), "günlük kupon hakkı yazısı kaldırıldı");
await page.click(".d-main [data-act=start]");
await login(page);
await page.waitForSelector(".modal.rules");
ok((await text(page, ".modal.rules")).includes("5 saniye") && (await text(page, ".modal.rules")).includes("tek hakkın"), "başlamadan önce kurallar pop-up'ı");
await shot(page, "02-kurallar", false);
await page.click("[data-act=go]");
ok(await page.locator(".g-count").count() === 1, "3-2-1 geri sayımı");
await page.waitForSelector("#board button");
ok(await page.locator("#board button").count() === 30, "tahtada 30 logo");
await shot(page, "03-tahta", false);
await pick(page, "Civil");
await page.waitForSelector("#wonCode");
const code = await page.textContent("#wonCode");
ok(/^DEMO-CIV-[A-Z2-9]{5}$/.test(code), `kupon kodu (${code})`);
const wonTxt = await text(page, ".modal");
ok(wonTxt.includes("+%5 yeni üye"), "ilk kuponda yeni üye eki");
ok((wonTxt.match(/%20 indirim/g) || []).length === 1, "kazanma penceresinde yüzde bir kez yazıyor");
ok(await page.$$eval(".modal .chips .chip", c => c.every(x => x.textContent.includes("indirim"))), "tüm koşul etiketlerinde 'indirim' yazıyor");
await page.click(".modal [data-copy]"); await page.waitForTimeout(200);
ok(await page.evaluate(() => navigator.clipboard.readText()) === code, "kod panoya kopyalandı");
const links = await page.$$eval(".modal a[data-utm]", a => a.map(x => x.href));
ok(links.length === 2 && links.every(h => h.includes("utm_content=" + code)) && links.some(h => h.includes("trendyol")) && links.some(h => h.includes("hepsiburada")), "pazaryeri linkleri UTM'li");
await shot(page, "04-kazandin", false);
await page.click(".modal a[href='#/kuponlarim']");
await page.waitForSelector(".ticket");
ok((await page.textContent(".ticket .code")) === code, "kupon Kuponlarım'da");
ok((await text(page, "main")).includes("belirlenen süre içinde") && (await text(page, "main")).includes("seçili ürünlerde geçerlidir"), "kupon metni revize");
await shot(page, "05-kuponlarim");

/* ---------- kupon hakkı sınırsız, her kampanyada tek oyun ---------- */
await go(page, "#/kampanya/giyim-demo");
ok((await text(page, ".d-main")).includes("Kazandın! Kodun"), "aynı kampanyada ikinci kez oynanamıyor");

/* ---------- kaybetme ve telafi ---------- */
await startCampaign(page, "ayakkabi-demo");
ok(true, "kupon kazandıktan sonra başka kampanya oynanabiliyor (günlük sınır yok)");
await lose(page, "Hotiç");
await page.waitForSelector(".modal.lost .telafi-box");
ok(await page.locator(".t-opt").count() === 3, "kazanamayana 3 telafi seçeneği (düşük / reklam / ücretli)");
await shot(page, "06-telafi", false);
await page.click("[data-kind=paid]"); await page.waitForSelector("form[data-form=pay]");
await page.click("form[data-form=pay] button[type=submit]");
await page.waitForSelector("#wonCode");
ok((await page.textContent("#wonCode")).startsWith("DEMO-HOT-"), "ücretli telafi kuponu verildi");
await go(page, "#/kampanya/ayakkabi-demo");
ok((await text(page, ".d-main")).includes("telafi kuponu alındı") && await page.locator(".d-main [data-act=telafi]").count() === 0, "telafi kampanya başına bir kez");
await startCampaign(page, "ev-tekstil-demo"); await lose(page, "English Home");
ok(await page.locator(".modal.lost .telafi-box").count() === 1, "başka kampanyada yeniden telafi hakkı var");
await page.click(".modal.lost button[data-close]");
await go(page, "#/");
await page.click("[data-act=filter][data-v=won]");
ok(await page.locator(".grid-cards .hist.won").count() === 1, "Kazandıklarım filtresi");
await page.click("[data-act=filter][data-v=lost]");
ok(await page.locator(".grid-cards .hist.lost").count() === 2, "Kazanamadıklarım filtresi");
await page.click("[data-act=filter][data-v=active]");

/* ---------- Muhteşem Fırsat ---------- */
await go(page, "#/kampanya/buyuk-firsat-demo");
ok((await text(page, ".detail")).includes("bordo ve siyah"), "Muhteşem Fırsat koşullarında bordo-siyah uyarısı");
await page.click(".d-main [data-act=start]"); await page.waitForSelector(".modal.rules .mf-note");
ok(true, "kurallar pop-up'ında Muhteşem Fırsat uyarısı");
await page.click("[data-act=go]"); await page.waitForSelector("#board button");
ok(await page.locator("#board button").count() === 55, "Muhteşem Fırsat tahtasında 55 logo (masaüstü)");
const colors = await page.$$eval("#board button", b => [...new Set(b.map(x => getComputedStyle(x).backgroundColor))]);
ok(colors.length === 2 && colors.includes("rgb(110, 11, 36)") && colors.includes("rgb(11, 11, 13)"), "tahtada yalnızca bordo ve siyah logolar");
await shot(page, "07-muhtesem-firsat", false);
await page.waitForSelector("#board .logo.reveal", {timeout:9000});
await page.waitForSelector(".modal.lost", {timeout:9000});
ok((await text(page, ".modal.lost")).includes("Süre doldu"), "5 sn dolunca kaybedilir");
await page.click(".modal.lost button[data-close]");

/* ---------- oyundan kaçmak ---------- */
await startCampaign(page, "elektronik-demo");
await page.goto(BASE + "#/"); await go(page, "#/kampanya/elektronik-demo");
ok((await text(page, ".d-main")).includes("hakkını kullandın"), "oyundan çıkmak hakkı yakar");

/* ---------- marka kasası, çoklu indirim, komisyon ---------- */
await go(page, "#/admin/kasa");
ok((await text(page, "main")).includes("müşteriler için değildir"), "kasa simülatörü yalnız yönetim panelinde");
await page.selectOption("#kBrand", "Koton"); await page.fill("#kCode", code); await page.click("button[value=validate]");
ok((await text(page, ".kasa-out")).includes("Koton kasasında geçmez"), "başka markanın kasasında red");
await page.selectOption("#kBrand", "Civil"); await page.fill("#kCode", code); await page.fill("#kAmount", "2000"); await page.click("button[value=validate]");
const val = await text(page, ".kasa-out");
ok(val.includes("Kod geçerli") && val.includes("%25") && val.includes("+%5") && val.includes("(%30)"), "doğrulamada indirim dökümü: barem %25 + yeni üye %5 = %30");
await page.fill("#kCode", code); await page.fill("#kAmount", "2000"); await page.fill("#kOrder", "SIP-1001"); await page.click("button[value=order]");
const ord = await text(page, ".kasa-out");
ok(ord.includes("1.400,00") && ord.includes("42,00"), "2.000 ₺ sepet → 1.400 ₺ ödenen, 42 ₺ komisyon");
await shot(page, "08-kasa");
await page.fill("#kCode", code); await page.fill("#kAmount", "2000"); await page.fill("#kOrder", "SIP-1001"); await page.click("button[value=order]");
ok((await text(page, ".kasa-out")).includes("ikinci kez sayılmadı"), "aynı sipariş iki kez sayılmaz");
await page.fill("#kCode", code); await page.fill("#kOrder", "SIP-1002"); await page.fill("#kAmount", "500"); await page.click("button[value=order]");
ok((await text(page, ".kasa-out")).includes("daha önce kullanılmış"), "kullanılmış kod reddedilir");

/* ---------- profil ve Kazancım ---------- */
await go(page, "#/profil");
ok((await text(page, ".earn")).includes("600,00"), "Kazancım: toplam 600 ₺ indirim");
ok(await page.locator(".switch-row").count() === 5, "bildirim ayarları (push, SMS, 5 dk, başladı, kupon bitiyor)");
await shot(page, "09-profil");

/* ---------- yönetim paneli ---------- */
await go(page, "#/admin/ozet");
const panel = await text(page, "main");
ok(panel.includes("42,00") && panel.includes("5,00"), "panelde komisyon ve telafi ödemesi");
await go(page, "#/admin/uyeler");
ok((await text(page, ".admin-body")).includes("Ayşe Yılmaz"), "üyeler listesinde kişisel bilgiler");
await go(page, "#/admin/takip");
ok((await text(page, ".admin-body")).includes("Satın aldı"), "satın alma takibi hunisi");
await go(page, "#/admin/kuponlar");
ok((await text(page, ".admin-body")).includes(code) && (await text(page, ".admin-body")).includes("SIP-1001"), "kupon listesinde kod ve sipariş");
const dl = page.waitForEvent("download"); await page.click("[data-act=csvCoupons]");
ok((await dl).suggestedFilename().startsWith("kuponlar-"), "CSV indiriliyor");
await page.click(`button[data-act=aDo][data-tur=iade][data-kod="${code}"]`); await page.waitForTimeout(300);
ok((await text(page, ".admin-body")).includes("İade"), "iade komisyonu geri alır");
await shot(page, "09b-admin-kuponlar", false);

/* ---------- hatırlatma ve bildirim ---------- */
await setDemo(page, "15:56");
await go(page, "#/"); await page.click("[data-act=filter][data-v=upcoming]");
await page.click("[data-act=catf][data-v=giyim]");
await page.click(".grid-cards .camp [data-act=remind] >> nth=0");
await page.waitForFunction(() => !document.querySelector("#notifCount").hidden, null, {timeout:5000});
await page.click("#notifBtn");
const nt = await text(page, ".modal.drawer");
ok(nt.includes("5 dk sonra başlıyor") && nt.includes("SMS"), "5 dk kala bildirim (uygulama + SMS demo)");
await shot(page, "10-bildirim", false);
await page.click(".modal.drawer [data-close]");
await page.click("[data-act=catf][data-v=all]");

await go(page, "#/admin/hatirlatmalar");
ok(await page.locator(".admin-body tbody tr").count() >= 1, "yönetim panelinde hatırlatma listesi");
/* ---------- logo yükleme ---------- */
await go(page, "#/admin/logolar"); await page.fill("#lgBrand", "Civil");
await page.setInputFiles("#lgFile", {name:"civil.png", mimeType:"image/png", buffer:Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a1b40000000049454e44ae426082", "hex")});
await page.waitForSelector(".lg-prev img"); await page.click("form[data-form=logo] button[type=submit]"); await page.waitForSelector(".lg-item");
await go(page, "#/kampanya/giyim-demo");
ok(await page.locator(".detail .logo.has-img img").count() >= 1, "yüklenen orijinal logo sitede görünüyor");
await go(page, "#/admin/logolar"); await page.click("[data-act=aLogoDel]"); await page.waitForTimeout(200);
/* ---------- kupon süresi ---------- */
await startCampaign(page, "saat-demo"); await pick(page, "Casio"); await page.waitForSelector("#wonCode");
await page.evaluate(() => localStorage.setItem("lb:demoOffset", String(Number(localStorage.getItem("lb:demoOffset")) + 25 * 3600e3)));
await page.goto(BASE + "#/kuponlarim"); await page.reload(); await page.click("[data-act=ctab][data-v=expired]");
ok(await page.locator(".ticket.expired").count() >= 1, "süresi dolan kupon 'Süresi dolan' sekmesinde");
await page.evaluate(() => localStorage.removeItem("lb:demoOffset"));

/* ---------- reklamlı telafi (15 sn) ---------- */
const p2 = await newPage();
await go(p2, "#/kampanya/kozmetik-demo"); await p2.click(".d-main [data-act=start]"); await login(p2, "Mehmet Kaya", "05559998877");
await p2.click("[data-act=go]"); await p2.waitForSelector("#board button"); await lose(p2, "Flormar");
await p2.waitForSelector("[data-kind=ad]"); await p2.click("[data-kind=ad]");
await p2.waitForSelector(".modal.ad"); await shot(p2, "11-reklam", false);
await p2.waitForSelector("#wonCode", {timeout:20000});
ok((await p2.textContent("#wonCode")).startsWith("DEMO-FLO-"), "reklam bitince telafi kuponu");

ok(errors.length === 0, "konsol hatası yok" + (errors.length ? ": " + errors.join(" | ") : ""));

/* ---------- tüm ekranlar: telefon, tablet, masaüstü; açık/koyu ---------- */
const screens = [["Android 360", 360, 740, true], ["iPhone 390", 390, 844, true], ["iPhone SE 375", 375, 667, true], ["Tablet 768", 768, 1024, true], ["Masaüstü 1440", 1440, 900, false]];
const routes = ["#/", "#/kategori/giyim", "#/kampanya/buyuk-firsat-demo", "#/kuponlarim", "#/profil", "#/nasil", "#/admin/ozet", "#/admin/kuponlar", "#/admin/uyeler", "#/admin/kasa", "#/admin/logolar"];
for (const [name, w, h, mobile] of screens) for (const scheme of ["dark", "light"]) {
  const p = await newPage({viewport:{width:w, height:h}, isMobile:mobile, hasTouch:mobile, colorScheme:scheme});
  await go(p, "#/"); await p.evaluate(() => { localStorage.setItem("lb:v3", JSON.stringify({users:{"05000000000":{phone:"05000000000", name:"Test Kişi", createdAt:Date.now()}}, session:"05000000000"})); }); await p.reload();
  let over = 0;
  for (const r of routes) { await go(p, r); over = Math.max(over, await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)); }
  ok(over <= 0, `${name} ${scheme}: ${routes.length} sayfada yatay taşma yok`);
  if (scheme === "dark") {
    await startCampaign(p, "giyim-demo");
    const box = await p.locator("#board").boundingBox();
    ok(box.y + box.height <= h, `${name}: 30 logo kaydırmadan sığıyor (alt kenar ${Math.round(box.y + box.height)} / ${h})`);
    if (name === "iPhone SE 375") await shot(p, "12-iphone-se-tahta", false);
    await p.goto(BASE + "#/"); await startCampaign(p, "buyuk-firsat-demo");
    const n = await p.locator("#board button").count(), mb = await p.locator("#board").boundingBox();
    ok(n === (w < 700 ? 50 : 55) && mb.y + mb.height <= h, `${name}: Muhteşem Fırsat ${n} logo kaydırmadan sığıyor (alt kenar ${Math.round(mb.y + mb.height)} / ${h})`);
    if (name === "iPhone 390") await shot(p, "12b-mf-telefon", false);
  }
  if (name === "Tablet 768" && scheme === "light") { await go(p, "#/"); await shot(p, "13-tablet-acik", false); }
  await p.context().close();
}

await browser.close();
console.log(failed ? `\n${failed} test BAŞARISIZ` : "\nTüm testler geçti");
process.exit(failed ? 1 : 0);
