'use strict';

/* ============================================================
   Iconos Lucide (https://lucide.dev, licencia ISC) incluidos en el
   propio proyecto para que funcionen sin internet.
   Uso en HTML:  <i data-lucide="bell" class="mi-clase"></i>
   Uso en JS:    lucide('bell', 'mi-clase')
   Se dibujan con el color del texto (currentColor); el color se
   elige desde styles.css.
   ============================================================ */
const LUCIDE = {
  menu: [['path', 'M4 6h16'], ['path', 'M4 12h16'], ['path', 'M4 18h16']],
  plus: [['path', 'M5 12h14'], ['path', 'M12 5v14']],
  bell: [['path', 'M10.268 21a2 2 0 0 0 3.464 0'], ['path', 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326']],
  search: [['circle', { cx: 11, cy: 11, r: 8 }], ['path', 'm21 21-4.3-4.3']],
  list: [['path', 'M3 12h.01'], ['path', 'M3 18h.01'], ['path', 'M3 6h.01'], ['path', 'M8 12h13'], ['path', 'M8 18h13'], ['path', 'M8 6h13']],
  'list-checks': [['path', 'm3 17 2 2 4-4'], ['path', 'm3 7 2 2 4-4'], ['path', 'M13 6h8'], ['path', 'M13 12h8'], ['path', 'M13 18h8']],
  'sticky-note': [['path', 'M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z'], ['path', 'M15 3v4a2 2 0 0 0 2 2h4']],
  link: [['path', 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'], ['path', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71']],
  image: [['rect', { width: 18, height: 18, x: 3, y: 3, rx: 2, ry: 2 }], ['circle', { cx: 9, cy: 9, r: 2 }], ['path', 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21']],
  pencil: [['path', 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'], ['path', 'm15 5 4 4']],
  download: [['path', 'M12 15V3'], ['path', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'], ['path', 'm7 10 5 5 5-5']],
  upload: [['path', 'M12 3v12'], ['path', 'm17 8-5-5-5 5'], ['path', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4']],
  'arrow-down-to-line': [['path', 'M12 17V3'], ['path', 'm6 11 6 6 6-6'], ['path', 'M19 21H5']],
  coffee: [['path', 'M10 2v2'], ['path', 'M14 2v2'], ['path', 'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1'], ['path', 'M6 2v2']],
  star: [['path', 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z']],
  'layout-list': [['rect', { width: 7, height: 7, x: 3, y: 3, rx: 1 }], ['rect', { width: 7, height: 7, x: 3, y: 14, rx: 1 }], ['path', 'M14 4h7'], ['path', 'M14 9h7'], ['path', 'M14 15h7'], ['path', 'M14 20h7']],
  'map-pin': [['path', 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0'], ['circle', { cx: 12, cy: 10, r: 3 }]],
  x: [['path', 'M18 6 6 18'], ['path', 'm6 6 12 12']],
  pause: [['rect', { x: 14, y: 3, width: 5, height: 18, rx: 1 }], ['rect', { x: 5, y: 3, width: 5, height: 18, rx: 1 }]],
  play: [['path', 'M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z']],
  'trash-2': [['path', 'M10 11v6'], ['path', 'M14 11v6'], ['path', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6'], ['path', 'M3 6h18'], ['path', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2']],
  'chevron-up': [['path', 'm18 15-6-6-6 6']],
  'chevron-down': [['path', 'm6 9 6 6 6-6']],
};

function lucide(name, cls = '') {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', `lu lu-${name} ${cls}`.trim());
  for (const [tag, attrs] of LUCIDE[name] || []) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(typeof attrs === 'string' ? { d: attrs } : attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}

/** Botón de acción con solo un icono (con nombre accesible y globo de ayuda). kind: pause | play | edit | delete */
const ACT_ICON = { pause: 'pause', play: 'play', edit: 'pencil', delete: 'trash-2' };
function actBtn(kind, label, onclick) {
  return h('button', { type: 'button', class: `link-btn act act-${kind}`, 'aria-label': label, title: label, onclick }, lucide(ACT_ICON[kind]));
}

/* Cambia cada <i data-lucide="..."> del HTML por su icono */
document.querySelectorAll('[data-lucide]').forEach((el) => el.replaceWith(lucide(el.dataset.lucide, el.getAttribute('class') || '')));
