import { h, icon, budgetRing, prettyDate, fmt } from "../ui.js";
import { state, budget, dayLog, todayKey, mutate, latestWeight, pointsUsedOn } from "../state.js";
import { openAddFood } from "../foodsearch.js";

const MEALS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snacks" },
];

export function renderMyDay() {
  const b = budget();
  const s = state.data.settings;
  const name = (state.data.name || "").split(" ")[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const wrap = h("div", { class: "view" });

  // Header
  wrap.append(h("div", { class: "day-header" },
    h("div", { class: "greet" }, `${greet}${name ? ", " + name : ""}`),
    h("div", { class: "day-date" }, prettyDate(todayKey()))));

  // Budget card with ring
  const ringCard = h("div", { class: "card ring-card" },
    budgetRing({ remaining: b.dailyRemaining, budget: b.dailyBudget }),
    h("div", { class: "ring-stats" },
      stat("Weekly bank", `${b.weeklyRemaining}`, `of ${b.weeklyBudget} left`, b.weeklyRemaining < 0 ? "over" : ""),
      stat("Activity", `${b.activityToday}`, "earned today"),
      b.rolled ? stat("Rollovers", `+${b.rolled}`, "into weekly") : stat("Used today", `${b.usedToday}`, "Points")));
  wrap.append(ringCard);

  // Weekly progress bar
  const wkFrac = b.weeklyBudget > 0 ? Math.max(0, Math.min(1, b.weeklyRemaining / b.weeklyBudget)) : 0;
  wrap.append(h("div", { class: "card weekbar-card" },
    h("div", { class: "weekbar-top" },
      h("span", {}, "Weekly Points bank"),
      h("span", { class: "weekbar-num" }, `${b.weeklyRemaining} left`)),
    h("div", { class: "weekbar" }, h("div", { class: "weekbar-fill" + (b.weeklyRemaining < 0 ? " over" : ""), style: { width: (wkFrac * 100) + "%" } }))));

  // Today's food, by meal
  const foodCard = h("div", { class: "card meals-card" });
  foodCard.append(h("div", { class: "card-title-row" }, h("div", { class: "card-title" }, "Today's food")));
  const dl = dayLog();
  MEALS.forEach((m) => {
    const items = dl.meals[m.key] || [];
    const mealPts = items.reduce((s2, it) => s2 + it.points * (it.qty || 1), 0);
    const head = h("div", { class: "meal-head", onClick: () => openAddFood(m.key) },
      h("div", { class: "meal-name" }, m.label),
      h("div", { class: "meal-right" },
        h("span", { class: "meal-pts" }, mealPts ? `${mealPts}` : ""),
        h("button", { class: "add-mini", onClick: (e) => { e.stopPropagation(); openAddFood(m.key); } }, icon("plus"))));
    foodCard.append(head);
    items.forEach((it, idx) => {
      foodCard.append(h("div", { class: "logged-item" },
        h("div", { class: "li-main" },
          h("div", { class: "li-name" }, it.name + (it.qty && it.qty !== 1 ? ` ×${it.qty}` : "")),
          it.serving ? h("div", { class: "li-sub" }, it.serving) : null),
        h("div", { class: "li-pts" + (it.points === 0 ? " zero" : "") }, String(it.points * (it.qty || 1))),
        h("button", { class: "li-del", onClick: () => removeItem(m.key, idx) }, icon("trash"))));
    });
    if (!items.length) foodCard.append(h("div", { class: "meal-empty", onClick: () => openAddFood(m.key) }, "Add food"));
  });
  wrap.append(foodCard);

  // Water tracker
  const water = dl.water || 0;
  const waterCard = h("div", { class: "card water-card" },
    h("div", { class: "card-title-row" },
      h("div", { class: "card-title" }, "Water"),
      h("div", { class: "water-count" }, `${water} / 8 cups`)),
    h("div", { class: "water-row" }, ...Array.from({ length: 8 }, (_, i) =>
      h("button", { class: "cup" + (i < water ? " on" : ""), onClick: () => setWater(i + 1 === water ? i : i + 1) }, icon("water")))));
  wrap.append(waterCard);

  // Weight snapshot
  const lw = latestWeight();
  const goal = state.data.goal || {};
  if (lw != null) {
    const unit = s.units === "metric" ? "kg" : "lb";
    const lost = goal.startWeight != null ? +(goal.startWeight - lw).toFixed(1) : null;
    wrap.append(h("div", { class: "card weight-snap", onClick: () => window.__nav("weight") },
      h("div", {},
        h("div", { class: "card-title" }, "Weight"),
        h("div", { class: "snap-sub" }, goal.goalWeight != null ? `Goal ${fmt(goal.goalWeight, 1)} ${unit}` : "Set a goal")),
      h("div", { class: "snap-right" },
        h("div", { class: "snap-num" }, `${fmt(lw, 1)} ${unit}`),
        lost != null ? h("div", { class: "snap-delta" + (lost >= 0 ? " down" : " up") }, `${lost >= 0 ? "▼" : "▲"} ${fmt(Math.abs(lost), 1)} ${unit}`) : null),
      icon("chevron", "chev")));
  }

  wrap.append(h("div", { style: { height: "12px" } }));
  return wrap;

  function stat(label, value, sub, cls = "") {
    return h("div", { class: "rstat" },
      h("div", { class: "rstat-val " + cls }, value),
      h("div", { class: "rstat-lbl" }, label),
      h("div", { class: "rstat-sub" }, sub));
  }
  function removeItem(mealKey, idx) {
    mutate((d) => { dayLog().meals[mealKey].splice(idx, 1); });
  }
  function setWater(v) { mutate(() => { dayLog().water = v; }); }
}
