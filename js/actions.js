// The floating + menu, modeled on WW: date, recently tracked (with meal
// picker), and quick actions — Food, Activity, Water, Weight, Barcode.
import { h, icon, sheet, toast } from "./ui.js";
import { state, mutate, dayLog, todayKey } from "./state.js";
import { openAddFood, openFoodDetail } from "./foodsearch.js";
import { openActivityLog } from "./views/activity.js";
import { openWeighIn } from "./views/weight.js";

const MEALS = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snack", "Snacks"]];
function guessMeal() { const hr = new Date().getHours(); return hr < 10 ? "breakfast" : hr < 15 ? "lunch" : hr < 21 ? "dinner" : "snack"; }

export function openActionMenu(dateKey = todayKey()) {
  let meal = guessMeal();
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dateText = (dateKey === todayKey() ? "Today, " : dt.toLocaleDateString(undefined, { weekday: "long" }) + ", ") +
    dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const overlay = h("div", { class: "am-overlay" });
  const close = () => { overlay.classList.remove("open"); setTimeout(() => overlay.remove(), 220); };
  const run = (fn) => () => { close(); setTimeout(fn, 160); };

  const mealBtn = h("button", { class: "am-meal" });
  const list = h("div", { class: "am-list" });
  const renderMeal = () => mealBtn.replaceChildren(MEALS.find((x) => x[0] === meal)[1].toUpperCase(), icon("chevronDown"));
  mealBtn.addEventListener("click", () => { const i = MEALS.findIndex((x) => x[0] === meal); meal = MEALS[(i + 1) % MEALS.length][0]; renderMeal(); });
  renderMeal();

  const recents = state.data.recents || [];
  if (!recents.length) {
    list.append(h("div", { class: "am-empty" },
      h("div", { class: "am-empty-h" }, "Nothing to see here"),
      h("div", { class: "am-empty-p" }, "You haven't tracked anything recently. Tap Food below to search and track.")));
  } else {
    recents.slice(0, 5).forEach((it) => list.append(h("button", {
      class: "am-row",
      onClick: run(() => openFoodDetail(it, { getMeal: () => meal, dateKey, onTracked: () => window.__rerender() })),
    }, h("span", { class: "am-row-name" }, it.name), h("span", { class: "am-row-pts" }, String(it.points ?? 0)))));
  }

  const tile = (ic, label, fn, outline = false) => h("button", { class: "am-tile" + (outline ? " outline" : ""), onClick: run(fn) },
    h("div", { class: "am-ico" }, icon(ic)), h("div", { class: "am-lbl" }, label));

  overlay.append(
    h("div", { class: "am-date" }, dateText),
    h("div", { class: "am-card" }, h("div", { class: "am-card-head" }, h("span", {}, "RECENTLY TRACKED"), mealBtn), list),
    h("div", { class: "am-grid" },
      tile("bowl", "Food", () => openAddFood(meal, dateKey)),
      tile("shoe", "Activity", () => openActivityLog(dateKey)),
      tile("water", "Water", () => openWater(dateKey)),
      tile("scale", "Weight", () => openWeighIn()),
      tile("barcode", "Barcode", () => openAddFood(meal, dateKey, { scan: true }), true)),
    h("button", { class: "am-close", "aria-label": "Close", onClick: close }, icon("close")));
  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add("open"));
}

export function openWater(dateKey = todayKey()) {
  const count = h("div", { class: "wt-count" });
  const render = () => { count.textContent = String(state.data.log?.[dateKey]?.water || 0); };
  const set = (delta) => { mutate(() => { const dl = dayLog(dateKey); dl.water = Math.max(0, (dl.water || 0) + delta); }); render(); };
  render();
  sheet("Water", h("div", { class: "pad wt" },
    h("div", { class: "wt-row" },
      h("button", { class: "wt-btn", "aria-label": "Remove a cup", onClick: () => set(-1) }, "–"),
      h("div", { class: "wt-mid" }, count, h("div", { class: "wt-lbl" }, "cups (8 oz)")),
      h("button", { class: "wt-btn", "aria-label": "Add a cup", onClick: () => { set(1); toast("+1 cup"); } }, "+")),
    h("div", { class: "set-hint" }, "Aim for about 8 cups a day.")));
}
