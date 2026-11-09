'use strict';

/* ================= Definicje urządzeń ================= */
const CATS = {
  wan:   { name: 'Internet / WAN', color: '#0ea5e9' },
  core:  { name: 'Sieć – rdzeń',   color: '#2563eb' },
  wifi:  { name: 'Bezprzewodowe',  color: '#7c3aed' },
  end:   { name: 'Urządzenia końcowe', color: '#16a34a' },
  srv:   { name: 'Serwery i inne', color: '#ea580c' },
  misc:  { name: 'Pozostałe',      color: '#64748b' },
};

const TYPES = {
  internet:  { label: 'Internet / ISP',     icon: '☁️', cat: 'wan',  ports: 0 },
  ont:       { label: 'ONT (światłowód)',   icon: '🔆', cat: 'wan',  ports: 2 },
  modem:     { label: 'Modem',              icon: '📶', cat: 'wan',  ports: 2 },
  modem4g:   { label: 'Modem LTE / 5G',     icon: '📡', cat: 'wan',  ports: 2 },
  antenna:   { label: 'Antena zewnętrzna',  icon: '🗼', cat: 'wan',  ports: 1 },
  dish:      { label: 'Antena satelitarna', icon: '🛰️', cat: 'wan',  ports: 1 },
  router:    { label: 'Router',             icon: '🛜', cat: 'core', ports: 5 },
  firewall:  { label: 'Firewall',           icon: '🛡️', cat: 'core', ports: 6 },
  switch:    { label: 'Switch',             icon: '🔀', cat: 'core', ports: 8 },
  poe:       { label: 'Switch PoE',         icon: '⚡', cat: 'core', ports: 8 },
  patch:     { label: 'Patch panel',        icon: '🧷', cat: 'core', ports: 24 },
  ap:        { label: 'Punkt dostępowy',    icon: '📻', cat: 'wifi', ports: 1 },
  mesh:      { label: 'Węzeł mesh',         icon: '🕸️', cat: 'wifi', ports: 2 },
  extender:  { label: 'Wzmacniacz Wi‑Fi',   icon: '📳', cat: 'wifi', ports: 1 },
  bridge:    { label: 'Most radiowy',       icon: '🔭', cat: 'wifi', ports: 1 },
  powerline: { label: 'Powerline',          icon: '🔌', cat: 'wifi', ports: 1 },
  pc:        { label: 'Komputer',           icon: '🖥️', cat: 'end',  ports: 1 },
  laptop:    { label: 'Laptop',             icon: '💻', cat: 'end',  ports: 1 },
  phone:     { label: 'Telefon / tablet',   icon: '📱', cat: 'end',  ports: 0 },
  printer:   { label: 'Drukarka',           icon: '🖨️', cat: 'end',  ports: 1 },
  tv:        { label: 'Telewizor',          icon: '📺', cat: 'end',  ports: 1 },
  console:   { label: 'Konsola',            icon: '🎮', cat: 'end',  ports: 1 },
  voip:      { label: 'Telefon VoIP',       icon: '☎️', cat: 'end',  ports: 2 },
  camera:    { label: 'Kamera IP',          icon: '📹', cat: 'end',  ports: 1 },
  iot:       { label: 'Smart home / IoT',   icon: '💡', cat: 'end',  ports: 0 },
  server:    { label: 'Serwer',             icon: '🗄️', cat: 'srv',  ports: 2 },
  nas:       { label: 'NAS',                icon: '💽', cat: 'srv',  ports: 2 },
  nvr:       { label: 'Rejestrator NVR',    icon: '📼', cat: 'srv',  ports: 2 },
  ups:       { label: 'UPS',                icon: '🔋', cat: 'misc', ports: 0 },
  rack:      { label: 'Szafa rack',         icon: '🗃️', cat: 'misc', ports: 0 },
  other:     { label: 'Inne urządzenie',    icon: '❔', cat: 'misc', ports: 1 },
};

const LINKS = {
  eth:   { label: 'Ethernet',      color: '#2563eb', dash: '',       wired: true },
  fiber: { label: 'Światłowód',    color: '#f97316', dash: '',       wired: true },
  wifi:  { label: 'Wi‑Fi',         color: '#7c3aed', dash: '2 6',    wired: false },
  coax:  { label: 'Koncentryk',    color: '#92400e', dash: '',       wired: true },
  radio: { label: 'Radiolinia',    color: '#db2777', dash: '10 5',   wired: false },
  usb:   { label: 'USB',           color: '#475569', dash: '4 3',    wired: true },
  phone: { label: 'Linia tel./DSL',color: '#15803d', dash: '1 3',    wired: true },
};

const W = 128, H = 88; // rozmiar kafla urządzenia
const STORE_KEY = 'planer-sieci-v1';
const SVGNS = 'http://www.w3.org/2000/svg';

/* ================= Stan ================= */
let state = { nodes: [], links: [] };
let view = { x: 0, y: 0, k: 1 };
let mode = 'select';
let selected = null;     // {kind:'node'|'link', id}
let pendingFrom = null;  // id węzła przy łączeniu
let undoStack = [], redoStack = [];

const $ = (s) => document.querySelector(s);
const stage = $('#stage'), vp = $('#viewport');
const nodesLayer = $('#nodesLayer'), linksLayer = $('#linksLayer'), ghost = $('#ghostLink');

const uid = () => Math.random().toString(36).slice(2, 9);
const snapOn = () => $('#chkSnap').checked;
const snap = (v) => snapOn() ? Math.round(v / 20) * 20 : v;
const nodeById = (id) => state.nodes.find(n => n.id === id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ================= Historia ================= */
function commit() {
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 100) undoStack.shift();
  redoStack = [];
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(state));
  state = JSON.parse(undoStack.pop());
  selected = null; renderAll();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(state));
  state = JSON.parse(redoStack.pop());
  selected = null; renderAll();
}

/* ================= Zapisywanie ================= */
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ state, view })); } catch (e) { /* ignore */ }
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    if (d && d.state) { state = sanitize(d.state); if (d.view) view = d.view; return true; }
  } catch (e) { /* ignore */ }
  return false;
}
function sanitize(s) {
  const nodes = (s.nodes || []).filter(n => n && n.id && TYPES[n.type]).map(n => ({
    id: String(n.id), type: n.type, x: +n.x || 0, y: +n.y || 0,
    name: String(n.name ?? TYPES[n.type].label), ip: String(n.ip ?? ''), location: String(n.location ?? ''),
    model: String(n.model ?? ''), ports: Number.isFinite(+n.ports) ? +n.ports : TYPES[n.type].ports, note: String(n.note ?? ''),
  }));
  const ids = new Set(nodes.map(n => n.id));
  const links = (s.links || []).filter(l => l && ids.has(l.from) && ids.has(l.to)).map(l => ({
    id: String(l.id || uid()), from: l.from, to: l.to, kind: LINKS[l.kind] ? l.kind : 'eth', label: String(l.label ?? ''),
  }));
  return { nodes, links };
}

/* ================= Paleta ================= */
function buildPalette() {
  const list = $('#paletteList');
  for (const [ck, c] of Object.entries(CATS)) {
    const h = document.createElement('div'); h.className = 'cat'; h.textContent = c.name; list.appendChild(h);
    for (const [tk, t] of Object.entries(TYPES)) {
      if (t.cat !== ck) continue;
      const el = document.createElement('div');
      el.className = 'pal-item'; el.draggable = true; el.dataset.type = tk;
      el.innerHTML = `<span class="ico" style="background:${c.color}22">${t.icon}</span><span>${t.label}</span>`;
      el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', tk); e.dataTransfer.effectAllowed = 'copy'; });
      el.addEventListener('click', () => {
        const r = stage.getBoundingClientRect();
        const p = toWorld(r.left + r.width / 2, r.top + r.height / 2);
        const off = (state.nodes.length % 6) * 20;
        addNode(tk, p.x + off, p.y + off);
      });
      list.appendChild(el);
    }
  }
}

stage.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
stage.addEventListener('drop', e => {
  e.preventDefault();
  const t = e.dataTransfer.getData('text/plain');
  if (!TYPES[t]) return;
  const p = toWorld(e.clientX, e.clientY);
  addNode(t, p.x, p.y);
});

function countOfType(type) { return state.nodes.filter(n => n.type === type).length; }

function addNode(type, x, y) {
  commit();
  const t = TYPES[type];
  const n = { id: uid(), type, x: snap(x), y: snap(y), name: `${t.label} ${countOfType(type) + 1}`,
    ip: '', location: '', model: '', ports: t.ports, note: '' };
  state.nodes.push(n);
  selected = { kind: 'node', id: n.id };
  renderAll();
}

function addLink(from, to, kind) {
  if (from === to) return;
  commit();
  const l = { id: uid(), from, to, kind, label: '' };
  state.links.push(l);
  selected = { kind: 'link', id: l.id };
  renderAll();
}

function deleteSelected() {
  if (!selected) return;
  commit();
  if (selected.kind === 'node') {
    state.nodes = state.nodes.filter(n => n.id !== selected.id);
    state.links = state.links.filter(l => l.from !== selected.id && l.to !== selected.id);
  } else {
    state.links = state.links.filter(l => l.id !== selected.id);
  }
  selected = null; renderAll();
}

function duplicateSelected() {
  if (!selected || selected.kind !== 'node') return;
  const n = nodeById(selected.id); if (!n) return;
  commit();
  const c = { ...n, id: uid(), x: n.x + 40, y: n.y + 40, name: n.name + ' (kopia)', ip: '' };
  state.nodes.push(c);
  selected = { kind: 'node', id: c.id };
  renderAll();
}

/* ================= Widok ================= */
function applyView() { vp.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
  $('#bg').setAttribute('transform', `translate(${view.x % (20 * view.k)},${view.y % (20 * view.k)}) scale(${view.k})`); }
function toWorld(cx, cy) {
  const r = stage.getBoundingClientRect();
  return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k };
}
function zoomAt(cx, cy, factor) {
  const r = stage.getBoundingClientRect();
  const k = Math.min(3, Math.max(0.2, view.k * factor));
  const px = cx - r.left, py = cy - r.top;
  view.x = px - (px - view.x) * (k / view.k);
  view.y = py - (py - view.y) * (k / view.k);
  view.k = k; applyView(); save();
}
function fitView() {
  const r = stage.getBoundingClientRect();
  if (!state.nodes.length) { view = { x: r.width / 2, y: r.height / 2, k: 1 }; applyView(); return; }
  const b = bounds();
  const k = Math.min(1.5, Math.min((r.width - 60) / (b.w || 1), (r.height - 60) / (b.h || 1)));
  view.k = Math.max(0.2, k);
  view.x = r.width / 2 - (b.x + b.w / 2) * view.k;
  view.y = r.height / 2 - (b.y + b.h / 2) * view.k;
  applyView(); save();
}
function bounds() {
  const xs = state.nodes.map(n => n.x), ys = state.nodes.map(n => n.y);
  const x = Math.min(...xs) - W / 2 - 10, y = Math.min(...ys) - H / 2 - 10;
  return { x, y, w: Math.max(...xs) + W / 2 + 10 - x, h: Math.max(...ys) + H / 2 + 24 - y };
}

stage.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });

/* ================= Renderowanie ================= */
function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

function linkPath(l) {
  const a = nodeById(l.from), b = nodeById(l.to);
  // przesunięcie dla wielu połączeń między tą samą parą
  const same = state.links.filter(o => (o.from === l.from && o.to === l.to) || (o.from === l.to && o.to === l.from));
  const idx = same.indexOf(l);
  const off = (idx - (same.length - 1) / 2) * 28 * (l.from < l.to ? 1 : -1);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const cx = mx - dy / len * off * 2, cy = my + dx / len * off * 2;
  return { d: off ? `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}` : `M${a.x},${a.y} L${b.x},${b.y}`,
    lx: off ? (mx + cx) / 2 : mx, ly: off ? (my + cy) / 2 : my };
}

function renderLinks() {
  linksLayer.innerHTML = '';
  for (const l of state.links) {
    const k = LINKS[l.kind], p = linkPath(l);
    const g = el('g', { 'data-link': l.id }, linksLayer);
    el('path', { d: p.d, class: 'link-hit' }, g);
    const path = el('path', { d: p.d, class: 'link' + (selected?.kind === 'link' && selected.id === l.id ? ' selected' : ''),
      stroke: k.color, 'stroke-dasharray': k.dash, 'stroke-linecap': 'round' }, g);
    path.style.stroke = k.color;
    const txt = l.label || '';
    if (txt) { const t = el('text', { x: p.lx, y: p.ly - 4, class: 'link-label' }, g); t.textContent = txt; }
  }
}

function renderNodes() {
  nodesLayer.innerHTML = '';
  for (const n of state.nodes) {
    const t = TYPES[n.type], c = CATS[t.cat];
    const cls = ['node'];
    if (selected?.kind === 'node' && selected.id === n.id) cls.push('selected');
    if (pendingFrom === n.id) cls.push('pending');
    const g = el('g', { class: cls.join(' '), 'data-node': n.id, transform: `translate(${n.x},${n.y})` }, nodesLayer);
    el('rect', { class: 'box', x: -W / 2, y: -H / 2, width: W, height: H, rx: 10 }, g);
    el('rect', { class: 'stripe', x: -W / 2 + 1, y: -H / 2 + 1, width: W - 2, height: 5, rx: 2, fill: c.color }, g);
    el('text', { class: 'icon', x: 0, y: -H / 2 + 28 }, g).textContent = t.icon;
    el('text', { class: 'name', x: 0, y: H / 2 - 24 }, g).textContent = clip(n.name, 18);
    el('text', { class: 'sub', x: 0, y: H / 2 - 9 }, g).textContent = clip(n.ip || n.location || t.label, 20);
  }
}
const clip = (s, m) => (s.length > m ? s.slice(0, m - 1) + '…' : s);

function renderAll() {
  renderLinks(); renderNodes(); renderProps(); renderSummary(); applyView();
  $('#emptyMsg').classList.toggle('hidden', state.nodes.length > 0);
  save();
}

/* ================= Panel właściwości ================= */
function renderProps() {
  const box = $('#props');
  if (!selected) { box.innerHTML = '<p class="hint">Kliknij urządzenie lub połączenie, żeby edytować.</p>' + legendHtml(); return; }
  if (selected.kind === 'node') {
    const n = nodeById(selected.id); if (!n) { selected = null; return renderProps(); }
    const used = state.links.filter(l => (l.from === n.id || l.to === n.id) && LINKS[l.kind].wired).length;
    box.innerHTML = `
      <div class="field"><label>Typ</label><select data-f="type">${Object.entries(TYPES).map(([k, t]) =>
        `<option value="${k}" ${k === n.type ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}</select></div>
      <div class="field"><label>Nazwa</label><input data-f="name" value="${esc(n.name)}"></div>
      <div class="row">
        <div class="field"><label>Adres IP</label><input data-f="ip" value="${esc(n.ip)}" placeholder="192.168.1.1"></div>
        <div class="field"><label>Porty (użyte ${used})</label><input data-f="ports" type="number" min="0" value="${n.ports}"></div>
      </div>
      <div class="field"><label>Model / producent</label><input data-f="model" value="${esc(n.model)}" placeholder="np. TP-Link TL-SG108"></div>
      <div class="field"><label>Lokalizacja</label><input data-f="location" value="${esc(n.location)}" placeholder="np. salon, piwnica, szafa"></div>
      <div class="field"><label>Notatki</label><textarea data-f="note">${esc(n.note)}</textarea></div>
      <div class="row"><button class="btn" id="pDup">⧉ Duplikuj</button><button class="btn" id="pConn">🔗 Połącz z…</button></div>
      <div class="row" style="margin-top:6px"><button class="btn danger" id="pDel">🗑 Usuń</button></div>`;
    bindFields(box, n, true);
    $('#pDup').onclick = duplicateSelected;
    $('#pConn').onclick = () => { setMode('connect'); pendingFrom = n.id; renderNodes(); setStatus('Kliknij urządzenie docelowe'); };
  } else {
    const l = state.links.find(x => x.id === selected.id); if (!l) { selected = null; return renderProps(); }
    const a = nodeById(l.from), b = nodeById(l.to);
    box.innerHTML = `
      <p style="font-size:13px;margin:0 0 8px"><b>${esc(a.name)}</b> ↔ <b>${esc(b.name)}</b></p>
      <div class="field"><label>Rodzaj połączenia</label><select data-f="kind">${Object.entries(LINKS).map(([k, t]) =>
        `<option value="${k}" ${k === l.kind ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div>
      <div class="field"><label>Opis (np. długość, kategoria, VLAN)</label><input data-f="label" value="${esc(l.label)}" placeholder="np. Cat6, 15 m"></div>
      <div class="row"><button class="btn danger" id="pDel">🗑 Usuń połączenie</button></div>` + legendHtml();
    bindFields(box, l, false);
  }
  $('#pDel').onclick = deleteSelected;
}

function legendHtml() {
  return '<div class="legend">' + Object.values(LINKS).map(k =>
    `<span><i style="border-color:${k.color};border-top-style:${k.dash ? 'dashed' : 'solid'}"></i>${k.label}</span>`).join('') + '</div>';
}

function bindFields(box, obj, isNode) {
  box.querySelectorAll('[data-f]').forEach(inp => {
    let committed = false;
    const handler = (final) => {
      if (!committed) { commit(); committed = true; }
      const f = inp.dataset.f;
      let v = inp.value;
      if (f === 'ports') v = Math.max(0, parseInt(v, 10) || 0);
      if (f === 'type') {
        const oldT = TYPES[obj.type];
        if (obj.ports === oldT.ports) obj.ports = TYPES[v].ports;
      }
      obj[f] = v;
      renderLinks(); renderNodes(); renderSummary(); save();
      if (final || inp.tagName === 'SELECT') { committed = false; if (inp.tagName === 'SELECT') renderProps(); }
    };
    inp.addEventListener('input', () => handler(false));
    inp.addEventListener('change', () => { committed = false; });
  });
}

/* ================= Podsumowanie i uwagi ================= */
function renderSummary() {
  const counts = {};
  state.nodes.forEach(n => counts[n.type] = (counts[n.type] || 0) + 1);
  const lc = {};
  state.links.forEach(l => lc[l.kind] = (lc[l.kind] || 0) + 1);
  let html = '<table class="summary-table">';
  html += `<tr><td><b>Urządzenia</b></td><td>${state.nodes.length}</td></tr>`;
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) html += `<tr><td>${TYPES[k].icon} ${TYPES[k].label}</td><td>${v}</td></tr>`;
  html += `<tr><td><b>Połączenia</b></td><td>${state.links.length}</td></tr>`;
  for (const [k, v] of Object.entries(lc)) html += `<tr><td>${LINKS[k].label}</td><td>${v}</td></tr>`;
  html += '</table>';
  $('#summary').innerHTML = html;

  const warn = [];
  const ipMap = {};
  for (const n of state.nodes) {
    const links = state.links.filter(l => l.from === n.id || l.to === n.id);
    const wired = links.filter(l => LINKS[l.kind].wired).length;
    if (!links.length && !['ups', 'rack'].includes(n.type)) warn.push(`„${n.name}” nie jest z niczym połączone.`);
    if (TYPES[n.type].ports > 0 || n.ports > 0) {
      if (wired > n.ports) warn.push(`„${n.name}”: ${wired} połączeń kablowych, a tylko ${n.ports} portów.`);
    }
    if (n.ip) {
      if (!/^(\d{1,3})(\.\d{1,3}){3}(\/\d{1,2})?$/.test(n.ip.trim()) || n.ip.split(/[./]/).slice(0, 4).some(x => +x > 255))
        warn.push(`„${n.name}”: niepoprawny adres IP „${n.ip}”.`);
      const key = n.ip.trim().split('/')[0];
      (ipMap[key] = ipMap[key] || []).push(n.name);
    }
  }
  for (const [ip, names] of Object.entries(ipMap)) if (names.length > 1) warn.push(`Konflikt IP ${ip}: ${names.join(', ')}.`);
  const hasWan = state.nodes.some(n => TYPES[n.type].cat === 'wan');
  if (state.nodes.length && !hasWan) warn.push('Brak urządzenia dostępowego (modem / ONT / Internet).');
  const ul = $('#warnings');
  ul.innerHTML = warn.length ? warn.map(w => `<li>${esc(w)}</li>`).join('') : '<li class="ok">✔ Wszystko wygląda dobrze</li>';
}

/* ================= Interakcja ================= */
function setMode(m) {
  mode = m; pendingFrom = null; ghost.setAttribute('visibility', 'hidden');
  $('#btnSelect').classList.toggle('active', m === 'select');
  $('#btnConnect').classList.toggle('active', m === 'connect');
  stage.classList.toggle('connect', m === 'connect');
  setStatus(m === 'connect' ? 'Tryb: łączenie – kliknij pierwsze urządzenie' : 'Tryb: wybierz');
  renderNodes();
}
function setStatus(s) { $('#status').textContent = s; }

let drag = null;
stage.addEventListener('pointerdown', e => {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  const nodeEl = e.target.closest('[data-node]');
  const linkEl = e.target.closest('[data-link]');
  const p = toWorld(e.clientX, e.clientY);

  if (nodeEl) {
    const id = nodeEl.dataset.node;
    if (mode === 'connect') {
      if (!pendingFrom) { pendingFrom = id; renderNodes(); setStatus('Kliknij urządzenie docelowe (Esc – anuluj)'); }
      else if (pendingFrom !== id) { const f = pendingFrom; pendingFrom = null; ghost.setAttribute('visibility', 'hidden'); addLink(f, id, $('#linkKind').value); setStatus('Połączono! Kliknij kolejne urządzenie'); }
      return;
    }
    const n = nodeById(id);
    selected = { kind: 'node', id };
    drag = { type: 'node', id, dx: p.x - n.x, dy: p.y - n.y, moved: false };
    // przenieś na wierzch
    nodesLayer.appendChild(nodeEl);
    renderProps(); markSelection();
    stage.setPointerCapture(e.pointerId);
    return;
  }
  if (linkEl && mode === 'select') {
    selected = { kind: 'link', id: linkEl.dataset.link };
    renderLinks(); renderNodes(); renderProps();
    return;
  }
  // tło
  if (mode === 'connect' && pendingFrom) { pendingFrom = null; ghost.setAttribute('visibility', 'hidden'); renderNodes(); setStatus('Tryb: łączenie – kliknij pierwsze urządzenie'); }
  if (selected) { selected = null; renderLinks(); renderNodes(); renderProps(); }
  drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
  stage.classList.add('panning');
  stage.setPointerCapture(e.pointerId);
});

stage.addEventListener('pointermove', e => {
  if (mode === 'connect' && pendingFrom) {
    const a = nodeById(pendingFrom), p = toWorld(e.clientX, e.clientY);
    ghost.setAttribute('x1', a.x); ghost.setAttribute('y1', a.y);
    ghost.setAttribute('x2', p.x); ghost.setAttribute('y2', p.y);
    ghost.setAttribute('visibility', 'visible');
  }
  if (!drag) return;
  if (drag.type === 'pan') {
    view.x = drag.vx + e.clientX - drag.sx; view.y = drag.vy + e.clientY - drag.sy; applyView();
  } else if (drag.type === 'node') {
    const n = nodeById(drag.id), p = toWorld(e.clientX, e.clientY);
    if (!drag.moved) { commit(); drag.moved = true; }
    n.x = snap(p.x - drag.dx); n.y = snap(p.y - drag.dy);
    const g = nodesLayer.querySelector(`[data-node="${drag.id}"]`);
    g.setAttribute('transform', `translate(${n.x},${n.y})`);
    renderLinks();
  }
});

const endDrag = () => {
  if (drag) { if (drag.type === 'pan' || drag.moved) save(); }
  drag = null; stage.classList.remove('panning');
};
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

stage.addEventListener('dblclick', e => {
  const nodeEl = e.target.closest('[data-node]');
  if (nodeEl) { const inp = document.querySelector('#props [data-f="name"]'); if (inp) { inp.focus(); inp.select(); } }
});

function markSelection() {
  nodesLayer.querySelectorAll('.node').forEach(g => g.classList.toggle('selected', selected?.kind === 'node' && g.dataset.node === selected.id));
  linksLayer.querySelectorAll('.link').forEach(p => p.classList.remove('selected'));
}

document.addEventListener('keydown', e => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && !typing) { e.preventDefault(); duplicateSelected(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exportJson(); return; }
  if (typing) { if (e.key === 'Escape') document.activeElement.blur(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
  else if (e.key === 'Escape') { setMode('select'); }
  else if (e.key.toLowerCase() === 'c') setMode('connect');
  else if (e.key.toLowerCase() === 'v') setMode('select');
  else if (e.key === '+' || e.key === '=') { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2); }
  else if (e.key === '-') { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2); }
});

/* ================= Eksport / import ================= */
function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportJson() {
  download('plan-sieci.json', new Blob([JSON.stringify({ app: 'planer-sieci', version: 1, ...state }, null, 2)], { type: 'application/json' }));
}
function importJson(file) {
  const r = new FileReader();
  r.onload = () => {
    try { const d = JSON.parse(r.result); commit(); state = sanitize(d); selected = null; renderAll(); fitView(); }
    catch (e) { alert('Nie udało się wczytać pliku: ' + e.message); }
  };
  r.readAsText(file);
}

function exportPng() {
  if (!state.nodes.length) { alert('Plansza jest pusta.'); return; }
  const b = bounds(), pad = 30;
  const svg = stage.cloneNode(true);
  svg.querySelector('#bg').remove();
  svg.querySelector('#ghostLink')?.remove();
  svg.querySelector('#viewport').removeAttribute('transform');
  svg.querySelectorAll('.selected,.pending').forEach(x => x.classList.remove('selected', 'pending'));
  const w = b.w + pad * 2, h = b.h + pad * 2;
  svg.setAttribute('viewBox', `${b.x - pad} ${b.y - pad} ${w} ${h}`);
  svg.setAttribute('width', w); svg.setAttribute('height', h);
  const style = document.createElementNS(SVGNS, 'style');
  style.textContent = `
    text{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
    .box{fill:#fff;stroke:#cbd5e1;stroke-width:1.5}
    .icon{font-size:30px;text-anchor:middle;dominant-baseline:central}
    .name{font-size:13px;font-weight:600;text-anchor:middle;fill:#0f172a}
    .sub{font-size:11px;text-anchor:middle;fill:#64748b;font-family:ui-monospace,monospace}
    .link{fill:none;stroke-width:3}.link-hit{fill:none;stroke:none}
    .link-label{font-size:11px;text-anchor:middle;fill:#334155;paint-order:stroke;stroke:#fff;stroke-width:4px}`;
  svg.insertBefore(style, svg.firstChild);
  const bgRect = document.createElementNS(SVGNS, 'rect');
  bgRect.setAttribute('x', b.x - pad); bgRect.setAttribute('y', b.y - pad);
  bgRect.setAttribute('width', w); bgRect.setAttribute('height', h); bgRect.setAttribute('fill', '#fff');
  svg.insertBefore(bgRect, svg.querySelector('#viewport'));
  const data = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  const scale = 2;
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale;
    const ctx = c.getContext('2d'); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, w, h);
    c.toBlob(bl => download('plan-sieci.png', bl), 'image/png');
  };
  img.onerror = () => alert('Eksport PNG nie powiódł się w tej przeglądarce.');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
}

/* ================= Przykład ================= */
function example() {
  const N = (id, type, x, y, name, ip = '', location = '', ports) => ({ id, type, x, y, name, ip, location, model: '', ports: ports ?? TYPES[type].ports, note: '' });
  const L = (from, to, kind, label = '') => ({ id: uid(), from, to, kind, label });
  return {
    nodes: [
      N('inet', 'internet', 0, -340, 'Internet'),
      N('ont', 'ont', 0, -200, 'ONT operatora', '', 'Korytarz'),
      N('rtr', 'router', 0, -60, 'Router główny', '192.168.1.1', 'Korytarz'),
      N('sw', 'poe', -260, 80, 'Switch PoE', '192.168.1.2', 'Szafa'),
      N('ap1', 'ap', 260, 80, 'AP – parter', '192.168.1.3', 'Salon'),
      N('ap2', 'ap', -520, 220, 'AP – piętro', '192.168.1.4', 'Piętro'),
      N('pc', 'pc', -340, 240, 'PC biuro', '192.168.1.20', 'Biuro'),
      N('prn', 'printer', -180, 240, 'Drukarka', '192.168.1.30', 'Biuro'),
      N('nas', 'nas', -260, -100, 'NAS', '192.168.1.10', 'Szafa'),
      N('cam', 'camera', -520, 60, 'Kamera wejście', '192.168.1.40', 'Na zewnątrz'),
      N('tv', 'tv', 180, 240, 'Telewizor', '', 'Salon'),
      N('lap', 'laptop', 340, 240, 'Laptop', '', 'Salon'),
      N('tel', 'phone', 500, 160, 'Telefony'),
    ],
    links: [
      L('inet', 'ont', 'fiber', 'Światłowód operatora'),
      L('ont', 'rtr', 'eth', 'WAN'),
      L('rtr', 'sw', 'eth', 'Cat6'),
      L('rtr', 'ap1', 'eth', 'Cat6'),
      L('rtr', 'nas', 'eth', '1 Gb/s'),
      L('sw', 'ap2', 'eth', 'PoE'),
      L('sw', 'cam', 'eth', 'PoE'),
      L('sw', 'pc', 'eth'),
      L('sw', 'prn', 'eth'),
      L('ap1', 'tv', 'wifi'),
      L('ap1', 'lap', 'wifi'),
      L('ap1', 'tel', 'wifi'),
    ],
  };
}

/* ================= Przyciski ================= */
$('#btnSelect').onclick = () => setMode('select');
$('#btnConnect').onclick = () => setMode('connect');
$('#btnUndo').onclick = undo;
$('#btnRedo').onclick = redo;
$('#btnZoomIn').onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2); };
$('#btnZoomOut').onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2); };
$('#btnFit').onclick = fitView;
$('#btnExample').onclick = () => {
  if (state.nodes.length && !confirm('Zastąpić obecny projekt przykładem? (Możesz cofnąć Ctrl+Z)')) return;
  commit(); state = example(); selected = null; renderAll(); fitView();
};
$('#btnNew').onclick = () => {
  if (state.nodes.length && !confirm('Wyczyścić planszę? (Możesz cofnąć Ctrl+Z)')) return;
  commit(); state = { nodes: [], links: [] }; selected = null; renderAll(); fitView();
};
$('#btnSave').onclick = exportJson;
$('#btnLoad').onclick = () => $('#fileInput').click();
$('#fileInput').onchange = e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; };
$('#btnPng').onclick = exportPng;
$('#btnPrint').onclick = () => { fitView(); setTimeout(() => window.print(), 100); };

/* ================= Start ================= */
buildPalette();
const had = load();
renderAll();
if (!had) fitView(); else applyView();
