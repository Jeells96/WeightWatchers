// Points calculation.
//
// WW's exact algorithm is proprietary and not published. This is a well-known
// nutrition-based approximation (the "SmartPoints"-style formula) that produces
// sensible, consistent values from calories, saturated fat, sugar and protein.
// It is tuned so everyday foods land close to familiar Points values.
//
// Points = round( 0.0305*cal + 0.275*satFat_g + 0.12*sugar_g - 0.098*protein_g )
// clamped at 0. ZeroPoint foods always return 0.

export function pointsFromNutrition(n = {}) {
  const cal = num(n.calories ?? n.cal ?? n.energyKcal);
  const satFat = num(n.satFat ?? n.saturatedFat);
  const sugar = num(n.sugar ?? n.sugars);
  const protein = num(n.protein);
  if (!cal && !satFat && !sugar && !protein) return null; // not enough info
  const raw = 0.0305 * cal + 0.275 * satFat + 0.12 * sugar - 0.098 * protein;
  return Math.max(0, Math.round(raw));
}

function num(v) {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : 0;
}

// Scale a per-100g nutrition object to a given gram weight.
export function scaleNutrition(per100g, grams) {
  const f = (num(grams) || 0) / 100;
  const out = {};
  for (const k of ["calories", "satFat", "sugar", "protein", "carbs", "fat", "fiber"]) {
    if (per100g[k] != null) out[k] = +(num(per100g[k]) * f).toFixed(1);
  }
  return out;
}

// Keywords that mark common ZeroPoint foods (non-starchy veg, most fruit,
// eggs, plain lean proteins, plain yogurt, beans, etc.). Used as a hint when
// adding a food; the user can always toggle it.
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
