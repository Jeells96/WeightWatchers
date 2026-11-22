// Food search + barcode lookup. A large built-in database (foods-db.js) powers
// instant, offline, high-quality results; Open Food Facts supplements it for
// branded/scanned products.
import { pointsFromNutrition, looksZeroPoint } from "./points.js";
import { CATEGORIES } from "./foods-db.js";
import { USDA_API_KEY } from "./config.js";

const OFF = "https://world.openfoodfacts.org";
const USDA = "https://api.nal.usda.gov/fdc/v1";
const LS_USDA = "ww_usda_key";

// The USDA key: a per-device override (set in Settings) takes priority,
// otherwise the one baked into config.js.
export function getUsdaKey() {
  try { return (localStorage.getItem(LS_USDA) || "").trim() || USDA_API_KEY; } catch { return USDA_API_KEY; }
}
export function setUsdaKey(k) {
  try { k && k.trim() ? localStorage.setItem(LS_USDA, k.trim()) : localStorage.removeItem(LS_USDA); } catch {}
}
export function usingDemoKey() { return getUsdaKey() === "DEMO_KEY"; }

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

// ---- USDA FoodData Central (big database, ~600k foods) ------------------
function usdaNutrient(food, number) {
  const arr = food.foodNutrients || [];
  const n = arr.find((x) => String(x.nutrientNumber ?? x.number ?? x.nutrient?.number) === number);
  if (!n) return null;
  const v = n.value ?? n.amount;
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : null;
}

function titleCaseIfYelling(s) {
  if (s && s === s.toUpperCase()) return s.toLowerCase().replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
  return s;
}

const BRAND_FIX = { mcdonalds: "McDonald's", "mcdonald's": "McDonald's", wendys: "Wendy's", "wendy's": "Wendy's",
  arbys: "Arby's", "arby's": "Arby's", dennys: "Denny's", "dominos": "Domino's", "domino's": "Domino's",
  kfc: "KFC", "chick-fil-a": "Chick-fil-A" };
function fixBrand(b) {
  const k = b.toLowerCase().trim();
  return BRAND_FIX[k] || k.replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
}
// "Cheeseburger (McDonalds)" / "McDONALD'S, Hamburger" / "Yogurt, Greek, CHOBANI" -> brand first
function niceName(desc) {
  const paren = desc.match(/^(.+?)\s*\(([A-Z][^)]{1,30})\)$/);
  if (paren && !/[0-9]/.test(paren[2]) && !/^(includes|with|made|from|NFS|NS)/i.test(paren[2])) {
    const brand = fixBrand(paren[2]); return { name: `${brand} ${paren[1]}`, brand };
  }
  const parts = desc.split(",");
  const shouty = (t) => { const l = t.replace(/[^A-Za-z]/g, ""); return l.length >= 3 && t.replace(/[^A-Z]/g, "").length / l.length > 0.75; };
  if (parts.length > 1 && shouty(parts[0])) {
    const brand = fixBrand(parts[0]); return { name: `${brand} ${parts.slice(1).join(",").trim()}`, brand };
  }
  if (parts.length > 1 && shouty(parts[parts.length - 1])) {
    const brand = fixBrand(parts[parts.length - 1]); return { name: `${brand} ${parts.slice(0, -1).join(",").trim()}`, brand };
  }
  return { name: titleCaseIfYelling(desc), brand: "" };
}

function fromUSDA(food) {
  const desc = (food.description || "").trim();
  if (!desc) return null;
  const per100 = {
    calories: usdaNutrient(food, "208"), fat: usdaNutrient(food, "204"), satFat: usdaNutrient(food, "606"),
    carbs: usdaNutrient(food, "205"), sugar: usdaNutrient(food, "269"), addedSugar: usdaNutrient(food, "539"),
    protein: usdaNutrient(food, "203"), fiber: usdaNutrient(food, "291"), sodium: usdaNutrient(food, "307"),
  };
  if (per100.calories == null && per100.fat == null && per100.carbs == null && per100.protein == null) return null;

  // Prefer a real portion ("1 cheeseburger" = 110 g, "1 cup, cooked" = 174 g),
  // then a branded label serving, and only fall back to 100 g.
  let grams = 100, servingLabel = "100 g", real = false;
  const measures = (food.foodMeasures || []).filter((m) => m.gramWeight > 0 && m.disseminationText);
  const m = measures.find((x) => !/quantity not specified/i.test(x.disseminationText)) || measures[0];
  const unit = (food.servingSizeUnit || "").toLowerCase();
  const hh = (food.householdServingFullText || "").trim();
  if (m) {
    grams = m.gramWeight; real = true;
    servingLabel = /quantity not specified/i.test(m.disseminationText) ? "1 serving"
      : m.disseminationText.replace(/\b(mcdonald'?s|burger king|wendy'?s|taco bell|subway|kfc|arby'?s)\s+/i, "");
  } else if (food.servingSize && ["g", "ml", "gram", "grm", "mlt"].includes(unit)) {
    grams = food.servingSize; real = true;
    servingLabel = hh && !/^none$/i.test(hh) ? hh.toLowerCase() : `${+food.servingSize} ${unit === "mlt" ? "ml" : unit}`;
  }
  const f = grams / 100;
  const nutrition = {};
  for (const k of Object.keys(per100)) if (per100[k] != null) nutrition[k] = +(per100[k] * f).toFixed(1);

  const { name, brand } = niceName(desc);
  const item = finalizeItem({
    id: "usda_" + food.fdcId, name,
    brand: brand || (food.brandName || food.brandOwner || "").trim(),
    serving: servingLabel, grams: Math.round(grams), nutrition,
  });
  item._real = real;
  return item;
}

export async function searchUSDA(query, { signal } = {}) {
  const q = query.trim();
  if (!q) return [];
  const dataTypes = encodeURIComponent("Survey (FNDDS),Foundation,SR Legacy,Branded");
  const url = `${USDA}/foods/search?api_key=${encodeURIComponent(getUsdaKey())}` +
    `&query=${encodeURIComponent(q)}&pageSize=40&dataType=${dataTypes}`;
  // USDA's gateway intermittently returns 400/429/5xx — retry before giving up.
  let res;
  for (let i = 0; i < 3; i++) {
    res = await fetch(url, { signal });
    if (res.ok) break;
    await new Promise((r) => setTimeout(r, 350 * (i + 1)));
  }
  if (!res.ok) throw new Error("usda " + res.status);
  const data = await res.json();
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const seen = new Set();
  // Exact brand/word matches first, then foods with real servings; no duplicates.
  return (data.foods || []).map(fromUSDA).filter(Boolean)
    .map((it, i) => ({ it, i, all: words.every((w) => (it.name + " " + it.brand).toLowerCase().includes(w)) ? 1 : 0 }))
    .sort((a, b) => (b.all - a.all) || (b.it._real - a.it._real) || a.i - b.i)
    .map((x) => x.it)
    .filter((it) => { const k = it.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

export { finalizeItem };
