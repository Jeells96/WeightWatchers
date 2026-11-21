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

// Keywords that mark common ZeroPoint foods (non-starchy veg, most fruit,
// eggs, plain lean proteins, plain yogurt, beans, etc.).
const ZERO_HINTS = [
  "apple", "banana", "orange", "strawberr", "blueberr", "raspberr", "grape",
  "melon", "watermelon", "peach", "pear", "pineapple", "mango", "kiwi",
  "broccoli", "spinach", "lettuce", "kale", "carrot", "cucumber", "tomato",
  "pepper", "zucchini", "cauliflower", "green bean", "asparagus", "celery",
  "onion", "mushroom", "egg", "chicken breast", "turkey breast", "white fish",
  "cod", "tilapia", "shrimp", "tuna in water", "plain nonfat yogurt",
  "plain greek yogurt", "black bean", "chickpea", "lentil", "tofu",
];

export function looksZeroPoint(name = "") {
  const t = name.toLowerCase();
  return ZERO_HINTS.some((h) => t.includes(h));
}
