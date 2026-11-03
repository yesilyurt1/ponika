// Pilates ders takvimi ayarları.
//
// firebase: null iken uygulama DEMO modunda çalışır (veriler sadece o tarayıcıda tutulur).
// Gerçek kullanım için README.md'deki adımları izleyip Firebase ayarlarını buraya yapıştırın.
window.PILATES_CONFIG = {
  studioName: "Pilates Stüdyo",

  // Yönetici (hoca) olacak e-posta adresleri. firestore.rules dosyasındaki listeyle AYNI olmalı.
  adminEmails: [
    // "hoca@ornek.com"
  ],

  // Firebase konsolundan kopyalanan web uygulaması ayarları:
  firebase: null
  // firebase: {
  //   apiKey: "...",
  //   authDomain: "proje-adi.firebaseapp.com",
  //   projectId: "proje-adi",
  //   storageBucket: "proje-adi.appspot.com",
  //   messagingSenderId: "...",
  //   appId: "..."
  // }
};
