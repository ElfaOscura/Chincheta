'use strict';

/* ============================================================
   Post-it de enlaces con tarjetas de vista previa.
   Cada enlace se muestra como una tarjeta: icono del sitio (favicon),
   título limpio y dirección. El título se deduce al instante de la
   dirección y, si el sitio lo permite, se reemplaza por el título real.
   Al pegar un enlace dentro de este post-it se agrega solo.
   ============================================================ */

const looksLikeUrl = (s) => /^https?:\/\/\S+$/i.test(s) || /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s);

/** Título legible a partir de la dirección: "es.wikipedia.org/wiki/Corcho_natural" -> "Corcho natural". */
function guessTitle(url) {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean).pop();
    if (!seg) return hostOf(url);
    const clean = decodeURIComponent(seg).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_+]+/g, ' ').trim();
    if (!clean || /^\d+$/.test(clean)) return hostOf(url);
    return cap(clean).slice(0, 90);
  } catch { return hostOf(url) || url; }
}

/** Intenta leer el título real de la página. Casi siempre el navegador lo bloquea (CORS); entonces se queda el título deducido. */
async function tryFetchTitle(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4500);
  try {
    const res = await fetch(url, { signal: ctrl.signal, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) return '';
    const html = (await res.text()).slice(0, 300000);
    const doc = new DOMParser().parseFromString(html, 'text/html'); // no ejecuta scripts
    const raw = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || doc.title || '';
    return raw.replace(/\s+/g, ' ').trim().slice(0, 120);
  } catch { return ''; } finally { clearTimeout(timer); }
}

function letterAvatar(url) {
  const host = hostOf(url) || '?';
  let hash = 0;
  for (const ch of host) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return h('span', { class: 'fav fav-letter', 'aria-hidden': 'true', style: `--hue:${hash}`, text: host.charAt(0).toUpperCase() });
}
function faviconEl(url) {
  let icon;
  try { icon = new URL('/favicon.ico', url).href; } catch { return letterAvatar(url); }
  const img = h('img', { class: 'fav', src: icon, alt: '', width: 32, height: 32, referrerpolicy: 'no-referrer', loading: 'lazy' });
  img.addEventListener('error', () => img.replaceWith(letterAvatar(url)));
  return img;
}

function linksEditor(it) {
  const list = h('ul', { class: 'links' });
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const labelIn = h('input', { type: 'text', class: 'field', maxlength: 120, placeholder: t('link.namePh'), 'aria-label': t('link.nameAria'), autocomplete: 'off' });
  const urlIn = h('input', { type: 'text', class: 'field', placeholder: t('link.urlPh'), 'aria-label': t('link.urlAria'), autocomplete: 'off' });

  const draw = () => {
    list.replaceChildren(...(it.links.length
      ? it.links.map(linkCard)
      : [h('li', { class: 'list-empty', text: t('link.empty') })]));
  };

  function linkCard(l) {
    const li = h('li', { class: 'link-card' });
    const view = () => li.replaceChildren(
      faviconEl(l.url),
      h('div', { class: 'lc-main' },
        h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer', text: l.label || l.title || guessTitle(l.url) }),
        h('span', { class: 'lc-host', text: hostOf(l.url) })),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('link.edit'), onclick: edit }, '✎'),
      h('button', {
        type: 'button', class: 'icon-btn', 'aria-label': t('link.remove'),
        onclick: () => { it.links = it.links.filter((x) => x !== l); save(); draw(); },
      }, '✕'));
    const edit = () => {
      const lab = h('input', { type: 'text', class: 'field', maxlength: 120, value: l.label, placeholder: l.title || guessTitle(l.url), 'aria-label': t('link.nameAria') });
      const url = h('input', { type: 'text', class: 'field', value: l.url, placeholder: 'https://…', 'aria-label': t('link.urlAria') });
      li.replaceChildren(h('form', {
        class: 'link-edit',
        onsubmit: (e) => {
          e.preventDefault();
          const u = cleanUrl(url.value);
          if (!u) { url.classList.add('invalid'); url.focus(); return; }
          if (u !== l.url) { l.url = u; l.title = guessTitle(u); fetchTitleFor(l); }
          l.label = lab.value.trim();
          save(); view();
        },
      }, lab, url,
      h('button', { type: 'submit', class: 'btn small' }, t('link.save')),
      h('button', { type: 'button', class: 'btn small', onclick: view }, t('common.cancel'))));
      lab.focus();
    };
    view();
    return li;
  }

  function fetchTitleFor(l) {
    tryFetchTitle(l.url).then((t) => {
      if (!t || !it.links.includes(l)) return;
      l.title = t;
      save();
      if (current?.it === it || dockCtx?.it === it) draw(); // abierta en una ventana o en el panel fijado
    });
  }

  function addLink(url, label = '') {
    const l = { id: uid(), label, url, title: guessTitle(url) };
    it.links.push(l);
    save();
    draw();
    fetchTitleFor(l);
  }

  const form = h('form', {
    class: 'add-row',
    onsubmit: (e) => {
      e.preventDefault();
      const u = cleanUrl(urlIn.value);
      if (!u) {
        err.textContent = t('link.paste');
        err.hidden = false;
        urlIn.focus();
        return;
      }
      err.hidden = true;
      addLink(u, labelIn.value.trim());
      labelIn.value = '';
      urlIn.value = '';
      urlIn.focus();
    },
  }, labelIn, urlIn, h('button', { type: 'submit', class: 'btn small' }, t('link.add')));

  /* Pegar un enlace (en el campo de dirección o en cualquier parte de la ventana) lo agrega solo */
  if (current) {
    current.onPaste = (e) => {
      const target = e.target;
      const inField = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if (inField && target !== urlIn) return;
      const text = (e.clipboardData?.getData('text') || '').trim();
      if (!text || !looksLikeUrl(text)) return;
      const u = cleanUrl(text);
      if (!u) return;
      e.preventDefault();
      err.hidden = true;
      addLink(u, target === urlIn ? labelIn.value.trim() : '');
      if (target === urlIn) { labelIn.value = ''; urlIn.value = ''; }
    };
  }

  draw();
  return h('div', {}, list, form, err);
}