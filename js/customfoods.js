// Foods people create from a nutrition label (e.g. restaurant menu items the
// free databases don't carry). Shared with everyone and searchable.
import { watchCustomFoods, writeCustomFood } from "./db.js";
import { state } from "./state.js";
import { pointsRaw } from "./points.js";
import { looksZeroPoint } from "./points.js";

const store = { foods: {}, unsub: null };

export function initCustomFoods() {
  if (store.unsub) { store.unsub(); store.unsub = null; }
  if (state.id === "__demo__") return;
  store.unsub = watchCustomFoods((d) => { store.foods = (d && d.foods) || {}; });
}

export function toItem(f) {
  const raw = pointsRaw(f.nutrition) ?? 0;
  const zero = looksZeroPoint(f.name) && raw < 0.5;
  return { id: f.id, name: f.name, brand: f.brand || "", serving: f.serving || "1 serving", grams: null,
    nutrition: f.nutrition || {}, zero, pointsRaw: zero ? 0 : raw, points: zero ? 0 : Math.max(0, Math.round(raw)), custom: true };
}

export function searchCustom(query) {
  const words = query.toLowerCase().replace(/[’']/g, "").split(/\s+/).filter(Boolean);
  return Object.values(store.foods)
    .filter((f) => { const t = (f.name + " " + (f.brand || "")).toLowerCase().replace(/[’']/g, ""); return words.every((w) => t.includes(w)); })
    .map(toItem);
}

export function saveCustomFood(f) {
  const id = "cf_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const food = { ...f, id, by: state.data?.name || "", at: Date.now() };
  store.foods[id] = food;
  if (state.id !== "__demo__") writeCustomFood(id, food).catch(() => {});
  return toItem(food);
}
