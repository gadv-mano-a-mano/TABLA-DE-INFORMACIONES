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

import { CONFIG } from "../config.js";

const app = initializeApp(CONFIG.firebaseConfig);

export const auth = getAuth(app);
export const storage = getStorage(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export function onAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function signInGoogle() {
  await signInWithRedirect(auth, provider);
}

export async function handleAuthRedirect() {
  try {
    await getRedirectResult(auth);
  } catch (_) {
    // silencioso
  }
}

export async function signOutUser() {
  await signOut(auth);
}

