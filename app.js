'use strict';

/* ============================================================
   CONFIGURACIÓN
   Para renombrar el proyecto cambia estas constantes, el "name"
   de manifest.json y el <title> de index.html.
   (Si cambias STORAGE_KEY o DB_NAME, los datos ya guardados
   dejarán de verse: haz antes un respaldo y cárgalo después.)
   ============================================================ */
const APP_NAME = 'Chincheta';
const EXPORT_SLUG = 'chincheta';
const STORAGE_KEY = 'chincheta:datos:v1';
const DB_NAME = 'chincheta-imagenes';
const DB_STORE = 'imagenes';

const TYPES = {
  /* `label` es una propiedad que se traduce al idioma activo (ver i18n.js) */
  tasks: { get label() { return t('type.tasks'); }, cls: 'rosa' },
  note: { get label() { return t('type.note'); }, cls: 'amarillo' },
  links: { get label() { return t('type.links'); }, cls: 'azul' },
  image: { get label() { return t('type.image'); }, cls: 'foto' },
  draw: { get label() { return t('type.draw'); }, cls: 'menta' },
  alert: { get label() { return t('type.alert'); }, cls: 'naranja' },
};

/* Tipos de evento del calendario.
   - event: se muestra el día indicado y termina al pasar la fecha.
   - birthday: atemporal, se repite todos los años. */
const EVENT_TYPES = {
  event: { get label() { return t('ev.type.event'); }, icon: '🔔', cls: 't-event' },
  birthday: { get label() { return t('ev.type.birthday'); }, icon: '🎂', cls: 't-birthday' },
};

/* Tamaño de las notas en el tablero (en rem, así escalan con la interfaz) */
const NOTE_W = 11.5;
const PHOTO_W = 12.75;
const MIN_W = 7;
const MAX_W = 24;
/* Versión del formato de posiciones: 2 = fracción del tablero (0 a 1). La 1 eran píxeles. */
const LAYOUT_VERSION = 2;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS_LUN = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

/* ============================================================
   Utilidades
   ============================================================ */
const $ = (sel, root = document) => root.querySelector(sel);
const uid = () => globalThis.crypto?.randomUUID?.() ?? (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n) => String(n).padStart(2, '0');

/** Crea un elemento DOM. Todo el texto entra por textContent (nunca innerHTML). */
function h(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked') node[k] = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

/* Fechas: siempre en hora local, como texto AAAA-MM-DD */
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const todayKey = () => dateKey(new Date());
const keyToUTC = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const dayDiff = (a, b) => Math.round((keyToUTC(b) - keyToUTC(a)) / 864e5);
const fmtLong = (k) => fmtLongIntl(parseKey(k));  // «jueves, 5 de noviembre» (según el idioma)
const fmtFull = (k) => fmtFullIntl(parseKey(k));  // con el año

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 4200);
}

/* Solo se aceptan enlaces http/https (evita "javascript:" y similares). */
function cleanUrl(v) {
  if (typeof v !== 'string') return '';
  let s = v.trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return '';
    s = 'https://' + s;
  }
  try {
    const u = new URL(s);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
  } catch { return ''; }
}
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

/* ============================================================
   Datos: texto en localStorage, imágenes en IndexedDB
   ============================================================ */
let state = { layout: LAYOUT_VERSION, items: [], events: [], settings: { sound: true, dockId: '', dockW: DOCK_W } };
let maxZ = 1;
const imageURLs = new Map(); // id de imagen -> object URL

const str = (v, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v, def = 0) => (Number.isFinite(v) ? v : def);

function sanitizeItem(it) {
  if (!it || !TYPES[it.type]) return null;
  const base = {
    id: str(it.id, 80) || uid(),
    type: it.type,
    title: str(it.title, 120),
    x: clamp(num(it.x, 0.05), 0, 1),
    y: clamp(num(it.y, 0.08), 0, 1),
    w: clamp(num(it.w, it.type === 'image' ? PHOTO_W : NOTE_W), MIN_W, MAX_W),
    rot: clamp(num(it.rot, 0), -6, 6),
    z: num(it.z, 1),
    pin: Math.abs(Math.trunc(num(it.pin, 0))) % 4,
    imageUrl: cleanUrl(it.imageUrl),
  };
  if (it.type === 'note') base.body = str(it.body, 20000);
  if (it.type === 'draw') base.hasDrawing = !!it.hasDrawing;
  if (it.type === 'alert') Object.assign(base, sanitizeAlertFields(it));
  if (it.type === 'tasks') {
    base.tasks = (Array.isArray(it.tasks) ? it.tasks : []).slice(0, 300)
      .map((t) => ({ id: str(t?.id, 80) || uid(), text: str(t?.text, 300), done: !!t?.done }));
  }
  if (it.type === 'links') {
    base.links = (Array.isArray(it.links) ? it.links : []).slice(0, 300)
      .map((l) => ({ id: str(l?.id, 80) || uid(), label: str(l?.label, 120), title: str(l?.title, 160), url: cleanUrl(l?.url) }))
      .filter((l) => l.url);
  }
  if (it.type === 'image') {
    base.source = it.source === 'file' ? 'file' : 'url';
    base.src = base.source === 'url' ? cleanUrl(it.src) : '';
    base.note = str(it.note, 5000);
  }
  return base;
}

function sanitizeEvent(e) {
  if (!e || typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return null;
  if (dateKey(parseKey(e.date)) !== e.date) return null;
  const title = str(e.title, 120).trim();
  if (!title) return null;
  return {
    id: str(e.id, 80) || uid(),
    date: e.date,
    title,
    text: str(e.text, 5000),
    type: e.type === 'birthday' ? 'birthday' : 'event', // los eventos guardados antes de esta versión son "event"
    created: num(e.created, 0),
  };
}

/** Datos de la versión anterior: x e y estaban en píxeles. Se pasan a fracción del tablero actual. */
function migrateItem(it) {
  if (!it || typeof it !== 'object') return it;
  const wrap = $('#items');
  const W = wrap.clientWidth || 1000, H = wrap.clientHeight || 500;
  const k = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
  return { ...it, x: num(it.x, 30) * k / W, y: num(it.y, 30) * k / H };
}

function sanitizeState(d) {
  const legacy = d?.layout !== LAYOUT_VERSION;
  const items = Array.isArray(d?.items) ? d.items.map((it) => sanitizeItem(legacy ? migrateItem(it) : it)).filter(Boolean) : [];
  const dockId = str(d?.settings?.dockId, 80);
  return {
    layout: LAYOUT_VERSION,
    settings: {
      sound: d?.settings?.sound !== false,
      /* nota fijada a la derecha: solo una, y debe existir (las alertas no se fijan) */
      dockId: items.some((i) => i.id === dockId && i.type !== 'alert') ? dockId : '',
      dockW: clamp(num(d?.settings?.dockW, DOCK_W), DOCK_MIN, DOCK_MAX),
    },
    items,
    events: Array.isArray(d?.events) ? d.events.map(sanitizeEvent).filter(Boolean) : [],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = sanitizeState(saved);
      if (saved?.layout !== LAYOUT_VERSION) save(); // deja guardado el formato nuevo
    }
  } catch (err) { console.warn('No se pudieron leer los datos guardados', err); }
  recalcMaxZ();
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (err) {
    console.error(err);
    toast(t('err.save'));
  }
}
function recalcMaxZ() { maxZ = state.items.reduce((m, i) => Math.max(m, i.z), 1); }

/* --- IndexedDB (imágenes subidas desde el PC) --- */
let dbPromise;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(DB_STORE, mode);
    let req;
    try { req = fn(t.objectStore(DB_STORE)); } catch (err) { reject(err); return; }
    t.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const putImage = (id, blob) => tx('readwrite', (s) => s.put({ id, blob }));
const delImage = (id) => tx('readwrite', (s) => s.delete(id));
const clearImages = () => tx('readwrite', (s) => s.clear());
const allImages = () => tx('readonly', (s) => s.getAll());

async function loadImageURLs() {
  try {
    for (const row of await allImages()) imageURLs.set(row.id, URL.createObjectURL(row.blob));
  } catch (err) {
    console.warn('IndexedDB no disponible', err);
    toast(t('err.idb'));
  }
}
function setImageURL(id, blob) {
  const old = imageURLs.get(id);
  if (old) URL.revokeObjectURL(old);
  imageURLs.set(id, URL.createObjectURL(blob));
}
function dropImage(id) {
  const u = imageURLs.get(id);
  if (u) URL.revokeObjectURL(u);
  imageURLs.delete(id);
  delImage(id).catch(() => {});
}

const byId = (id) => state.items.find((i) => i.id === id);
function imageSrcOf(it) {
  if (it.type === 'draw') return imageURLs.get(it.id) || '';
  if (it.type === 'image') return it.source === 'file' ? (imageURLs.get(it.id) || '') : it.src;
  return it.imageUrl || '';
}

/** Reduce y comprime la imagen antes de guardarla. */
async function prepareImage(file) {
  if (!file.type.startsWith('image/')) throw new Error(t('img.err.notImage'));
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    if (file.size > 8 * 1024 * 1024) throw new Error(t('img.err.size'));
    return file;
  }
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch { throw new Error(t('img.err.open')); }
  const MAX = 1600;
  const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.88));
  if (!blob) throw new Error(t('img.err.process'));
  return blob;
}

/* ============================================================
   Tablero
   ============================================================ */
const randomRot = () => Math.round((Math.random() * 7 - 3.5) * 10) / 10;
const rootPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
const round4 = (v) => Math.round(v * 10000) / 10000;
/* Antes en pantallas angostas las notas se acomodaban solas en columnas. Ahora se mueven y cambian
   de tamaño igual que en el PC (con el dedo), así que ya no existe ese modo. */
const isFlowLayout = () => false;

/** Busca un hueco libre. Devuelve la posición como fracción del tablero (0 a 1). */
function findSlot() {
  const wrap = $('#items');
  const W = wrap.clientWidth || 900, H = wrap.clientHeight || 500;
  const rem = rootPx();
  const gapX = 14 * rem, gapY = 10.5 * rem, pad = 1.5 * rem;
  const cols = Math.max(1, Math.floor((W - pad) / gapX));
  const rows = Math.max(1, Math.floor((H - pad) / gapY));
  const busy = (x, y) => state.items.some((o) => Math.abs(o.x * W - x) < 9 * rem && Math.abs(o.y * H - y) < 7 * rem);
  for (let i = 0; i < cols * rows; i++) {
    const x = pad + (i % cols) * gapX + Math.random() * rem;
    const y = pad * 1.5 + Math.floor(i / cols) * gapY + Math.random() * rem;
    if (!busy(x, y)) return { x: round4(x / W), y: round4(y / H) };
  }
  return { x: round4(Math.random() * 0.7), y: round4(Math.random() * 0.6) }; // tablero lleno
}

function newItemBase(type, extra = {}) {
  const { x, y } = findSlot();
  return {
    id: uid(), type, title: '', x, y, w: type === 'image' ? PHOTO_W : NOTE_W,
    rot: randomRot(), z: ++maxZ, pin: Math.floor(Math.random() * 4), imageUrl: '', ...extra,
  };
}

function addItem(type) {
  const extra = type === 'note' ? { body: '' } : type === 'tasks' ? { tasks: [] } : type === 'draw' ? { hasDrawing: false } : { links: [] };
  const it = newItemBase(type, extra);
  state.items.push(it);
  save();
  renderBoard();
  openItem(it.id, true);
}

function deleteItem(id) {
  const it = byId(id);
  if ((it?.type === 'image' && it.source === 'file') || it?.type === 'draw') dropImage(id);
  state.items = state.items.filter((i) => i.id !== id);
  const wasPinned = state.settings.dockId === id; // era la nota fijada
  if (wasPinned) state.settings.dockId = '';
  save();
  renderBoard();
  if (wasPinned) renderDock();
  refreshNotesList();
}

/* --- Colocar las notas: la posición se guarda como fracción del tablero y se ajusta para que siempre quepan --- */
function placeItem(node, it) {
  if (isFlowLayout()) return;
  const wrap = $('#items');
  const W = wrap.clientWidth, H = wrap.clientHeight;
  node.style.left = `${clamp(it.x * W, 0, Math.max(0, W - node.offsetWidth))}px`;
  node.style.top = `${clamp(it.y * H, 0, Math.max(0, H - node.offsetHeight))}px`;
}
function placeAll() {
  for (const node of $('#items').children) {
    const it = byId(node.dataset.id);
    if (it) placeItem(node, it);
  }
}
let placeQueued = false;
function schedulePlace() {
  if (placeQueued) return;
  placeQueued = true;
  requestAnimationFrame(() => { placeQueued = false; placeAll(); });
}

function imgEl(src, alt) {
  if (!src) return h('span', { class: 'img-missing', text: t('common.imageNA') });
  const img = h('img', { src, alt, loading: 'lazy', draggable: 'false', referrerpolicy: 'no-referrer' });
  img.addEventListener('load', schedulePlace);
  img.addEventListener('error', () => {
    img.replaceWith(h('span', { class: 'img-missing', text: t('common.imageNA') }));
    schedulePlace();
  });
  return img;
}

/* --- Progreso de una lista de tareas: anillo con el porcentaje --- */
function taskProgress(it) {
  const total = it.tasks.length;
  const done = it.tasks.filter((t) => t.done).length;
  return { total, done, pct: total ? Math.round((done * 100) / total) : 0 };
}
function taskRing({ pct }) {
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  const svg = mk('svg', { viewBox: '0 0 44 44', class: `task-ring${pct === 100 ? ' ring-done' : ''}`, 'aria-hidden': 'true', focusable: 'false' });
  svg.append(
    mk('circle', { class: 'ring-track', cx: 22, cy: 22, r: 17, fill: 'none', 'stroke-width': 7 }),
    mk('circle', { class: 'ring-arc', cx: 22, cy: 22, r: 17, fill: 'none', 'stroke-width': 7, pathLength: 100, 'stroke-dasharray': `${pct} ${100 - pct}`, transform: 'rotate(-90 22 22)' }),
  );
  const txt = mk('text', { class: `ring-pct${pct === 100 ? ' small' : ''}`, x: 22, y: 22, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
  txt.textContent = `${pct}%`;
  svg.append(txt);
  return svg;
}

function renderItem(it) {
  const label = it.type === 'image' ? (it.note || t('type.image')) : (it.title || t('common.untitled'));
  const prog = it.type === 'tasks' && it.tasks.length ? taskProgress(it) : null;
  const node = h('div', {
    class: `item ${TYPES[it.type].cls} type-${it.type} pin${it.pin}`,
    role: 'button', tabindex: '0',
    'aria-label': `${TYPES[it.type].label}: ${label}${prog ? t('item.ringAria', { done: prog.done, total: prog.total }) : ''}`,
    dataset: { id: it.id },
  });
  if (prog) node.classList.add('has-ring');
  node.style.setProperty('--w', `${it.w}rem`);
  node.style.setProperty('--rot', `${it.rot}deg`);
  node.style.zIndex = it.z;
  const face = h('div', { class: 'face' });
  if (it.type === 'image') {
    face.append(imgEl(imageSrcOf(it), it.note || t('type.image')));
  } else if (it.type === 'alert') {
    face.append(...alertFace(it));
    setUrgency(node, urgencyOf(it));
  } else {
    const src = imageSrcOf(it);
    if (src) face.append(imgEl(src, it.type === 'draw' ? t('type.draw') : ''));
    face.append(h('span', { class: 'item-title', text: it.title || t('common.untitled') }));
  }
  node.append(
    h('span', { class: 'pin-dot', 'aria-hidden': 'true' }),
    face,
    ...(prog ? [taskRing(prog)] : []),
    /* estrella para fijar la nota a la derecha (las alertas no se fijan); con teclado se usa el listado de notas o la ventana de la nota */
    ...(it.type !== 'alert' ? [h('span', { class: 'star-btn', title: t('pin.title'), 'aria-hidden': 'true' }, lucide('star'))] : []),
    h('span', { class: 'resize-handle', 'aria-hidden': 'true' }),
  );
  return node;
}

/** Vuelve a dibujar una sola nota (sin tocar las demás). */
function refreshItemNode(id) {
  const it = byId(id);
  const old = [...$('#items').children].find((n) => n.dataset.id === id);
  if (!it || !old) return;
  const node = renderItem(it);
  old.replaceWith(node);
  placeItem(node, it);
  applySearch();
}

let lastFlow = null;
function renderBoard() {
  lastFlow = isFlowLayout();
  /* En pantallas angostas se ordenan por su posición (de arriba a abajo, de izquierda a derecha) */
  const onBoard = state.items.filter((i) => i.id !== state.settings.dockId); // la nota fijada vive en el panel de la derecha
  const list = lastFlow
    ? [...onBoard].sort((a, b) => Math.round(a.y * 6) - Math.round(b.y * 6) || a.x - b.x)
    : onBoard;
  $('#items').replaceChildren(...list.map(renderItem));
  $('#empty').hidden = state.items.length > 0;
  placeAll();
  applySearch();
}

/* --- Arrastrar (un clic sin mover abre la ventana) y cambiar tamaño --- */
function startDrag(e, node, it, flow) {
  const wrap = $('#items');
  const startX = e.clientX, startY = e.clientY;
  const origLeft = parseFloat(node.style.left) || 0;
  const origTop = parseFloat(node.style.top) || 0;
  let moved = false;
  try { node.setPointerCapture(e.pointerId); } catch { /* no crítico */ }

  const onMove = (ev) => {
    if (flow) return; // en pantallas angostas solo se abre
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < (ev.pointerType === 'touch' ? 10 : 5)) return; // con el dedo se tolera un temblor mayor
    if (!moved) {
      moved = true;
      node.classList.add('dragging');
      it.z = ++maxZ;
      node.style.zIndex = it.z;
    }
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const left = clamp(origLeft + dx, 0, Math.max(0, W - node.offsetWidth));
    const top = clamp(origTop + dy, 0, Math.max(0, H - node.offsetHeight));
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
    it.x = round4(left / W);
    it.y = round4(top / H);
  };
  const onUp = (ev) => {
    node.removeEventListener('pointermove', onMove);
    node.removeEventListener('pointerup', onUp);
    node.removeEventListener('pointercancel', onUp);
    node.classList.remove('dragging');
    if (moved) save();
    else if (ev.type === 'pointerup') openItem(it.id);
  };
  node.addEventListener('pointermove', onMove);
  node.addEventListener('pointerup', onUp);
  node.addEventListener('pointercancel', onUp);
}

function startResize(e, node, it) {
  e.preventDefault();
  const wrap = $('#items');
  const rem = rootPx();
  const startX = e.clientX;
  const startW = node.offsetWidth;
  const startLeft = parseFloat(node.style.left) || 0;
  node.classList.add('resizing');
  try { node.setPointerCapture(e.pointerId); } catch { /* no crítico */ }

  const onMove = (ev) => {
    const W = wrap.clientWidth;
    const px = clamp(startW + (ev.clientX - startX), MIN_W * rem, Math.min(MAX_W * rem, W));
    it.w = Math.round((px / rem) * 100) / 100;
    node.style.setProperty('--w', `${it.w}rem`);
    node.style.left = `${clamp(startLeft, 0, Math.max(0, W - px))}px`; // si no cabe a la derecha, se corre a la izquierda
  };
  const onUp = () => {
    node.removeEventListener('pointermove', onMove);
    node.removeEventListener('pointerup', onUp);
    node.removeEventListener('pointercancel', onUp);
    node.classList.remove('resizing');
    const W = wrap.clientWidth, H = wrap.clientHeight;
    it.x = round4((parseFloat(node.style.left) || 0) / W);
    placeItem(node, it); // si ahora sobresale por abajo, la sube
    it.y = round4((parseFloat(node.style.top) || 0) / H);
    save();
  };
  node.addEventListener('pointermove', onMove);
  node.addEventListener('pointerup', onUp);
  node.addEventListener('pointercancel', onUp);
}

function setupBoard() {
  const wrap = $('#items');

  wrap.addEventListener('dragstart', (e) => e.preventDefault());

  wrap.addEventListener('pointerdown', (e) => {
    const node = e.target.closest('.item');
    if (!node || e.button !== 0) return;
    if (e.target.closest('.star-btn')) return; // la estrella no arrastra ni abre la nota: solo fija
    const it = byId(node.dataset.id);
    if (!it) return;
    const flow = isFlowLayout();
    if (!flow && e.target.closest('.resize-handle')) startResize(e, node, it);
    else startDrag(e, node, it, flow);
  });
  wrap.addEventListener('click', (e) => {
    const star = e.target.closest('.star-btn');
    if (!star) return;
    e.stopPropagation();
    pinItem(star.closest('.item').dataset.id);
  });

  wrap.addEventListener('keydown', (e) => {
    const node = e.target;
    if (node.classList?.contains('item') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openItem(node.dataset.id);
    }
  });

  /* Soltar imágenes del PC directamente sobre el tablero */
  const board = $('#board');
  board.addEventListener('dragover', (e) => {
    if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); board.classList.add('dropping'); }
  });
  board.addEventListener('dragleave', (e) => { if (!board.contains(e.relatedTarget)) board.classList.remove('dropping'); });
  board.addEventListener('drop', async (e) => {
    e.preventDefault();
    board.classList.remove('dropping');
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (!files.length) { toast(t('board.dropHint')); return; }
    for (const f of files) {
      try { await addImageFromFile(f, ''); } catch (err) { toast(err.message); }
    }
  });
  /* Si se suelta un archivo fuera del tablero, no abrir la imagen en la pestaña */
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  /* Al cambiar el tamaño de la ventana las notas se reacomodan en proporción */
  window.addEventListener('resize', () => { if (isFlowLayout() !== lastFlow) renderBoard(); else schedulePlace(); });
  window.addEventListener('load', schedulePlace);
}

/* ============================================================
   Ventanas (modales)
   ============================================================ */
function enableBackdropClose(dlg) {
  let downOnBackdrop = false;
  dlg.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === dlg; });
  dlg.addEventListener('click', (e) => { if (e.target === dlg && downOnBackdrop) dlg.close(); });
}

function confirmDialog(message, okLabel = t('common.delete'), danger = true) {
  return new Promise((resolve) => {
    const dlg = $('#confirm-dialog');
    $('#confirm-msg').textContent = message;
    $('#confirm-ok').textContent = okLabel;
    $('#confirm-ok').className = danger ? 'btn danger-solid' : 'btn primary'; // rojo solo cuando se va a borrar algo
    dlg.returnValue = '';
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
    dlg.showModal();
  });
}

/* --- Post-it abierto --- */
let current = null; // { it, isNew, deleted }

function isEmptyItem(it) {
  if (it.title.trim() || it.imageUrl) return false;
  if (it.type === 'draw') return !it.hasDrawing;
  if (it.type === 'note') return !it.body.trim();
  if (it.type === 'tasks') return it.tasks.length === 0;
  if (it.type === 'links') return it.links.length === 0;
  return false;
}

function openItem(id, isNew = false) {
  const it = byId(id);
  if (!it) return;
  if (it.type === 'alert') { openAlertItem(id); return; }
  if (state.settings.dockId === id) { focusDock(); return; } // la nota fijada ya está abierta a la derecha
  current = { it, isNew, deleted: false };
  const dlg = $('#item-dialog');
  dlg.className = `modal ${TYPES[it.type].cls}`;
  dlg.setAttribute('aria-label', `${TYPES[it.type].label}${it.title ? `: ${it.title}` : ''}`);
  dlg.replaceChildren(buildItemSheet(it));
  dlg.showModal();
  if (isNew) dlg.querySelector('.title-input')?.focus();
}

/** Ejecuta fn con `current` apuntando a ctx (los editores de enlaces y dibujo se enganchan a `current` al crearse). */
function withCtx(ctx, fn) {
  const prev = current;
  current = ctx;
  try { return fn(); } finally { current = prev; }
}

/** Contenido de una nota. En una ventana (modal) o, con opts.dock, dentro del panel fijado a la derecha. */
function buildItemSheet(it, opts = {}) {
  const dock = !!opts.dock;
  const dlg = $('#item-dialog');
  const sheet = h('div', { class: 'sheet' });
  const star = h('button', {
    type: 'button', class: `icon-btn star-toggle${dock ? ' on' : ''}`,
    'aria-label': dock ? t('unpin.aria') : t('pin.aria'),
    title: dock ? t('unpin.title') : t('pin.title'),
    onclick: dock ? () => unpinItem() : async () => {
      if (!(await confirmPinReplace(it.id))) return;
      const flush = current?.flush; // si es un dibujo, guarda el último trazo antes de moverlo al panel
      if (flush) { try { await flush(); } catch { /* no crítico */ } }
      dlg.close();
      commitPin(it.id);
    },
  }, lucide('star'));
  sheet.append(h('div', { class: 'sheet-top' },
    h('span', { class: 'kind', text: dock ? t('dock.kind', { type: TYPES[it.type].label }) : TYPES[it.type].label }),
    h('div', { class: 'top-btns' },
      star,
      ...(dock ? [] : [h('button', { type: 'button', class: 'icon-btn close', 'aria-label': t('sheet.close'), onclick: () => dlg.close() }, '✕')]))));

  if (it.type === 'image') {
    sheet.append(...imageEditor(it));
  } else {
    sheet.append(h('input', {
      type: 'text', class: 'title-input', maxlength: 120, placeholder: t('sheet.title'), 'aria-label': t('sheet.title'),
      value: it.title,
      oninput: (e) => { it.title = e.target.value; save(); },
    }));
    if (it.type === 'draw') {
      if (!dock) sheet.classList.add('wide');
      sheet.append(drawEditor(it));
    } else {
      sheet.append(pictureField(it));
      if (it.type === 'note') sheet.append(noteEditor(it));
      if (it.type === 'tasks') sheet.append(tasksEditor(it));
      if (it.type === 'links') sheet.append(linksEditor(it));
    }
  }

  if (!dock && !isFlowLayout()) sheet.append(sizeControl(it));
  const del = h('button', {
    type: 'button', class: 'btn danger',
    onclick: async () => {
      if (!(await confirmDialog(t(it.type === 'image' ? 'sheet.confirmDelImage' : 'sheet.confirmDelNote')))) return;
      if (dock) { deleteItem(it.id); return; } // deleteItem también recoge el panel
      current.deleted = true;
      deleteItem(it.id);
      dlg.close();
    },
  }, t('common.delete'));
  sheet.append(h('div', { class: 'sheet-foot' },
    del,
    ...(dock ? [] : [h('button', { type: 'button', class: 'btn primary', onclick: () => dlg.close() }, t('sheet.done'))])));
  return sheet;
}

function sizeControl(it) {
  const input = h('input', {
    type: 'range', min: MIN_W, max: MAX_W, step: 0.25, value: it.w,
    'aria-label': t('sheet.size'),
    oninput: () => { it.w = Number(input.value); save(); },
  });
  return h('label', { class: 'size-field' }, h('span', { text: t('sheet.size') }), input);
}

function pictureField(it) {
  const preview = h('div', { class: 'pic-preview' });
  const msg = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const input = h('input', {
    type: 'text', class: 'field', value: it.imageUrl || '', autocomplete: 'off',
    placeholder: t('sheet.imageLink'), 'aria-label': t('sheet.imageLinkAria'),
  });
  const draw = () => {
    preview.replaceChildren();
    if (!it.imageUrl) return;
    const img = h('img', { src: it.imageUrl, alt: '', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => preview.replaceChildren(h('span', { class: 'img-missing', text: t('sheet.imgFail') })));
    preview.append(img);
  };
  input.addEventListener('change', () => {
    const raw = input.value.trim();
    if (!raw) { it.imageUrl = ''; msg.hidden = true; }
    else {
      const u = cleanUrl(raw);
      if (!u) {
        input.classList.add('invalid');
        msg.textContent = t('link.bad');
        msg.hidden = false;
        return;
      }
      it.imageUrl = u; input.value = u; msg.hidden = true;
    }
    input.classList.remove('invalid');
    save(); draw();
  });
  draw();
  return h('div', { class: 'pic-field' }, preview, input, msg);
}

function noteEditor(it) {
  return h('textarea', {
    class: 'lined', placeholder: t('sheet.notePh'), 'aria-label': t('sheet.noteAria'),
    value: it.body,
    oninput: (e) => { it.body = e.target.value; save(); },
  });
}

function tasksEditor(it) {
  const list = h('ul', { class: 'tasks' });
  const prog = h('p', { class: 'progress' });
  const newInput = h('input', { type: 'text', class: 'field', maxlength: 300, placeholder: t('tasks.new'), 'aria-label': t('tasks.new'), autocomplete: 'off' });

  const updateProgress = () => {
    const done = it.tasks.filter((x) => x.done).length;
    prog.textContent = it.tasks.length ? t('tasks.progress', { done, total: it.tasks.length }) : '';
  };
  const draw = () => {
    list.replaceChildren(...(it.tasks.length
      ? it.tasks.map(taskRow)
      : [h('li', { class: 'list-empty', text: t('tasks.empty') })]));
    updateProgress();
  };
  function taskRow(task) {
    const cb = h('input', {
      type: 'checkbox', checked: task.done, 'aria-label': t('tasks.doneAria'),
      onchange: () => { task.done = cb.checked; row.classList.toggle('done', task.done); save(); updateProgress(); },
    });
    const txt = h('input', {
      type: 'text', class: 'task-text', maxlength: 300, value: task.text, 'aria-label': t('tasks.task'),
      oninput: () => { task.text = txt.value; save(); },
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); newInput.focus(); } },
    });
    const del = h('button', {
      type: 'button', class: 'icon-btn', 'aria-label': t('tasks.remove'),
      onclick: () => { it.tasks = it.tasks.filter((x) => x !== task); save(); draw(); },
    }, '✕');
    const row = h('li', { class: `task${task.done ? ' done' : ''}` }, cb, txt, del);
    return row;
  }

  const form = h('form', {
    class: 'add-row',
    onsubmit: (e) => {
      e.preventDefault();
      const text = newInput.value.trim();
      if (!text) return;
      it.tasks.push({ id: uid(), text, done: false });
      newInput.value = '';
      save(); draw(); newInput.focus();
    },
  }, newInput, h('button', { type: 'submit', class: 'btn small' }, t('link.add')));

  draw();
  return h('div', {}, list, prog, form);
}

function imageEditor(it) {
  const src = imageSrcOf(it);
  const missing = () => h('p', { class: 'img-missing', text: t('common.imageNA') });
  const pic = src
    ? h('img', {
      class: 'modal-photo', src, alt: it.note || t('type.image'), referrerpolicy: 'no-referrer',
      onerror: (e) => e.target.replaceWith(missing()),
    })
    : missing();
  const note = h('textarea', {
    class: 'lined short', placeholder: t('sheet.imgNotePh'), 'aria-label': t('sheet.imgNoteAria'),
    value: it.note,
    oninput: (e) => { it.note = e.target.value; save(); },
  });
  return [pic, note];
}

$('#item-dialog').addEventListener('close', async () => {
  if (!current) return;
  const { it, isNew, deleted, flush } = current;
  current = null;
  if (deleted) return;
  if (flush) { try { await flush(); } catch { /* no crítico */ } }
  if (isNew && isEmptyItem(it)) deleteItem(it.id);
  else { save(); renderBoard(); }
});

/* --- Agregar imagen --- */
async function addImageFromFile(file, note) {
  const blob = await prepareImage(file);
  const it = newItemBase('image', { source: 'file', src: '', note });
  try { await putImage(it.id, blob); }
  catch { throw new Error(t('img.err.store')); }
  setImageURL(it.id, blob);
  state.items.push(it);
  save(); renderBoard();
}
function addImageFromUrl(url, note) {
  const it = newItemBase('image', { source: 'url', src: url, note });
  state.items.push(it);
  save(); renderBoard();
}

function setupImageDialog() {
  const dlg = $('#image-dialog');
  const form = $('#image-form');
  const err = $('#img-error');
  const submit = $('#image-submit');
  const showErr = (m) => { err.textContent = m; err.hidden = false; };

  const open = () => { form.reset(); err.hidden = true; submit.disabled = false; dlg.showModal(); };
  $('#image-close').addEventListener('click', () => dlg.close());
  $('#image-cancel').addEventListener('click', () => dlg.close());
  enableBackdropClose(dlg);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const file = $('#img-file').files[0];
    const rawUrl = $('#img-url').value.trim();
    const note = $('#img-note').value.trim();
    if (!file && !rawUrl) { showErr(t('img.err.choose')); return; }
    submit.disabled = true;
    try {
      if (file) await addImageFromFile(file, note);
      else {
        const u = cleanUrl(rawUrl);
        if (!u) { showErr(t('link.bad')); submit.disabled = false; return; }
        addImageFromUrl(u, note);
      }
      dlg.close();
    } catch (ex) {
      showErr(ex.message || t('img.err.add'));
      submit.disabled = false;
    }
  });
  return open;
}

/* ============================================================
   Calendario y eventos
   ============================================================ */
const cal = { year: 0, month: 0, selected: '', editing: null };
let lastToday = todayKey();

const byCreated = (a, b) => a.created - b.created;
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Día en que cae un cumpleaños en un año dado (el 29 de febrero pasa al 28 en los años normales). */
function birthdayKey(ev, year) {
  const md = ev.date.slice(5);
  return `${String(year).padStart(4, '0')}-${md === '02-29' && !isLeap(year) ? '02-28' : md}`;
}
function occursOn(ev, key) {
  return ev.type === 'birthday' ? key === birthdayKey(ev, Number(key.slice(0, 4))) : ev.date === key;
}
/** Primera fecha igual o posterior a `from` en que ocurre el evento (null si ya pasó). */
function nextOccurrence(ev, from) {
  if (ev.type !== 'birthday') return ev.date >= from ? ev.date : null;
  const y = Number(from.slice(0, 4));
  const k = birthdayKey(ev, y);
  return k >= from ? k : birthdayKey(ev, y + 1);
}
const eventsOn = (key) => state.events.filter((e) => occursOn(e, key)).sort(byCreated);

function upcomingEvents() {
  const today = todayKey();
  return state.events
    .map((ev) => ({ ev, key: nextOccurrence(ev, today) }))
    .filter((x) => x.key)
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.ev.created - b.ev.created));
}

function isValidDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const y = Number(v.slice(0, 4));
  return y >= 1900 && y <= 2100 && dateKey(parseKey(v)) === v;
}

function renderDateBtn() {
  const d = new Date();
  $('#dp-month').textContent = `${cap(MESES[d.getMonth()])} ${d.getFullYear()}`;
  $('#dp-day').textContent = d.getDate();
  $('#dp-weekday').textContent = cap(DIAS[d.getDay()]);
}

function whenLabel(key) {
  const diff = dayDiff(todayKey(), key);
  if (diff === 0) return t('when.today');
  if (diff === 1) return t('when.tomorrow');
  if (diff === -1) return t('when.yesterday');
  if (diff > 1 && diff < 7) return t('when.inDays', { n: diff });
  const y = parseKey(key).getFullYear();
  return cap(y !== new Date().getFullYear() ? fmtFull(key) : fmtLong(key));
}

/* --- Tarjetas "Eventos siguientes" (3 + "Ver listado de eventos") --- */
function renderUpcoming() {
  const up = upcomingEvents();
  const slots = up.slice(0, 3).map(({ ev, key }) => {
    const d = parseKey(key);
    const et = EVENT_TYPES[ev.type];
    return h('li', { class: 'up-slot' }, h('button', {
      type: 'button', class: `up-card ${et.cls}`,
      'aria-label': `${et.label}, ${fmtLong(key)}: ${ev.title}`,
      onclick: () => openCalendar(key),
    },
    h('span', { class: 'up-bar' },
      h('span', { class: 'up-date' }, h('b', { text: d.getDate() }), ' ', MESES_CORTOS[d.getMonth()]),
      h('span', { class: 'ico', 'aria-hidden': 'true', text: et.icon })),
    h('span', { class: 'up-body', text: ev.title })));
  });
  if (!up.length) slots.push(h('li', { class: 'up-empty', text: t('up.empty') }));
  /* Arriba: los 3 próximos eventos. Abajo: los botones (listado de eventos, notas, alertas, crear nota). */
  const quick = [
    h('li', { class: 'up-slot' }, h('button', {
      type: 'button', class: 'up-card more',
      'aria-label': t('up.moreAria', { n: state.events.length }),
      onclick: openEventsDialog,
    }, lucide('list', 'more-ico'), h('span', { text: t('up.more') }))),
    notesListSlot(),
    alertsBellSlot(),
    createNoteSlot(),
  ];
  $('#upcoming').replaceChildren(...slots);
  $('#quick').replaceChildren(...quick);
  updateBell();
}

/* --- Ventana del calendario --- */
function openCalendar(key = todayKey(), editId = null) {
  const d = parseKey(key);
  cal.year = d.getFullYear(); cal.month = d.getMonth(); cal.selected = key; cal.editing = null;
  resetEventForm(key);
  renderCalendar();
  const dlg = $('#cal-dialog');
  if (!dlg.open) dlg.showModal();
  if (editId) editEvent(editId);
}

function selectDay(key, keepForm = false) {
  const d = parseKey(key);
  cal.year = d.getFullYear(); cal.month = d.getMonth(); cal.selected = key;
  if (!keepForm) {
    if (cal.editing) { cal.editing = null; resetEventForm(key); }
    else $('#ev-date').value = key; // lo que ya escribiste se conserva
  }
  renderCalendar();
}

function renderCalendar() {
  $('#cal-title').textContent = `${cap(MESES[cal.month])} ${cal.year}`;
  const offset = (new Date(cal.year, cal.month, 1).getDay() + 6) % 7; // semana empieza en lunes
  const days = new Date(cal.year, cal.month + 1, 0).getDate();
  const total = Math.ceil((offset + days) / 7) * 7;
  const today = todayKey();

  const cells = DIAS_CORTOS_LUN.map((n) => h('div', { class: 'cal-dow', text: n }));
  for (let i = 0; i < total; i++) {
    const d = new Date(cal.year, cal.month, 1 - offset + i);
    const key = dateKey(d);
    const evs = eventsOn(key);
    const cls = ['cal-day-btn'];
    if (d.getMonth() !== cal.month) cls.push('other');
    if (key === today) cls.push('today');
    if (key === cal.selected) cls.push('selected');
    cells.push(h('button', {
      type: 'button', class: cls.join(' '),
      'aria-pressed': key === cal.selected ? 'true' : 'false',
      'aria-label': `${fmtFull(key)}${evs.length ? `, ${tn('cal.events', evs.length)}` : ''}`,
      onclick: () => selectDay(key),
    },
    h('span', { class: 'num', text: d.getDate() }),
    evs.length ? h('span', { class: 'dots', 'aria-hidden': 'true' }, evs.slice(0, 3).map((e) => h('i', { class: EVENT_TYPES[e.type].cls }))) : null));
  }
  $('#cal-grid').replaceChildren(...cells);
  renderDay();
}

function eventButtons(e, onEdit) {
  return h('div', { class: 'ev-btns' },
    actBtn('edit', t('ev.editAria', { name: e.title }), onEdit),
    actBtn('delete', t('ev.delAria', { name: e.title }), () => removeEvent(e.id)));
}

function renderDay() {
  $('#day-title').textContent = cap(fmtFull(cal.selected));
  const evs = eventsOn(cal.selected);
  const list = $('#day-events');
  if (!evs.length) {
    list.replaceChildren(h('li', { class: 'day-empty', text: t('ev.dayEmpty') }));
    return;
  }
  list.replaceChildren(...evs.map((e) => {
    const et = EVENT_TYPES[e.type];
    return h('li', { class: `ev ${et.cls}` },
      h('div', { class: 'ev-body' },
        h('strong', {}, h('span', { class: 'ico', 'aria-hidden': 'true', text: et.icon }), ' ', e.title),
        e.type === 'birthday' ? h('span', { class: 'ev-tag', text: t('ev.tagBirthday') }) : null,
        e.text ? h('p', { text: e.text }) : null),
      eventButtons(e, () => editEvent(e.id)));
  }));
}

/* --- Formulario de evento --- */
const formType = () => document.querySelector('input[name="ev-type"]:checked')?.value || 'event';
function setFormType(type) {
  const radio = document.querySelector(`input[name="ev-type"][value="${type}"]`);
  if (radio) radio.checked = true;
  $('#ev-type-hint').textContent = t(type === 'birthday' ? 'ev.hint.birthday' : 'ev.hint.event');
}
function resetEventForm(key = cal.selected) {
  $('#ev-title').value = '';
  $('#ev-text').value = '';
  $('#ev-date').value = key;
  $('#ev-error').hidden = true;
  $('#form-title').textContent = t('ev.new');
  $('#ev-save').textContent = t('ev.saveNew');
  $('#ev-cancel').hidden = true;
  setFormType('event');
}
function editEvent(id) {
  const e = state.events.find((x) => x.id === id);
  if (!e) return;
  cal.editing = id;
  $('#ev-title').value = e.title;
  $('#ev-text').value = e.text;
  $('#ev-date').value = e.date;
  $('#ev-error').hidden = true;
  $('#form-title').textContent = t('ev.edit');
  $('#ev-save').textContent = t('ev.saveEdit');
  $('#ev-cancel').hidden = false;
  setFormType(e.type);
  $('#ev-title').focus();
}

function refreshEventViews() {
  renderUpcoming();
  if ($('#cal-dialog').open) renderCalendar();
  if ($('#events-dialog').open) renderEventsDialog();
}

async function removeEvent(id) {
  const ev = state.events.find((x) => x.id === id);
  if (!ev) return;
  const msg = t(ev.type === 'birthday' ? 'ev.confirmDelBirthday' : 'ev.confirmDelEvent', { name: ev.title });
  if (!(await confirmDialog(msg))) return;
  state.events = state.events.filter((x) => x.id !== id);
  if (cal.editing === id) { cal.editing = null; resetEventForm(); }
  save();
  refreshEventViews();
}

/* --- Ventana "Listado de eventos" --- */
function openEventsDialog() {
  renderEventsDialog();
  const dlg = $('#events-dialog');
  if (!dlg.open) dlg.showModal();
}

function eventRow(ev, key, isPast) {
  const et = EVENT_TYPES[ev.type];
  const d = parseKey(key);
  const meta = ev.type === 'birthday' ? t('ev.metaBirthday', { when: whenLabel(key) }) : whenLabel(key);
  return h('li', { class: `ev-row ${et.cls}${isPast ? ' past' : ''}` },
    h('div', { class: 'ev-chip', 'aria-hidden': 'true' },
      h('span', { class: 'ev-chip-bar', text: MESES_CORTOS[d.getMonth()] }),
      h('b', { text: d.getDate() })),
    h('div', { class: 'ev-main' },
      h('strong', {}, h('span', { class: 'ico', 'aria-hidden': 'true', text: et.icon }), ' ', ev.title),
      h('span', { class: 'ev-meta', text: meta }),
      ev.text ? h('p', { text: ev.text }) : null),
    eventButtons(ev, () => {
      $('#events-dialog').close();
      openCalendar(key, ev.id);
    }));
}

function renderEventsDialog() {
  const today = todayKey();
  const up = upcomingEvents();
  const past = state.events
    .filter((e) => e.type !== 'birthday' && e.date < today)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const body = $('#events-body');
  if (!up.length && !past.length) {
    body.replaceChildren(h('p', { class: 'list-empty', text: t('events.empty') }));
    return;
  }
  const section = (title, rows) => (rows.length
    ? h('section', { class: 'ev-section' }, h('h3', { text: `${title} (${rows.length})` }), h('ul', { class: 'ev-rows' }, rows))
    : null);
  body.replaceChildren(...[
    section(t('events.upcoming'), up.map(({ ev, key }) => eventRow(ev, key, false))),
    section(t('events.past'), past.map((ev) => eventRow(ev, ev.date, true))),
  ].filter(Boolean));
}

function setupCalendar() {
  const dlg = $('#cal-dialog');
  $('#date-btn').addEventListener('click', () => openCalendar());
  $('#cal-close').addEventListener('click', () => dlg.close());
  enableBackdropClose(dlg);

  const shift = (delta) => {
    const d = new Date(cal.year, cal.month + delta, 1);
    cal.year = d.getFullYear(); cal.month = d.getMonth();
    renderCalendar();
  };
  $('#cal-prev').addEventListener('click', () => shift(-1));
  $('#cal-next').addEventListener('click', () => shift(1));
  $('#cal-today').addEventListener('click', () => selectDay(todayKey()));

  document.querySelectorAll('input[name="ev-type"]').forEach((r) => r.addEventListener('change', () => setFormType(formType())));
  $('#ev-date').addEventListener('change', (e) => { if (isValidDate(e.target.value)) selectDay(e.target.value, true); });

  $('#ev-cancel').addEventListener('click', () => { cal.editing = null; resetEventForm(); });
  $('#event-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('#ev-title').value.trim();
    const text = $('#ev-text').value.trim();
    const date = $('#ev-date').value;
    const type = formType();
    const err = $('#ev-error');
    if (!title) { $('#ev-title').focus(); return; }
    if (!isValidDate(date)) {
      err.textContent = t('ev.errDate');
      err.hidden = false;
      $('#ev-date').focus();
      return;
    }
    err.hidden = true;
    let ev = cal.editing ? state.events.find((x) => x.id === cal.editing) : null;
    if (ev) Object.assign(ev, { title, text, date, type });
    else { ev = { id: uid(), date, title, text, type, created: Date.now() }; state.events.push(ev); }
    cal.editing = null;
    save();
    /* Muestra el día donde se ve el evento: su fecha, o la próxima vez que cae el cumpleaños */
    const target = type === 'birthday' ? nextOccurrence(ev, todayKey()) : date;
    const d = parseKey(target);
    cal.year = d.getFullYear(); cal.month = d.getMonth(); cal.selected = target;
    resetEventForm(target);
    renderCalendar();
    renderUpcoming();
    if ($('#events-dialog').open) renderEventsDialog();
    $('#ev-title').focus();
  });

  /* Ventana de listado */
  const evDlg = $('#events-dialog');
  $('#events-close').addEventListener('click', () => evDlg.close());
  enableBackdropClose(evDlg);
  $('#events-add').addEventListener('click', () => {
    evDlg.close();
    openCalendar();
    $('#ev-title').focus();
  });

  /* Si la app queda abierta pasada la medianoche, actualiza la fecha */
  const checkDay = () => {
    if (todayKey() === lastToday) return;
    lastToday = todayKey();
    renderDateBtn();
    refreshEventViews();
  };
  setInterval(checkDay, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
}

/* ============================================================
   Respaldo: guardar y cargar
   ============================================================ */
const blobToDataURL = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

function dataURLToBlob(u) {
  if (typeof u !== 'string') return null;
  const m = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(u);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

async function exportData() {
  try {
    const images = {};
    const wanted = new Set(state.items.filter((i) => (i.type === 'image' && i.source === 'file') || i.type === 'draw').map((i) => i.id));
    for (const row of await allImages()) {
      if (wanted.has(row.id)) images[row.id] = await blobToDataURL(row.blob);
    }
    const payload = { app: EXPORT_SLUG, version: 1, layout: LAYOUT_VERSION, settings: state.settings, exportedAt: new Date().toISOString(), items: state.items, events: state.events, images };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const now = new Date();
    const stamp = `${dateKey(now)}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const a = h('a', { href: URL.createObjectURL(blob), download: `${EXPORT_SLUG}-respaldo-${stamp}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast(t('backup.saved'));
  } catch (err) {
    console.error(err);
    toast(t('backup.fail'));
  }
}

async function importData(file) {
  let data;
  try { data = JSON.parse(await file.text()); }
  catch { toast(t('backup.invalid')); return; }
  if (!data || !Array.isArray(data.items) || !Array.isArray(data.events)) { toast(t('backup.invalid')); return; }

  const ok = await confirmDialog(t('backup.confirm'), t('backup.replace'));
  if (!ok) return;

  const next = sanitizeState(data);
  const imgs = data.images && typeof data.images === 'object' ? data.images : {};
  try {
    await clearImages();
    for (const u of imageURLs.values()) URL.revokeObjectURL(u);
    imageURLs.clear();
    for (const it of next.items) {
      if (!((it.type === 'image' && it.source === 'file') || it.type === 'draw')) continue;
      const blob = dataURLToBlob(imgs[it.id]);
      if (blob) { await putImage(it.id, blob); setImageURL(it.id, blob); }
    }
  } catch (err) {
    console.error(err);
    toast(t('backup.imgFail'));
  }
  state = next;
  recalcMaxZ();
  save();
  renderAll();
  toast(t('backup.loaded'));
}

function setupBackup() {
  $('#export-btn').addEventListener('click', exportData);
  const fileIn = $('#import-file');
  $('#import-btn').addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0];
    fileIn.value = '';
    if (f) await importData(f);
  });
}

/* ============================================================
   Instalación como app (PWA) y arranque
   ============================================================ */
function setupInstall() {
  let deferred = null;
  const btn = $('#install-btn');
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; btn.hidden = false; });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    btn.hidden = true;
  });
  window.addEventListener('appinstalled', () => { btn.hidden = true; toast(t('app.installed', { app: APP_NAME })); });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('No se pudo registrar el service worker', err));
  }
}

function renderAll() {
  renderDateBtn();
  renderUpcoming();
  renderBoard();
  renderDock();
}

/** Al cambiar de idioma: vuelve a dibujar todo lo que tiene texto generado por código. */
function onLangChange() {
  renderAll();
  if (typeof refreshFoldLabel === 'function') refreshFoldLabel();
  if (typeof refreshAlertsLang === 'function') refreshAlertsLang();
  if ($('#cal-dialog').open) renderCalendar();
  if ($('#events-dialog').open) renderEventsDialog();
  if (typeof refreshNotesList === 'function') refreshNotesList();
  if (!cal.editing) resetEventLabels();
}
/** Textos del formulario de eventos que cambian según si se crea o se edita. */
function resetEventLabels() {
  $('#form-title').textContent = t('ev.new');
  $('#ev-save').textContent = t('ev.saveNew');
  setFormType(formType());
}

async function init() {
  document.title = APP_NAME;
  initI18n();
  I18N.onChange.push(onLangChange);
  load();
  await loadImageURLs();
  setupBoard();
  setupCalendar();
  setupBackup();
  setupInstall();
  const openImageDialog = setupImageDialog();
  enableBackdropClose($('#item-dialog'));
  enableBackdropClose($('#confirm-dialog'));

  document.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.add === 'image') openImageDialog();
      else addItem(btn.dataset.add);
    });
  });

  $('#item-dialog').addEventListener('paste', (e) => current?.onPaste?.(e));
  setupSearch();
  setupDock();
  setupNotes();
  renderAll();
  refreshFoldLabel(); // el texto de la flechita depende del idioma
  setupAlerts();
  navigator.storage?.persist?.().catch(() => {}); // pide que el navegador no borre los datos solo
}

init();