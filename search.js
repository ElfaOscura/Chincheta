'use strict';

/* ============================================================
   Buscador global
   Escribe en la barra de arriba (o pulsa "/" o Ctrl + K) y mientras
   escribes: las notas que no coinciden se atenúan en el tablero y
   aparece una lista con los resultados (notas, tareas, enlaces,
   alertas y eventos del calendario). Ignora mayúsculas y tildes.
   ============================================================ */

let searchQuery = '';
const SEARCH_ICON = { note: '📝', tasks: '✅', links: '🔗', image: '🖼️', draw: '🎨', alert: '🔔' };
const SEARCH_MAX = 8;

const searchNorm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const searchTerms = () => searchNorm(searchQuery).split(/\s+/).filter(Boolean);

/** Todo el texto de una nota donde se puede buscar. */
function itemParts(it) {
  const rest = [];
  if (it.type === 'note') rest.push(it.body);
  if (it.type === 'tasks') it.tasks.forEach((t) => rest.push(t.text));
  if (it.type === 'links') it.links.forEach((l) => rest.push(l.label, l.title, l.url));
  if (it.type === 'image') rest.push(it.note, it.src);
  if (it.type === 'alert') rest.push(it.body, repeatLabel(it.repeat));
  if (it.imageUrl) rest.push(it.imageUrl);
  const title = it.title || (it.type === 'image' ? it.note || '' : '');
  return { title, rest: rest.filter(Boolean) };
}
function eventParts(ev) {
  return { title: ev.title, rest: [ev.text, fmtLong(ev.date), EVENT_TYPES[ev.type].label].filter(Boolean) };
}

const partsMatch = ({ title, rest }, terms) => {
  const all = searchNorm([title, ...rest].join(' \n '));
  return terms.every((t) => all.includes(t));
};

/** Trocito de texto alrededor de la primera coincidencia (para mostrar bajo el título). */
function searchSnippet(rest, terms) {
  for (const text of rest) {
    const i = searchNorm(text).indexOf(terms[0]);
    if (i < 0) continue;
    const a = Math.max(0, i - 18);
    const body = text.slice(a, a + 72).replace(/\s+/g, ' ');
    return `${a > 0 ? '…' : ''}${body}${a + 72 < text.length ? '…' : ''}`;
  }
  return '';
}

/* --- Atenuar en el tablero lo que no coincide --- */
function applySearch() {
  const terms = searchTerms();
  const board = document.getElementById('board');
  board.classList.toggle('searching', terms.length > 0);
  for (const node of document.getElementById('items').children) {
    const it = byId(node.dataset.id);
    const hit = !terms.length || (!!it && partsMatch(itemParts(it), terms));
    node.classList.toggle('dim', !hit);
    node.classList.toggle('hit', terms.length > 0 && hit);
  }
  if (typeof dockSearchHit === 'function') dockSearchHit(terms); // la nota fijada también se resalta
}

/* --- Lista de resultados --- */
function searchResults(terms) {
  const out = [];
  for (const it of state.items) {
    const p = itemParts(it);
    if (!partsMatch(p, terms)) continue;
    out.push({
      kind: 'item', id: it.id, icon: SEARCH_ICON[it.type],
      title: p.title || TYPES[it.type].label,
      sub: searchSnippet(p.rest, terms) || TYPES[it.type].label,
    });
  }
  const today = todayKey();
  for (const ev of state.events) {
    const p = eventParts(ev);
    if (!partsMatch(p, terms)) continue;
    const key = nextOccurrence(ev, today) || ev.date;
    out.push({
      kind: 'event', key, icon: EVENT_TYPES[ev.type].icon,
      title: ev.title,
      sub: `${EVENT_TYPES[ev.type].label} · ${cap(fmtLong(key))}`,
    });
  }
  return out;
}

function openSearchResult(r) {
  hideSearchResults();
  if (r.kind === 'item') openItem(r.id);
  else openCalendar(r.key);
}
function hideSearchResults() {
  document.getElementById('search-results').hidden = true;
}

function renderSearchResults() {
  const box = document.getElementById('search-results');
  const status = document.getElementById('search-status');
  const terms = searchTerms();
  if (!terms.length) {
    box.hidden = true;
    box.replaceChildren();
    status.textContent = '';
    return;
  }
  const res = searchResults(terms);
  status.textContent = res.length ? tn('search.status', res.length) : t('search.none');
  if (!res.length) {
    box.replaceChildren(h('p', { class: 'sr-empty', text: t('search.noResults', { q: searchQuery.trim() }) }));
  } else {
    const rows = res.slice(0, SEARCH_MAX).map((r) => h('button', {
      type: 'button', class: 'sr-item', onclick: () => openSearchResult(r),
    },
    h('span', { class: 'ico sr-ico', 'aria-hidden': 'true', text: r.icon }),
    h('span', { class: 'sr-text' }, h('strong', { text: r.title }), h('span', { text: r.sub }))));
    if (res.length > SEARCH_MAX) rows.push(h('p', { class: 'sr-more', text: t('search.more', { n: res.length - SEARCH_MAX }) }));
    box.replaceChildren(...rows);
  }
  box.hidden = false;
}

function setupSearch() {
  const input = document.getElementById('search-input');
  const box = document.getElementById('search-results');
  const wrap = input.closest('.search');

  const run = () => {
    searchQuery = input.value;
    applySearch();
    renderSearchResults();
  };
  input.addEventListener('input', run);
  input.addEventListener('focus', () => { if (searchTerms().length) renderSearchResults(); });
  wrap.addEventListener('focusout', (e) => { if (!wrap.contains(e.relatedTarget)) hideSearchResults(); });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      const first = box.querySelector('.sr-item');
      if (first) { e.preventDefault(); first.focus(); }
    } else if (e.key === 'Enter') {
      const first = box.querySelector('.sr-item');
      if (first) { e.preventDefault(); first.click(); }
    } else if (e.key === 'Escape') {
      if (input.value) { input.value = ''; run(); } else input.blur();
    }
  });
  box.addEventListener('keydown', (e) => {
    const items = [...box.querySelectorAll('.sr-item')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && i < items.length - 1) { e.preventDefault(); items[i + 1].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? items[i - 1] : input).focus(); }
    else if (e.key === 'Escape') { input.focus(); }
  });

  /* Atajos: "/" o Ctrl + K llevan el cursor al buscador */
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    const slash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing;
    const ctrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
    if (!slash && !ctrlK) return;
    e.preventDefault();
    if (typeof openTools === 'function') openTools();
    input.focus();
    input.select();
  });
}