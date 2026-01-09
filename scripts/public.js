import { CONFIG } from "../config.js";
import { readManifest, getUrlForPath } from "./manifest.js";

const PROJECTS_CSV_URL = CONFIG.sheets.projectsCsv;
const FLIGHTS_CSV_URL  = CONFIG.sheets.flightsCsv;

const REFRESH_SECONDS = CONFIG.refreshSeconds;
const MAX_SHOW = CONFIG.maxShow; // 7

// UI
const rowsProjects = document.getElementById("rowsProjects");
const rowsFlights  = document.getElementById("rowsFlights");
const errProjects  = document.getElementById("errProjects");
const errFlights   = document.getElementById("errFlights");
const elLast       = document.getElementById("lastUpdate");
const countProjects= document.getElementById("countProjects");
const countFlights = document.getElementById("countFlights");
document.getElementById("refreshEvery").textContent = REFRESH_SECONDS;

const boardScreen = document.getElementById("boardScreen");
const mediaScreen = document.getElementById("mediaScreen");
const mediaImg = document.getElementById("mediaImg");
const mediaVideo = document.getElementById("mediaVideo");
const mediaLoading = document.getElementById("mediaLoading");

const btnFs = document.getElementById("btnFs");
const btnRefreshCarousel = document.getElementById("btnRefreshCarousel");
const carouselStatus = document.getElementById("carouselStatus");

let boardRefreshTimer = null;
let playlistTimer = null;
let currentIndex = 0;

let manifestCache = null;
let urlCache = new Map(); // key: path|buster -> url
let audioUnlocked = false;

// Mantener último dato bueno (evita que la tabla “desaparezca” si falla fetch)
let lastGoodProjects = null;
let lastGoodFlights = null;

/* ========= Clock ========= */
function tickClock(){
  const d = new Date();
  document.getElementById("now").textContent =
    d.toLocaleString(undefined, {
      weekday:"short", year:"numeric", month:"short", day:"2-digit",
      hour:"2-digit", minute:"2-digit"
    });
}
setInterval(tickClock, 1000);
tickClock();

/* ========= CSV helpers ========= */
function safe(v){ return (v ?? "").toString().trim(); }

function normHeader(h){
  return safe(h)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCSV(text){
  const rows = [];
  let row = [], cur = "", inQuotes = false;

  for (let i=0; i<text.length; i++){
    const ch = text[i];
    const next = text[i+1];

    if (ch === '"' && inQuotes && next === '"'){ cur += '"'; i++; }
    else if (ch === '"'){ inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes){ row.push(cur); cur = ""; }
    else if ((ch === '\n' || ch === '\r') && !inQuotes){
      if (cur.length || row.length){
        row.push(cur); cur = "";
        if (ch === '\r' && next === '\n') i++;
        rows.push(row);
        row = [];
      }
    } else cur += ch;
  }
  if (cur.length || row.length){ row.push(cur); rows.push(row); }
  return rows;
}

function requireIdx(headersNorm, candidates, label, headersRaw){
  for (const c of candidates){
    const i = headersNorm.indexOf(c);
    if (i !== -1) return i;
  }
  throw new Error(
    `${label}: encabezado no encontrado.\n` +
    `Busqué: ${candidates.join(", ")}\n` +
    `Encabezados detectados: ${headersRaw.join(" | ")}`
  );
}

/* ========= Fetch robusto (reintentos + timeout) ========= */
async function fetchWithTimeout(url, ms = 10000){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try{
    const res = await fetch(url, { cache:"no-store", signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function fetchRetry(url, retries = 2, baseDelayMs = 700){
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++){
    try{
      const res = await fetchWithTimeout(url, 10000);
      return res;
    } catch(e){
      lastErr = e;
      const delay = baseDelayMs * Math.pow(1.6, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr || new Error("Failed to fetch");
}

async function loadCSV(url){
  const finalUrl = url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
  const res = await fetchRetry(finalUrl, 2, 650);
  if (!res.ok) throw new Error("No se pudo cargar el CSV: " + res.status);

  const text = await res.text();

  // Si Google devuelve HTML, no está publicado como CSV
  const t = text.trim();
  if (t.startsWith("<!DOCTYPE") || t.startsWith("<html")){
    throw new Error("Google devolvió HTML (no CSV). Revisa Publish to web + permisos.");
  }

  const data = parseCSV(text);
  if (!data.length) throw new Error("CSV vacío.");

  const headersRaw = data[0];
  const headersNorm = headersRaw.map(normHeader);
  const rows = data.slice(1).filter(r => r.some(c => safe(c) !== ""));
  return { headersRaw, headersNorm, rows };
}

/* ========= Render helpers ========= */
function statusPill(txt){
  const t = safe(txt).toUpperCase();
  const label = t || "—";
  return `<span class="status">${label}</span>`;
}

function takeLatest(rows){
  return rows.slice(-MAX_SHOW).reverse();
}

function padTo(arr, n){
  const out = arr.slice(0, n);
  while(out.length < n) out.push(null);
  return out;
}

function setError(el, msg){
  el.textContent = msg;
  el.style.display = "block";
}
function clearError(el){
  el.textContent = "";
  el.style.display = "none";
}

/* ========= Projects ========= */
function renderProjects(headersNorm, headersRaw, rows){
  clearError(errProjects);
  rowsProjects.innerHTML = "";

  const iInst = requireIdx(headersNorm, ["institucion","institution"], "PROYECTOS/INSTITUCION", headersRaw);
  const iProg = requireIdx(headersNorm, ["programas","programa","programs"], "PROYECTOS/PROGRAMAS", headersRaw);
  const iProy = requireIdx(headersNorm, ["proyectos","proyecto","projects","project"], "PROYECTOS/PROYECTOS", headersRaw);
  const iEst  = requireIdx(headersNorm, ["estado","status"], "PROYECTOS/ESTADO", headersRaw);

  const latest = padTo(takeLatest(rows), MAX_SHOW);

  for (const r of latest){
    const tr = document.createElement("tr");

    if (!r){
      tr.innerHTML = `
        <td>&nbsp;</td>
        <td class="center">&nbsp;</td>
        <td class="right">&nbsp;</td>
        <td class="right">&nbsp;</td>
      `;
    } else {
      const inst = safe(r[iInst]) || "—";
      const prog = safe(r[iProg]) || "—";
      const proy = safe(r[iProy]) || "—";
      tr.innerHTML = `
        <td title="${inst}">${inst}</td>
        <td class="center" title="${prog}">${prog}</td>
        <td class="right" title="${proy}">${proy}</td>
        <td class="right">${statusPill(r[iEst])}</td>
      `;
    }

    rowsProjects.appendChild(tr);
  }

  countProjects.textContent = rows.length;
}

/* ========= Flights ========= */
function renderFlights(headersNorm, headersRaw, rows){
  clearError(errFlights);
  rowsFlights.innerHTML = "";

  const iFecha = requireIdx(headersNorm, ["fecha","date"], "VUELOS/FECHA", headersRaw);
  const iAer   = requireIdx(headersNorm, ["aeronave","aircraft","plane"], "VUELOS/AERONAVE", headersRaw);
  const iTipo  = requireIdx(headersNorm, ["tipo_de_vuelo","tipo_vuelo","flight_type"], "VUELOS/TIPO DE VUELO", headersRaw);
  const iDest  = requireIdx(headersNorm, ["destino","destination"], "VUELOS/DESTINO", headersRaw);
  const iHora  = requireIdx(headersNorm, ["hora_de_salida","hora_salida","hora","std","time"], "VUELOS/HORA DE SALIDA", headersRaw);

  const latest = padTo(takeLatest(rows), MAX_SHOW);

  for (const r of latest){
    const tr = document.createElement("tr");

    if (!r){
      tr.innerHTML = `
        <td>&nbsp;</td>
        <td class="center">&nbsp;</td>
        <td class="center">&nbsp;</td>
        <td class="center">&nbsp;</td>
        <td class="right">&nbsp;</td>
      `;
    } else {
      const fecha = safe(r[iFecha]) || "—";
      const aer   = safe(r[iAer]) || "—";
      const tipo  = safe(r[iTipo]) || "—";
      const dest  = safe(r[iDest]) || "—";
      const hora  = safe(r[iHora]) || "—";

      tr.innerHTML = `
        <td title="${fecha}">${fecha}</td>
        <td class="center" title="${aer}">${aer}</td>
        <td class="center" title="${tipo}">${tipo}</td>
        <td class="center" title="${dest}">${dest}</td>
        <td class="right" title="${hora}">${hora}</td>
      `;
    }

    rowsFlights.appendChild(tr);
  }

  countFlights.textContent = rows.length;
}

/* ========= Load all (robusto) ========= */
async function loadAll(){
  // Projects
  try{
    const p = await loadCSV(PROJECTS_CSV_URL);
    lastGoodProjects = p;
    renderProjects(p.headersNorm, p.headersRaw, p.rows);
  } catch(e){
    // Si ya tenemos data buena, NO borramos la tabla (solo avisamos suave)
    if (!lastGoodProjects){
      rowsProjects.innerHTML = "";
      countProjects.textContent = "0";
    }
    setError(errProjects, "Error de conexión (proyectos). Reintentando…");
  }

  // Flights
  try{
    const f = await loadCSV(FLIGHTS_CSV_URL);
    lastGoodFlights = f;
    renderFlights(f.headersNorm, f.headersRaw, f.rows);
  } catch(e){
    if (!lastGoodFlights){
      rowsFlights.innerHTML = "";
      countFlights.textContent = "0";
    }
    setError(errFlights, "Error de conexión (vuelos). Reintentando…");
  }

  // Last update siempre
  elLast.textContent = new Date().toLocaleTimeString(undefined, {
    hour:"2-digit", minute:"2-digit", second:"2-digit"
  });
}

/* ========= Fullscreen ========= */
function isFullscreen(){
  return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
}
function requestFs(el){
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  if (el.msRequestFullscreen) return el.msRequestFullscreen();
  return Promise.reject(new Error("Fullscreen no soportado"));
}
function exitFs(){
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  if (document.msExitFullscreen) return document.msExitFullscreen();
}
btnFs?.addEventListener("click", async () => {
  try{
    audioUnlocked = true;
    if (!isFullscreen()) await requestFs(document.documentElement);
    else await exitFs();
  }catch(_){}
});

/* ========= Manifest / playlist ========= */
function withBuster(url, buster){
  if (!buster) return url;
  return url + (url.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(buster);
}
async function resolveUrl(path, buster){
  const key = `${path}|${buster || ""}`;
  if (urlCache.has(key)) return urlCache.get(key);
  const url = await getUrlForPath(path);
  const finalUrl = withBuster(url, buster);
  urlCache.set(key, finalUrl);
  return finalUrl;
}
function buildPlaylist(manifest){
  const items = [];
  items.push({ type:"board", durationMs: (manifest?.board?.durationMs ?? CONFIG.boardDurationMs) });

  const slots = Array.isArray(manifest?.slots) ? manifest.slots : [];
  for (const s of slots){
    if (!s?.enabled || !s?.path) continue;
    items.push({
      type: "media",
      kind: s.kind,
      path: s.path,
      durationMs: s.durationMs ?? 10000,
      useVideoDuration: !!s.useVideoDuration,
      cacheBuster: s.cacheBuster || null
    });
  }
  return items;
}

async function refreshManifestOnce(){
  carouselStatus.textContent = "Cargando carrusel…";
  try{
    const m = await readManifest();
    manifestCache = m;
    urlCache.clear();
    carouselStatus.textContent = "Carrusel OK";
  }catch(_){
    manifestCache = null;
    carouselStatus.textContent = "Carrusel: sin manifest (ok si aún no creaste)";
  }
}

/* ========= Board/media switching ========= */
function stopBoardRefresh(){
  if (boardRefreshTimer){
    clearInterval(boardRefreshTimer);
    boardRefreshTimer = null;
  }
}
function startBoardRefresh(){
  if (boardRefreshTimer) return;
  loadAll();
  boardRefreshTimer = setInterval(loadAll, REFRESH_SECONDS * 1000);
}

function stopMedia(){
  mediaImg.style.display = "none";
  mediaVideo.style.display = "none";
  mediaLoading.style.display = "none";

  mediaVideo.pause();
  mediaVideo.removeAttribute("src");
  mediaVideo.load();
}

function showBoard(){
  document.body.dataset.screen = "board";
  mediaScreen.style.display = "none";
  boardScreen.style.display = "block";
  stopMedia();
  startBoardRefresh();
}

async function showMedia(item){
  document.body.dataset.screen = "media";
  stopBoardRefresh();

  boardScreen.style.display = "none";
  mediaScreen.style.display = "block";

  mediaLoading.style.display = "block";
  mediaLoading.querySelector("span").textContent = "Cargando…";

  const url = await resolveUrl(item.path, item.cacheBuster);

  if (item.kind === "image"){
    mediaVideo.style.display = "none";
    mediaImg.style.display = "block";

    await new Promise((resolve) => {
      mediaImg.onload = () => resolve(true);
      mediaImg.onerror = () => resolve(false);
      mediaImg.src = url;
    });

    mediaLoading.style.display = "none";
    scheduleNext(item.durationMs || 10000);
    return;
  }

  mediaImg.style.display = "none";
  mediaVideo.style.display = "block";

  mediaVideo.muted = false;
  mediaVideo.autoplay = true;
  mediaVideo.playsInline = true;
  mediaVideo.loop = false;
  mediaVideo.controls = false;
  mediaVideo.preload = "auto";
  mediaVideo.src = url;
  mediaVideo.load();

  await new Promise((resolve) => {
    const done = () => resolve(true);
    mediaVideo.onloadedmetadata = done;
    mediaVideo.onerror = done;
    setTimeout(done, 2500);
  });

  try{
    await mediaVideo.play();
    mediaLoading.style.display = "none";
  }catch(_){
    try{
      mediaVideo.muted = true;
      await mediaVideo.play();
      mediaLoading.querySelector("span").textContent =
        audioUnlocked ? "Reproduciendo (audio bloqueado)" : "Audio bloqueado: presiona ⛶";
    }catch(_e){
      mediaLoading.querySelector("span").textContent = "Error reproduciendo video";
    }
  }

  if (item.useVideoDuration){
    mediaVideo.onended = () => next();
    const safetyMs = Math.min(Math.max((mediaVideo.duration || 20) * 1000 + 1500, 8000), 180000);
    scheduleNext(safetyMs);
  }else{
    scheduleNext(item.durationMs || 10000);
  }
}

function scheduleNext(ms){
  if (playlistTimer) clearTimeout(playlistTimer);
  playlistTimer = setTimeout(() => next(), ms);
}

async function next(){
  const playlist = buildPlaylist(manifestCache || { slots: [], board:{durationMs:CONFIG.boardDurationMs} });
  currentIndex = (currentIndex + 1) % playlist.length;
  const item = playlist[currentIndex];

  if (item.type === "board"){
    showBoard();
    scheduleNext(item.durationMs || CONFIG.boardDurationMs);
    return;
  }

  try{
    await showMedia(item);
  }catch(_){
    showBoard();
    scheduleNext(CONFIG.boardDurationMs);
  }
}

// Botón: actualizar carrusel (manual)
btnRefreshCarousel?.addEventListener("click", async () => {
  btnRefreshCarousel.disabled = true;
  try{
    await refreshManifestOnce();
  } finally {
    btnRefreshCarousel.disabled = false;
  }
});

/* ========= Start ========= */
async function start(){
  showBoard();

  if (CONFIG.readManifestOnStartup) {
    await refreshManifestOnce(); // 1 sola vez al inicio
  } else {
    carouselStatus.textContent = "Carrusel: manual (↻)";
  }

  currentIndex = 0;
  scheduleNext(CONFIG.boardDurationMs);
}

start();
