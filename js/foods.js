// Food search + barcode lookup via Open Food Facts (free, no key, CORS-enabled),
// plus a small built-in list of common foods for instant results offline.
import { pointsFromNutrition, looksZeroPoint } from "./points.js";

const OFF = "https://world.openfoodfacts.org";

// A tiny starter list so search feels instant and works without a connection.
// Values are per listed serving.
const COMMON = [
  { name: "Banana", brand: "", serving: "1 medium", grams: 118, nutrition: { calories: 105, satFat: 0.1, sugar: 14, protein: 1.3 } },
  { name: "Apple", brand: "", serving: "1 medium", grams: 182, nutrition: { calories: 95, satFat: 0, sugar: 19, protein: 0.5 } },
  { name: "Egg, large", brand: "", serving: "1 egg", grams: 50, nutrition: { calories: 72, satFat: 1.6, sugar: 0.2, protein: 6.3 } },
  { name: "Chicken breast, grilled", brand: "", serving: "4 oz", grams: 112, nutrition: { calories: 187, satFat: 1.1, sugar: 0, protein: 35 } },
  { name: "White rice, cooked", brand: "", serving: "1 cup", grams: 158, nutrition: { calories: 205, satFat: 0.1, sugar: 0.1, protein: 4.3 } },
  { name: "Whole milk", brand: "", serving: "1 cup", grams: 244, nutrition: { calories: 149, satFat: 4.6, sugar: 12, protein: 7.7 } },
  { name: "Plain nonfat Greek yogurt", brand: "", serving: "170 g", grams: 170, nutrition: { calories: 100, satFat: 0, sugar: 6, protein: 17 } },
  { name: "Avocado", brand: "", serving: "1/2 fruit", grams: 68, nutrition: { calories: 114, satFat: 1.5, sugar: 0.2, protein: 1.3 } },
  { name: "Peanut butter", brand: "", serving: "2 tbsp", grams: 32, nutrition: { calories: 188, satFat: 3.3, sugar: 3, protein: 8 } },
  { name: "Oatmeal, cooked", brand: "", serving: "1 cup", grams: 234, nutrition: { calories: 166, satFat: 0.6, sugar: 1, protein: 6 } },
  { name: "Cheddar cheese", brand: "", serving: "1 oz", grams: 28, nutrition: { calories: 115, satFat: 6, sugar: 0.1, protein: 7 } },
  { name: "Slice of bread, whole wheat", brand: "", serving: "1 slice", grams: 28, nutrition: { calories: 80, satFat: 0.2, sugar: 1.6, protein: 4 } },
  { name: "Coffee, black", brand: "", serving: "1 cup", grams: 240, nutrition: { calories: 2, satFat: 0, sugar: 0, protein: 0.3 } },
  { name: "Olive oil", brand: "", serving: "1 tbsp", grams: 14, nutrition: { calories: 119, satFat: 1.9, sugar: 0, protein: 0 } },
  { name: "Broccoli, steamed", brand: "", serving: "1 cup", grams: 156, nutrition: { calories: 55, satFat: 0, sugar: 2, protein: 3.7 } },
];

function finalizeItem(it) {
  const zero = looksZeroPoint(it.name);
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
    zero,
    points: pts,
  };
}

function cryptoId() {
  return "f_" + Math.random().toString(36).slice(2, 10);
}

export function searchCommon(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return COMMON.filter((f) => f.name.toLowerCase().includes(q)).map(finalizeItem);
}

// Parse an Open Food Facts product into our item shape.
function fromOFF(p) {
  if (!p) return null;
  const name = p.product_name || p.generic_name || "";
  if (!name) return null;
  const nutr = p.nutriments || {};
  const servingG = parseFloat(p.serving_quantity) || 100;
  const per100 = {
    calories: nutr["energy-kcal_100g"] ?? nutr["energy-kcal"] ?? null,
    satFat: nutr["saturated-fat_100g"] ?? null,
    sugar: nutr["sugars_100g"] ?? null,
    protein: nutr["proteins_100g"] ?? null,
    carbs: nutr["carbohydrates_100g"] ?? null,
    fat: nutr["fat_100g"] ?? null,
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
