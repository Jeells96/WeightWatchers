// Food search + barcode lookup. A large built-in database (foods-db.js) powers
// instant, offline, high-quality results; Open Food Facts supplements it for
// branded/scanned products.
import { pointsFromNutrition, looksZeroPoint } from "./points.js";
import { CATEGORIES } from "./foods-db.js";

const OFF = "https://world.openfoodfacts.org";

function finalizeItem(it) {
  const zero = it.zero != null ? it.zero : looksZeroPoint(it.name);
  let pts = pointsFromNutrition(it.nutrition);
  if (pts == null) pts = 0;
  if (zero) pts = 0;
  return {
    id: it.id || cryptoId(),
    name: it.name,
    brand: it.brand || "",
    serving: it.serving || "1 serving",
    grams: it.grams || null,
    nutrition: it.nutrition || {},
    category: it.category || "",
    zero,
    points: pts,
  };
}

function cryptoId() {
  return "f_" + Math.random().toString(36).slice(2, 10);
}

// ---- Built-in database --------------------------------------------------
// Expand the compact tuples once into finalized items with computed Points.
const NUTR_KEYS = ["calories", "fat", "satFat", "carbs", "sugar", "protein", "fiber"];
const FOOD_DB = [];
const CATEGORY_INDEX = [];
for (const cat of CATEGORIES) {
  const items = [];
  for (const row of cat.items) {
    const [name, serving, grams, ...rest] = row;
    const zero = rest[7] ? 1 : 0;
    const vals = rest.slice(0, 7); // cal, fat, sat, carb, sugar, pro, fib
    const nutrition = {};
    NUTR_KEYS.forEach((k, i) => { if (vals[i] != null) nutrition[k] = vals[i]; });
    const item = finalizeItem({ id: "db_" + slugName(name), name, serving, grams, nutrition, zero, category: cat.name });
    FOOD_DB.push(item);
    items.push(item);
  }
  CATEGORY_INDEX.push({ name: cat.name, icon: cat.icon, items });
}

function slugName(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export function foodCategories() {
  return CATEGORY_INDEX.map((c) => ({ name: c.name, icon: c.icon, count: c.items.length }));
}
export function foodsInCategory(name) {
  const c = CATEGORY_INDEX.find((x) => x.name === name);
  return c ? c.items.slice() : [];
}

// Relevance-ranked search of the built-in database.
export function searchLocal(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qWords = q.split(/\s+/).filter(Boolean);
  const scored = [];
  for (const item of FOOD_DB) {
    const name = item.name.toLowerCase();
    let s = 0;
    if (name === q) s = 100;
    else if (name.startsWith(q)) s = 85;
    else if (name.split(/[^a-z0-9]+/).some((w) => w.startsWith(q))) s = 65;
    else if (name.includes(q)) s = 45;
    else if (qWords.length > 1 && qWords.every((w) => name.includes(w))) s = 35;
    if (s > 0) scored.push({ item, s });
  }
  scored.sort((a, b) => b.s - a.s || a.item.name.length - b.item.name.length);
  return scored.map((x) => x.item);
}

// Back-compat alias used elsewhere.
export const searchCommon = searchLocal;

// Parse an Open Food Facts product into our item shape.
function fromOFF(p) {
  if (!p) return null;
  const name = p.product_name || p.generic_name || "";
  if (!name) return null;
  const nutr = p.nutriments || {};
  const servingG = parseFloat(p.serving_quantity) || 100;
  const per100 = {
    calories: nutr["energy-kcal_100g"] ?? nutr["energy-kcal"] ?? null,
    fat: nutr["fat_100g"] ?? null,
    satFat: nutr["saturated-fat_100g"] ?? null,
    carbs: nutr["carbohydrates_100g"] ?? null,
    sugar: nutr["sugars_100g"] ?? null,
    addedSugar: nutr["added-sugars_100g"] ?? null,
    protein: nutr["proteins_100g"] ?? null,
    fiber: nutr["fiber_100g"] ?? null,
  };
  const f = servingG / 100;
  const nutrition = {};
  for (const k of Object.keys(per100)) {
    if (per100[k] != null) nutrition[k] = +(per100[k] * f).toFixed(1);
  }
  return finalizeItem({
    id: p.code ? "off_" + p.code : undefined,
    name,
    brand: (p.brands || "").split(",")[0] || "",
    serving: p.serving_size || `${Math.round(servingG)} g`,
    grams: Math.round(servingG),
    nutrition,
  });
}

export async function searchOpenFoodFacts(query, { signal } = {}) {
  const q = query.trim();
  if (!q) return [];
  const url =
    `${OFF}/api/v2/search?search_terms=${encodeURIComponent(q)}` +
    `&fields=code,product_name,generic_name,brands,serving_size,serving_quantity,nutriments` +
    `&sort_by=popularity_key&page_size=25`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("search failed");
  const data = await res.json();
  return (data.products || []).map(fromOFF).filter(Boolean);
}

export async function lookupBarcode(code) {
  const url = `${OFF}/api/v2/product/${encodeURIComponent(code)}.json` +
    `?fields=code,product_name,generic_name,brands,serving_size,serving_quantity,nutriments`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("lookup failed");
  const data = await res.json();
  if (data.status !== 1 && !data.product) return null;
  return fromOFF(data.product);
}

export { finalizeItem };
