// Bildirim planlamasının testleri: node test.mjs
process.env.TZ = "Europe/Istanbul";
const { plan, channelsFor, normalizePhone } = await import("./lib.mjs");
import assert from "node:assert/strict";

const now = new Date(2026, 10, 10, 12, 0); // 10 Kasım 2026 12:00
const at = h => { const d = new Date(now.getTime() + h * 36e5); const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const users = {
  a: { id: "a", name: "Ayşe Yılmaz", email: "ayse@example.com", phone: "0532 111 22 33" },
  b: { id: "b", name: "Mehmet Kaya", email: "mehmet@example.com", phone: "5321112234", notifyEmail: false },
  c: { id: "c", name: "Elif Şahin", email: "", phone: "" }
};
const slot = (id, h, attendees, extra = {}) => ({ id, start: at(h), capacity: 5, status: "open", attendees, lateCancels: [], ...extra });
const slots = {
  s1: slot("s1", 25, ["a", "b"]),             // hatırlatma zamanı geldi (26 saat penceresi)
  s2: slot("s2", 40, ["a"]),                  // henüz erken
  s3: slot("s3", 10, ["c"]),                  // kontrol saati geçti, tek kişi → otomatik iptal
  s4: slot("s4", 30, ["a"], { status: "cancelled", cancelReason: "Hoca müsait değil" }),
  s5: slot("s5", 8, ["a"], { keepOpen: true }) // az kişi ama hoca yapacak
};
const bk = (id, slotId, userId, extra = {}) => ({ id, slotId, userId, packageId: "p" + userId, slotStart: slots[slotId].start, status: "booked", createdAt: new Date(now.getTime() - 72 * 36e5).toISOString(), by: userId, ...extra });
const bookings = {
  b1: bk("b1", "s1", "a"), b2: bk("b2", "s1", "b"), b3: bk("b3", "s2", "a"), b4: bk("b4", "s3", "c"),
  b5: bk("b5", "s4", "a", { status: "lesson_cancelled" }),
  b6: bk("b6", "s5", "a", { movedFrom: "b0", by: "admin" }),
  b0: { id: "b0", slotId: "old", userId: "a", slotStart: at(50), status: "moved" }
};
const packages = {
  pa: { id: "pa", userId: "a", size: 8, startDate: "2026-10-20", expiresAt: "2026-11-15" },
  pb: { id: "pb", userId: "b", size: 8, startDate: "2026-11-01", expiresAt: "2026-11-30" }
};

const r = plan({ settings: {}, users, slots, bookings, packages, now, appUrl: "https://ornek.github.io/pilates/" });
const keys = r.messages.map(m => m.key).sort();
console.log(keys);
console.log(r.messages.find(m => m.key === "remind_b1").text);

assert.deepEqual(r.autoCancel, ["s3"]);
assert.ok(keys.includes("remind_b1") && keys.includes("remind_b2"), "25 saat kalan derse hatırlatma");
assert.ok(!keys.includes("remind_b3"), "40 saat kalan derse henüz hatırlatma yok");
assert.ok(keys.includes("cancel_b4"), "otomatik iptal bildirimi");
assert.ok(keys.includes("cancel_b5"), "hoca iptali bildirimi");
assert.ok(r.messages.find(m => m.key === "cancel_b5").text.includes("Hoca müsait değil"));
assert.ok(keys.includes("moved_b6"), "taşıma bildirimi");
assert.ok(!keys.includes("cancel_b6"), "keepOpen dersi iptal sayılmaz");
assert.ok(keys.includes("expiry_pa"), "5 gün sonra biten pakette hak var");
assert.ok(!keys.includes("expiry_pb"), "20 gün sonra biten paket için henüz uyarı yok");

assert.equal(normalizePhone("0532 111 22 33"), "905321112233");
assert.equal(normalizePhone("+90 (532) 111 22 33"), "905321112233");
assert.equal(normalizePhone("123"), null);
assert.deepEqual(channelsFor(users.a, { notifySms: true }), { email: "ayse@example.com", sms: "905321112233" });
assert.deepEqual(channelsFor(users.b, {}), { email: null, sms: null }, "SMS varsayılan kapalı, üye e-postayı kapattı");
console.log("Tüm testler geçti.");
