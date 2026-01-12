import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

// scripts/firebase.js
import { CONFIG } from "../config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

export const app = initializeApp(CONFIG.firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

let persistenceReady = false;
async function initAuthPersistence() {
  if (persistenceReady) return;
  await setPersistence(auth, browserLocalPersistence);
  persistenceReady = true;
}

export function onAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function signInGoogle() {
  await initAuthPersistence();

  // 1) Intentar POPUP (más estable en GitHub Pages)
  try {
    return await signInWithPopup(auth, provider);
  } catch (err) {
    // 2) Fallback a REDIRECT si el popup está bloqueado
    const code = err?.code || "";
    if (
      code === "auth/popup-blocked" ||
      code === "auth/popup-closed-by-user" ||
      code === "auth/operation-not-supported-in-this-environment"
    ) {
      return await signInWithRedirect(auth, provider);
    }
    throw err;
  }
}

export async function handleAuthRedirect() {
  await initAuthPersistence();
  // IMPORTANTE: no ocultar errores
  return await getRedirectResult(auth);
}

export async function signOutUser() {
  return await signOut(auth);
}
