// config.js
export const CONFIG = {
  // ===== Firebase Web App config (ya lo tienes) =====
  firebaseConfig: {
    apiKey: "AIzaSyA3f-IdR6O_kl3LLeru3vNG1qFgBGJg_O0",
    authDomain: "info-board-v3.firebaseapp.com",
    projectId: "info-board-v3",
    storageBucket: "info-board-v3.firebasestorage.app",
    messagingSenderId: "70958093532",
    appId: "1:70958093532:web:750f05dc1606da3d789019",
  },

  // ===== Admins (los mismos de tus rules) =====
  adminEmails: [
    "gadv.mano.a.mano@gmail.com",
    "guian.devi1265@gmail.com",
    "pedelvi@gmail.com",
  ],

  // ===== Google Sheets CSV (los que ya generaste) =====
  sheets: {
    projectsCsv:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vRCG-Fb-uIs4UAWWQioIRUX7zRW2aD6gydQcYhP4YGwByesp7Jfodq5wrjh0wnfUTZbyEHVuIdDAPEj/pub?gid=0&single=true&output=csv",
    flightsCsv:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vRCG-Fb-uIs4UAWWQioIRUX7zRW2aD6gydQcYhP4YGwByesp7Jfodq5wrjh0wnfUTZbyEHVuIdDAPEj/pub?gid=2103036915&single=true&output=csv",
  },

  // ===== Tabla =====
  refreshSeconds: 30,
  maxShow: 7,

  // ===== Carrusel =====
  boardDurationMs: 30000,      // tiempo mostrando tablas antes de ir al carrusel
  readManifestOnStartup: true, // lee manifest 1 vez al inicio
  // luego SOLO se actualiza con botón (para ahorrar requests)
};

