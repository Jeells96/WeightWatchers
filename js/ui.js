// Small UI toolkit: DOM builder, icons, formatters, the budget ring, a weight
// chart, and a bottom-sheet modal. No framework.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

// ---- Icons (original line icons) ---------------------------------------
const ICONS = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.8 14.6c2.3.2 4 1.6 4.6 4.1"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  discover: '<path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M6 5h12M8 2.5h8"/><path d="m12 11 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5L11 13z"/>',
  progress: '<path d="M4 19h16"/><path d="m5 15 4-4 3.5 3L19 7.5"/><path d="M15 7.5h4v4"/>',
  profile: '<circle cx="12" cy="8.5" r="3.8"/><path d="M5 20c1-3.6 3.8-5.4 7-5.4s6 1.8 7 5.4"/>',
  drumstick: '<path d="M14.5 4.5a4.5 4.5 0 0 1 4.6 6.6c-1.2 2-3.4 3-5.6 2.6l-3.2 3.2a1.8 1.8 0 1 1-2.6 2.6 1.8 1.8 0 1 1-2.6-2.6 1.8 1.8 0 1 1 2.6-2.6l3.2-3.2a4.5 4.5 0 0 1 3.6-6.6z"/>',
  fiber: '<path d="M12 4c2 0 3.2 1.4 3.4 3 1.6-.3 3.4.8 3.6 2.8.2 1.8-1 3-2.4 3.4.8 1.4.4 3.3-1.2 4-1.4.7-3 .2-3.6-.9-.6 1.1-2.2 1.6-3.6.9-1.6-.7-2-2.6-1.2-4C5.6 12.8 4.8 11.6 5 9.8 5.2 7.8 7 6.7 8.6 7 8.8 5.4 10 4 12 4z"/>',
  bread: '<path d="M6 10.5a3.5 3.5 0 0 1 2-6.5h8a3.5 3.5 0 0 1 2 6.5V19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><path d="m10 12 4-3M10 15.5l4-3"/>',
  avocado: '<path d="M12 3c3 0 5 4 5.8 7.5.9 4.2-1.6 9.5-5.8 9.5S5.3 14.7 6.2 10.5C7 7 9 3 12 3z"/><circle cx="12" cy="14" r="2.6"/>',
  salt: '<path d="M8 9h8l1 10a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"/><path d="M8.5 9 9.5 4h5l1 5"/><circle cx="11" cy="14" r=".6"/><circle cx="13.5" cy="16" r=".6"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  dumbbell: '<path d="M6.5 7.5v9M17.5 7.5v9M3.5 10v4M20.5 10v4M6.5 12h11"/>',
  infinity: '<path d="M8 15.5a3.5 3.5 0 1 1 0-7c3 0 5 7 8 7a3.5 3.5 0 1 0 0-7c-3 0-5 7-8 7z"/>',
  bowl: '<path d="M4 12h16a8 8 0 0 1-16 0zM9 8.5c0-1 1-1 1-2s-1-1-1-2M13 8.5c0-1 1-1 1-2s-1-1-1-2"/>',
  coffee: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2.5M11 3.5v2.5"/>',
  plate: '<path d="M4 17h16M6 17a6 6 0 0 1 12 0M12 9V7.5M10.5 7.5h3"/>',
  appleIco: '<path d="M12 7c-2-1.5-6-1-6 4 0 4 2.5 9 6 8 3.5 1 6-4 6-8 0-5-4-5.5-6-4z"/><path d="M12 7c0-2 1-3.5 3-4"/>',
  shoe: '<path d="M4 16.5c0-3 1-7 2-9l3 1.5c.5 1.5 2 2.5 4 2.5l5 1.5c1.5.5 2 1.5 2 3v1H4z"/><path d="M4 19.5h16"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 6c.5-.1 1-.1 1.4-.1 6 0 9.5 6.1 9.5 6.1a17 17 0 0 1-3 3.6M6.4 7.4A16 16 0 0 0 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1"/>',
  scanFood: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 9v6M10.5 9v6M13 9v6M15.5 9v6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  bookmark: '<path d="M7 4h10v16l-5-3.5L7 20z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  home: '<path d="M3 11.5 12 4l9 7.5M5 10v10h5v-6h4v6h5V10"/>',
  food: '<path d="M6 3v8a2 2 0 0 0 2 2h0v8M6 3v5M9 3v5M18 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  scale: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M8 9h8M12 9l-2 4a2 2 0 1 0 4 0z"/>',
  activity: '<path d="M3 12h3l2.5 6 4-14 2.5 8 1.5-3H21"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.4-2.6l-.1-.1A2 2 0 1 1 7.2 4.6l.1.1A1.6 1.6 0 0 0 9 4.9h.1A1.6 1.6 0 0 0 10 3.4V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V10a1.6 1.6 0 0 0 1.5 1h.1a2 2 0 1 1 0 4H21a1.6 1.6 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  barcode: '<path d="M4 6v12M7 6v12M10 6v8M10 16v2M13 6v12M17 6v12M20 6v12"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M5 12.5 10 17l9-10"/>',
  trash: '<path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/>',
  water: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  flame: '<path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C8 11 12 9 12 3z"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/>',
  camera: '<path d="M4 8h3l1.5-2h7L18 8h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.2"/>',
};

export function icon(name, cls = "") {
  const path = ICONS[name] || "";
  const svg = `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  const tmp = document.createElement("template");
  tmp.innerHTML = svg.trim();
  return tmp.content.firstChild;
}

// ---- Budget ring --------------------------------------------------------
// value/max, with an optional over-budget state.
export function budgetRing({ remaining, budget, size = 230 }) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const used = Math.max(0, budget - remaining);
  const frac = budget > 0 ? Math.min(1, used / budget) : 0;
  const over = remaining < 0;
  const dash = c * frac;
  const wrap = h("div", { class: "ring-wrap", style: { width: size + "px", height: size + "px" } });
  wrap.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="ring">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="var(--ring-track)" stroke-width="${stroke}" fill="none"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}"
        stroke="${over ? "var(--danger)" : "url(#ringGrad)"}" stroke-width="${stroke}" fill="none"
        stroke-linecap="round" stroke-dasharray="${dash} ${c}"
        transform="rotate(-90 ${size / 2} ${size / 2})"/>
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="var(--brand-500)"/>
          <stop offset="1" stop-color="var(--brand-300)"/>
        </linearGradient>
      </defs>
    </svg>
    <div class="ring-center">
      <div class="ring-num ${over ? "over" : ""}">${remaining}</div>
      <div class="ring-label">${over ? "over budget" : "Points left today"}</div>
      <div class="ring-sub">${used} of ${budget} used</div>
    </div>`;
  return wrap;
}

// ---- Weight chart (SVG line) -------------------------------------------
export function weightChart(points, { goal, width = 340, height = 150 } = {}) {
  const wrap = h("div", { class: "chart" });
  if (points.length < 2) {
    wrap.append(h("div", { class: "chart-empty" }, "Log at least two weigh-ins to see your trend."));
    return wrap;
  }
  const pad = { l: 8, r: 8, t: 14, b: 14 };
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.weight);
  let min = Math.min(...ys, goal ?? Infinity);
  let max = Math.max(...ys, goal ?? -Infinity);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min -= span * 0.12; max += span * 0.12;
  const X = (i) => pad.l + (i / (xs.length - 1)) * (width - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (v - min) / (max - min)) * (height - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.weight).toFixed(1)}`).join(" ");
  const area = `${line} L${X(xs.length - 1).toFixed(1)} ${height - pad.b} L${X(0).toFixed(1)} ${height - pad.b} Z`;
  const goalLine = goal != null
    ? `<line x1="${pad.l}" y1="${Y(goal).toFixed(1)}" x2="${width - pad.r}" y2="${Y(goal).toFixed(1)}" stroke="var(--good)" stroke-width="1.5" stroke-dasharray="4 4"/>`
    : "";
  const dots = points.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.weight).toFixed(1)}" r="2.6" fill="var(--brand-500)"/>`).join("");
  wrap.innerHTML = `
    <svg width="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="chart-svg">
      <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--brand-400)" stop-opacity="0.28"/>
        <stop offset="1" stop-color="var(--brand-400)" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#wg)"/>
      ${goalLine}
      <path d="${line}" fill="none" stroke="var(--brand-500)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
    </svg>`;
  return wrap;
}

// ---- Bottom sheet modal -------------------------------------------------
export function sheet(title, bodyNode, { full = false, header = null, footer = null, onClose = null } = {}) {
  const overlay = h("div", { class: "sheet-overlay" });
  const panel = h("div", { class: "sheet " + (full ? "sheet-full" : "") });
  const head = header
    ? (typeof header === "function" ? header(close) : header)
    : h("div", { class: "sheet-head" },
        h("span", { style: { width: "34px" } }),
        h("div", { class: "sheet-title" }, title),
        h("button", { class: "icon-btn", onClick: close, "aria-label": "Close" }, icon("close")));
  panel.append(head, bodyNode);
  if (footer) panel.append(h("div", { class: "sheet-foot" }, footer));
  overlay.append(panel);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add("open"));
  let closed = false;
  function close() {
    if (closed) return; closed = true;
    overlay.classList.remove("open");
    if (onClose) onClose();
    setTimeout(() => overlay.remove(), 220);
  }
  return { close, panel };
}

export function toast(msg) {
  const t = h("div", { class: "toast" }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 1800);
}

export function fmt(n, d = 0) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "–";
  return x.toFixed(d).replace(/\.0+$/, "");
}

export function prettyDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((date - today) / 86400000);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
