'use strict';

/* ============================================================
   Listado de notas: todas las notas del tablero en una lista que se
   puede filtrar por texto y por tipo. Para cuando el tablero se llena.
   Cada fila: abrir la nota, verla en el tablero y fijarla (estrella).
   ============================================================ */

let notesType = 'all'; // 'all' o una clave de TYPES

const notesDlg = () => document.getElementById('notes-dialog');

function openNotesList() {
  const dlg = notesDlg();
  if (!dlg) return;
  document.getElementById('notes-filter').value = '';
  notesType = 'all';
  renderNotesList();
  if (!dlg.open) dlg.showModal();
  document.getElementById('notes-filter').focus();
}

/** Si el listado está abierto, lo vuelve a dibujar (se llama al cambiar notas o la fijada). */
function refreshNotesList() {
  const dlg = notesDlg();
  if (dlg?.open) renderNotesList();
  const btn = document.getElementById('notes-btn');
  if (btn) btn.setAttribute('aria-label', t('notes.btnAria', { n: state.items.length }));
}

/** Muestra la nota en el tablero: la trae a la vista y la resalta un momento. */
function showOnBoard(id) {
  notesDlg().close();
  if (state.settings.dockId === id) { focusDock(); return; }
  const node = [...document.getElementById('items').children].find((n) => n.dataset.id === id);
  if (!node) return;
  node.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  node.classList.remove('flash');
  void node.offsetWidth; // reinicia la animación
  node.classList.add('flash');
  setTimeout(() => node.classList.remove('flash'), 1800);
}

function noteSummary(it) {
  if (it.type === 'tasks') {
    const p = taskProgress(it);
    return p.total ? t('tasks.progress', { done: p.done, total: p.total }) : t('notes.noTasks');
  }
  if (it.type === 'links') return it.links.length ? tn('notes.links', it.links.length) : t('notes.noLinks');
  if (it.type === 'note') return (it.body || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (it.type === 'alert') return (it.body || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  return '';
}

function renderNotesList() {
  const filter = document.getElementById('notes-filter').value;
  const terms = searchNorm(filter).split(/\s+/).filter(Boolean);

  /* Chips por tipo (solo los que existen), con su cantidad */
  const counts = {};
  for (const it of state.items) counts[it.type] = (counts[it.type] || 0) + 1;
  if (notesType !== 'all' && !counts[notesType]) notesType = 'all';
  const chip = (key, label, n) => h('button', {
    type: 'button', class: `chip${notesType === key ? ' on' : ''}`, 'aria-pressed': String(notesType === key),
    onclick: () => { notesType = key; renderNotesList(); },
  }, `${label} · ${n}`);
  document.getElementById('notes-chips').replaceChildren(
    chip('all', t('notes.all'), state.items.length),
    ...Object.keys(TYPES).filter((k) => counts[k]).map((k) => chip(k, TYPES[k].label, counts[k])),
  );

  const pinnedId = state.settings.dockId;
  const rows = state.items
    .filter((it) => (notesType === 'all' || it.type === notesType) && (!terms.length || partsMatch(itemParts(it), terms)))
    .sort((a, b) => (b.id === pinnedId) - (a.id === pinnedId) || itemLabel(a).localeCompare(itemLabel(b), 'es', { sensitivity: 'base' }));

  const total = state.items.length;
  document.getElementById('notes-count').textContent = rows.length === total
    ? tn('notes.count', total)
    : t('notes.countOf', { n: rows.length, total });

  const list = document.getElementById('notes-list');
  if (!rows.length) {
    list.replaceChildren(h('li', { class: 'notes-empty', text: t(total ? 'notes.emptyFilter' : 'notes.emptyNone') }));
    return;
  }
  list.replaceChildren(...rows.map((it) => {
    const pinned = it.id === pinnedId;
    const sum = noteSummary(it);
    return h('li', { class: `notes-row ${TYPES[it.type].cls}${pinned ? ' is-pinned' : ''}` },
      h('button', {
        type: 'button', class: 'notes-open',
        onclick: () => { notesDlg().close(); openItem(it.id); },
      },
      h('span', { class: 'ico', 'aria-hidden': 'true', text: SEARCH_ICON[it.type] }),
      h('span', { class: 'notes-text' },
        h('strong', { text: itemLabel(it) }),
        h('span', { text: sum ? `${TYPES[it.type].label} · ${sum}` : TYPES[it.type].label })),
      pinned ? h('span', { class: 'notes-badge', text: t('notes.pinned') }) : null),
      h('div', { class: 'notes-acts' },
        h('button', {
          type: 'button', class: 'link-btn act act-locate', 'aria-label': t('notes.locate'), title: t('notes.locate'),
          onclick: () => showOnBoard(it.id),
        }, lucide('map-pin')),
        it.type === 'alert' ? null : h('button', {
          type: 'button', class: `icon-btn star-toggle${pinned ? ' on' : ''}`,
          'aria-label': pinned ? t('unpin.aria') : t('pin.aria'), 'aria-pressed': String(pinned),
          title: pinned ? t('unpin.title') : t('pin.title'),
          onclick: () => { if (pinned) unpinItem(); else pinItem(it.id); },
        }, lucide('star'))));
  }));
}

function setupNotes() {
  const dlg = notesDlg();
  document.getElementById('notes-close').addEventListener('click', () => dlg.close());
  enableBackdropClose(dlg);
  document.getElementById('notes-filter').addEventListener('input', renderNotesList);
}