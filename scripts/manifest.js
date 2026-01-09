import {
  ref,
  getBytes,
  uploadBytes,
  getMetadata,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

import { storage } from "./firebase.js";

export const MANIFEST_PATH = "carousel/manifest.json";

// 25 imágenes: 01ad..25ad + 2 videos
const IMAGE_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { id: `${n}ad`, kind: "image" };
});

const VIDEO_SLOTS = [
  { id: "01video", kind: "video" },
  { id: "02video", kind: "video" },
];

export const SLOT_DEFS = [...IMAGE_SLOTS, ...VIDEO_SLOTS];

export function defaultManifest(boardDurationMs = 30000) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    board: { durationMs: boardDurationMs },
    slots: SLOT_DEFS.map(s => ({
      id: s.id,
      kind: s.kind,
      enabled: false,
      path: null,
      contentType: null,
      size: null,
      durationMs: 10000,
      useVideoDuration: s.kind === "video",
      cacheBuster: null,
      updatedAt: null
    }))
  };
}

export async function readManifest() {
  const mref = ref(storage, MANIFEST_PATH);
  const bytes = await getBytes(mref, 256 * 1024);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

export async function writeManifest(manifest) {
  const mref = ref(storage, MANIFEST_PATH);
  const data = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  await uploadBytes(mref, data, {
    contentType: "application/json",
    cacheControl: "no-cache"
  });
  return true;
}

export async function getUrlForPath(path) {
  const oref = ref(storage, path);
  return getDownloadURL(oref);
}

export async function deletePath(path) {
  const oref = ref(storage, path);
  return deleteObject(oref);
}

