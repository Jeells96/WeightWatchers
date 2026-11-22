import { h, icon } from "./ui.js";
import { state, getCurrentId, signIn, onChange, loadDemo } from "./state.js";
import { renderGate } from "./views/onboarding.js";
import { renderMyDay } from "./views/myday.js";
import { renderDiscover } from "./views/discover.js";
import { renderWeight } from "./views/weight.js";
import { renderSettings } from "./views/settings.js";
import { renderFriends } from "./views/friends.js";
import { renderCorrections } from "./views/corrections.js";
import { openActionMenu } from "./actions.js";
import { getSelectedDate } from "./views/myday.js";
import { initCalibrations } from "./calibrations.js";

const root = document.getElementById("app");
let current = "myday";

const TABS = [
  { key: "myday", label: "My Day", icon: "calendar", render: renderMyDay },
  { key: "discover", label: "Discover", icon: "discover", render: renderDiscover },
  { key: "friends", label: "Community", icon: "people", render: renderFriends },
  { key: "weight", label: "Progress", icon: "progress", render: renderWeight },
  { key: "settings", label: "Profile", icon: "profile", render: renderSettings },
];

// Global helpers used by views.
window.__nav = (key) => { current = key; renderApp(); };
window.__rerender = () => { if (state.data) renderApp(); };
window.__boot = boot;

let lastView = null;
function renderApp() {
  if (!state.data) return;
  const prevScroll = document.getElementById("scroll")?.scrollTop || 0;
  const same = lastView === current;
  const screen = h("div", { class: "app-shell" });
  const scroll = h("div", { class: "scroll", id: "scroll" });

  if (current === "corrections") {
    scroll.append(renderCorrections());
  } else {
    const tab = TABS.find((t) => t.key === current) || TABS[0];
    scroll.append(tab.render());
  }
  screen.append(scroll);

  // bottom tab bar + floating + (like WW)
  const bar = h("nav", { class: "tabbar" });
  TABS.forEach((t) => {
    const on = t.key === current || (t.key === "settings" && current === "corrections");
    const badge = t.key === "friends" && (state.data.requestsIn || []).length
      ? h("span", { class: "tab-badge" }, String(state.data.requestsIn.length)) : null;
    bar.append(h("button", { class: "tab" + (on ? " on" : ""), onClick: () => { current = t.key; renderApp(); } },
      h("div", { class: "tab-ico-wrap" }, icon(t.icon), badge), h("span", { class: "tab-lbl" }, t.label)));
  });
  screen.append(bar);
  if (current === "myday") screen.append(h("button", { class: "fab-float", "aria-label": "Track", onClick: () => openActionMenu(getSelectedDate()) }, icon("plus")));

  root.replaceChildren(screen);
  if (same) scroll.scrollTop = prevScroll;
  lastView = current;
}


async function boot() {
  if (new URLSearchParams(location.search).get("demo") === "1" && !state.data) {
    loadDemo();
    initCalibrations(() => { if (state.data) renderApp(); });
    renderApp();
    return;
  }
  const id = getCurrentId();
  if (!state.data && id) {
    root.replaceChildren(h("div", { class: "gate loading" }, h("div", { class: "spinner" })));
    try { await signIn(id); } catch {}
  }
  if (state.data) {
    initCalibrations(() => { if (state.data) renderApp(); });
    renderApp();
  } else { renderGate(root); }
}

// Re-render live when Firestore pushes updates (but not mid-scroll jank: cheap).
onChange(() => { if (state.data) renderApp(); });

boot();

// ---- Zoom guard ---------------------------------------------------------
// The app must be viewed/installed at 100% zoom. Warn (dismissibly) if not.
function zoomPercent() {
  try {
    const screenW = Math.min(window.screen.width, window.screen.height);
    const iw = window.innerWidth || screenW;
    if (!screenW || !iw) return 100;
    let pct = (screenW / iw) * 100;
    const vs = window.visualViewport ? window.visualViewport.scale : 1;
    if (vs && Math.abs(vs - 1) > 0.02) pct *= vs;
    return Math.round(pct);
  } catch { return 100; }
}

function checkZoom() {
  const existing = document.querySelector(".zoom-banner");
  let dismissed = false;
  try { dismissed = sessionStorage.getItem("ww_zoom_ok") === "1"; } catch {}
  const pct = zoomPercent();
  const off = navigator.maxTouchPoints > 0 && Math.abs(pct - 100) > 4;
  if (!off || dismissed) { if (existing) existing.remove(); return; }
  if (existing) { existing.querySelector(".zb-text").textContent = bannerText(pct); return; }
  const banner = h("div", { class: "zoom-banner" },
    h("div", { class: "zb-ico" }, "⚠️"),
    h("div", { class: "zb-text" }, bannerText(pct)),
    h("button", { class: "zb-close", onClick: () => { try { sessionStorage.setItem("ww_zoom_ok", "1"); } catch {} banner.remove(); } }, "✕"));
  document.body.appendChild(banner);
}
function bannerText(pct) {
  return `Your browser looks zoomed to ~${pct}%. Set Safari to 100% (tap “AA” in the address bar → 100%) before adding to the Home Screen, or the layout won’t fit right.`;
}

window.addEventListener("resize", checkZoom);
window.addEventListener("orientationchange", () => setTimeout(checkZoom, 300));
if (window.visualViewport) window.visualViewport.addEventListener("resize", checkZoom);
setTimeout(checkZoom, 600);

// Register service worker for offline / installability.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
