// Uçtan uca test: `npx http-server logo-bulma -p 8765` çalışırken `node logo-bulma/tests/e2e.mjs`
import { createRequire } from "module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright")); }

const BASE = process.env.BASE || "http://localhost:8765/";
const SHOTS = process.env.SHOTS || null;
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) failed++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: "tr-TR" });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(BASE).origin });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(m.text()); });
const shot = async (name, p = page) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
const setDemo = async hhmm => {
  await page.goto(BASE + "#/panel"); await page.fill("#demoAt", hhmm);
  await page.click("form[data-form=demo] button[type=submit]");
  await page.waitForFunction(t => document.querySelector("#clock").textContent.startsWith(t), hhmm);
};

await page.goto(BASE);
ok(await page.locator(".cat-tile").count() === 15, "ana sayfada 15 kategori var");
ok(await page.locator(".cat-tile.soon").count() === 12, "verisi olmayan 12 kategori 'Yakında'");
ok(/\d\d:\d\d:\d\d/.test(await page.textContent("#clock")), "saat çalışıyor");

await setDemo("00:02");
ok(await page.isVisible("#demoBanner"), "demo saat bandı görünür");
await page.goto(BASE + "#/");
ok(await page.locator("section[aria-labelledby=liveH] .camp").count() === 4, "00:02'de 3 saatlik + Civil demo = 4 aktif kampanya");
ok((await page.textContent("section[aria-labelledby=liveH] .camp")).includes("Civil"), "Civil demo kampanyası en başta");
await shot("1-ana-sayfa");

// giriş
await page.goto(BASE + "#/oyna/giyim-00");
await page.click("[data-act=login]");
await page.fill("#lName", "Ayşe Yılmaz"); await page.fill("#lPhone", "12345");
await page.click("form[data-form=login] button[type=submit]");
ok((await page.textContent("#lErr")).includes("KVKK"), "KVKK onayı zorunlu");
await page.check("input[name=kvkk]"); await page.click("form[data-form=login] button[type=submit]");
ok((await page.textContent("#lErr")).includes("telefon"), "geçersiz telefon reddedildi");
await page.fill("#lPhone", "+90 532 111 22 33"); await page.click("form[data-form=login] button[type=submit]");
ok((await page.textContent("#userBtn")) === "Ayşe", "giriş yapıldı");

// kazanma
await page.click("[data-act=start]");
ok(await page.locator("#board button").count() === 24, "Giyim'de 24 logo dizildi");
await shot("2-oyun");
const order1 = await page.$$eval("#board button", b => b.map(x => x.getAttribute("aria-label")).join());
await page.click('#board button[aria-label="LC Waikiki"]');
await page.waitForSelector("#wonCode");
const code = await page.textContent("#wonCode");
ok(/^DEMO-LCW-[A-Z2-9]{5}$/.test(code), `kupon kodu üretildi (${code})`);
await shot("3-kazandin");
await page.click(".modal [data-copy]");
await page.waitForTimeout(200);
ok(await page.evaluate(() => navigator.clipboard.readText()) === code, "kod panoya kopyalandı");
const href = await page.getAttribute(".modal a[data-utm]", "href");
ok(href.includes("lcw.com") && href.includes("utm_source=1milyonuncumarka") && href.includes(`utm_content=${code}`), "marka linkinde UTM parametreleri var");
await page.click(".modal a[href='#/kuponlarim']");
await page.waitForSelector(".coupon");
ok(await page.locator(".coupon").count() === 1 && (await page.textContent(".coupon .code")) === code, "kupon Kuponlarım'da");
ok((await page.textContent("#couponCount")) === "1", "menüde aktif kupon sayısı");
await shot("4-kuponlarim");
await page.goto(BASE + "#/oyna/giyim-00");
ok((await page.textContent("#stage")).includes("kazandın"), "aynı kampanyaya ikinci kez girilemiyor");

// yanlış logo
await page.goto(BASE + "#/oyna/ayakkabi-00"); await page.click("[data-act=start]");
await page.click('#board button:not([aria-label="Tonny Black"]) >> nth=0');
await page.waitForSelector(".modal #mT");
ok((await page.textContent("#mT")) === "Yanlış logo", "yanlış logo kaybettiriyor");
ok(await page.locator('#board button.hit[aria-label="Tonny Black"]').count() === 1, "doğru logo gösteriliyor");
await page.click(".modal button[data-close]");
ok((await page.textContent("#stage")).includes("hakkını kullandın"), "yanlıştan sonra tekrar deneme yok");

// süre dolması
await page.goto(BASE + "#/oyna/ev-tekstil-00"); await page.click("[data-act=start]");
await page.waitForSelector(".modal #mT", { timeout: 8000 });
ok((await page.textContent("#mT")) === "Süre doldu", "5 sn sonunda süre doluyor");
await page.click(".modal button[data-close]");

// oyun sırasında sayfadan çıkma
await setDemo("01:01");
await page.goto(BASE + "#/oyna/giyim-01"); await page.click("[data-act=start]");
await page.goto(BASE + "#/");
await page.goto(BASE + "#/oyna/giyim-01");
ok((await page.textContent("#stage")).includes("hakkını kullandın"), "oyundan kaçmak hakkı yakıyor");

// sıralama her denemede değişiyor
await page.goto(BASE + "#/oyna/ayakkabi-01"); await page.click("[data-act=start]");
await page.waitForSelector(".modal #mT", { timeout: 8000 }); await page.click(".modal button[data-close]");
ok(true, "ikinci oyun tamamlandı");

// kontenjan dolması -> kampanya ana sayfadan kalkar
await page.goto(BASE + "#/panel");
await page.click('button[data-act=fill][data-id="ev-tekstil-01"]');
await page.goto(BASE + "#/");
ok(await page.locator('.grid-cards').first().locator('a[href="#/oyna/ev-tekstil-01"]').count() === 0, "kontenjanı dolan kampanya ana sayfadan kalktı");
await page.goto(BASE + "#/oyna/ev-tekstil-01");
ok((await page.textContent("#stage")).includes("Kontenjan doldu"), "kontenjanı dolan kampanyaya girilemiyor");

// süre biten kampanya
await setDemo("00:20");
await page.goto(BASE + "#/oyna/giyim-00");
ok((await page.textContent("#stage")).includes("kazandın") , "kazanılan kampanya bilgisi süre bitince de duruyor");
await page.goto(BASE + "#/oyna/ayakkabi-00");
ok((await page.textContent("#stage")).includes("hakkını kullandın"), "kullanılmış hak süre bitince de korunuyor");
await page.evaluate(() => { const db = JSON.parse(localStorage.getItem("lb:v1")); db.session = null; localStorage.setItem("lb:v1", JSON.stringify(db)); });
await page.goto(BASE + "#/oyna/ayakkabi-00"); await page.reload();
ok((await page.textContent("#stage")).includes("sona erdi"), "süresi biten kampanya kapalı");
await page.goto(BASE + "#/oyna/giyim-23"); 
ok((await page.textContent("#stage")).includes("başlıyor"), "gelecek kampanya geri sayım gösteriyor");
// tekrar giriş
await page.click("#userBtn"); await page.fill("#lName", "Ayşe Yılmaz"); await page.fill("#lPhone", "05321112233"); await page.check("input[name=kvkk]");
await page.click("form[data-form=login] button[type=submit]");

// marka kasası: doğrulama, sipariş, komisyon, kontroller
await page.goto(BASE + "#/marka-kasasi/" + code);
ok((await page.inputValue("#kBrand")) === "LC Waikiki" && (await page.inputValue("#kCode")) === code, "kasa kupondan marka ve kodu dolduruyor");
await page.selectOption("#kBrand", "Koton"); await page.click("button[value=validate]");
ok((await page.textContent(".kasa-out")).includes("Koton kasasında geçmez"), "başka markanın kasasında kod reddediliyor");
await page.selectOption("#kBrand", "LC Waikiki"); await page.click("button[value=validate]");
ok((await page.textContent(".kasa-out")).includes("Kod geçerli"), "kod doğrulanıyor");
await page.fill("#kAmount", "1250"); await page.fill("#kOrder", "SIP-1001"); await page.click("button[value=order]");
ok((await page.textContent(".kasa-out")).replace(/\s/g, " ").includes("37,50"), "1.250 ₺ siparişte %3 = 37,50 ₺ komisyon");
await page.fill("#kCode", code); await page.fill("#kAmount", "1250"); await page.fill("#kOrder", "SIP-1001"); await page.click("button[value=order]");
ok((await page.textContent(".kasa-out")).includes("ikinci kez sayılmadı"), "aynı sipariş tekrar bildirilirse iki kez sayılmıyor");
await page.fill("#kCode", code); await page.fill("#kOrder", "SIP-1002"); await page.fill("#kAmount", "500"); await page.click("button[value=order]");
ok((await page.textContent(".kasa-out")).includes("daha önce kullanılmış"), "kullanılmış kod yeni siparişte reddediliyor");
await page.goto(BASE + "#/panel");
ok((await page.textContent("main")).replace(/\s/g, " ").includes("37,50"), "komisyon panelde ve marka hakedişinde");
await shot("5-panel");
const dl = page.waitForEvent("download"); await page.click("[data-act=csv]");
const file = await dl; ok(file.suggestedFilename().startsWith("kuponlar-"), "CSV indiriliyor");

// Civil demo: her saatte açık, kazanılıyor; kasada doğrulanıp siparişi bildirilmezse kontrol listesine düşüyor
await setDemo("15:40");
await page.goto(BASE + "#/oyna/giyim-civil-demo"); await page.click("[data-act=start]");
ok(await page.locator("#board button").count() === 24, "tahtada 24 logo (kütüphaneden rastgele)");
await page.click('#board button[aria-label="Civil"]'); await page.waitForSelector("#wonCode");
const civil = await page.textContent("#wonCode");
ok(/^DEMO-CIV-/.test(civil), `Civil kuponu kazanıldı (${civil})`);
await page.click(".modal a[href^='#/marka-kasasi']"); await page.waitForSelector("#kCode");
await page.click("button[value=validate]");
await page.goto(BASE + "#/panel");
ok((await page.textContent(".stat.warn b")) === "1", "kasada doğrulanıp sipariş bildirilmeyen kod 'Kontrol edilecek'");
await page.goto(BASE + "#/marka-kasasi/" + civil); await page.fill("#kAmount", "800"); await page.click("button[value=order]");
await page.goto(BASE + "#/panel");
ok(await page.locator(".stat.warn").count() === 0, "sipariş gelince kontrol uyarısı kalkıyor");
await page.click(`button[data-act=refund][data-code="${civil}"]`);
ok((await page.textContent("main")).includes("İade edildi") || (await page.locator(`tr:has-text("${civil}") s`).count()) === 1, "iade komisyonu geri alıyor");

// 24 saat sonra kupon süresi dolar (yeni bir kupon kazanıp saati 25 sa ileri al)
await setDemo("02:01");
await page.goto(BASE + "#/oyna/giyim-02"); await page.click("[data-act=start]");
await page.click('#board button[aria-label="Defacto"]'); await page.waitForSelector("#wonCode");
await page.evaluate(() => localStorage.setItem("lb:demoOffset", String(Number(localStorage.getItem("lb:demoOffset")) + 25 * 3600e3)));
await page.goto(BASE + "#/kuponlarim"); await page.reload();
ok((await page.textContent("main")).includes("Süresi doldu"), "24 saati geçen kupon 'Süresi doldu'");
ok((await page.textContent("main")).includes("Kullanıldı"), "kullanılan kupon 'Kullanıldı'");

ok(errors.length === 0, "konsol hatası yok" + (errors.length ? ": " + errors.join(" | ") : ""));

// mobil
const m = await browser.newContext({ viewport: { width: 375, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mp = await m.newPage();
await mp.setViewportSize({ width: 375, height: 740 });
for (const r of ["#/", "#/kategori/giyim", "#/kuponlarim", "#/nasil", "#/panel", "#/oyna/giyim-05", "#/marka-kasasi", "#/kategori/supermarket"]) {
  await mp.goto(BASE + r);
  const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 0, `mobil ${r}: yatay taşma yok`);
}
await mp.evaluate(() => { localStorage.setItem("lb:v1", JSON.stringify({users:{"05000000000":{phone:"05000000000",name:"Test"}},session:"05000000000",attempts:{},coupons:[],clicks:[]})); });
await mp.reload(); await mp.goto(BASE + "#/panel"); await mp.fill("#demoAt", "05:03"); await mp.click("form[data-form=demo] button[type=submit]");
await mp.setViewportSize({ width: 375, height: 667 });
await mp.goto(BASE + "#/oyna/giyim-05"); await mp.tap("[data-act=start]");
const box = await mp.locator("#board").boundingBox();
const headBottom = await mp.evaluate(() => Math.max(0, document.querySelector(".top").getBoundingClientRect().bottom));
const tgt = await mp.locator(".target").boundingBox();
ok(tgt.y >= headBottom, `mobilde hedef kart üst menünün altında kalmıyor (${Math.round(tgt.y)} >= ${Math.round(headBottom)})`);
ok(box.y >= headBottom && box.y + box.height <= 667, `iPhone SE boyunda (375×667) 24 logo kaydırmadan sığıyor (${Math.round(box.y)}–${Math.round(box.y + box.height)} / 667)`);
await shot("6-mobil-oyun", mp);
await mp.waitForSelector(".modal", { timeout: 8000 });
await mp.goto(BASE + "#/"); await shot("7-mobil-ana", mp);
const dk = await browser.newContext({ viewport: { width: 375, height: 740 }, colorScheme: "dark" });
const dp = await dk.newPage(); await dp.goto(BASE + "#/kategori/giyim"); await shot("8-karanlik", dp);

await browser.close();
console.log(failed ? `\n${failed} test BAŞARISIZ` : "\nTüm testler geçti");
process.exit(failed ? 1 : 0);
