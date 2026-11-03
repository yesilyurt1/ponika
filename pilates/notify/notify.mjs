// Pilates bildirim gönderici. GitHub Actions bunu 15 dakikada bir çalıştırır (.github/workflows/pilates-bildirim.yml).
// Yaptıkları:
//   1) Kontrol saati gelen ve yeterli kişiye ulaşmayan dersleri kalıcı olarak "otomatik iptal" yapar.
//   2) Ders hatırlatması, ders iptali, başka saate taşıma ve paket bitiş uyarılarını e-posta / SMS ile gönderir.
//   3) Her bildirimi notifications koleksiyonuna yazar; aynı bildirim iki kez gitmez.
//
// Ortam değişkenleri (GitHub → Settings → Secrets and variables → Actions):
//   FIREBASE_SERVICE_ACCOUNT  Firebase hizmet hesabı JSON'u (zorunlu)
//   APP_URL                   Mesajlara eklenecek uygulama adresi (isteğe bağlı)
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM     E-posta için
//   SMS_PROVIDER=netgsm  + NETGSM_USERCODE, NETGSM_PASSWORD, NETGSM_HEADER
//   SMS_PROVIDER=twilio  + TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM
//   DRY_RUN=1                 Hiçbir şey göndermez/yazmaz, sadece ne yapılacağını listeler
//   TZ                        Varsayılan Europe/Istanbul
process.env.TZ ||= "Europe/Istanbul";

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";
import { plan, channelsFor, ymd } from "./lib.mjs";

const env = process.env;
const DRY = env.DRY_RUN === "1" || env.DRY_RUN === "true";
const nowIso = () => new Date().toISOString();

if (!env.FIREBASE_SERVICE_ACCOUNT) { console.error("FIREBASE_SERVICE_ACCOUNT tanımlı değil."); process.exit(1); }
initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();

/* ---------- kanallar ---------- */
const mailer = env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
  ? nodemailer.createTransport({ host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 465), secure: Number(env.SMTP_PORT || 465) === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } })
  : null;
const smsProvider = (env.SMS_PROVIDER || "").toLowerCase();
const smsReady = (smsProvider === "netgsm" && env.NETGSM_USERCODE && env.NETGSM_PASSWORD && env.NETGSM_HEADER)
  || (smsProvider === "twilio" && env.TWILIO_SID && env.TWILIO_TOKEN && env.TWILIO_FROM);

async function sendEmail(to, subject, text) {
  await mailer.sendMail({ from: env.MAIL_FROM || env.SMTP_USER, to, subject, text });
}
async function sendSms(no, text) {
  if (smsProvider === "netgsm") {
    const u = new URL("https://api.netgsm.com.tr/sms/send/get");
    u.search = new URLSearchParams({ usercode: env.NETGSM_USERCODE, password: env.NETGSM_PASSWORD, gsmno: no, message: text, msgheader: env.NETGSM_HEADER, dil: "TR" });
    const r = await fetch(u);
    const body = (await r.text()).trim();
    if (!/^0[0-2]\b/.test(body)) throw new Error(`Netgsm yanıtı: ${body}`);
    return;
  }
  if (smsProvider === "twilio") {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(`${env.TWILIO_SID}:${env.TWILIO_TOKEN}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: "+" + no, From: env.TWILIO_FROM, Body: text })
    });
    if (!r.ok) throw new Error(`Twilio ${r.status}: ${await r.text()}`);
  }
}

/* ---------- veri ---------- */
const byId = snap => { const m = {}; snap.forEach(d => m[d.id] = { id: d.id, ...d.data() }); return m; };
async function load(now) {
  const since = ymd(new Date(now.getTime() - 100 * 864e5)); // en uzun paket 3 ay
  const [settings, users, slots, bookings, packages] = await Promise.all([
    db.doc("settings/main").get(),
    db.collection("users").get(),
    db.collection("slots").where("start", ">=", since).get(),
    db.collection("bookings").where("slotStart", ">=", since).get(),
    db.collection("packages").where("expiresAt", ">=", ymd(now)).get()
  ]);
  return { settings: settings.exists ? settings.data() : {}, users: byId(users), slots: byId(slots), bookings: byId(bookings), packages: byId(packages) };
}

async function main() {
  const now = new Date();
  const data = await load(now);
  const { autoCancel, messages } = plan({ ...data, now, appUrl: env.APP_URL || "" });
  const report = { lastRun: nowIso(), autoCancelled: 0, sent: 0, failed: 0, skipped: 0, lastError: "", channels: { email: !!mailer, sms: !!smsReady } };

  // 1) Otomatik iptalleri kalıcı yap
  for (const id of autoCancel) {
    const s = data.slots[id];
    const reason = `Yetersiz katılım (en az ${data.settings.minAttendees || 2} kişi)`;
    console.log(`Otomatik iptal: ${s.start}`);
    if (DRY) continue;
    await db.runTransaction(async tr => {
      const ref = db.doc(`slots/${id}`);
      const cur = await tr.get(ref);
      if (!cur.exists || cur.data().status !== "open") return;
      tr.update(ref, { status: "auto_cancelled", cancelReason: reason, cancelledAt: nowIso() });
      Object.values(data.bookings).filter(b => b.slotId === id && b.status === "booked")
        .forEach(b => tr.update(db.doc(`bookings/${b.id}`), { status: "lesson_cancelled", updatedAt: nowIso() }));
    });
    report.autoCancelled++;
  }

  // 2) Daha önce gönderilmemiş bildirimleri gönder
  const refs = messages.map(m => db.doc(`notifications/${m.key}`));
  const existing = refs.length ? await db.getAll(...refs) : [];
  for (let i = 0; i < messages.length; i++) {
    if (existing[i].exists) continue;
    const m = messages[i], user = data.users[m.userId];
    const ch = channelsFor(user, data.settings);
    const to = { email: mailer ? ch.email : null, sms: smsReady ? ch.sms : null };
    if (!to.email && !to.sms) { report.skipped++; continue; }
    if (DRY) { console.log(`[DRY] ${m.type} → ${user.name} (${[to.email, to.sms].filter(Boolean).join(", ")})\n  ${m.sms}`); continue; }

    // Önce kaydı oluştur (create aynı anahtarla ikinci kez çalışmaz), sonra gönder
    try { await refs[i].create({ type: m.type, userId: m.userId, status: "sending", at: nowIso(), text: m.sms }); }
    catch (e) { if (e.code === 6) continue; throw e; } // 6 = ALREADY_EXISTS

    const sent = [], errors = [];
    if (to.email) { try { await sendEmail(to.email, m.subject, m.text); sent.push("email"); } catch (e) { errors.push("E-posta: " + e.message); } }
    if (to.sms) { try { await sendSms(to.sms, m.sms); sent.push("sms"); } catch (e) { errors.push("SMS: " + e.message); } }
    await refs[i].update({ status: sent.length ? "sent" : "failed", channels: sent, error: errors.join(" | ") });
    if (sent.length) report.sent++; else report.failed++;
    if (errors.length) { report.lastError = errors.join(" | "); console.error(m.key, errors); }
    console.log(`${m.type} → ${user.name}: ${sent.join("+") || "gönderilemedi"}`);
  }

  console.log(JSON.stringify(report));
  if (!DRY) await db.doc("system/notifier").set(report);
}

main().catch(async e => {
  console.error(e);
  if (!DRY) { try { await db.doc("system/notifier").set({ lastRun: nowIso(), lastError: String(e.message || e) }, { merge: true }); } catch {} }
  process.exit(1);
});
