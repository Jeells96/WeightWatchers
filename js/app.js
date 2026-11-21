import { h, icon } from "./ui.js";
import { state, getCurrentId, signIn, onChange, loadDemo } from "./state.js";
import { renderGate } from "./views/onboarding.js";
import { renderMyDay } from "./views/myday.js";
import { renderFood } from "./views/food.js";
import { renderWeight } from "./views/weight.js";
import { renderActivity } from "./views/activity.js";
import { renderSettings } from "./views/settings.js";
import { renderFriends } from "./views/friends.js";
import { openAddFood } from "./foodsearch.js";

const root = document.getElementById("app");
let current = "myday";

const TABS = [
  { key: "myday", label: "My Day", icon: "home", render: renderMyDay },
  { key: "food", label: "Food", icon: "food", render: renderFood },
  { key: "add", label: "", icon: "plus", center: true },
  { key: "weight", label: "Weight", icon: "scale", render: renderWeight },
  { key: "settings", label: "More", icon: "settings", render: renderSettings },
];

// Global helpers used by views.
window.__nav = (key) => { current = key; renderApp(); };
window.__rerender = () => { if (state.data) renderApp(); };
window.__boot = boot;

function renderApp() {
  if (!state.data) return;
  const screen = h("div", { class: "app-shell" });
  const scroll = h("div", { class: "scroll", id: "scroll" });

  if (current === "friends") {
    scroll.append(renderFriends());
  } else {
    const tab = TABS.find((t) => t.key === current) || TABS[0];
    if (tab.render) scroll.append(tab.render());
  }
  screen.append(scroll);

  // bottom tab bar
  const bar = h("nav", { class: "tabbar" });
  TABS.forEach((t) => {
    if (t.center) {
      bar.append(h("button", { class: "tab center", onClick: () => openAddFood(currentMealGuess()) },
        h("div", { class: "fab" }, icon("plus"))));
      return;
    }
    const on = t.key === current || (t.key === "settings" && current === "friends");
    const badge = t.key === "settings" && state.data && (state.data.requestsIn || []).length
      ? h("span", { class: "tab-badge" }, String(state.data.requestsIn.length)) : null;
    bar.append(h("button", {
      class: "tab" + (on ? " on" : ""),
      onClick: () => { current = t.key; renderApp(); },
    }, h("div", { class: "tab-ico-wrap" }, icon(t.icon), badge), h("span", { class: "tab-lbl" }, t.label)));
  });
  screen.append(bar);

  root.replaceChildren(screen);
}

function currentMealGuess() {
  const hr = new Date().getHours();
  if (hr < 10) return "breakfast";
  if (hr < 15) return "lunch";
  if (hr < 21) return "dinner";
  return "snack";
}

async function boot() {
  if (new URLSearchParams(location.search).get("demo") === "1" && !state.data) {
    loadDemo();
    renderApp();
    return;
  }
  const id = getCurrentId();
  if (!state.data && id) {
    root.replaceChildren(h("div", { class: "gate loading" }, h("div", { class: "spinner" })));
    try { await signIn(id); } catch {}
  }
  if (state.data) { renderApp(); }
  else { renderGate(root); }
}

// Re-render live when Firestore pushes updates (but not mid-scroll jank: cheap).
onChange(() => { if (state.data) renderApp(); });

boot();

// Register service worker for offline / installability.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
