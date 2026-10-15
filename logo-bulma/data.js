// 1 Milyonuncu Marka: kampanya verisi.
// logo_bulma.xlsx dosyasından üretildi (Sayfa1, satır 4-27). Düzeltmeler için ANALIZ.md'ye bak.
// Diğer 12 kategorinin programı, demo kampanyalar ve indirim koşulları kurallar.js'de üretilir.
// Gerçek sistemde bu liste yönetim panelinden girilir ve sunucudan gelir.
window.LB_DATA = {
  findSecDefault: 5,
  couponValidHours: 24,         // varsayılan; kampanya bazında validHours ile değişir
  commissionRate: 0.03,
  timeZone: "Europe/Istanbul",
  boardSize: 30,                // oyunda tek seferde gösterilen logo (hedef dahil)
  boardSizeMf: 55,              // Muhteşem Fırsat tahtası: ekrana sığdığı kadar, 50-55 arası
  boardSizeMfMin: 50,
  minPool: 300,                 // her kategoride oyuna giren en az logo sayısı
  maxDurationMin: 180,          // bir kampanya en fazla 3 saat sürer
  // Kupon hakkı sınırsızdır; müşteri her kampanyada yalnızca bir kez oynayabilir (telafi de kampanya başına bir kez).
  // Excel dışındaki kategorilerin programı: her kaç dakikada bir, ilk başlangıç dakikası, sırayla kullanılan süreler (dk).
  // mf: Muhteşem Fırsat olan başlangıç dakikaları.
  schedules: {
    elektronik:{every:30, offset:10, durations:[20, 45, 60, 90, 120, 180]},
    gozluk:{every:60, offset:20, durations:[30, 60, 90]},
    canta:{every:15, offset:5, durations:[15, 30, 45, 60]},
    supermarket:{every:30, offset:0, durations:[30, 60, 120]},
    saat:{every:60, offset:40, durations:[45, 90, 180]},
    bijuteri:{every:60, offset:15, durations:[30, 60]},
    kozmetik:{every:15, offset:10, durations:[15, 30, 60, 90]},
    cicek:{every:60, offset:30, durations:[60, 120]},
    yemek:{every:30, offset:15, durations:[30, 45, 90]},
    saglik:{every:60, offset:50, durations:[60, 180]},
    "cafe-hastane":{every:30, offset:20, durations:[30, 60]},
    "buyuk-firsat":{every:60, offset:45, durations:[60, 120, 180], mf:[705, 1185]}
  },
  newMemberBonus: 5,            // ilk kuponunu kazanan yeni üyeye ek indirim (puan)
  telafi: {lowShare: 0.4, adShare: 0.6, paidShare: 1, fee: 5, adSec: 15},
  // Kategoriler: renk (kart ve ikon vurgusu) ve ikon anahtarı (app.js içindeki SVG seti)
  categories: [
    {slug:"giyim", name:"Giyim", icon:"shirt", color:"#FF3D7F"},
    {slug:"ayakkabi", name:"Ayakkabı", icon:"shoe", color:"#FF7A1A"},
    {slug:"ev-tekstil", name:"Ev Tekstil", icon:"home", color:"#FFC21A"},
    {slug:"elektronik", name:"Elektronik", icon:"phone", color:"#2EC5FF"},
    {slug:"gozluk", name:"Gözlük", icon:"glasses", color:"#8B5CFF"},
    {slug:"canta", name:"Çanta", icon:"bag", color:"#FF5A36"},
    {slug:"supermarket", name:"Süpermarket", icon:"cart", color:"#22D37A"},
    {slug:"saat", name:"Saat", icon:"watch", color:"#5B8CFF"},
    {slug:"bijuteri", name:"Bijuteri", icon:"gem", color:"#E94BFF"},
    {slug:"kozmetik", name:"Kozmetik", icon:"sparkle", color:"#FF4FA3"},
    {slug:"cicek", name:"Çiçek", icon:"flower", color:"#FF6FB1"},
    {slug:"yemek", name:"Yemek", icon:"burger", color:"#FF9F1C"},
    {slug:"saglik", name:"Sağlık", icon:"heart", color:"#10D9C4"},
    {slug:"cafe-hastane", name:"Cafe / Hastane vb.", icon:"coffee", color:"#C08457"},
    {slug:"buyuk-firsat", name:"Büyük Fırsat", icon:"gift", color:"#D4FF2A"}
  ],
  // Pazaryeri linkleri: marka panelden kendi mağaza linklerini girer ({"Civil":[{ad:"Trendyol mağazası", url:"…"}]}).
  brandLinks: {},
  marketplaceSearch: true,
  // Yalnızca alan adından emin olunan markalar; diğerleri panelden girilmeli.
  brandUrls: {
    "LC Waikiki":"https://www.lcw.com", "Defacto":"https://www.defacto.com.tr", "Koton":"https://www.koton.com",
    "Mavi":"https://www.mavi.com", "H&M":"https://www2.hm.com/tr_tr", "Mango":"https://shop.mango.com/tr",
    "English Home":"https://www.englishhome.com", "Karaca":"https://www.karaca.com", "Madame Coco":"https://www.madamecoco.com"
  },
  campaigns: [
  {"id":"giyim-00","cat":"giyim","hour":0,"brand":"LC Waikiki","offer":"Çocuk mont %50 indirimli","findSec":5,"durationMin":10,"quota":5},
  {"id":"giyim-01","cat":"giyim","hour":1,"brand":"Fabrika","offer":"Elbise %50 indirimli","findSec":5,"durationMin":11,"quota":10},
  {"id":"giyim-02","cat":"giyim","hour":2,"brand":"Defacto","offer":"Erkek eşofman takımı %60 indirimli","findSec":5,"durationMin":12,"quota":15},
  {"id":"giyim-03","cat":"giyim","hour":3,"brand":"Altınyıldız","offer":"Takım elbise %40 indirimli","findSec":5,"durationMin":13,"quota":10},
  {"id":"giyim-04","cat":"giyim","hour":4,"brand":"Koton","offer":null,"findSec":5,"durationMin":14,"quota":20},
  {"id":"giyim-05","cat":"giyim","hour":5,"brand":"Slazenger","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"giyim-06","cat":"giyim","hour":6,"brand":"D1ffrence","offer":null,"findSec":5,"durationMin":30,"quota":50},
  {"id":"giyim-07","cat":"giyim","hour":7,"brand":"Mavi","offer":null,"findSec":5,"durationMin":30,"quota":50},
  {"id":"giyim-08","cat":"giyim","hour":8,"brand":"Jack Jones","offer":null,"findSec":5,"durationMin":30,"quota":50},
  {"id":"giyim-09","cat":"giyim","hour":9,"brand":"Nicoletta","offer":null,"findSec":5,"durationMin":30,"quota":50},
  {"id":"giyim-10","cat":"giyim","hour":10,"brand":"Adidas","offer":null,"findSec":5,"durationMin":30,"quota":20},
  {"id":"giyim-11","cat":"giyim","hour":11,"brand":"Buratti","offer":null,"findSec":5,"durationMin":15,"quota":5},
  {"id":"giyim-12","cat":"giyim","hour":12,"brand":"Lela","offer":null,"findSec":5,"durationMin":15,"quota":50},
  {"id":"giyim-13","cat":"giyim","hour":13,"brand":"Lufian","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"giyim-14","cat":"giyim","hour":14,"brand":"Damat","offer":null,"findSec":5,"durationMin":15,"quota":5},
  {"id":"giyim-15","cat":"giyim","hour":15,"brand":"Civil","offer":null,"findSec":5,"durationMin":15,"quota":50},
  {"id":"giyim-16","cat":"giyim","hour":16,"brand":"Pierre Cardin","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"giyim-17","cat":"giyim","hour":17,"brand":"Hummel","offer":null,"findSec":5,"durationMin":15,"quota":5},
  {"id":"giyim-18","cat":"giyim","hour":18,"brand":"North Face","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"giyim-19","cat":"giyim","hour":19,"brand":"Tommy Life","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"giyim-20","cat":"giyim","hour":20,"brand":"U.S. Polo Assn.","offer":null,"findSec":5,"durationMin":15,"quota":50},
  {"id":"giyim-21","cat":"giyim","hour":21,"brand":"Mango","offer":null,"findSec":5,"durationMin":15,"quota":5},
  {"id":"giyim-22","cat":"giyim","hour":22,"brand":"Madmext","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"giyim-23","cat":"giyim","hour":23,"brand":"H&M","offer":null,"findSec":5,"durationMin":15,"quota":50},
  {"id":"ayakkabi-00","cat":"ayakkabi","hour":0,"brand":"Tonny Black","offer":null,"findSec":5,"durationMin":10,"quota":5},
  {"id":"ayakkabi-01","cat":"ayakkabi","hour":1,"brand":"Daxtors","offer":null,"findSec":5,"durationMin":11,"quota":10},
  {"id":"ayakkabi-02","cat":"ayakkabi","hour":2,"brand":"Adidas","offer":null,"findSec":5,"durationMin":12,"quota":15},
  {"id":"ayakkabi-03","cat":"ayakkabi","hour":3,"brand":"Hummel","offer":null,"findSec":5,"durationMin":13,"quota":10},
  {"id":"ayakkabi-04","cat":"ayakkabi","hour":4,"brand":"Ugg","offer":null,"findSec":5,"durationMin":14,"quota":20},
  {"id":"ayakkabi-05","cat":"ayakkabi","hour":5,"brand":"Vicco","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"ayakkabi-06","cat":"ayakkabi","hour":6,"brand":"Puma","offer":null,"findSec":5,"durationMin":30,"quota":50},
  {"id":"ayakkabi-07","cat":"ayakkabi","hour":7,"brand":"Crocs","offer":null,"findSec":5,"durationMin":30,"quota":50},
  {"id":"ayakkabi-08","cat":"ayakkabi","hour":8,"brand":"Igor","offer":null,"findSec":5,"durationMin":30,"quota":50},
  {"id":"ayakkabi-09","cat":"ayakkabi","hour":9,"brand":"Cat","offer":null,"findSec":5,"durationMin":30,"quota":50},
  {"id":"ayakkabi-10","cat":"ayakkabi","hour":10,"brand":"Harley","offer":null,"findSec":5,"durationMin":30,"quota":20},
  {"id":"ayakkabi-11","cat":"ayakkabi","hour":11,"brand":"Columbia","offer":null,"findSec":5,"durationMin":15,"quota":5},
  {"id":"ayakkabi-12","cat":"ayakkabi","hour":12,"brand":"New Balance","offer":null,"findSec":5,"durationMin":15,"quota":50},
  {"id":"ayakkabi-13","cat":"ayakkabi","hour":13,"brand":"Kemal Tanca","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"ayakkabi-14","cat":"ayakkabi","hour":14,"brand":"Hotiç","offer":null,"findSec":5,"durationMin":15,"quota":5},
  {"id":"ayakkabi-15","cat":"ayakkabi","hour":15,"brand":"Ceyo","offer":null,"findSec":5,"durationMin":15,"quota":50},
  {"id":"ayakkabi-16","cat":"ayakkabi","hour":16,"brand":"Polaris","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"ayakkabi-17","cat":"ayakkabi","hour":17,"brand":"Lumberjack","offer":null,"findSec":5,"durationMin":15,"quota":5},
  {"id":"ayakkabi-18","cat":"ayakkabi","hour":18,"brand":"U.S. Polo Assn.","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"ayakkabi-19","cat":"ayakkabi","hour":19,"brand":"Limoya","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"ayakkabi-20","cat":"ayakkabi","hour":20,"brand":"Muggo","offer":null,"findSec":5,"durationMin":15,"quota":50},
  {"id":"ayakkabi-21","cat":"ayakkabi","hour":21,"brand":"Gezer","offer":null,"findSec":5,"durationMin":15,"quota":5},
  {"id":"ayakkabi-22","cat":"ayakkabi","hour":22,"brand":"Marjin","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"ayakkabi-23","cat":"ayakkabi","hour":23,"brand":"Ziya","offer":null,"findSec":5,"durationMin":15,"quota":50},
  {"id":"ev-tekstil-00","cat":"ev-tekstil","hour":0,"brand":"English Home","offer":null,"findSec":5,"durationMin":10,"quota":5},
  {"id":"ev-tekstil-01","cat":"ev-tekstil","hour":1,"brand":"Madame Coco","offer":null,"findSec":5,"durationMin":11,"quota":10},
  {"id":"ev-tekstil-02","cat":"ev-tekstil","hour":2,"brand":"Karaca","offer":null,"findSec":5,"durationMin":12,"quota":15},
  {"id":"ev-tekstil-03","cat":"ev-tekstil","hour":3,"brand":"Tefal","offer":null,"findSec":5,"durationMin":13,"quota":10},
  {"id":"ev-tekstil-04","cat":"ev-tekstil","hour":4,"brand":"Jumbo","offer":null,"findSec":5,"durationMin":14,"quota":20},
  {"id":"ev-tekstil-05","cat":"ev-tekstil","hour":5,"brand":"Özdilek","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"ev-tekstil-06","cat":"ev-tekstil","hour":6,"brand":"Paşabahçe","offer":null,"findSec":5,"durationMin":30,"quota":50},
  {"id":"ev-tekstil-07","cat":"ev-tekstil","hour":7,"brand":"Penelope","offer":null,"findSec":5,"durationMin":30,"quota":50},
  {"id":"ev-tekstil-08","cat":"ev-tekstil","hour":8,"brand":"Noname","offer":null,"findSec":5,"durationMin":30,"quota":50},
  {"id":"ev-tekstil-09","cat":"ev-tekstil","hour":9,"brand":"Taç","offer":null,"findSec":5,"durationMin":30,"quota":50},
  {"id":"ev-tekstil-10","cat":"ev-tekstil","hour":10,"brand":"Modalife","offer":null,"findSec":5,"durationMin":30,"quota":20},
  {"id":"ev-tekstil-11","cat":"ev-tekstil","hour":11,"brand":"Kitchen Life","offer":null,"findSec":5,"durationMin":15,"quota":5},
  {"id":"ev-tekstil-12","cat":"ev-tekstil","hour":12,"brand":"Bella Maison","offer":null,"findSec":5,"durationMin":15,"quota":50},
  {"id":"ev-tekstil-13","cat":"ev-tekstil","hour":13,"brand":"Chakra","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"ev-tekstil-14","cat":"ev-tekstil","hour":14,"brand":"Yataş","offer":null,"findSec":5,"durationMin":15,"quota":5},
  {"id":"ev-tekstil-15","cat":"ev-tekstil","hour":15,"brand":"LAV","offer":null,"findSec":5,"durationMin":15,"quota":50},
  {"id":"ev-tekstil-16","cat":"ev-tekstil","hour":16,"brand":"Acar","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"ev-tekstil-17","cat":"ev-tekstil","hour":17,"brand":"Meleni","offer":null,"findSec":5,"durationMin":15,"quota":5},
  {"id":"ev-tekstil-18","cat":"ev-tekstil","hour":18,"brand":"Elart","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"ev-tekstil-19","cat":"ev-tekstil","hour":19,"brand":"Schafer","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"ev-tekstil-20","cat":"ev-tekstil","hour":20,"brand":"Evidea","offer":null,"findSec":5,"durationMin":15,"quota":50},
  {"id":"ev-tekstil-21","cat":"ev-tekstil","hour":21,"brand":"English Home","offer":null,"findSec":5,"durationMin":15,"quota":5},
  {"id":"ev-tekstil-22","cat":"ev-tekstil","hour":22,"brand":"Madame Coco","offer":null,"findSec":5,"durationMin":15,"quota":20},
  {"id":"ev-tekstil-23","cat":"ev-tekstil","hour":23,"brand":"Karaca","offer":null,"findSec":5,"durationMin":15,"quota":50}
  ]
};
