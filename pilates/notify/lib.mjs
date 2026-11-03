// Bildirim planlama: hangi üyeye hangi mesajın gideceğini hesaplar.
// Ağa ya da veritabanına dokunmaz; notify.mjs bu sonuca göre gönderir. Saat dilimi process.env.TZ'dir.

export const DEFAULTS = {
  studioName: "Pilates Stüdyo",
  capacity: 5,
  minAttendees: 2,
  autoCancelHours: 12,
  changeHours: 24,
  duration: 50,
  reminderHours: 26,     // dersten kaç saat önce hatırlatma gider
  notifyEmail: true,     // e-posta bildirimleri açık mı
  notifySms: false,      // SMS bildirimleri açık mı
  expiryWarnDays: 7      // paket bitişinden kaç gün önce uyarı gider
};

const HOUR = 36e5;
const pad = n => String(n).padStart(2, "0");
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parseStart(s) {
  const [a, b = "00:00"] = s.split("T");
  const [y, m, d] = a.split("-").map(Number);
  const [h, mi] = b.split(":").map(Number);
  return new Date(y, m - 1, d, h, mi, 0, 0);
}
const fmtDay = d => new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" }).format(d);
const fmtDate = d => new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" }).format(d);
const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const when = s => { const d = parseStart(s); return `${fmtDay(d)} ${hhmm(d)}`; };
const firstName = u => String(u?.name || "").trim().split(/\s+/)[0] || "Merhaba";

export const headcount = s => new Set([...(s.attendees || []), ...(s.lateCancels || [])]).size;

/** Türkiye cep numarasını 905XXXXXXXXX biçimine çevirir; geçersizse null. */
export function normalizePhone(p) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = "9" + d;
  if (d.length === 10 && d.startsWith("5")) d = "90" + d;
  return /^905\d{9}$/.test(d) ? d : null;
}

/**
 * @param {object} p
 * @param {object} p.settings  settings/main belgesi
 * @param {Record<string,object>} p.users, p.slots, p.bookings, p.packages  (id → belge, belgede id alanı var)
 * @param {Date} p.now
 * @param {string} [p.appUrl]
 * @returns {{autoCancel: string[], messages: Array<{key,type,userId,subject,text,sms}>}}
 */
export function plan({ settings, users, slots, bookings, packages, now, appUrl = "" }) {
  const cfg = { ...DEFAULTS, ...(settings || {}) };
  const t = now.getTime();
  const link = appUrl ? ` ${appUrl}` : "";
  const sign = cfg.studioName;
  const messages = [];
  const push = (key, type, userId, subject, body, sms) =>
    messages.push({ key, type, userId, subject: `${sign}: ${subject}`, text: `${body}\n\n${sign}${appUrl ? `\n${appUrl}` : ""}`, sms: `${sms}${link}` });

  // 1) Süresi gelen otomatik iptaller (kontrol saati geçti, en az kişi sayısına ulaşılmadı)
  const autoCancel = Object.values(slots).filter(s => {
    if (s.status !== "open" || s.keepOpen) return false;
    const st = parseStart(s.start).getTime();
    return t >= st - cfg.autoCancelHours * HOUR && t < st + HOUR && headcount(s) < cfg.minAttendees;
  }).map(s => s.id);
  const autoSet = new Set(autoCancel);
  const isVoid = s => !s || s.status === "cancelled" || s.status === "auto_cancelled" || autoSet.has(s.id);

  for (const b of Object.values(bookings)) {
    const u = users[b.userId]; if (!u) continue;
    const s = slots[b.slotId];
    const start = parseStart(b.slotStart).getTime();
    if (start <= t) continue; // geçmiş derslere bildirim yok
    const name = firstName(u);

    // 2) Ders iptali (hoca iptal etti, ders silindi ya da az katılım)
    const cancelled = b.status === "lesson_cancelled" || (b.status === "booked" && isVoid(s));
    if (cancelled) {
      const auto = autoSet.has(b.slotId) || s?.status === "auto_cancelled";
      const reason = auto ? `en az ${cfg.minAttendees} kişiye ulaşılamadığı için` : (s?.cancelReason ? `(${s.cancelReason})` : "");
      push(`cancel_${b.id}`, "cancel", u.id, "Dersin iptal edildi",
        `${name}, ${when(b.slotStart)} pilates dersin ${reason ? reason + " " : ""}iptal edildi. Ders hakkın iade edildi; takvimden yeni bir ders seçebilirsin.`,
        `${name}, ${when(b.slotStart)} pilates dersin ${auto ? "az katılım nedeniyle " : ""}iptal edildi. Hakkın iade edildi.`);
      continue;
    }
    if (b.status !== "booked") continue;

    // 3) Hoca üyeyi başka saate taşıdı
    if (b.movedFrom && b.by && b.by !== b.userId) {
      const old = bookings[b.movedFrom];
      push(`moved_${b.id}`, "moved", u.id, "Dersin başka saate alındı",
        `${name}, ${old ? when(old.slotStart) + " dersin" : "dersin"} ${when(b.slotStart)} saatine taşındı.`,
        `${name}, ${old ? when(old.slotStart) + " dersin" : "dersin"} ${when(b.slotStart)} saatine taşındı.`);
    }

    // 4) Ders hatırlatma
    const remindAt = start - cfg.reminderHours * HOUR;
    const created = b.createdAt ? Date.parse(b.createdAt) : 0;
    if (t >= remindAt && t < start - 30 * 60000 && created < remindAt) {
      const deadline = new Date(start - cfg.changeHours * HOUR);
      const canChange = t < deadline.getTime();
      const alone = s && headcount(s) < cfg.minAttendees && !s.keepOpen;
      const cutoff = new Date(start - cfg.autoCancelHours * HOUR);
      const extra = [
        canChange ? `İptal veya değişiklik için son zaman: ${fmtDay(deadline)} ${hhmm(deadline)}.` : "",
        alone ? `Derste şu an ${headcount(s)} kişi var. ${fmtDay(cutoff)} ${hhmm(cutoff)} saatine kadar en az ${cfg.minAttendees} kişi olmazsa ders iptal olur ve hakkın iade edilir.` : ""
      ].filter(Boolean).join(" ");
      push(`remind_${b.id}`, "remind", u.id, "Ders hatırlatması",
        `${name}, ${when(b.slotStart)} pilates dersin var.${extra ? " " + extra : ""}`,
        `${name}, ${when(b.slotStart)} pilates dersin var.${canChange ? ` İptal için son: ${fmtDate(deadline)} ${hhmm(deadline)}.` : ""}`);
    }
  }

  // 5) Paket bitiyor, kullanılmamış hak var
  const today = ymd(now);
  const warnUntil = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + cfg.expiryWarnDays));
  for (const p of Object.values(packages)) {
    if (!(p.expiresAt >= today && p.expiresAt <= warnUntil)) continue;
    const u = users[p.userId]; if (!u) continue;
    const used = Object.values(bookings).filter(b => b.packageId === p.id && ["booked", "late_cancel"].includes(b.status) && !isVoid(slots[b.slotId])).length;
    const left = p.size - used;
    if (left <= 0) continue;
    const end = fmtDate(parseStart(p.expiresAt));
    push(`expiry_${p.id}`, "expiry", u.id, "Paketin bitiyor",
      `${firstName(u)}, ${p.size} derslik paketin ${end} tarihinde bitiyor ve ${left} ders hakkın henüz seçilmedi. Hakların yanmasın diye takvimden ders seçebilirsin.`,
      `${firstName(u)}, ${p.size} derslik paketin ${end} tarihinde bitiyor, ${left} ders hakkın seçilmedi.`);
  }

  return { autoCancel, messages };
}

/** Bir üyeye hangi kanallardan gönderileceğini döner. */
export function channelsFor(user, settings) {
  const cfg = { ...DEFAULTS, ...(settings || {}) };
  return {
    email: cfg.notifyEmail && user.notifyEmail !== false && /\S+@\S+\.\S+/.test(user.email || "") ? user.email : null,
    sms: cfg.notifySms && user.notifySms !== false ? normalizePhone(user.phone) : null
  };
}
