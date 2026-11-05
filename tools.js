'use strict';

/* ============================================================
   Barra superior: franja fija (fecha, eventos, campana) y un cajón de
   herramientas que se desliza hacia abajo. Una flechita centrada
   permite plegar la franja entera; la preferencia se recuerda.
   ============================================================ */

const UI_KEY = 'chincheta:ui:v1';
const topEl = document.getElementById('top');
const toolsBtn = document.getElementById('tools-btn');
const drawer = document.getElementById('tools-drawer');
const foldBtn = document.getElementById('fold-btn');

function loadUi() {
  try { return JSON.parse(localStorage.getItem(UI_KEY)) || {}; } catch { return {}; }
}
function saveUi(patch) {
  try { localStorage.setItem(UI_KEY, JSON.stringify({ ...loadUi(), ...patch })); } catch { /* sin almacenamiento: no pasa nada */ }
}
const createPop = document.getElementById('create-pop');
const createBtn = () => document.getElementById('create-btn'); // se vuelve a dibujar con las tarjetas de arriba

const alertsPop = document.getElementById('alerts-pop');
const alertsBtn = () => document.getElementById('alerts-btn'); // también se vuelve a dibujar

/* Tres paneles que se deslizan bajo la franja: el menú (☰), "Crear nota" y el submenú de alertas. Solo uno abierto a la vez. */
const panels = {
  menu: { el: drawer, btn: () => toolsBtn },
  create: { el: createPop, btn: createBtn },
  alerts: { el: alertsPop, btn: alertsBtn },
};
const panelOpen = (p) => panels[p].btn()?.getAttribute('aria-expanded') === 'true';
const toolsOpen = () => panelOpen('menu');
const anyOpen = () => Object.keys(panels).some(panelOpen);

/** Coloca un panel bajo su botón (sin salirse de la pantalla). */
function placePop(name) {
  const b = panels[name].btn(), el = panels[name].el;
  if (!b) return;
  const t = topEl.getBoundingClientRect(), r = b.getBoundingClientRect();
  const w = el.offsetWidth || 0;
  const left = Math.max(8, Math.min(r.left - t.left, t.width - w - 8));
  el.style.left = `${left}px`;
  el.style.right = 'auto';
}

function setPanel(name, open) {
  const p = panels[name], btn = p.btn();
  if (!btn || open === panelOpen(name)) return;
  if (open) for (const other of Object.keys(panels)) if (other !== name) setPanel(other, false);
  btn.setAttribute('aria-expanded', String(open));
  if (open) {
    p.el.hidden = false;
    if (name !== 'menu') placePop(name);
    requestAnimationFrame(() => p.el.classList.add('open')); // deja que el navegador pinte antes de animar
  } else {
    p.el.classList.remove('open');
    const done = () => { if (!panelOpen(name)) p.el.hidden = true; };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else setTimeout(done, 220);
  }
}
const setTools = (open) => setPanel('menu', open);
const openTools = () => { if (topEl.classList.contains('folded')) setFolded(false); setTools(true); };
const closeTools = () => { for (const name of Object.keys(panels)) setPanel(name, false); };

/** Texto de la flechita que pliega la barra (cambia con el idioma). */
function refreshFoldLabel() {
  const label = t(topEl.classList.contains('folded') ? 'fold.show' : 'fold.hide');
  foldBtn.title = label;
  document.getElementById('fold-label').textContent = label;
}

function setFolded(folded, remember = true) {
  if (folded) closeTools();
  topEl.classList.toggle('folded', folded);
  foldBtn.setAttribute('aria-expanded', String(!folded));
  refreshFoldLabel();
  foldBtn.querySelector('svg').replaceWith(lucide(folded ? 'chevron-down' : 'chevron-up'));
  if (remember) saveUi({ folded });
  /* el tablero cambia de alto: reacomoda las notas al terminar la animación */
  if (typeof schedulePlace === 'function') { schedulePlace(); setTimeout(schedulePlace, 260); }
}

toolsBtn.addEventListener('click', () => setTools(!toolsOpen()));
document.addEventListener('click', (e) => {
  if (e.target.closest('#create-btn')) setPanel('create', !panelOpen('create'));
  else if (e.target.closest('#alerts-btn')) setPanel('alerts', !panelOpen('alerts'));
});
foldBtn.addEventListener('click', () => setFolded(!topEl.classList.contains('folded')));
window.addEventListener('resize', () => { for (const name of ['create', 'alerts']) if (panelOpen(name)) placePop(name); });

/* Al elegir un tipo de post-it, o al usar un botón del menú, el panel se recoge solo */
createPop.addEventListener('click', (e) => { if (e.target.closest('.adder')) setTimeout(closeTools, 0); });
drawer.addEventListener('click', (e) => { if (e.target.closest('.backup button, .support-link')) setTimeout(closeTools, 0); });
/* Clic fuera, o Esc, lo cierra (el buscador con texto conserva su lista mientras se escribe) */
document.addEventListener('pointerdown', (e) => {
  if (!anyOpen()) return;
  if (drawer.contains(e.target) || createPop.contains(e.target) || alertsPop.contains(e.target) || toolsBtn.contains(e.target)) return;
  if (e.target.closest('#create-btn, #alerts-btn')) return; // esos botones abren y cierran su propio panel
  closeTools();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !anyOpen()) return;
  if (document.querySelector('dialog[open]')) return;
  const input = document.getElementById('search-input');
  if (document.activeElement === input && input.value) return; // primero limpia la búsqueda (search.js)
  const was = panelOpen('create') ? createBtn() : panelOpen('alerts') ? alertsBtn() : toolsBtn;
  closeTools();
  was?.focus();
}, true);

if (loadUi().folded) setFolded(true, false);

/** Tarjeta "Ver listado de notas" (la dibuja renderUpcoming, junto a «Ver listado de eventos»). */
function notesListSlot() {
  return h('li', { class: 'up-slot' }, h('button', {
    type: 'button', class: 'up-card more notes-card', id: 'notes-btn',
    'aria-label': t('notes.btnAria', { n: state.items.length }),
    onclick: () => openNotesList(),
  }, lucide('layout-list', 'more-ico'), h('span', { text: t('notes.btn') })));
}

/** Tarjeta "Crear nota" (la dibuja renderUpcoming, justo después de la campana). */
function createNoteSlot() {
  return h('li', { class: 'up-slot create-slot' }, h('button', {
    type: 'button', class: 'up-card create', id: 'create-btn', 'aria-haspopup': 'true',
    'aria-expanded': String(panelOpen('create')), 'aria-controls': 'create-pop', 'aria-label': t('create.title'),
  },
  lucide('plus', 'create-plus'),
  h('span', { text: t('create.title') })));
}