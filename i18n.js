'use strict';

/* ============================================================
   Idiomas (español, inglés y chino).
   - Los textos viven en i18n/es.js, i18n/en.js e i18n/zh.js
     (un diccionario por idioma, con las mismas claves).
   - t('clave', { nombre: 'valor' })   → texto traducido ({nombre} se reemplaza)
   - tn('clave', n, vars)              → singular|plural según n ("{n} nota|{n} notas")
   - setLang('en')                     → cambia el idioma y vuelve a dibujar la app
   - Los textos fijos de index.html se traducen con STATIC (abajo):
     [selector, clave, atributo]. Sin atributo se cambia el texto.
   Para agregar un idioma: crea i18n/xx.js, regístralo en I18N.langs y súmalo a index.html y sw.js.
   ============================================================ */
const I18N = {
  lang: 'es',
  dict: {},
  langs: {
    es: { name: 'Español', locale: 'es-VE', html: 'es' },
    en: { name: 'English', locale: 'en-US', html: 'en' },
    zh: { name: '中文', locale: 'zh-CN', html: 'zh-CN' },
  },
  onChange: [], // funciones que se ejecutan después de cambiar de idioma
};
const LANG_KEY = 'chincheta:lang';

const locale = () => I18N.langs[I18N.lang].locale;

function t(key, vars) {
  let s = I18N.dict[I18N.lang]?.[key] ?? I18N.dict.es?.[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}
/** Plural simple: la clave guarda "singular|plural" (el chino usa una sola forma). */
function tn(key, n, vars = {}) {
  const raw = t(key, { n, ...vars });
  const [one, many] = raw.split('|');
  return n === 1 || many === undefined ? one : many;
}

function detectLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && I18N.langs[saved]) return saved;
  } catch { /* sin almacenamiento */ }
  const nav = (navigator.language || 'es').slice(0, 2).toLowerCase();
  return I18N.langs[nav] ? nav : 'es';
}

/* --- Nombres de meses y días (los arrays los declara app.js; aquí se rellenan según el idioma) --- */
const intlNames = (opts, count, make) => Array.from({ length: count }, (_, i) => new Intl.DateTimeFormat(locale(), opts).format(make(i)));
function fillDateNames() {
  const fill = (arr, items) => { arr.splice(0, arr.length, ...items); };
  fill(MESES, intlNames({ month: 'long' }, 12, (i) => new Date(2024, i, 1)));
  fill(MESES_CORTOS, intlNames({ month: 'short' }, 12, (i) => new Date(2024, i, 1)).map((s) => s.replace(/\.$/, '')));
  fill(DIAS, intlNames({ weekday: 'long' }, 7, (i) => new Date(2024, 0, 7 + i))); // 7 de enero de 2024 fue domingo
  fill(DIAS_CORTOS_LUN, intlNames({ weekday: 'short' }, 7, (i) => new Date(2024, 0, 8 + i)).map((s) => s.replace(/\.$/, ''))); // empieza en lunes
}
/** Día de la semana abreviado (0 = domingo). */
const weekdayShort = (d) => new Intl.DateTimeFormat(locale(), { weekday: 'short' }).format(new Date(2024, 0, 7 + d)).replace(/\.$/, '');
/** Fecha larga sin año: «jueves, 5 de noviembre» / «Thursday, November 5» / «11月5日星期四». */
const fmtLongIntl = (d) => new Intl.DateTimeFormat(locale(), { weekday: 'long', month: 'long', day: 'numeric' }).format(d);
/** Fecha larga con año. */
const fmtFullIntl = (d) => new Intl.DateTimeFormat(locale(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(d);

/* --- Textos fijos de index.html: [selector, clave, atributo (opcional)] --- */
const STATIC = [
  ['#date-btn .visually-hidden', 'cal.open'],
  ['#up-title', 'up.title'],
  ['#tools-btn', 'menu.label', 'aria-label'],
  ['#tools-btn', 'menu.title', 'title'],
  ['#tools-btn .tools-label', 'menu.label'],
  ['#tools-drawer', 'menu.label', 'aria-label'],
  ['label[for="search-input"]', 'search.placeholder'],
  ['#search-input', 'search.placeholder', 'placeholder'],
  ['.search-key', 'search.key', 'title'],
  ['.backup', 'backup.group', 'aria-label'],
  ['#export-btn', 'backup.save'],
  ['#import-btn', 'backup.load'],
  ['#install-btn', 'backup.install'],
  ['#support-link span', 'support'],
  ['.lang-title', 'lang.label'],
  ['.lang-pick', 'lang.label', 'aria-label'],
  ['#create-pop', 'create.title', 'aria-label'],
  ['#create-pop .pop-title', 'create.question'],
  ['#create-pop .adders', 'create.group', 'aria-label'],
  ['[data-add="tasks"]', 'type.tasks'], ['[data-add="tasks"]', 'create.add.tasks', 'aria-label'],
  ['[data-add="note"]', 'type.note'], ['[data-add="note"]', 'create.add.note', 'aria-label'],
  ['[data-add="links"]', 'type.links'], ['[data-add="links"]', 'create.add.links', 'aria-label'],
  ['[data-add="image"]', 'type.image'], ['[data-add="image"]', 'create.add.image', 'aria-label'],
  ['[data-add="draw"]', 'type.draw'], ['[data-add="draw"]', 'create.add.draw', 'aria-label'],
  ['#alerts-pop', 'alerts.label', 'aria-label'],
  ['#al-menu-list strong', 'alerts.menu.list'],
  ['#al-menu-new strong', 'alerts.menu.new'],
  ['#al-menu-new small', 'alerts.menu.newSub'],
  ['#board', 'board.label', 'aria-label'],
  ['#empty .empty-title', 'empty.title'],
  ['#empty p:not(.empty-title)', 'empty.text'],
  ['#dock-resize', 'dock.resize', 'aria-label'],
  ['#dock-resize', 'dock.resizeTitle', 'title'],
  /* Agregar imagen */
  ['#image-dlg-title', 'img.add'],
  ['#image-close', 'common.close', 'aria-label'],
  ['label[for="img-file"]', 'img.file'],
  ['#image-form .or', 'common.or'],
  ['label[for="img-url"]', 'img.url'],
  ['label[for="img-note"]', 'img.note'],
  ['#img-note', 'img.notePh', 'placeholder'],
  ['#image-cancel', 'common.cancel'],
  ['#image-submit', 'img.submit'],
  /* Calendario */
  ['#cal-dialog', 'cal.label', 'aria-label'],
  ['#cal-close', 'cal.close', 'aria-label'],
  ['.cal-month', 'cal.month', 'aria-label'],
  ['#cal-prev', 'cal.prev', 'aria-label'],
  ['#cal-next', 'cal.next', 'aria-label'],
  ['#cal-today', 'cal.today'],
  ['.cal-day', 'cal.dayNotes', 'aria-label'],
  ['#event-form legend', 'cal.eventType'],
  ['.type-opt.t-event > span', 'ev.type.event'],
  ['.type-opt.t-birthday > span', 'ev.type.birthday'],
  ['label[for="ev-date"]', 'ev.date'],
  ['label[for="ev-title"]', 'ev.title'],
  ['#ev-title', 'ev.titlePh', 'placeholder'],
  ['label[for="ev-text"]', 'ev.details'],
  ['#ev-cancel', 'common.cancel'],
  /* Alertas */
  ['#alerts-close', 'alerts.close', 'aria-label'],
  ['.al-tabs', 'alerts.label', 'aria-label'],
  ['#al-tab-list > span:not(.al-tab-count)', 'alerts.tab.list'],
  ['label[for="al-title"]', 'alerts.f.title'],
  ['#al-title', 'alerts.f.titlePh', 'placeholder'],
  ['label[for="al-text"]', 'alerts.f.desc'],
  ['label[for="al-time"]', 'alerts.f.time'],
  ['.repeat-pick legend', 'alerts.f.repeat'],
  ['input[name="al-mode"][value="once"] + span', 'alerts.f.once'],
  ['input[name="al-mode"][value="daily"] + span', 'alerts.f.daily'],
  ['input[name="al-mode"][value="days"] + span', 'alerts.f.days'],
  ['label[for="al-date"]', 'alerts.f.date'],
  ['#al-days-wrap legend', 'alerts.f.daysLegend'],
  ['#al-cancel', 'common.cancel'],
  ['#notif-btn', 'alerts.notif.btn'],
  ['label.check', 'alerts.sound'],
  ['#sound-test', 'alerts.soundTest'],
  ['#fire-snooze', 'alerts.fire.snooze'],
  ['#fire-dismiss', 'alerts.fire.dismiss'],
  /* Listados */
  ['#events-close', 'events.close', 'aria-label'],
  ['#events-title', 'events.title'],
  ['#events-add', 'events.add'],
  ['#notes-close', 'notes.close', 'aria-label'],
  ['#notes-title', 'notes.title'],
  ['label[for="notes-filter"]', 'notes.filter'],
  ['#notes-filter', 'notes.filterPh', 'placeholder'],
  ['#notes-chips', 'notes.filterType', 'aria-label'],
  ['#confirm-dialog button[value="cancel"]', 'common.cancel'],
];

/** Cambia el texto de un elemento sin tocar sus iconos: reemplaza su último nodo de texto. */
function setNodeText(el, text) {
  if (!el.children.length) { el.textContent = text; return; }
  const nodes = [...el.childNodes].filter((n) => n.nodeType === 3 && n.nodeValue.trim());
  const node = nodes[nodes.length - 1];
  if (node) node.nodeValue = /^\s*/.exec(node.nodeValue)[0] + text;
  else el.append(document.createTextNode(text));
}

function applyI18n() {
  for (const [sel, key, attr] of STATIC) {
    for (const el of document.querySelectorAll(sel)) {
      if (attr) el.setAttribute(attr, t(key));
      else setNodeText(el, t(key));
    }
  }
  /* Iniciales y nombres de los días en el formulario de alertas (Lunes primero) */
  const order = [1, 2, 3, 4, 5, 6, 0];
  order.forEach((d, i) => {
    const sp = document.querySelector(`input[name="al-day"][value="${d}"] + span`);
    if (!sp) return;
    sp.textContent = t(`wd.initial.${d}`);
    sp.title = DIAS[d] ? DIAS[d].charAt(0).toUpperCase() + DIAS[d].slice(1) : '';
  });
  document.querySelectorAll('.lang-pick button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === I18N.lang)));
}

function setLang(lang, { silent = false } = {}) {
  if (!I18N.langs[lang]) lang = 'es';
  I18N.lang = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* no crítico */ }
  document.documentElement.lang = I18N.langs[lang].html;
  fillDateNames();
  applyI18n();
  if (!silent) for (const fn of I18N.onChange) fn();
}

/** Arranque: elige el idioma guardado (o el del navegador) y conecta los botones del menú. */
function initI18n() {
  I18N.lang = detectLang();
  document.querySelectorAll('.lang-pick button').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.lang !== I18N.lang) setLang(b.dataset.lang);
  }));
  setLang(I18N.lang, { silent: true });
}