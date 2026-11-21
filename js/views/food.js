import { h, icon, prettyDate } from "../ui.js";
import { state, todayKey, mutate, pointsUsedOn, budget } from "../state.js";
import { openAddFood } from "../foodsearch.js";

const MEALS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snacks" },
];

let viewDate = todayKey();

export function renderFood() {
  const wrap = h("div", { class: "view" });
  const b = budget();
  const used = pointsUsedOn(viewDate);

  // Date navigator
  wrap.append(h("div", { class: "date-nav" },
    h("button", { class: "icon-btn", onClick: () => shift(-1) }, icon("back")),
    h("div", { class: "date-label" }, prettyDate(viewDate)),
    h("button", { class: "icon-btn" + (viewDate >= todayKey() ? " disabled" : ""), onClick: () => shift(1) }, icon("chevron"))));

  // Day total
  wrap.append(h("div", { class: "card total-card" },
    h("div", {},
      h("div", { class: "total-num" }, String(used)),
      h("div", { class: "total-lbl" }, "Points eaten")),
    viewDate === todayKey() ? h("div", { class: "total-right" },
      h("div", { class: "total-num small " + (b.dailyRemaining < 0 ? "over" : "") }, String(b.dailyRemaining)),
      h("div", { class: "total-lbl" }, "left today")) : null));

  const log = state.data.log?.[viewDate];
  MEALS.forEach((m) => {
    const items = log?.meals?.[m.key] || [];
    const mp = items.reduce((s, it) => s + it.points * (it.qty || 1), 0);
    const card = h("div", { class: "card meal-card" });
    card.append(h("div", { class: "meal-head", onClick: () => openAddFood(m.key, viewDate) },
      h("div", { class: "meal-name" }, m.label),
      h("div", { class: "meal-right" },
        h("span", { class: "meal-pts" }, mp ? String(mp) : ""),
        h("button", { class: "add-mini", onClick: (e) => { e.stopPropagation(); openAddFood(m.key, viewDate); } }, icon("plus")))));
    if (!items.length) card.append(h("div", { class: "meal-empty", onClick: () => openAddFood(m.key, viewDate) }, "Add food"));
    items.forEach((it, idx) => card.append(h("div", { class: "logged-item" },
      h("div", { class: "li-main" },
        h("div", { class: "li-name" }, it.name + (it.qty && it.qty !== 1 ? ` ×${it.qty}` : "")),
        it.serving ? h("div", { class: "li-sub" }, [it.brand, it.serving].filter(Boolean).join(" · ")) : null),
      h("div", { class: "li-pts" + (it.points === 0 ? " zero" : "") }, String(it.points * (it.qty || 1))),
      h("button", { class: "li-del", onClick: () => mutate(() => state.data.log[viewDate].meals[m.key].splice(idx, 1)) }, icon("trash")))));
    wrap.append(card);
  });

  wrap.append(h("div", { style: { height: "12px" } }));
  return wrap;

  function shift(n) {
    const [y, mo, d] = viewDate.split("-").map(Number);
    const dt = new Date(y, mo - 1, d + n);
    const key = todayKey(dt);
    if (key > todayKey()) return;
    viewDate = key;
    window.__rerender();
  }
}
