'use strict';

/* ============================================================
   Alertas
   - Post-it naranja en el tablero con cuenta atrás y chincheta por urgencia.
   - Ventana de la campana para crear y administrar alertas.
   - Al llegar la hora: ventana en pantalla (Descartar / Prorrogar),
     notificación del sistema y un sonido suave.
   Este archivo se carga antes que app.js y usa sus funciones al ejecutarse.
   ============================================================ */

const ALERT_SOON_MS = 3 * 3600e3; // chincheta amarilla: faltan menos de 3 horas
const ALERT_NOW_MS = 15 * 60e3;   // chincheta roja: faltan 15 minutos o menos, o ya venció
const SNOOZE_MS = 10 * 60e3;      // "Prorrogar 10 minutos"
const WEEKDAYS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mié'], [4, 'Jue'], [5, 'Vie'], [6, 'Sáb'], [0, 'Dom']]; // getDay()

/* ---------- Horarios ---------- */
/** Próxima vez que suena la alerta `a` ({ time, repeat }) después de `from` (milisegundos). */
function nextTrigger(a, from = Date.now()) {
  const [hh, mm] = a.time.split(':').map(Number);
  if (a.repeat.mode === 'once') {
    if (!a.repeat.date) return 0;
    const d = parseKey(a.repeat.date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0).getTime();
  }
  const days = a.repeat.mode === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : a.repeat.days;
  const base = new Date(from);
  for (let i = 0; i < 8; i++) {
    const c = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i, hh, mm, 0, 0);
    if (c.getTime() > from && days.includes(c.getDay())) return c.getTime();
  }
  return 0;
}

/** Normaliza los campos propios de una alerta guardada (se usa al cargar y al importar). */
function sanitizeAlertFields(it) {
  const r = it.repeat && typeof it.repeat === 'object' ? it.repeat : {};
  const days = Array.isArray(r.days)
    ? [...new Set(r.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [];
  let mode = ['once', 'daily', 'days'].includes(r.mode) ? r.mode : 'daily';
  if (mode === 'days' && !days.length) mode = 'daily';
  const date = typeof r.date === 'string' && isValidDate(r.date) ? r.date : '';
  if (mode === 'once' && !date) mode = 'daily';
  const out = {
    body: str(it.body, 2000),
    time: typeof it.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(it.time) ? it.time : '08:00',
    repeat: { mode, days, date },
    enabled: it.enabled !== false,
    done: !!it.done,
    fired: !!it.fired,
    snoozed: !!it.snoozed,
    next: num(it.next, 0),
  };
  if (out.enabled && !out.done && !out.fired && !out.next) out.next = nextTrigger(out);
  return out;
}

/** (Re)programa una alerta desde cero: la próxima vez que le toca sonar. */
function scheduleAlert(it) {
  it.fired = false;
  it.snoozed = false;
  it.done = false;
  it.next = it.enabled ? nextTrigger(it) : 0;
}

/* ---------- Textos ---------- */
function fmtClock(ms) {
  return new Date(ms).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' });
}
function fmtTime(hhmm) {
  const [hh, mm] = hhmm.split(':').map(Number);
  return fmtClock(new Date(2000, 0, 1, hh, mm).getTime());
}
const shortDate = (key) => {
  const d = parseKey(key);
  return `${DIAS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
};
function repeatLabel(r) {
  if (r.mode === 'once') return r.date ? t('rep.onceDate', { date: shortDate(r.date) }) : t('rep.once');
  if (r.mode === 'daily') return t('rep.daily');
  const set = new Set(r.days);
  if (set.size === 7) return t('rep.daily');
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return t('rep.weekdays');
  return WEEKDAYS.filter(([d]) => set.has(d)).map(([d]) => cap(weekdayShort(d))).join(I18N.lang === 'zh' ? '、' : ', ');
}
const scheduleLabel = (it) => `${fmtTime(it.time)} · ${repeatLabel(it.repeat)}`;
const alertMeta = (it) => (it.snoozed ? t('alerts.snoozed', { time: fmtClock(it.next) }) : scheduleLabel(it));

function fmtLeft(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  if (d) return `${d} d ${hh} h ${mm} min`;
  if (hh) return `${hh} h ${mm} min`;
  return `${mm} min ${pad(ss)} s`;
}
function fmtAgo(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return t('ago.now');
  if (m < 60) return t('ago.min', { n: m });
  const hh = Math.floor(m / 60);
  if (hh < 24) return t('ago.h', { h: hh, m: m % 60 });
  return t('ago.d', { n: Math.floor(hh / 24) });
}
function countdownLabel(it, now = Date.now()) {
  if (it.done) return t('cd.done');
  if (!it.enabled) return t('cd.paused');
  if (it.fired || it.next <= now) return t('cd.overdue', { ago: fmtAgo(now - it.next) });
  return t('cd.left', { time: fmtLeft(it.next - now) });
}

/** 'ok' (verde), 'soon' (amarillo), 'now' (rojo) u 'off' (en pausa o cumplida). */
function urgencyOf(it, now = Date.now()) {
  if (!it.enabled || it.done) return 'off';
  if (it.fired) return 'now';
  const left = it.next - now;
  return left <= ALERT_NOW_MS ? 'now' : left <= ALERT_SOON_MS ? 'soon' : 'ok';
}

/* ---------- Post-it del tablero ---------- */
function alertFace(it) {
  return [
    h('div', { class: 'alert-top' },
      h('span', { class: 'alert-bell ico', 'aria-hidden': 'true', text: '🔔' }),
      h('span', { class: 'countdown', text: countdownLabel(it) })),
    h('span', { class: 'item-title', text: it.title || t('alerts.defaultTitle') }),
    h('span', { class: 'alert-meta', text: alertMeta(it) }),
  ];
}

function setUrgency(node, u) {
  for (const c of ['ok', 'soon', 'now', 'off']) node.classList.toggle(`urg-${c}`, c === u);
}

/** Se ejecuta cada segundo: refresca cuentas atrás, colores de chincheta y campana. */
function updateAlertNodes() {
  const now = Date.now();
  for (const node of document.querySelectorAll('#items .item.type-alert')) {
    const it = byId(node.dataset.id);
    if (!it) continue;
    const c = node.querySelector('.countdown');
    const txt = countdownLabel(it, now);
    if (c && c.textContent !== txt) c.textContent = txt;
    const m = node.querySelector('.alert-meta');
    const meta = alertMeta(it);
    if (m && m.textContent !== meta) m.textContent = meta;
    setUrgency(node, urgencyOf(it, now));
  }
  updateBell(now);
  if ($('#alerts-dialog').open) updateAlertRows(now);
}

/* ---------- Campana de la barra superior ---------- */
function alertsBellSlot() {
  /* Al pulsarla se abre el submenú (lo maneja tools.js): Ver alertas / Crear alerta */
  return h('li', { class: 'up-slot bell-slot' }, h('button', {
    type: 'button', class: 'up-card bell', id: 'alerts-btn', 'aria-label': t('alerts.label'),
    'aria-haspopup': 'true', 'aria-expanded': String(typeof panelOpen === 'function' && panelOpen('alerts')), 'aria-controls': 'alerts-pop',
  },
  lucide('bell', 'bell-ico'),
  h('span', { text: t('alerts.label') }),
  h('span', { class: 'bell-badge', hidden: true }),
  lucide('chevron-down', 'bell-caret')));
}
/** Cantidades en el submenú y en la pestaña «Mis alertas». */
function updateAlertCounts() {
  const total = state.items.filter((i) => i.type === 'alert').length;
  const active = state.items.filter((i) => i.type === 'alert' && i.enabled && !i.done).length;
  const menu = document.getElementById('al-menu-count');
  if (menu) menu.textContent = total ? `${tn('alerts.menu.count', total)} · ${tn('alerts.menu.active', active)}` : t('alerts.menu.none');
  const tab = document.getElementById('al-tab-count');
  if (tab) tab.textContent = total ? String(total) : '';
}
function updateBell(now = Date.now()) {
  const btn = document.getElementById('alerts-btn');
  if (!btn) return;
  const active = state.items.filter((i) => i.type === 'alert' && i.enabled && !i.done);
  const badge = btn.querySelector('.bell-badge');
  badge.textContent = String(active.length);
  badge.hidden = active.length === 0;
  btn.classList.toggle('urgent', active.some((i) => urgencyOf(i, now) === 'now'));
  btn.setAttribute('aria-label', tn('alerts.bellAria', active.length));
  updateAlertCounts();
}

/** Al cambiar de idioma: refresca los textos de la ventana de alertas y de la campana. */
function refreshAlertsLang() {
  updatePrefs();
  updateAlertCounts();
  updateBell();
  const dlg = $('#alerts-dialog');
  if (dlg.open) {
    renderAlertList();
    /* vuelve a escribir los textos del formulario (crear / editar) y del título de la ventana */
    const view = $('#alert-form').hidden ? 'list' : 'new';
    const id = alertEditing;
    $('#alert-form-title').textContent = t(id ? 'alerts.title.edit' : 'alerts.title.new');
    $('#al-save').textContent = t(id ? 'alerts.save.edit' : 'alerts.save.new');
    $('#al-tab-new-label').textContent = t(id ? 'alerts.tab.edit' : 'alerts.tab.new');
    setAlertView(view);
  } else {
    $('#alert-form-title').textContent = t('alerts.title.new');
    $('#al-save').textContent = t('alerts.save.new');
    $('#al-tab-new-label').textContent = t('alerts.tab.new');
  }
}

/* ---------- Ventana "Alertas" ---------- */
let alertEditing = null;
const alertSorted = () => state.items.filter((i) => i.type === 'alert').sort((a, b) => {
  const live = (x) => (x.enabled && !x.done ? 0 : 1);
  return live(a) - live(b) || (a.next || Infinity) - (b.next || Infinity);
});

/** Muestra una de las dos vistas de la ventana: 'list' (Mis alertas) o 'new' (crear / editar). */
function setAlertView(view, focus = false) {
  const isNew = view === 'new';
  $('#al-view-list').hidden = isNew;
  $('#alert-form').hidden = !isNew;
  $('#al-tab-list').setAttribute('aria-selected', String(!isNew));
  $('#al-tab-new').setAttribute('aria-selected', String(isNew));
  $('#al-tab-list').tabIndex = isNew ? -1 : 0;
  $('#al-tab-new').tabIndex = isNew ? 0 : -1;
  $('#alerts-title').textContent = t(isNew ? (alertEditing ? 'alerts.title.edit' : 'alerts.title.new') : 'alerts.title.list');
  if (focus) (isNew ? $('#al-title') : $('#al-tab-list')).focus();
}

/** Abre la ventana en la vista pedida. Con editId, abre la alerta para editarla. */
function openAlerts(view = 'list', editId = null) {
  const dlg = $('#alerts-dialog');
  renderAlertList();
  resetAlertForm();
  updatePrefs();
  updateAlertCounts();
  if (editId) editAlert(editId);
  else setAlertView(view);
  if (!dlg.open) dlg.showModal();
  if (view === 'new' || editId) $('#al-title').focus();
}

/** Al tocar una alerta del tablero: si ya venció se muestra su aviso; si no, se abre para editarla. */
function openAlertItem(id) {
  const it = byId(id);
  if (!it) return;
  if (it.enabled && !it.done && (it.fired || it.next <= Date.now())) {
    if (!it.fired) { it.fired = true; save(); }
    fire.queue = fire.queue.filter((x) => x !== id);
    fire.queue.unshift(id);
    showNextFire();
  } else {
    openAlerts('new', id);
  }
}

function renderAlertList() {
  const list = $('#alerts-list');
  const items = alertSorted();
  updateAlertCounts();
  if (!items.length) {
    list.replaceChildren(h('li', { class: 'list-empty' },
      h('span', { text: t('alerts.none') }),
      h('button', { type: 'button', class: 'btn small primary', onclick: () => { resetAlertForm(); setAlertView('new', true); } }, t('alerts.createFirst'))));
    return;
  }
  list.replaceChildren(...items.map((it) => {
    const live = it.enabled && !it.done;
    return h('li', { class: 'alert-row', dataset: { id: it.id } },
      h('span', { class: `al-dot urg-${urgencyOf(it)}`, 'aria-hidden': 'true' }),
      h('div', { class: 'al-main' },
        h('strong', { text: it.title || t('alerts.defaultTitle') }),
        h('span', { class: 'al-sched', text: alertMeta(it) }),
        h('span', { class: 'al-status', text: countdownLabel(it) }),
        it.body ? h('span', { class: 'al-body', text: it.body }) : null),
      h('div', { class: 'ev-btns' },
        actBtn(live ? 'pause' : 'play', t(live ? 'alerts.pause' : 'alerts.activate', { name: it.title }), () => toggleAlert(it.id)),
        actBtn('edit', t('alerts.edit', { name: it.title }), () => editAlert(it.id)),
        actBtn('delete', t('alerts.delete', { name: it.title }), () => removeAlert(it.id))));
  }));
}
function updateAlertRows(now = Date.now()) {
  for (const row of document.querySelectorAll('#alerts-list .alert-row')) {
    const it = byId(row.dataset.id);
    if (!it) continue;
    const s = row.querySelector('.al-status');
    const txt = countdownLabel(it, now);
    if (s.textContent !== txt) s.textContent = txt;
    row.querySelector('.al-dot').className = `al-dot urg-${urgencyOf(it, now)}`;
  }
}

function toggleAlert(id) {
  const it = byId(id);
  if (!it) return;
  if (it.enabled && !it.done) {
    it.enabled = false; it.fired = false; it.snoozed = false; it.next = 0;
    fire.queue = fire.queue.filter((x) => x !== id);
  } else {
    it.enabled = true;
    scheduleAlert(it);
    if (it.repeat.mode === 'once' && it.next <= Date.now()) {
      it.enabled = false; it.done = true; it.next = 0;
      toast(t('alerts.onceExpired'));
    }
  }
  save();
  refreshItemNode(id);
  renderAlertList();
  updateBell();
}

async function removeAlert(id) {
  const it = byId(id);
  if (!it) return;
  if (!(await confirmDialog(t('alerts.confirmDelete', { name: it.title })))) return;
  fire.queue = fire.queue.filter((x) => x !== id);
  if (alertEditing === id) resetAlertForm();
  deleteItem(id);
  renderAlertList();
  updateBell();
}

/* --- Formulario --- */
const alertMode = () => document.querySelector('input[name="al-mode"]:checked')?.value || 'once';
function syncRepeatUI() {
  const mode = alertMode();
  $('#al-date-wrap').hidden = mode !== 'once';
  $('#al-days-wrap').hidden = mode !== 'days';
}
function defaultWhen() {
  const d = new Date(Date.now() + 30 * 60e3);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return { date: dateKey(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
function setDayChecks(days) {
  document.querySelectorAll('input[name="al-day"]').forEach((c) => { c.checked = days.includes(Number(c.value)); });
}
function resetAlertForm() {
  alertEditing = null;
  const w = defaultWhen();
  $('#al-title').value = '';
  $('#al-text').value = '';
  $('#al-time').value = w.time;
  $('#al-date').value = w.date;
  document.querySelector('input[name="al-mode"][value="once"]').checked = true;
  setDayChecks([]);
  $('#al-error').hidden = true;
  $('#alert-form-title').textContent = t('alerts.title.new');
  $('#al-save').textContent = t('alerts.save.new');
  $('#al-cancel').hidden = true;
  $('#al-tab-new-label').textContent = t('alerts.tab.new');
  syncRepeatUI();
}
function editAlert(id) {
  const it = byId(id);
  if (!it) return;
  alertEditing = id;
  $('#al-title').value = it.title;
  $('#al-text').value = it.body;
  $('#al-time').value = it.time;
  $('#al-date').value = it.repeat.date || defaultWhen().date;
  document.querySelector(`input[name="al-mode"][value="${it.repeat.mode}"]`).checked = true;
  setDayChecks(it.repeat.days);
  $('#al-error').hidden = true;
  $('#alert-form-title').textContent = t('alerts.title.edit');
  $('#al-save').textContent = t('alerts.save.edit');
  $('#al-cancel').hidden = false;
  $('#al-tab-new-label').textContent = t('alerts.tab.edit');
  syncRepeatUI();
  setAlertView('new', true);
}

function submitAlertForm(e) {
  e.preventDefault();
  const err = $('#al-error');
  const fail = (msg, el) => { err.textContent = msg; err.hidden = false; el?.focus(); };
  const title = $('#al-title').value.trim();
  const time = $('#al-time').value;
  const mode = alertMode();
  const date = $('#al-date').value;
  const days = [...document.querySelectorAll('input[name="al-day"]:checked')].map((c) => Number(c.value));
  if (!title) return fail(t('alerts.err.title'), $('#al-title'));
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return fail(t('alerts.err.time'), $('#al-time'));
  if (mode === 'once' && !isValidDate(date)) return fail(t('alerts.err.date'), $('#al-date'));
  if (mode === 'days' && !days.length) return fail(t('alerts.err.days'), document.querySelector('input[name="al-day"]'));
  const sched = { time, repeat: { mode, days: mode === 'days' ? days : [], date: mode === 'once' ? date : '' } };
  if (mode === 'once' && nextTrigger(sched) <= Date.now()) return fail(t('alerts.err.past'), $('#al-time'));
  err.hidden = true;

  const body = $('#al-text').value.trim();
  const creating = !alertEditing;
  let id = alertEditing;
  if (id) {
    const it = byId(id);
    Object.assign(it, { title, body, ...sched, enabled: true });
    scheduleAlert(it);
    fire.queue = fire.queue.filter((x) => x !== id);
  } else {
    const it = newItemBase('alert', { title, body, ...sched, enabled: true, done: false, fired: false, snoozed: false, next: 0 });
    scheduleAlert(it);
    state.items.push(it);
    id = it.id;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(updatePrefs).catch(() => {});
    }
  }
  save();
  renderBoard();
  renderAlertList();
  updateBell();
  resetAlertForm();
  setAlertView('list', true); // vuelve a «Mis alertas» para ver la alerta recién guardada
  toast(t(creating ? 'alerts.created' : 'alerts.saved'));
}

/* --- Notificaciones y sonido --- */
function updatePrefs() {
  const st = $('#notif-status');
  const btn = $('#notif-btn');
  if (!('Notification' in window)) {
    st.textContent = t('alerts.notif.unsupported');
    btn.hidden = true;
  } else if (Notification.permission === 'granted') {
    st.textContent = t('alerts.notif.granted');
    btn.hidden = true;
  } else if (Notification.permission === 'denied') {
    st.textContent = t('alerts.notif.denied');
    btn.hidden = true;
  } else {
    st.textContent = t('alerts.notif.default');
    btn.hidden = false;
  }
  $('#sound-toggle').checked = !!state.settings.sound;
}

let audioCtx = null;
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* sin audio */ }
}
/** Dos "din-don" suaves hechos con osciladores (no hace falta ningún archivo de sonido). */
function playChime(force = false) {
  if (!force && !state.settings.sound) return;
  unlockAudio();
  const ctx = audioCtx;
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + 0.03;
  [[659.25, 0], [880, 0.24], [659.25, 1.0], [880, 1.24]].forEach(([freq, dt]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + dt);
    gain.gain.exponentialRampToValueAtTime(0.08, t0 + dt + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.8);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + dt);
    osc.stop(t0 + dt + 0.85);
  });
}

async function notifyAlert(it) {
  playChime();
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const title = `🔔 ${it.title || t('alerts.defaultTitle')}`;
  const opts = {
    body: it.body || t('alerts.fire.now', { time: fmtClock(it.next) }),
    tag: `chincheta-${it.id}`, renotify: true, requireInteraction: true,
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    data: { id: it.id },
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) {
      await reg.showNotification(title, {
        ...opts,
        actions: [{ action: 'snooze', title: t('alerts.notif.snooze') }, { action: 'dismiss', title: t('alerts.notif.dismiss') }],
      });
      return;
    }
  } catch { /* se prueba con la notificación simple */ }
  try { new Notification(title, opts); } catch { /* no crítico */ }
}

/* ---------- Aviso cuando se cumple la hora ---------- */
const fire = { queue: [], shown: new Set(), current: null };

function enqueueFire(id) {
  if (!fire.queue.includes(id) && fire.current !== id) fire.queue.push(id);
}

function showNextFire() {
  const dlg = $('#alert-dialog');
  if (dlg.open) return;
  while (fire.queue.length) {
    const id = fire.queue.shift();
    const it = byId(id);
    if (!it || it.type !== 'alert' || !it.enabled || !it.fired) continue;
    fire.current = id;
    fire.shown.add(id);
    $('#fire-title').textContent = it.title || t('alerts.defaultTitle');
    const text = $('#fire-text');
    text.textContent = it.body;
    text.hidden = !it.body;
    const late = Date.now() - it.next;
    $('#fire-when').textContent = late > 90e3
      ? t('alerts.fire.late', { time: fmtClock(it.next), ago: fmtAgo(late) })
      : t('alerts.fire.now', { time: fmtClock(it.next) });
    const count = $('#fire-count');
    count.textContent = t('alerts.fire.queue', { n: fire.queue.length + 1 });
    count.hidden = fire.queue.length === 0;
    document.title = `🔔 ${it.title || t('alerts.defaultTitle')} · ${APP_NAME}`;
    dlg.showModal();
    $('#fire-dismiss').focus();
    return;
  }
  fire.current = null;
  document.title = APP_NAME;
}

/** Descartar: la alerta se cierra; si se repite, queda programada para su siguiente vez. */
function dismissAlert(id) {
  const it = byId(id);
  if (!it) return;
  it.fired = false;
  it.snoozed = false;
  if (it.repeat.mode === 'once') { it.done = true; it.enabled = false; it.next = 0; }
  else it.next = nextTrigger(it, Date.now());
  save();
  refreshItemNode(id);
  updateBell();
  if ($('#alerts-dialog').open) renderAlertList();
}

/** Prorrogar: vuelve a sonar dentro de 10 minutos. */
function snoozeAlert(id) {
  const it = byId(id);
  if (!it) return;
  it.fired = false;
  it.snoozed = true;
  it.next = Date.now() + SNOOZE_MS;
  save();
  refreshItemNode(id);
  updateBell();
  if ($('#alerts-dialog').open) renderAlertList();
}

function alertsTick() {
  const now = Date.now();
  for (const it of state.items) {
    if (it.type !== 'alert' || !it.enabled || it.done) continue;
    if (!it.fired && it.next && it.next <= now) {
      it.fired = true;
      save();
      notifyAlert(it);
      enqueueFire(it.id);
    } else if (it.fired && !fire.shown.has(it.id)) {
      enqueueFire(it.id); // venció mientras Chincheta estaba cerrada
    }
  }
  if (fire.queue.length) showNextFire();
  updateAlertNodes();
}

/** Un reloj dentro de un Worker: el navegador lo frena menos que a la página cuando está en segundo plano. */
function startAlertClock(fn) {
  try {
    const blob = new Blob(['setInterval(function(){postMessage(0)},1000)'], { type: 'text/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = fn;
  } catch {
    setInterval(fn, 1000);
  }
}

function setupAlerts() {
  const dlg = $('#alerts-dialog');
  $('#alerts-close').addEventListener('click', () => dlg.close());
  enableBackdropClose(dlg);
  /* Submenú de la campana */
  $('#al-menu-list').addEventListener('click', () => { closeTools(); openAlerts('list'); });
  $('#al-menu-new').addEventListener('click', () => { closeTools(); openAlerts('new'); });
  /* Pestañas de la ventana */
  $('#al-tab-list').addEventListener('click', () => setAlertView('list'));
  $('#al-tab-new').addEventListener('click', () => setAlertView('new'));
  $('.al-tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setAlertView(e.key === 'ArrowRight' ? 'new' : 'list', true);
  });
  document.querySelectorAll('input[name="al-mode"]').forEach((r) => r.addEventListener('change', syncRepeatUI));
  $('#alert-form').addEventListener('submit', submitAlertForm);
  $('#al-cancel').addEventListener('click', () => { resetAlertForm(); setAlertView('list', true); });

  $('#notif-btn').addEventListener('click', () => {
    Notification.requestPermission().then(updatePrefs).catch(() => {});
  });
  $('#sound-toggle').addEventListener('change', (e) => { state.settings.sound = e.target.checked; save(); });
  $('#sound-test').addEventListener('click', () => { unlockAudio(); setTimeout(() => playChime(true), 80); });

  const fireDlg = $('#alert-dialog');
  $('#fire-dismiss').addEventListener('click', () => { const id = fire.current; fireDlg.close(); dismissAlert(id); });
  $('#fire-snooze').addEventListener('click', () => { const id = fire.current; fireDlg.close(); snoozeAlert(id); });
  fireDlg.addEventListener('close', () => { fire.current = null; setTimeout(showNextFire, 200); });

  /* Los navegadores solo dejan sonar el audio después de un gesto del usuario */
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, unlockAudio, { passive: true }));

  /* Botones de la notificación del sistema (Prorrogar / Descartar) */
  navigator.serviceWorker?.addEventListener('message', (e) => {
    const { type, action, id } = e.data || {};
    if (type !== 'alert-action' || !byId(id)) return;
    if (action === 'snooze') snoozeAlert(id);
    else if (action === 'dismiss') dismissAlert(id);
    else openAlertItem(id);
  });

  document.addEventListener('visibilitychange', () => { if (!document.hidden) alertsTick(); });
  startAlertClock(alertsTick);
  alertsTick();
}