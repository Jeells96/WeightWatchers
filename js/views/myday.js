// My Day — modeled on the WW layout: header, date strip, Points ring card
// (Weeklies · Points Left · Used), Scanner / Track a meal, meal rows with
// protein · fiber · Points, streak, macros & nutrients, weight & activity.
import { h, icon } from "../ui.js";
import {
  state, budget, totalsOn, streak, macroTargets, dayLog, mutate, todayKey, addDays,
  latestWeight, trackedOn,
} from "../state.js";
import { openAddFood } from "../foodsearch.js";
import { openActivityLog } from "./activity.js";
import { openWater } from "../actions.js";

const MEALS = [
  { key: "breakfast", label: "Breakfast", icon: "coffee" },
  { key: "lunch", label: "Lunch", icon: "bowl" },
  { key: "dinner", label: "Dinner", icon: "plate" },
  { key: "snack", label: "Snacks", icon: "appleIco" },
];
const MODES = { lose: { label: "Lose", icon: "bolt" }, allin: { label: "All-In", icon: "dumbbell" }, maintain: { label: "Maintain", icon: "infinity" } };

let selDate = todayKey();
export function getSelectedDate() { return selDate; }

export function guessMeal() {
  const hr = new Date().getHours();
  return hr < 10 ? "breakfast" : hr < 15 ? "lunch" : hr < 21 ? "dinner" : "snack";
}

export function renderMyDay() {
  const today = todayKey();
  const s = state.data.settings;
  const b = budget(selDate);
  const wrap = h("div", { class: "view myday" });

  // ---- Header ----
  const reqs = (state.data.requestsIn || []).length;
  wrap.append(h("div", { class: "topbar" },
    h("button", { class: "tb-btn", "aria-label": "Menu", onClick: () => window.__nav("settings") }, icon("menu")),
    h("div", { class: "tb-title" }, "My Day"),
    h("div", { class: "tb-right" },
      h("button", { class: "tb-btn", "aria-label": "Friends", onClick: () => window.__nav("friends") }, icon("people")),
      h("button", { class: "tb-btn", "aria-label": "Notifications", onClick: () => window.__nav("friends") },
        icon("bell"), reqs ? h("span", { class: "tb-dot" }) : null))));

  // ---- Date strip ----
  const strip = h("div", { class: "datestrip" });
  for (let i = -21; i <= 7; i++) {
    const key = addDays(today, i);
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    strip.append(h("button", {
      class: "ds-day" + (key === selDate ? " sel" : "") + (key > today ? " future" : "") + (key === today ? " today" : ""),
      onClick: () => { selDate = key; window.__rerender(); },
    }, h("div", { class: "ds-num" }, String(d)), h("div", { class: "ds-wd" }, dt.toLocaleDateString(undefined, { weekday: "short" }))));
  }
  wrap.append(strip);
  requestAnimationFrame(() => {
    const sel = strip.querySelector(".sel");
    if (sel) strip.scrollLeft = sel.offsetLeft - (strip.clientWidth - sel.offsetWidth) / 2;
  });
  if (selDate !== today) {
    wrap.append(h("button", { class: "back-today", onClick: () => { selDate = today; window.__rerender(); } }, "Back to today"));
  }

  // ---- Points ring card ----
  const mode = MODES[s.mode] || MODES.lose;
  const curMeal = selDate === today ? guessMeal() : null;
  const card = h("div", { class: "pts-card" });
  card.append(h("button", { class: "mode-pill", onClick: () => window.__nav("settings") }, icon(mode.icon), mode.label, icon("chevron")));
  card.append(h("div", { class: "pts-row" },
    h("div", { class: "pts-side" },
      h("div", { class: "pts-side-num" + (b.weeklyRemaining < 0 ? " over" : "") }, String(b.weeklyRemaining)),
      h("div", { class: "pts-side-lbl" }, "Weeklies")),
    ring(b.dailyLeft, b.dailyBudget),
    h("div", { class: "pts-side" },
      h("div", { class: "pts-side-num" }, String(b.usedToday)),
      h("div", { class: "pts-side-lbl" }, "Used"))));
  card.append(h("div", { class: "pts-actions" },
    h("button", { class: "pa-btn", onClick: () => openAddFood(curMeal || "snack", selDate, { scan: true }) }, icon("scanFood"), h("span", {}, "Scanner")),
    h("button", { class: "pa-btn", onClick: () => openAddFood(curMeal || "breakfast", selDate) }, icon("plus"), h("span", {}, "Track a meal"))));
  MEALS.forEach((m) => {
    const t = totalsOn(selDate, m.key);
    card.append(h("button", { class: "meal-bar" + (m.key === curMeal ? " cur" : ""), onClick: () => openAddFood(m.key, selDate) },
      h("div", { class: "mb-ico" }, icon(m.icon)),
      h("div", { class: "mb-name" }, m.label, t.count ? h("span", { class: "mb-count" }, `${t.count} item${t.count > 1 ? "s" : ""}`) : null),
      h("div", { class: "mb-stats" },
        h("div", { class: "mb-macro" }, icon("drumstick"), `${Math.round(t.protein)}g`),
        h("div", { class: "mb-macro" }, icon("fiber"), `${Math.round(t.fiber)}g`)),
      h("div", { class: "mb-pts" }, String(Math.round(t.points)))));
  });
  wrap.append(card);

  // ---- Streak ----
  const wkStart = addDays(today, -new Date().getDay()); // Sunday
  const n = streak();
  wrap.append(h("div", { class: "streak-card" },
    h("div", { class: "sk-days" }, ...["S", "M", "T", "W", "T", "F", "S"].map((l, i) => {
      const key = addDays(wkStart, i);
      return h("div", { class: "sk-day" },
        h("div", { class: "sk-l" }, l),
        h("div", { class: "sk-dot" + (trackedOn(key) ? " on" : "") + (key === today ? " today" : "") }, trackedOn(key) ? icon("check") : null));
    })),
    h("div", { class: "sk-text" }, n ? `🔥 ${n}-day streak — keep it going!` : "Track a meal to start a streak!")));

  // ---- Daily summary ----
  const t = totalsOn(selDate);
  const tg = macroTargets();
  const water = state.data.log?.[selDate]?.water || 0;
  wrap.append(h("div", { class: "section-title" }, "Daily Summary"));
  wrap.append(h("div", { class: "macros-card" },
    h("div", { class: "mc-head" }, "MACROS AND NUTRIENTS"),
    h("div", { class: "mc-grid" },
      tile("drumstick", "Protein", `${Math.round(t.protein)} g`, `${tg.protein[0]}–${tg.protein[1]}g`),
      tile("bread", "Carbs", `${Math.round(t.carbs)} g`, `${tg.carbs[0]}–${tg.carbs[1]}g`),
      tile("avocado", "Fats", `${Math.round(t.fat)} g`, `${tg.fat[0]}–${tg.fat[1]}g`),
      tile("fiber", "Fiber", `${Math.round(t.fiber)} g`, `At least ${tg.fiber}g`),
      tile("salt", "Sodium", `${Math.round(t.sodium)} mg`, `Under ${tg.sodium}mg`),
      tile("water", "Water", `${water} cups`, "Goal 8 cups", () => openWater(selDate)))));

  // ---- Weight / Activity ----
  const unit = s.units === "metric" ? "kg" : "lbs";
  const lw = latestWeight();
  const goal = state.data.goal || {};
  let hide = false;
  try { hide = localStorage.getItem("ww_hide_weight") === "1"; } catch {}
  const pct = goal.startWeight != null && goal.goalWeight != null && lw != null && goal.startWeight !== goal.goalWeight
    ? Math.max(0, Math.min(1, (goal.startWeight - lw) / (goal.startWeight - goal.goalWeight))) : 0;
  wrap.append(h("div", { class: "cards-row" },
    h("div", { class: "mini-card", onClick: () => window.__nav("weight") },
      h("div", { class: "mini-head" }, "WEIGHT", icon("chevron")),
      h("div", { class: "mini-big" },
        hide ? "•••" : (lw != null ? `${+lw.toFixed(1)} ${unit}` : "—"),
        h("button", { class: "eye-btn", onClick: (e) => { e.stopPropagation(); try { localStorage.setItem("ww_hide_weight", hide ? "0" : "1"); } catch {} window.__rerender(); } }, icon(hide ? "eyeOff" : "eye"))),
      h("div", { class: "mini-sub" },
        h("span", {}, `Start: ${goal.startWeight != null ? +goal.startWeight : "—"}`),
        h("span", {}, `Goal: ${goal.goalWeight != null ? +goal.goalWeight : "—"}`)),
      h("div", { class: "mini-bar" }, h("div", { style: { width: pct * 100 + "%" } }))),
    h("div", { class: "mini-card", onClick: () => openActivityLog(selDate) },
      h("div", { class: "mini-head" }, "ACTIVITY", icon("plus")),
      h("div", { class: "mini-big" }, String(b.activityToday)),
      h("div", { class: "mini-sub" }, h("span", {}, "activity Points today")),
      h("div", { class: "mini-sub dim" }, h("span", {}, `${b.activityThisWeek} this week`)))));

  wrap.append(h("div", { style: { height: "40px" } }));
  return wrap;

  function tile(ic, label, value, range, onClick) {
    return h("button", { class: "mc-tile", onClick },
      h("div", { class: "mc-top" }, h("div", { class: "mc-ico" }, icon(ic)), icon("chevron")),
      h("div", { class: "mc-lbl" }, label.toUpperCase()),
      h("div", { class: "mc-val" }, value),
      h("div", { class: "mc-range" }, range));
  }
}

function ring(left, total) {
  const size = 200, stroke = 20, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const el = h("div", { class: "pts-ring" });
  el.innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <circle cx="100" cy="100" r="${r}" fill="none" stroke="var(--ring-track)" stroke-width="${stroke}"/>
    <circle cx="100" cy="100" r="${r}" fill="none" stroke="var(--brand-300)" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c * frac} ${c}" transform="rotate(-90 100 100)"/></svg>
    <div class="pr-center"><div class="pr-num">${left}</div><div class="pr-lbl">Points Left</div></div>`;
  return el;
}
