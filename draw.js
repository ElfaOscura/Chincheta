'use strict';

/* ============================================================
   Post-it de dibujo: un lienzo para garabatear a mano alzada
   con el ratón, el dedo o un lápiz táctil.
   El dibujo se guarda como imagen PNG en IndexedDB (igual que las
   fotos del PC) y en el tablero se ve su miniatura con el título.
   ============================================================ */

const DRAW_W = 960;
const DRAW_H = 640;
const DRAW_COLORS = [['Negro', '#2b2623'], ['Rojo', '#d6382b'], ['Azul', '#2c6fd1'], ['Verde', '#2f8f5b'], ['Naranja', '#e8821a']];
const DRAW_SIZES = [['Fino', 4], ['Medio', 9], ['Grueso', 18]];

const drawMid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function drawStyle(ctx, s) {
  ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/* Un trazo es una lista de puntos; se dibuja con curvas suaves entre los puntos medios. */
function drawSegment(ctx, p, i) {
  ctx.beginPath();
  if (i === 1) {
    const m = drawMid(p[0], p[1]);
    ctx.moveTo(p[0].x, p[0].y);
    ctx.lineTo(m.x, m.y);
  } else {
    const a = drawMid(p[i - 2], p[i - 1]);
    const b = drawMid(p[i - 1], p[i]);
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(p[i - 1].x, p[i - 1].y, b.x, b.y);
  }
  ctx.stroke();
}
function drawEnd(ctx, p) {
  const n = p.length;
  const m = drawMid(p[n - 2], p[n - 1]);
  ctx.beginPath();
  ctx.moveTo(m.x, m.y);
  ctx.lineTo(p[n - 1].x, p[n - 1].y);
  ctx.stroke();
}
function paintStroke(ctx, s) {
  if (s.clear) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, DRAW_W, DRAW_H);
    return;
  }
  drawStyle(ctx, s);
  const p = s.pts;
  if (p.length === 1) {
    ctx.beginPath();
    ctx.arc(p[0].x, p[0].y, s.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    for (let i = 1; i < p.length; i++) drawSegment(ctx, p, i);
    drawEnd(ctx, p);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawEditor(it) {
  const canvas = h('canvas', { class: 'draw-canvas', width: DRAW_W, height: DRAW_H, role: 'img', 'aria-label': t('draw.canvas') });
  const ctx = canvas.getContext('2d');
  const strokes = [];
  const tool = { color: DRAW_COLORS[0][1], size: DRAW_SIZES[1][1], erase: false };
  let base = null;   // el dibujo ya guardado, si lo hay
  let active = null; // trazo en curso
  let dirty = false;
  let timer = 0;
  let pending = Promise.resolve();

  const redraw = () => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, DRAW_W, DRAW_H);
    if (base) ctx.drawImage(base, 0, 0, DRAW_W, DRAW_H);
    strokes.forEach((s) => paintStroke(ctx, s));
  };
  const saved = imageURLs.get(it.id);
  if (saved) {
    const img = new Image();
    img.onload = () => { base = img; redraw(); };
    img.src = saved;
  }

  /* Guardado: unos instantes después de cada trazo y siempre al cerrar la ventana */
  const saveNow = () => {
    clearTimeout(timer);
    if (!dirty) return pending;
    dirty = false;
    pending = new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        try {
          if (blob) {
            await putImage(it.id, blob);
            setImageURL(it.id, blob);
            it.hasDrawing = true;
            save();
          }
        } catch { toast(t('draw.saveFail')); }
        resolve();
      }, 'image/png');
    });
    return pending;
  };
  const touch = () => { dirty = true; clearTimeout(timer); timer = setTimeout(saveNow, 400); };

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * DRAW_W) / r.width, y: ((e.clientY - r.top) * DRAW_H) / r.height };
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* no crítico */ }
    active = { color: tool.color, width: tool.erase ? tool.size * 2.4 : tool.size, erase: tool.erase, pts: [pos(e)] };
    strokes.push(active);
    drawStyle(ctx, active);
    ctx.beginPath();
    ctx.arc(active.pts[0].x, active.pts[0].y, active.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!active) return;
    for (const ev of e.getCoalescedEvents?.() || [e]) {
      const p = pos(ev);
      const last = active.pts[active.pts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 1.5) continue;
      active.pts.push(p);
      drawStyle(ctx, active);
      drawSegment(ctx, active.pts, active.pts.length - 1);
    }
    ctx.globalCompositeOperation = 'source-over';
  });
  const end = () => {
    if (!active) return;
    if (active.pts.length > 1) { drawStyle(ctx, active); drawEnd(ctx, active.pts); }
    ctx.globalCompositeOperation = 'source-over';
    active = null;
    touch();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  const undo = () => { if (strokes.length) { strokes.pop(); redraw(); touch(); } };
  const clearAll = () => { strokes.push({ clear: true }); redraw(); touch(); };

  /* Barra de herramientas */
  const colorBtns = DRAW_COLORS.map(([, hex], i) => h('button', {
    type: 'button', class: 'dr-color', 'aria-label': t(`draw.color.${i}`), title: t(`draw.color.${i}`), 'aria-pressed': 'false',
    style: `--c:${hex}`, dataset: { hex },
    onclick: () => { tool.color = hex; tool.erase = false; sync(); },
  }));
  const sizeBtns = DRAW_SIZES.map(([, n], i) => h('button', {
    type: 'button', class: 'dr-size', 'aria-label': t('draw.sizeAria', { name: t(`draw.size.${i}`) }), title: t('draw.sizeAria', { name: t(`draw.size.${i}`) }), 'aria-pressed': 'false',
    dataset: { size: n },
    onclick: () => { tool.size = n; sync(); },
  }, h('i', { style: `--s:${n}` })));
  const eraser = h('button', { type: 'button', class: 'dr-btn', 'aria-pressed': 'false', onclick: () => { tool.erase = !tool.erase; sync(); } }, t('draw.eraser'));
  const sync = () => {
    colorBtns.forEach((b) => b.setAttribute('aria-pressed', String(!tool.erase && b.dataset.hex === tool.color)));
    sizeBtns.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.size) === tool.size)));
    eraser.setAttribute('aria-pressed', String(tool.erase));
    canvas.classList.toggle('erasing', tool.erase);
  };
  sync();

  if (current) { current.flush = saveNow; current.undo = undo; }

  return h('div', { class: 'draw-wrap' },
    h('div', { class: 'draw-bar', role: 'toolbar', 'aria-label': t('draw.toolbar') },
      h('div', { class: 'dr-group' }, colorBtns),
      h('div', { class: 'dr-group' }, sizeBtns),
      h('div', { class: 'dr-group' }, eraser,
        h('button', { type: 'button', class: 'dr-btn', onclick: undo }, t('draw.undo')),
        h('button', { type: 'button', class: 'dr-btn', onclick: clearAll }, t('draw.clear')))),
    h('div', { class: 'draw-paper' }, canvas));
}

/* Ctrl + Z deshace el último trazo mientras el dibujo está abierto */
document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
  if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  const modalOpen = document.getElementById('item-dialog').open;
  /* Con una ventana abierta se deshace su dibujo; si no, el del panel fijado (si es un dibujo) */
  const ctx = modalOpen ? current : (document.querySelector('dialog[open]') ? null : dockCtx);
  if (!ctx?.undo) return;
  e.preventDefault();
  ctx.undo();
});