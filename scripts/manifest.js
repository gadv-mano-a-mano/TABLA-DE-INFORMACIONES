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
const MAX_MANIFEST_BYTES = 512 * 1024;

// ===== Slots: 25 imágenes + 2 videos =====
const IMAGE_SLOTS = 25;

export const SLOT_DEFS = [
  ...Array.from({ length: IMAGE_SLOTS }, (_, i) => ({
    id: `${String(i + 1).padStart(2, "0")}ad`,
    kind: "image"
  })),
  { id: "01video", kind: "video" },
  { id: "02video", kind: "video" }
];

export function defaultManifest() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    board: { durationMs: 30000 },
    slots: SLOT_DEFS.map((s) => ({
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

function isMissingStorageObject(error) {
  return error?.code === "storage/object-not-found";
}

function normalizeManifest(manifest) {
  const base = defaultManifest();
  const definedIds = new Set(base.slots.map((slot) => slot.id));

  const mergedSlots = base.slots.map((slot) => {
    const override = manifest.slots?.find((s) => s.id === slot.id);
    return override ? { ...slot, ...override } : slot;
  });

  const extraSlots = Array.isArray(manifest.slots)
    ? manifest.slots.filter((slot) => !definedIds.has(slot.id))
    : [];

  return {
    ...base,
    ...manifest,
    board: { ...base.board, ...(manifest.board ?? {}) },
    slots: [...mergedSlots, ...extraSlots]
  };
}

/**
 * IMPORTANTE:
 * - readManifest() SOLO LEE.
 * - NO crea ni sobrescribe manifest automáticamente.
 * - Si falta y fallbackToDefault=true, devuelve default en memoria.
 */
export async function readManifest(options = {}) {
  const { fallbackToDefault = true, normalize = true } = {
    fallbackToDefault: true,
    normalize: true,
    ...options
  };

  const mref = ref(storage, MANIFEST_PATH);

  try {
    const bytes = await getBytes(mref, MAX_MANIFEST_BYTES);
    const text = new TextDecoder().decode(bytes);

    // Si por algún motivo llega vacío/no texto JSON
    if (!text || !text.trim()) {
      const err = new Error("Manifest vacío o ilegible (contenido vacío).");
      err.code = "manifest/empty";
      throw err;
    }

    const parsed = JSON.parse(text);
    return normalize ? normalizeManifest(parsed) : parsed;
  } catch (error) {
    // Si NO existe, opcionalmente devolvemos default (SIN escribir en Firebase)
    if (isMissingStorageObject(error)) {
      if (fallbackToDefault) return defaultManifest();
      throw error;
    }

    // Si el JSON es inválido, NUNCA lo sobreescribimos automáticamente
    if (error instanceof SyntaxError) {
      const err = new Error("Manifest JSON inválido. No se sobrescribe automáticamente.");
      err.code = "manifest/invalid-json";
      throw err;
    }

    // Si es un error de “contenido vacío”
    if (error?.code === "manifest/empty") {
      throw error;
    }

    throw error;
  }
}

export async function writeManifest(manifest) {
  const mref = ref(storage, MANIFEST_PATH);
  const data = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

  // manifest: no-cache para cambios rápidos en público
  await uploadBytes(mref, data, {
    contentType: "application/json",
    cacheControl: "no-cache"
  });

  return true;
}

export async function getManifestMeta() {
  const mref = ref(storage, MANIFEST_PATH);
  return getMetadata(mref);
}

export async function getUrlForPath(path) {
  const oref = ref(storage, path);
  return getDownloadURL(oref);
}

export async function deletePath(path) {
  const oref = ref(storage, path);
  return deleteObject(oref);
}
