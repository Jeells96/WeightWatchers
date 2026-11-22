// Points calculation.
//
// WW's exact algorithm is proprietary and unpublished. This is an independent
// approximation of the current "Points" program, built from a community
// reverse-engineering of the per-nutrient weights (fat, saturated fat, carbs,
// sugar, added sugar, protein lower the cost per calorie, and fiber reduces
// points). It will land close to familiar values but won't match WW to the
// exact point on every food. ZeroPoint foods always return 0.
//
// points = fat/3 + satFat/3 + carbs/7 + sugar/29 + addedSugar/8 + protein/19 - fiber/3

// Grams per 1 point for each nutrient (so coefficient = 1 / gramsPerPoint).
const PER_POINT = {
  fat: 3,
  satFat: 3,        // in addition to total fat
  carbs: 7,
  sugar: 29,        // in addition to carbs
  addedSugar: 8,    // in addition to sugar
  protein: 19,
  fiber: 3,         // subtracts
};

function num(v) {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : 0;
}

export function pointsFromNutrition(n = {}) {
  const fat = num(n.fat);
  const carbs = num(n.carbs);
  const haveMacros = n.fat != null || n.carbs != null;

  if (haveMacros) {
    const raw =
      fat / PER_POINT.fat +
      num(n.satFat ?? n.saturatedFat) / PER_POINT.satFat +
      carbs / PER_POINT.carbs +
      num(n.sugar ?? n.sugars) / PER_POINT.sugar +
      num(n.addedSugar ?? n.addedSugars) / PER_POINT.addedSugar +
      num(n.protein) / PER_POINT.protein -
      num(n.fiber) / PER_POINT.fiber;
    return Math.max(0, Math.round(raw));
  }

  // Fallback when only calories (+ maybe a couple of fields) are known:
  // the older SmartPoints-style estimate so we still return something sane.
  const cal = num(n.calories ?? n.cal ?? n.energyKcal);
  if (!cal) return null;
  const raw =
    0.0305 * cal +
    0.275 * num(n.satFat ?? n.saturatedFat) +
    0.12 * num(n.sugar ?? n.sugars) -
    0.098 * num(n.protein);
  return Math.max(0, Math.round(raw));
}

// Scale a per-100g nutrition object to a given gram weight.
export function scaleNutrition(per100g, grams) {
  const f = (num(grams) || 0) / 100;
  const out = {};
  for (const k of ["calories", "fat", "satFat", "carbs", "sugar", "addedSugar", "protein", "fiber"]) {
    if (per100g[k] != null) out[k] = +(num(per100g[k]) * f).toFixed(1);
  }
  return out;
}

// ---- ZeroPoint detection ---------------------------------------------------
// Driven by the household's ZeroPoint list (zeropoint-list.js). A food counts
// as ZeroPoint when its name contains all the key words of a list entry
// (e.g. USDA "Beef, flank, steak, separable lean only" matches "Beef, flank
// steak, lean, trimmed"), unless it's been turned into something that costs
// Points (fried, breaded, in oil, sweetened, in a sauce, baked into a pie…).
import { ZERO_POINT_LIST } from "./zeropoint-list.js";

// Descriptors that don't change whether it's ZeroPoint.
const DROP = new Set(["lean", "trimmed", "plain", "fresh", "skinless", "edible", "portion", "item", "items",
  "large", "small", "medium", "meat", "the", "on", "of", "or", "and", "all", "types", "eg", "in", "no",
  "style", "raw", "cooked", "cubed", "quartered", "drained", "packed", "roast", "steak", "chop", "chops"]);
// Not stripped from "beef, top round steak" etc. would be too strict, so
// "steak/roast/chop" are dropped and the cut name (round, sirloin, loin…) carries it.

// Things that turn a ZeroPoint food into one that costs Points. Ignored when
// the list entry itself contains the word (e.g. "Fruit cocktail", "Fruit salad",
// "Split peas", "Turkey, canned in water").
const EXCLUDE = ["fried", "breaded", "battered", "nugget", "chip", "fries", "crisp", "crispy", "juice", "pie",
  "cake", "cookie", "candy", "sweetened", "syrup", "butter", "buttered", "cream", "creamed", "bread", "muffin",
  "bar", "dried", "jam", "jelly", "dressing", "sauce", "gravy", "oil", "chocolate", "caramel", "kettle",
  "glazed", "sandwich", "burrito", "pizza", "soup", "smoothie", "mashed", "gratin", "scalloped", "hash",
  "tot", "fudge", "flavored", "vanilla", "honey", "maple", "granola", "cereal", "pancake", "waffle", "noodle",
  "pasta", "pudding", "flake", "tortilla", "starch", "dog", "roll", "ring", "sausage", "bacon", "jerky",
  "salami", "nectar", "drink", "cocktail", "salad", "teriyaki", "bbq", "barbecue", "stuffed", "casserole",
  "dip", "spread", "cobbler", "crumble", "tart", "alfredo", "parmesan", "cheese", "split", "latte", "spice",
  "sesame", "batter", "wrap", "taco", "nacho", "quesadilla", "loaf", "patty", "burger", "pot pie", "bowl"];
const EXCLUDE_PHRASES = ["with skin", "skin on", "orange chicken", "lemon chicken", "general tso", "sweet and sour"];

function stem(w) {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && /(ch|sh|x|ss)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("oes")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}
function tokens(text) {
  return String(text).toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/e\.g\..*$/, " ")
    .replace(/no oil/g, " ")
    .replace(/(\d{2})\s*\/\s*\d{1,2}/g, "$1%")       // "90/10" -> "90%"
    .replace(/fat[- ]free/g, "fatfree")
    .split(/[^a-z0-9%]+/).filter(Boolean).map(stem);
}

const RULES = [];
for (const g of ZERO_POINT_LIST) for (const [full] of g.items) {
  for (const name of full.split("/")) {
    // "baked or broiled" -> either word is enough
    const anyOf = [];
    const cleaned = name.replace(/\(.*?\)/g, " ").replace(/([a-z]+) or ([a-z]+)/gi, (m, a, b) => {
      anyOf.push([stem(a.toLowerCase()), stem(b.toLowerCase())]); return " ";
    });
    const req = tokens(cleaned).filter((w) => !DROP.has(w));
    if (req.length) RULES.push({ req, anyOf, all: new Set(tokens(full)) });
  }
}

export function looksZeroPoint(name = "") {
  const lower = String(name).toLowerCase();
  // Yogurt / cottage cheese: only plain & nonfat are ZeroPoint.
  if (lower.includes("yogurt")) return lower.includes("plain") && !/(vanilla|honey|fruit|berry|sweetened)/.test(lower.replace("unsweetened", ""))
    && (/(nonfat|non-fat|fat free|fat-free|0%)/.test(lower) || /\bsoy\b/.test(lower) || (/almond/.test(lower) && lower.includes("unsweetened")));
  if (lower.includes("cottage cheese")) return /(nonfat|non-fat|fat free|fat-free)/.test(lower) && !/(fruit|pineapple|peach|berry)/.test(lower);
  const words = tokens(lower);
  const set = new Set(words);
  const phraseHit = EXCLUDE_PHRASES.some((p) => lower.includes(p));
  for (const r of RULES) {
    if (!r.req.every((w) => set.has(w))) continue;
    if (r.anyOf.length && !r.anyOf.every((alts) => alts.some((w) => set.has(w)))) continue;
    if (phraseHit && !EXCLUDE_PHRASES.some((p) => [...r.all].join(" ").includes(p))) continue;
    const blocked = EXCLUDE.some((x) => { const sx = stem(x); return set.has(sx) && !r.all.has(sx); });
    if (!blocked) return true;
  }
  return false;
}
