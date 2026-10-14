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
  await go(p, "#/panel"); await p.fill("#demoAt", hhmm); await p.click("form[data-form=demo] button[type=submit]");
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
ok(await page.locator(".grid-cards .camp .cd-l:has-text('Başlamasına')").count() > 0 || (await text(page, "main")).includes("kalmadı"), "yaklaşan kampanyalarda başlangıç sayacı");
await page.click("[data-act=filter][data-v=active]");
await shot(page, "01-ana-sayfa", false);

/* ---------- kurallar, giriş, kazanma ---------- */
await go(page, "#/kampanya/giyim-demo");
ok((await text(page, ".detail")).includes("Kampanya koşulları") && (await text(page, ".detail")).includes("Oyun kuralları"), "detay sayfasında koşullar ve kurallar");
ok((await text(page, ".detail")).includes("Yeni üyeye +%5") && (await text(page, ".detail")).includes("üstü %25"), "çoklu indirim: yeni üye eki ve barem");
ok((await text(page, ".detail")).includes("Firma değişiklik yapma hakkını saklı tutar"), "kampanya süresi metni revize");
await page.click(".d-main [data-act=start]");
await login(page);
await page.waitForSelector(".modal.rules");
ok((await text(page, ".modal.rules")).includes("5 saniye") && (await text(page, ".modal.rules")).includes("Tek hak"), "başlamadan önce kurallar pop-up'ı");
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
ok((await text(page, ".modal")).includes("+%5 yeni üye"), "ilk kuponda yeni üye eki");
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

/* ---------- günlük hak ---------- */
await go(page, "#/kampanya/ayakkabi-demo");
ok(await page.locator(".d-main button:has-text('Günlük hak doldu')").count() === 1, "günde bir kupon: diğer kampanyalar kilitli");

/* ---------- kaybetme ve telafi ---------- */
await go(page, "#/panel"); await page.click("[data-act=resetDaily]");
await startCampaign(page, "ayakkabi-demo");
await pickWrong(page, "Hotiç");
await page.waitForSelector(".modal.lost .telafi-box");
ok(await page.locator(".t-opt").count() === 3, "kazanamayana 3 telafi seçeneği (düşük / reklam / ücretli)");
await shot(page, "06-telafi", false);
await page.click("[data-kind=paid]"); await page.waitForSelector("form[data-form=pay]");
await page.click("form[data-form=pay] button[type=submit]");
await page.waitForSelector("#wonCode");
ok((await page.textContent("#wonCode")).startsWith("DEMO-HOT-"), "ücretli telafi kuponu verildi");
await go(page, "#/panel"); await page.click("[data-act=resetDaily]");
await startCampaign(page, "ev-tekstil-demo"); await pickWrong(page, "English Home");
await page.waitForSelector(".modal.lost");
ok(await page.locator(".modal.lost .telafi-box").count() === 0 && (await text(page, ".modal.lost")).includes("telafi hakkını kullandın"), "telafi günde bir kez");
await page.click(".modal.lost button[data-close]");
await go(page, "#/");
await page.click("[data-act=filter][data-v=won]");
ok(await page.locator(".grid-cards .hist.won").count() === 1, "Kazandıklarım filtresi");
await page.click("[data-act=filter][data-v=lost]");
ok(await page.locator(".grid-cards .hist.lost").count() === 2, "Kazanamadıklarım filtresi");
await page.click("[data-act=filter][data-v=active]");

/* ---------- Muhteşem Fırsat ---------- */
await go(page, "#/panel"); await page.click("[data-act=resetDaily]");
await go(page, "#/kampanya/buyuk-firsat-demo");
ok((await text(page, ".detail")).includes("bordo ve siyah"), "Muhteşem Fırsat koşullarında bordo-siyah uyarısı");
await page.click(".d-main [data-act=start]"); await page.waitForSelector(".modal.rules .mf-note");
ok(true, "kurallar pop-up'ında Muhteşem Fırsat uyarısı");
await page.click("[data-act=go]"); await page.waitForSelector("#board button");
const colors = await page.$$eval("#board button", b => [...new Set(b.map(x => getComputedStyle(x).backgroundColor))]);
ok(colors.length === 2 && colors.includes("rgb(110, 11, 36)") && colors.includes("rgb(11, 11, 13)"), "tahtada yalnızca bordo ve siyah logolar");
await shot(page, "07-muhtesem-firsat", false);
await page.waitForSelector(".modal.lost", {timeout:9000});
ok((await text(page, ".modal.lost")).includes("Süre doldu"), "5 sn dolunca kaybedilir");
await page.click(".modal.lost button[data-close]");

/* ---------- oyundan kaçmak ---------- */
await go(page, "#/panel"); await page.click("[data-act=resetDaily]");
await startCampaign(page, "elektronik-demo");
await page.goto(BASE + "#/"); await go(page, "#/kampanya/elektronik-demo");
ok((await text(page, ".d-main")).includes("hakkını kullandın"), "oyundan çıkmak hakkı yakar");

/* ---------- marka kasası, çoklu indirim, komisyon ---------- */
await go(page, `#/marka-kasasi/${code}`);
await page.selectOption("#kBrand", "Koton"); await page.click("button[value=validate]");
ok((await text(page, ".kasa-out")).includes("Koton kasasında geçmez"), "başka markanın kasasında red");
await page.selectOption("#kBrand", "Civil"); await page.fill("#kAmount", "2000"); await page.click("button[value=validate]");
const val = await text(page, ".kasa-out");
ok(val.includes("Kod geçerli") && val.includes("%25") && val.includes("+%5") && val.includes("(%30)"), "doğrulamada indirim dökümü: barem %25 + yeni üye %5 = %30");
await page.fill("#kAmount", "2000"); await page.fill("#kOrder", "SIP-1001"); await page.click("button[value=order]");
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

/* ---------- panel ---------- */
await go(page, "#/panel");
const panel = await text(page, "main");
ok(panel.includes("42,00") && panel.includes("5,00"), "panelde komisyon ve telafi ödemesi");
const dl = page.waitForEvent("download"); await page.click("[data-act=csv]");
ok((await dl).suggestedFilename().startsWith("kuponlar-"), "CSV indiriliyor");
await page.click(`button[data-act=refund][data-code="${code}"]`);
ok((await text(page, "main")).includes("İade edildi") || await page.locator("td s").count() > 0, "iade komisyonu geri alır");

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

/* ---------- kupon süresi ---------- */
await go(page, "#/panel"); await page.click("[data-act=resetDaily]");
await startCampaign(page, "saat-demo"); await pick(page, "Casio"); await page.waitForSelector("#wonCode");
await page.evaluate(() => localStorage.setItem("lb:demoOffset", String(Number(localStorage.getItem("lb:demoOffset")) + 25 * 3600e3)));
await page.goto(BASE + "#/kuponlarim"); await page.reload(); await page.click("[data-act=ctab][data-v=expired]");
ok(await page.locator(".ticket.expired").count() >= 1, "süresi dolan kupon 'Süresi dolan' sekmesinde");
await page.evaluate(() => localStorage.removeItem("lb:demoOffset"));

/* ---------- reklamlı telafi (15 sn) ---------- */
const p2 = await newPage();
await go(p2, "#/kampanya/kozmetik-demo"); await p2.click(".d-main [data-act=start]"); await login(p2, "Mehmet Kaya", "05559998877");
await p2.click("[data-act=go]"); await p2.waitForSelector("#board button"); await pickWrong(p2, "Flormar");
await p2.waitForSelector("[data-kind=ad]"); await p2.click("[data-kind=ad]");
await p2.waitForSelector(".modal.ad"); await shot(p2, "11-reklam", false);
await p2.waitForSelector("#wonCode", {timeout:20000});
ok((await p2.textContent("#wonCode")).startsWith("DEMO-FLO-"), "reklam bitince telafi kuponu");

ok(errors.length === 0, "konsol hatası yok" + (errors.length ? ": " + errors.join(" | ") : ""));

/* ---------- tüm ekranlar: telefon, tablet, masaüstü; açık/koyu ---------- */
const screens = [["Android 360", 360, 740, true], ["iPhone 390", 390, 844, true], ["iPhone SE 375", 375, 667, true], ["Tablet 768", 768, 1024, true], ["Masaüstü 1440", 1440, 900, false]];
const routes = ["#/", "#/kategori/giyim", "#/kampanya/buyuk-firsat-demo", "#/kuponlarim", "#/profil", "#/nasil", "#/panel", "#/marka-kasasi"];
for (const [name, w, h, mobile] of screens) for (const scheme of ["dark", "light"]) {
  const p = await newPage({viewport:{width:w, height:h}, isMobile:mobile, hasTouch:mobile, colorScheme:scheme});
  await go(p, "#/"); await p.evaluate(() => { localStorage.setItem("lb:v2", JSON.stringify({users:{"05000000000":{phone:"05000000000", name:"Test Kişi", createdAt:Date.now()}}, session:"05000000000"})); }); await p.reload();
  let over = 0;
  for (const r of routes) { await go(p, r); over = Math.max(over, await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)); }
  ok(over <= 0, `${name} ${scheme}: ${routes.length} sayfada yatay taşma yok`);
  if (scheme === "dark") {
    await startCampaign(p, "giyim-demo");
    const box = await p.locator("#board").boundingBox();
    ok(box.y + box.height <= h, `${name}: 30 logo kaydırmadan sığıyor (alt kenar ${Math.round(box.y + box.height)} / ${h})`);
    if (name === "iPhone SE 375") await shot(p, "12-iphone-se-tahta", false);
  }
  if (name === "Tablet 768" && scheme === "light") { await go(p, "#/"); await shot(p, "13-tablet-acik", false); }
  await p.context().close();
}

await browser.close();
console.log(failed ? `\n${failed} test BAŞARISIZ` : "\nTüm testler geçti");
process.exit(failed ? 1 : 0);
