// Discover: search, ZeroPoint foods by group, and browsing the food database.
import { h, icon, sheet } from "../ui.js";
import { todayKey } from "../state.js";
import { ZERO_POINT_LIST } from "../zeropoint-list.js";
import { foodCategories, foodsInCategory, searchLocal } from "../foods.js";
import { openAddFood, openFoodDetail } from "../foodsearch.js";
import { guessMeal } from "./myday.js";

const GROUP_EMOJI = {
  "Vegetables (incl. potatoes)": ["🥔", "🥒", "🥦", "🥕"],
  "Tofu & tempeh": ["🧈", "🫘", "🥢", "🍱"],
  "Chicken & turkey": ["🍗", "🦃", "🥪", "🍖"],
  "Oats": ["🥣", "🌾", "🥄", "🫙"],
  "Beans, peas & lentils": ["🫘", "🫛", "🥗", "🌯"],
  "Lean meats": ["🥩", "🍖", "🐄", "🐑"],
  "Fruit": ["🍈", "🍎", "🍇", "🍌"],
  "Fish & shellfish": ["🐟", "🦐", "🍣", "🦀"],
  "Eggs": ["🍳", "🥚", "🥘", "🧆"],
  "Corn & popcorn": ["🌽", "🍿", "🌾", "🫓"],
  "Yogurt & cottage cheese": ["🥛", "🍶", "🥣", "🧀"],
};

const ctx = () => ({ getMeal: guessMeal, dateKey: todayKey(), onTracked: () => window.__rerender() });

function findItem(name, portion) {
  const hit = searchLocal(name).find((it) => it.name.toLowerCase() === name.toLowerCase());
  return hit || { id: "zp_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, brand: "", serving: portion, grams: null, nutrition: {}, zero: true, points: 0, pointsRaw: 0 };
}

function listSheet(title, items) {
  const body = h("div", { class: "pad list-sheet" }, ...items.map((it) => h("button", { class: "res-row", onClick: () => openFoodDetail(it, ctx()) },
    h("div", { class: "res-main" }, h("div", { class: "res-name" }, it.name), h("div", { class: "res-sub" }, it.serving || "")),
    h("div", { class: "res-pts solo" + (it.zero ? " zero" : "") }, String(it.points ?? 0)))));
  sheet(title, body, { full: true });
}

export function renderDiscover() {
  const wrap = h("div", { class: "view" });
  wrap.append(h("div", { class: "topbar" }, h("span"), h("div", { class: "tb-title" }, "Discover"), h("span")));
  wrap.append(h("button", { class: "tr-pill disc-search", onClick: () => openAddFood(guessMeal(), todayKey()) }, icon("search"), h("span", {}, "Search and track food")));

  wrap.append(h("div", { class: "section-title" }, "ZeroPoint foods"));
  wrap.append(h("div", { class: "set-hint big" }, "Build meals around these — they don't count against your Points."));
  const zp = h("div", { class: "zp-card" });
  ZERO_POINT_LIST.forEach((g) => {
    const em = GROUP_EMOJI[g.group] || ["⭐", "⭐", "⭐", "⭐"];
    zp.append(h("button", { class: "zp-group", onClick: () => listSheet(g.group, g.items.map(([n, p]) => findItem(n, p))) },
      h("div", { class: "zp-name" }, g.group),
      h("div", { class: "zp-row" },
        ...em.map((e) => h("div", { class: "zp-bubble" }, h("span", {}, e), h("b", {}, "0"))),
        h("div", { class: "zp-more" }, `${g.items.length}`))));
  });
  wrap.append(zp);

  wrap.append(h("div", { class: "section-title" }, "Browse foods"));
  const grid = h("div", { class: "cat-grid" });
  foodCategories().forEach((c) => grid.append(h("button", { class: "cat-card", onClick: () => listSheet(c.name, foodsInCategory(c.name)) },
    h("span", { class: "cat-emoji" }, c.icon), h("span", { class: "cat-name" }, c.name), h("span", { class: "cat-count" }, String(c.count)))));
  wrap.append(grid);
  wrap.append(h("div", { style: { height: "40px" } }));
  return wrap;
}
