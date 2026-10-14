// Orijinal logoları toplar ve logos/manifest.js dosyasını yazar.
//  1) logos/elle/ klasörüne markanın verdiği dosyayı koy: dosya adı marka adının kısaltması olmalı (ör. lc-waikiki.svg, civil.png).
//  2) Alan adı bilinen markalar için logo servisinden indirir (LOGO_DEV_TOKEN ya da LOGO_URL gerekir).
// Çalıştırma: LOGO_DEV_TOKEN=pk_xxx node logo-bulma/tools/logo-indir.mjs
// Sonuç: logos/<kategori>/<marka>.<uzantı>, logos/manifest.js, eksik olanlar logos/eksik.csv
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOGOS = path.join(ROOT, "logos");
const TEMPLATE = process.env.LOGO_URL || (process.env.LOGO_DEV_TOKEN ? `https://img.logo.dev/{domain}?token=${process.env.LOGO_DEV_TOKEN}&size=256&format=png` : "");
const EXT = {"image/png":".png", "image/svg+xml":".svg", "image/webp":".webp", "image/jpeg":".jpg"};

const load = f => { const ctx = {window:{}}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx); return ctx.window; };
const LIB = load("markalar.js").LB_MARKALAR, D = load("data.js").LB_DATA;
export const slug = s => s.toLocaleLowerCase("tr").replace(/[çğıöşü]/g, ch => ({ç:"c", ğ:"g", ı:"i", ö:"o", ş:"s", ü:"u"}[ch]))
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, "-and-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Kategori başına marka + alan adı (Excel kampanya markaları da dahil; alan adı data.js'deki brandUrls'den)
const items = [], seen = new Set();
const domainOf = name => { const u = D.brandUrls?.[name]; return u ? new URL(u).hostname.replace(/^www2?\./, "") : ""; };
for (const [cat, list] of Object.entries(LIB)) for (const x of [...D.campaigns.filter(c => c.cat === cat).map(c => c.brand), ...list]) {
  const [name, domain = ""] = x.split("|");
  if (seen.has(name)) continue; seen.add(name);
  items.push({cat, name, domain:domain || domainOf(name)});
}

const manual = fs.existsSync(path.join(LOGOS, "elle")) ? Object.fromEntries(fs.readdirSync(path.join(LOGOS, "elle"))
  .filter(f => /\.(png|svg|webp|jpe?g)$/i.test(f)).map(f => [path.parse(f).name.toLowerCase(), f])) : {};
const manifest = {}, missing = [];
async function fetchLogo(it) {
  const file = manual[slug(it.name)];
  if (file) {
    const out = path.join(it.cat, slug(it.name) + path.extname(file).toLowerCase());
    fs.mkdirSync(path.join(LOGOS, it.cat), {recursive:true}); fs.copyFileSync(path.join(LOGOS, "elle", file), path.join(LOGOS, out));
    return manifest[it.name] = "logos/" + out.split(path.sep).join("/");
  }
  const existing = fs.existsSync(path.join(LOGOS, it.cat)) && fs.readdirSync(path.join(LOGOS, it.cat)).find(f => path.parse(f).name === slug(it.name));
  if (existing) return manifest[it.name] = `logos/${it.cat}/${existing}`;
  if (!it.domain) return missing.push([it.cat, it.name, "", "alan adı yok"]);
  if (!TEMPLATE) return missing.push([it.cat, it.name, it.domain, "LOGO_DEV_TOKEN tanımlı değil"]);
  try {
    const res = await fetch(TEMPLATE.replace("{domain}", encodeURIComponent(it.domain)), {signal:AbortSignal.timeout(15000)});
    const type = (res.headers.get("content-type") || "").split(";")[0];
    const buf = Buffer.from(await res.arrayBuffer());
    if (!res.ok || !EXT[type] || buf.length < 64) return missing.push([it.cat, it.name, it.domain, `indirilemedi (${res.status} ${type})`]);
    const out = `${it.cat}/${slug(it.name)}${EXT[type]}`;
    fs.mkdirSync(path.join(LOGOS, it.cat), {recursive:true}); fs.writeFileSync(path.join(LOGOS, out), buf);
    manifest[it.name] = "logos/" + out;
  } catch (e) { missing.push([it.cat, it.name, it.domain, "hata: " + e.message]); }
}
const queue = items.slice();
await Promise.all(Array.from({length:6}, async () => { while (queue.length) await fetchLogo(queue.shift()); }));

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b, "tr")));
fs.writeFileSync(path.join(LOGOS, "manifest.js"), "// Otomatik üretildi: tools/logo-indir.mjs. Elle düzenleme; logos/elle/ klasörünü kullan.\nwindow.LB_LOGOS = " + JSON.stringify(sorted, null, 1) + ";\n");
fs.writeFileSync(path.join(LOGOS, "eksik.csv"), "﻿kategori;marka;alan_adi;neden\r\n" + missing.map(r => r.join(";")).join("\r\n") + "\r\n");
console.log(`${items.length} marka: ${Object.keys(manifest).length} logo hazır, ${missing.length} eksik (logos/eksik.csv)`);
