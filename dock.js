'use strict';

/* ============================================================
   Nota fijada: una sola nota a la vez, abierta en un panel al
   extremo derecho. Su ancho se cambia arrastrando el borde
   izquierdo (o con las flechas del teclado) y se recuerda.
   Se fija con la estrella de la nota (en el tablero, en su
   ventana o en el listado de notas). Si ya hay una fijada, se
   pregunta si se quiere cambiar, nombrando la actual.
   ============================================================ */

const DOCK_W = 24;   // ancho por defecto (rem)
const DOCK_MIN = 16;
const DOCK_MAX = 48;

let dockCtx = null; // { it, isNew, deleted, flush?, onPaste?, undo? } del panel (igual que `current` en las ventanas)

const dockEl = () => document.getElementById('dock');
const pinnedItem = () => byId(state.settings.dockId) || null;

/** Nombre con el que se muestra una nota en mensajes y listados. */
function itemLabel(it) {
  if (it.title && it.title.trim()) return it.title.trim();
  if (it.type === 'image' && it.note && it.note.trim()) return it.note.trim().slice(0, 50);
  return it.type === 'image' ? t('common.imageUntitled') : t('common.untitled');
}

/** Si ya hay otra nota fijada, pregunta si se cambia (diciendo cuál es). Devuelve true si se puede seguir. */
async function confirmPinReplace(id) {
  const cur = pinnedItem();
  if (!cur || cur.id === id) return true;
  const next = byId(id);
  return confirmDialog(
    t('dock.confirmReplace', { cur: itemLabel(cur), next: next ? itemLabel(next) : t('dock.thisNote') }),
    t('dock.confirmOk'),
    false,
  );
}

async function flushDock() {
  const f = dockCtx?.flush; // un dibujo guarda su último trazo
  if (f) { try { await f(); } catch { /* no crítico */ } }
}

/** Fija la nota sin preguntar (quien llama ya confirmó). */
async function commitPin(id) {
  const it = byId(id);
  if (!it || it.type === 'alert') return false;
  const prev = pinnedItem();
  await flushDock();
  state.settings.dockId = id;
  save();
  renderBoard();
  renderDock();
  refreshNotesList();
  toast(prev && prev.id !== id
    ? t('dock.toastSwap', { name: itemLabel(it), prev: itemLabel(prev) })
    : t('dock.toastPin', { name: itemLabel(it) }));
  return true;
}

/** Fija una nota (preguntando antes si había otra). Devuelve true si quedó fijada. */
async function pinItem(id) {
  if (state.settings.dockId === id) return true;
  if (!(await confirmPinReplace(id))) return false;
  return commitPin(id);
}

/** Suelta la nota fijada: vuelve al tablero, al lugar donde estaba. */
async function unpinItem() {
  const it = pinnedItem();
  if (!it) return;
  await flushDock();
  state.settings.dockId = '';
  it.z = ++maxZ;
  save();
  renderBoard();
  renderDock();
  refreshNotesList();
  toast(t('dock.toastUnpin', { name: itemLabel(it) }));
}

function layoutChanged() {
  if (typeof schedulePlace === 'function') schedulePlace(); // el tablero cambió de ancho: reacomoda las notas
}

/** Dibuja (o esconde) el panel según la nota fijada. */
function renderDock() {
  const el = dockEl();
  if (!el) return;
  const body = document.getElementById('dock-body');
  const it = pinnedItem();
  if (!it || it.type === 'alert') {
    dockCtx = null;
    el.hidden = true;
    el.className = 'dock';
    body.replaceChildren();
    layoutChanged();
    return;
  }
  const ctx = { it, isNew: false, deleted: false };
  dockCtx = ctx;
  el.hidden = false;
  el.className = `dock ${TYPES[it.type].cls} type-${it.type}`;
  el.style.setProperty('--dock-w', `${state.settings.dockW}rem`);
  el.setAttribute('aria-label', t('dock.aria', { name: itemLabel(it) }));
  document.getElementById('dock-pin').className = `dock-pin pin${it.pin}`;
  body.replaceChildren(withCtx(ctx, () => buildItemSheet(it, { dock: true })));
  const sep = document.getElementById('dock-resize');
  sep.setAttribute('aria-valuenow', String(Math.round(state.settings.dockW)));
  dockSearchHit(searchTerms());
  layoutChanged();
}

/** Lleva el cursor al panel y lo resalta un momento (por ejemplo, al abrir desde el listado la nota que ya está fijada). */
function focusDock() {
  const el = dockEl();
  if (!el || el.hidden) return;
  el.classList.remove('flash');
  void el.offsetWidth; // reinicia la animación
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1800);
  el.querySelector('.title-input, textarea, input')?.focus();
}

/** El buscador también resalta el panel cuando la nota fijada coincide. */
function dockSearchHit(terms) {
  const el = dockEl();
  const it = pinnedItem();
  if (!el) return;
  el.classList.toggle('hit', !!it && terms.length > 0 && partsMatch(itemParts(it), terms));
}

function setupDock() {
  const el = dockEl();
  const sep = document.getElementById('dock-resize');
  const area = document.getElementById('workarea');
  const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const maxRem = () => Math.max(DOCK_MIN, Math.min(DOCK_MAX, (area.clientWidth * 0.6) / rem()));

  sep.setAttribute('aria-valuemin', String(DOCK_MIN));
  sep.setAttribute('aria-valuemax', String(DOCK_MAX));

  const apply = (w, persist) => {
    const v = clamp(Math.round(w * 4) / 4, DOCK_MIN, maxRem());
    state.settings.dockW = v;
    el.style.setProperty('--dock-w', `${v}rem`);
    sep.setAttribute('aria-valuenow', String(Math.round(v)));
    layoutChanged();
    if (persist) save();
  };

  sep.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    try { sep.setPointerCapture(e.pointerId); } catch { /* no crítico */ }
    document.body.classList.add('dock-resizing');
    const move = (ev) => {
      const dockRight = area.getBoundingClientRect().right - rem(); // el panel deja 1rem de margen a la derecha
      apply((dockRight - ev.clientX) / rem(), false);
    };
    const up = () => {
      sep.removeEventListener('pointermove', move);
      sep.removeEventListener('pointerup', up);
      sep.removeEventListener('pointercancel', up);
      document.body.classList.remove('dock-resizing');
      save();
    };
    sep.addEventListener('pointermove', move);
    sep.addEventListener('pointerup', up);
    sep.addEventListener('pointercancel', up);
  });
  sep.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); apply(state.settings.dockW + 1, true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); apply(state.settings.dockW - 1, true); }
  });
  sep.addEventListener('dblclick', () => apply(DOCK_W, true));

  el.addEventListener('paste', (e) => dockCtx?.onPaste?.(e)); // pegar un enlace en una nota de enlaces
  window.addEventListener('pagehide', () => { dockCtx?.flush?.(); });
  window.addEventListener('resize', () => { if (!el.hidden) apply(state.settings.dockW, false); });
}