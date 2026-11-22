// Food tracking, modeled on the WW flow:
//   Track sheet  – "Lunch ⌄" + date, search pill, barcode button, tracked items,
//                  recents, browse, and search results (+ / protein / fiber / Points)
//   Track food   – Points circle (tap to correct), "How do Points work?",
//                  serving picker (whole · fraction · unit), insights, nutrition, Track
import { h, icon, sheet, toast, prettyDate } from "./ui.js";
import { searchLocal, searchOpenFoodFacts, searchUSDA, lookupBarcode, foodCategories, foodsInCategory } from "./foods.js";
import { state, mutate, dayLog, todayKey } from "./state.js";
import { pointsFor, calibratedEntry, saveCalibration, removeByKey, calKey } from "./calibrations.js";
import { pointsRaw } from "./points.js";
import { searchCustom, saveCustomFood } from "./customfoods.js";

const MEALS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snacks" },
];
const mealLabel = (k) => (MEALS.find((m) => m.key === k) || MEALS[0]).label;

// ---- Amounts & units --------------------------------------------------------
const FRACTIONS = [
  { label: "–", v: 0 }, { label: "⅛", v: 0.125 }, { label: "¼", v: 0.25 }, { label: "⅓", v: 1 / 3 },
  { label: "½", v: 0.5 }, { label: "⅔", v: 2 / 3 }, { label: "¾", v: 0.75 },
];
const NKEYS = ["calories", "fat", "satFat", "carbs", "sugar", "addedSugar", "protein", "fiber", "sodium"];

function split(a) {
  let whole = Math.floor(a + 1e-9), rest = a - whole, frac = 0, best = 9;
  FRACTIONS.forEach((f, i) => { const d = Math.abs(f.v - rest); if (d < best) { best = d; frac = i; } });
  if (rest > 0.875) { whole += 1; frac = 0; }
  return { whole, frac };
}
function fmtAmt(a) {
  const { whole, frac } = split(a);
  const f = frac ? FRACTIONS[frac].label : "";
  return !whole && f ? f : f ? `${whole} ${f}` : String(whole);
}
function parseServing(s) {
  const t = String(s || "").trim();
  const m = t.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)\s*(.*)$/);
  if (!m) return { qty: 1, unit: t || "serving" };
  let qty;
  const q = m[1];
  if (q.includes(" ")) { const [w, fr] = q.split(/\s+/); const [a, b] = fr.split("/"); qty = +w + a / b; }
  else if (q.includes("/")) { const [a, b] = q.split("/"); qty = a / b; }
  else qty = parseFloat(q);
  return { qty: qty > 0 ? qty : 1, unit: (m[2] || "").replace(/^[,\s]+/, "").trim() || "serving" };
}
function unitText(u) {
  if (/^[a-z]+$/i.test(u) && !["g", "oz", "lb", "tsp", "tbsp", "ml", "medium", "large", "small", "serving"].includes(u.toLowerCase())) return `${u}(s)`;
  return u;
}

// Picker model for a food: units with grams-per-unit, and the default amount.
function model(item) {
  if (item._model) return item._model;
  const s = parseServing(item.serving);
  const n = item.nutrition || {};
  let m;
  if (item.grams) {
    const per100 = {};
    for (const k of NKEYS) if (n[k] != null) per100[k] = n[k] * 100 / item.grams;
    const units = [{ unit: s.unit, grams: item.grams / s.qty }];
    for (const u of [{ unit: "g", grams: 1 }, { unit: "oz", grams: 28.35 }, { unit: "lb", grams: 453.6 }]) {
      if (!units.some((x) => x.unit.toLowerCase() === u.unit)) units.push(u);
    }
    m = { per100, units, defAmt: s.qty, defGrams: item.grams };
  } else {
    m = { per100: null, units: [{ unit: s.unit, grams: null }], defAmt: s.qty, defGrams: null };
  }
  Object.defineProperty(item, "_model", { value: m, enumerable: false });
  return m;
}
function calc(item, amount, unitIdx) {
  const m = model(item);
  const u = m.units[unitIdx];
  let nutrition = {}, factor;
  if (m.per100 && u.grams != null) {
    const g = amount * u.grams;
    for (const k of Object.keys(m.per100)) nutrition[k] = +(m.per100[k] * g / 100).toFixed(2);
    factor = g / m.defGrams;
  } else {
    factor = amount / (m.defAmt || 1);
    for (const k of Object.keys(item.nutrition || {})) nutrition[k] = +((item.nutrition[k] || 0) * factor).toFixed(2);
  }
  const points = pointsFor(item, factor, Object.keys(nutrition).length ? nutrition : null);
  const amt = Math.abs(amount * 8 - Math.round(amount * 8)) < 1e-6 ? fmtAmt(amount) : String(+amount.toFixed(2));
  return { nutrition, factor, points, label: `${amt} ${unitText(u.unit)}` };
}

// ---- Logging ----------------------------------------------------------------
function track(item, meal, dateKey, amount, unitIdx) {
  const r = calc(item, amount, unitIdx);
  const clean = { ...item };
  delete clean._real;
  mutate((d) => {
    dayLog(dateKey).meals[meal].push({
      id: item.id, name: item.name, brand: item.brand || "", serving: r.label,
      points: r.points, qty: 1, nutrition: r.nutrition, zero: !!item.zero, loggedAt: Date.now(), ref: clean,
    });
    d.recents = [clean, ...(d.recents || []).filter((x) => !(x.name === item.name && (x.brand || "") === (item.brand || "")))].slice(0, 30);
  });
  return r;
}

// ============================================================================
// Track sheet
// ============================================================================
export function openAddFood(defaultMeal = "breakfast", dateKey = todayKey(), opts = {}) {
  let meal = defaultMeal;
  let query = "";
  let token = 0;
  let browseCat = null;

  const titleBtn = h("button", { class: "tr-title" });
  const renderTitle = () => titleBtn.replaceChildren(h("span", {}, mealLabel(meal)), icon("chevronDown"));
  renderTitle();
  titleBtn.addEventListener("click", () => {
    const menu = h("div", { class: "meal-menu" }, ...MEALS.map((m) => h("button", {
      class: "mm-opt" + (m.key === meal ? " on" : ""),
      onClick: () => { meal = m.key; renderTitle(); menu.remove(); render(); },
    }, m.label)));
    head.append(menu);
    setTimeout(() => document.addEventListener("click", function off(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener("click", off); } }), 0);
  });

  let sh;
  const head = h("div", { class: "tr-head" },
    h("button", { class: "tr-icon", "aria-label": "Quick add", onClick: () => quickAdd() }, icon("plus")),
    h("div", { class: "tr-center" }, titleBtn, h("div", { class: "tr-date" }, prettyDate(dateKey) === "Today" ? `Today, ${shortDate(dateKey)}` : prettyDate(dateKey))),
    h("button", { class: "tr-icon", "aria-label": "Close", onClick: () => sh.close() }, icon("close")));

  const input = h("input", { class: "tr-input", type: "search", placeholder: "Search and track food", autocomplete: "off", autocorrect: "off", autocapitalize: "none" });
  const clearBtn = h("button", { class: "tr-clear", "aria-label": "Clear", onClick: () => { input.value = ""; query = ""; render(); input.focus(); } }, icon("close"));
  const searchRow = h("div", { class: "tr-search" },
    h("div", { class: "tr-pill" }, icon("search"), input, clearBtn),
    h("button", { class: "tr-circle", "aria-label": "Scan barcode", onClick: () => startScan() }, icon("barcode")));
  const results = h("div", { class: "tr-results" });
  const body = h("div", { class: "tr-body" }, searchRow, results);

  sh = sheet(null, body, { full: true, header: head });

  let t;
  input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { query = input.value.trim(); browseCat = null; render(); }, 260); });

  const ctx = { getMeal: () => meal, dateKey, onTracked: () => render() };
  render();
  if (opts.scan) setTimeout(() => startScan(), 300);
  else setTimeout(() => input.focus(), 350);
  return sh;

  function render() {
    clearBtn.style.visibility = input.value ? "visible" : "hidden";
    if (query) return renderSearch();
    const nodes = [];
    if (browseCat) {
      nodes.push(h("button", { class: "cat-back", onClick: () => { browseCat = null; render(); } }, icon("back"), "All categories"),
        h("div", { class: "tr-label" }, browseCat.toUpperCase()), ...foodsInCategory(browseCat).map((it) => row(it)));
      return results.replaceChildren(...nodes);
    }
    const logged = dayLog(dateKey).meals[meal] || [];
    if (logged.length) {
      nodes.push(h("div", { class: "tr-label" }, `TRACKED IN ${mealLabel(meal).toUpperCase()}`));
      logged.forEach((it, idx) => nodes.push(loggedRow(it, idx)));
    }
    const favs = state.data.favorites || [];
    if (favs.length) { nodes.push(h("div", { class: "tr-label" }, "FAVORITES")); favs.slice(0, 6).forEach((it) => nodes.push(row(it))); }
    const recents = state.data.recents || [];
    if (recents.length) { nodes.push(h("div", { class: "tr-label" }, "RECENTLY TRACKED")); recents.slice(0, 8).forEach((it) => nodes.push(row(it))); }
    if (!logged.length && !recents.length && !favs.length) nodes.push(emptyArt());
    nodes.push(h("div", { class: "tr-label" }, "BROWSE FOODS"));
    const grid = h("div", { class: "cat-grid" });
    foodCategories().forEach((c) => grid.append(h("button", { class: "cat-card", onClick: () => { browseCat = c.name; render(); } },
      h("span", { class: "cat-emoji" }, c.icon), h("span", { class: "cat-name" }, c.name), h("span", { class: "cat-count" }, String(c.count)))));
    nodes.push(grid);
    results.replaceChildren(...nodes);
  }

  async function renderSearch() {
    const my = ++token;
    const local = [...searchCustom(query), ...searchLocal(query)];
    const show = (remote, loading) => {
      const nodes = [h("div", { class: "tr-label" }, "SEARCH RESULTS")];
      local.slice(0, 12).forEach((it) => nodes.push(row(it)));
      if (remote) remote.forEach((it) => nodes.push(row(it)));
      if (loading) nodes.push(h("div", { class: "searching" }, h("span", { class: "mini-spin" }), "Searching more foods…"));
      if (!loading && !local.length && !(remote && remote.length)) nodes.push(h("div", { class: "empty" }, "No matches in the food databases."));
      if (!loading) nodes.push(h("button", { class: "create-row", onClick: () => createFood(query) }, icon("plus"),
        h("div", {}, h("div", { class: "cr-h" }, "Can't find it? Create it"), h("div", { class: "cr-p" }, "Copy the numbers from the restaurant's nutrition info — saved for everyone"))));
      results.replaceChildren(...nodes);
    };
    show(null, true);
    let remote = [];
    try { remote = await searchUSDA(query); } catch { try { remote = await searchOpenFoodFacts(query); } catch {} }
    if (my !== token) return;
    const seen = new Set(local.map((x) => x.name.toLowerCase()));
    show(remote.filter((x) => !seen.has(x.name.toLowerCase())), false);
  }

  function row(item) {
    const r = calc(item, model(item).defAmt, 0);
    const n = item.nutrition || {};
    const add = h("button", { class: "res-add", "aria-label": "Track " + item.name }, icon("plus"));
    add.addEventListener("click", (e) => {
      e.stopPropagation();
      track(item, meal, dateKey, model(item).defAmt, 0);
      add.classList.add("done"); add.replaceChildren(icon("check"));
      toast(`Tracked to ${mealLabel(meal)}`);
    });
    return h("div", { class: "res-row", onClick: () => openFoodDetail(item, ctx) },
      add,
      h("div", { class: "res-main" },
        h("div", { class: "res-name" }, item.name),
        h("div", { class: "res-sub" }, item.serving || r.label)),
      h("div", { class: "res-stats" },
        h("div", { class: "res-macros" },
          h("div", {}, icon("drumstick"), `${Math.round(n.protein || 0)}g`),
          h("div", {}, icon("fiber"), `${Math.round(n.fiber || 0)}g`)),
        h("div", { class: "res-pts" + (item.zero ? " zero" : "") + (calibratedEntry(item) ? " edited" : "") }, String(r.points))));
  }

  function loggedRow(it, idx) {
    const n = it.nutrition || {};
    const q = it.qty || 1;
    return h("div", { class: "res-row logged" },
      h("button", { class: "res-add del", "aria-label": "Remove", onClick: () => { mutate(() => dayLog(dateKey).meals[meal].splice(idx, 1)); render(); } }, icon("trash")),
      h("div", { class: "res-main" }, h("div", { class: "res-name" }, it.name), h("div", { class: "res-sub" }, it.serving || "")),
      h("div", { class: "res-stats" },
        h("div", { class: "res-macros" },
          h("div", {}, icon("drumstick"), `${Math.round((n.protein || 0) * q)}g`),
          h("div", {}, icon("fiber"), `${Math.round((n.fiber || 0) * q)}g`)),
        h("div", { class: "res-pts" + (it.points === 0 ? " zero" : "") }, String(Math.round((it.points || 0) * q)))));
  }

  function emptyArt() {
    return h("div", { class: "tr-empty" },
      h("div", { class: "art" },
        h("div", { class: "art-card a1" }, h("span", { class: "art-ico" }, icon("avocado")), h("i"), h("i", { class: "s" })),
        h("div", { class: "art-card a2" }, h("span", { class: "art-ico" }, icon("bowl")), h("i"), h("i", { class: "s" })),
        h("div", { class: "art-card a3" }, h("span", { class: "art-ico" }, icon("drumstick")), h("i"), h("i", { class: "s" }))),
      h("div", { class: "tr-empty-h" }, "Search for a food to get started"),
      h("div", { class: "tr-empty-p" }, "Be specific — like grilled chicken breast, Chobani yogurt, or McDonald's fries."));
  }

  function createFood(prefill = "") {
    const f = (ph, mode = "decimal") => h("input", { class: "f-input", type: mode === "text" ? "text" : "number", inputmode: mode, placeholder: ph });
    const name = f("Food name (e.g. 10 pc Boneless Wings)", "text"); name.value = prefill;
    const brand = f("Restaurant / brand (e.g. Wingstop)", "text");
    const serving = f("Serving (e.g. 1 order, 1 sandwich)", "text"); serving.value = "1 serving";
    const fields = [["calories", "Calories"], ["fat", "Total fat (g)"], ["satFat", "Saturated fat (g)"], ["sodium", "Sodium (mg)"],
      ["carbs", "Total carbs (g)"], ["fiber", "Fiber (g)"], ["sugar", "Total sugars (g)"], ["addedSugar", "Added sugars (g)"], ["protein", "Protein (g)"]];
    const inputs = {};
    const preview = h("div", { class: "cf-preview" });
    const read = () => { const n = {}; for (const [k] of fields) { const v = parseFloat(inputs[k].value); if (Number.isFinite(v)) n[k] = v; } return n; };
    const paint = () => { const r = pointsRaw(read()); preview.textContent = r == null ? "Enter the nutrition to see Points" : `${Math.max(0, Math.round(r))} Points per serving`; };
    const grid = h("div", { class: "cf-grid" }, ...fields.map(([k, label]) => {
      inputs[k] = f(label); inputs[k].addEventListener("input", paint);
      return h("label", { class: "cf-field" }, h("span", {}, label), inputs[k]);
    }));
    paint();
    let cs;
    const save = h("button", { class: "btn-primary big", onClick: () => {
      const n = read();
      if (!name.value.trim()) { toast("Enter a name"); return; }
      if (n.calories == null && n.fat == null && n.carbs == null) { toast("Enter at least calories, fat and carbs"); return; }
      const item = saveCustomFood({ name: name.value.trim(), brand: brand.value.trim(), serving: serving.value.trim() || "1 serving", nutrition: n });
      toast("Food saved"); cs.close();
      openFoodDetail(item, ctx);
    } }, "Save food");
    cs = sheet("Create food", h("div", { class: "pad cf" }, name, brand, serving,
      h("div", { class: "set-hint" }, "Numbers are per serving. Wingstop, Jimmy John's and most chains list these on their website under Nutrition."),
      grid, preview), { full: true, footer: save });
    setTimeout(() => (prefill ? brand : name).focus(), 300);
  }

  function quickAdd() {
    const name = h("input", { class: "f-input", placeholder: "Food name" });
    const pts = h("input", { class: "f-input", type: "number", inputmode: "numeric", min: "0", placeholder: "Points" });
    const pro = h("input", { class: "f-input", type: "number", inputmode: "decimal", placeholder: "Protein (g, optional)" });
    const fib = h("input", { class: "f-input", type: "number", inputmode: "decimal", placeholder: "Fiber (g, optional)" });
    let qs;
    const save = h("button", { class: "btn-primary big", onClick: () => {
      const p = parseInt(pts.value, 10);
      if (!name.value.trim() || !Number.isFinite(p)) { toast("Enter a name and Points"); return; }
      const item = { id: "q_" + Date.now(), name: name.value.trim(), brand: "", serving: "1 serving", grams: null,
        nutrition: { protein: parseFloat(pro.value) || 0, fiber: parseFloat(fib.value) || 0 }, zero: p === 0, points: p, pointsRaw: p };
      mutate((d) => {
        dayLog(dateKey).meals[meal].push({ id: item.id, name: item.name, brand: "", serving: "1 serving", points: p, qty: 1, nutrition: item.nutrition, loggedAt: Date.now(), ref: item });
        d.recents = [item, ...(d.recents || [])].slice(0, 30);
      });
      toast(`Tracked to ${mealLabel(meal)}`); qs.close(); render();
    } }, "Track");
    qs = sheet("Quick add", h("div", { class: "quickadd pad" }, name, pts, pro, fib), { footer: save });
    setTimeout(() => name.focus(), 300);
  }

  // ---- Barcode ----
  async function startScan() {
    const video = h("video", { class: "scan-video", playsinline: true, muted: true });
    const scanBody = h("div", { class: "scanwrap" }, video, h("div", { class: "scan-frame" }), h("div", { class: "scan-hint" }, "Point the camera at a barcode"));
    let controls = null;
    const sc = sheet("Scan barcode", scanBody, { full: true, onClose: () => { try { controls && controls.stop(); } catch {} } });
    try {
      const mod = await import("https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm");
      const reader = new mod.BrowserMultiFormatReader();
      controls = await reader.decodeFromVideoDevice(undefined, video, async (result) => {
        if (result) { try { controls.stop(); } catch {} sc.close(); await handleCode(result.getText()); }
      });
    } catch {
      scanBody.replaceChildren(h("div", { class: "empty" }, "Camera isn't available. Allow camera access in Settings, or search by name instead."));
    }
  }
  async function handleCode(code) {
    toast("Looking up barcode…");
    try {
      const item = await lookupBarcode(code);
      if (!item) { toast("Not found — try searching by name"); return; }
      openFoodDetail(item, ctx);
    } catch { toast("Lookup failed — check your connection"); }
  }
}

function shortDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ============================================================================
// Track food (detail)
// ============================================================================
export function openFoodDetail(item, ctx) {
  const m = model(item);
  let { whole, frac } = split(m.defAmt);
  let unitIdx = 0;
  let typed = null; // amount typed into the servings box overrides the picker
  const amount = () => (typed != null ? typed : whole + FRACTIONS[frac].v);
  let r = calc(item, amount(), unitIdx);

  const isFav = () => (state.data.favorites || []).some((f) => f.name === item.name && (f.brand || "") === (item.brand || ""));
  const favBtn = h("button", { class: "tr-icon" + (isFav() ? " on" : ""), "aria-label": "Save to favorites" }, icon("bookmark"));
  favBtn.addEventListener("click", () => {
    const was = isFav();
    mutate((d) => {
      const rest = (d.favorites || []).filter((f) => !(f.name === item.name && (f.brand || "") === (item.brand || "")));
      d.favorites = was ? rest : [{ ...item }, ...rest];
    });
    favBtn.classList.toggle("on", !was);
    toast(was ? "Removed from favorites" : "Saved to favorites");
  });

  let sh;
  const head = h("div", { class: "tr-head" }, favBtn, h("div", { class: "tr-center" }, h("div", { class: "td-title" }, "Track food")),
    h("button", { class: "tr-icon", "aria-label": "Close", onClick: () => sh.close() }, icon("close")));

  const ptsCircle = h("button", { class: "td-pts", "aria-label": "Correct Points" });
  const servVal = h("div", { class: "sv-val" });
  const picker = h("div", { class: "picker" });
  const servBox = h("div", { class: "serv-box" });
  const servInput = h("input", { class: "sv-input", type: "text", inputmode: "decimal", "aria-label": "Number of servings" });
  servInput.addEventListener("input", () => {
    const v = parseFloat(servInput.value.replace(",", "."));
    if (Number.isFinite(v) && v >= 0) { typed = v; update(); }
  });
  servInput.addEventListener("focus", () => servInput.select());
  const unitBtn = h("button", { class: "sv-unit" });
  unitBtn.addEventListener("click", () => servBox.classList.toggle("open"));
  const servRow = h("div", { class: "sv-row" }, h("div", {}, "Servings"), h("div", { class: "sv-right" }, servInput, unitBtn));
  servBox.append(servRow, picker);

  const insights = h("div");
  const table = h("div");
  const howBody = h("div", { class: "how-body" });
  const how = h("div", { class: "how" },
    h("button", { class: "how-btn", onClick: () => how.classList.toggle("open") }, "How do Points work?", icon("chevronDown")),
    howBody);

  const mealLine = h("button", { class: "td-meal" });
  const renderMeal = () => mealLine.replaceChildren(`Tracking to ${mealLabel(ctx.getMeal())} · ${prettyDate(ctx.dateKey)}`);

  const body = h("div", { class: "td-body" },
    h("div", { class: "td-top" },
      h("div", {}, h("div", { class: "td-name" }, item.name), item.brand && !item.name.startsWith(item.brand) ? h("div", { class: "td-brand" }, item.brand) : null),
      ptsCircle),
    mealLine, how, servBox, insights, table);
  const trackBtn = h("button", { class: "btn-track", onClick: () => {
    track(item, ctx.getMeal(), ctx.dateKey, amount(), unitIdx);
    toast(`Tracked to ${mealLabel(ctx.getMeal())}`);
    sh.close(); ctx.onTracked && ctx.onTracked();
  } }, "Track");

  sh = sheet(null, body, { full: true, header: head, footer: trackBtn });
  ptsCircle.addEventListener("click", correct);
  buildPicker();
  update();

  function update() {
    r = calc(item, amount(), unitIdx);
    ptsCircle.textContent = String(r.points);
    ptsCircle.classList.toggle("edited", !!calibratedEntry(item));
    if (document.activeElement !== servInput) servInput.value = String(+amount().toFixed(2));
    unitBtn.replaceChildren(unitText(m.units[unitIdx].unit), icon("chevronDown"));
    renderMeal();
    const e = calibratedEntry(item);
    howBody.replaceChildren(
      h("p", {}, "Points add up the calories, saturated fat, sugar and added sugar in a food, and give credit for protein and fiber. ZeroPoint foods don't count against your budget."),
      item.zero ? h("p", { class: "how-zero" }, "⭐ This is a ZeroPoint food.") : null,
      h("p", {}, e ? `Corrected to match WW${e.by ? " by " + e.by : ""}. Calculated value: ${Math.round((item.pointsRaw ?? item.points ?? 0) * r.factor)}.` : "Number doesn't match the WW app? Tap the Points circle to correct it — everyone's corrections are shared."),
      e ? h("button", { class: "link-btn", onClick: () => { removeByKey(calKey(item)); update(); } }, "Reset to calculated") : null);

    const n = r.nutrition;
    const chips = [];
    if ((n.protein || 0) >= 10) chips.push(["drumstick", "Higher source of protein"]);
    if ((n.fiber || 0) >= 5) chips.push(["fiber", "Good source of fiber"]);
    if ((n.sodium || 0) >= 600) chips.push(["salt", "Higher in sodium"]);
    if ((n.addedSugar || 0) >= 10 || (n.sugar || 0) >= 20) chips.push(["flame", "Higher in sugar"]);
    if ((n.satFat || 0) >= 5) chips.push(["avocado", "Higher in saturated fat"]);
    insights.replaceChildren(...(chips.length ? [h("div", { class: "box" },
      h("div", { class: "box-h" }, "Nutritional Insights"),
      h("div", { class: "chips" }, ...chips.map(([ic, t]) => h("div", { class: "chip" }, icon(ic), t))))] : []));

    const has = Object.keys(n).length > 0;
    const v = (x, u = "g") => (x == null ? "–" : `${x >= 10 || x === 0 ? Math.round(x) : +x.toFixed(1)}${u ? " " + u : ""}`);
    const rowN = (label, val, cls = "") => h("div", { class: "nt-row " + cls }, h("span", {}, label), h("span", {}, val));
    table.replaceChildren(...(has ? [h("div", { class: "box" },
      h("div", { class: "box-h" }, "Nutritional Information"),
      rowN("Calories", n.calories == null ? "–" : String(Math.round(n.calories))),
      rowN("Fat", v(n.fat)), rowN("Saturated Fat", v(n.satFat), "sub"),
      rowN("Sodium", v(n.sodium, "mg")),
      rowN("Carbohydrates", v(n.carbs)), rowN("Fiber", v(n.fiber), "sub"), rowN("Total Sugars", v(n.sugar), "sub"), rowN("Added Sugar", v(n.addedSugar), "sub2"),
      rowN("Protein", v(n.protein)))] : []));
  }

  function buildPicker() {
    const max = m.units[unitIdx]?.grams === 1 ? 1000 : 50;
    const wholes = Array.from({ length: max + 1 }, (_, i) => String(i));
    picker.replaceChildren(
      wheel(wholes, whole, (i) => { typed = null; whole = i; update(); }),
      wheel(FRACTIONS.map((f) => f.label), frac, (i) => { typed = null; frac = i; update(); }),
      wheel(m.units.map((u) => unitText(u.unit)), unitIdx, (i) => {
        if (i === unitIdx) return;
        // keep the same amount of food when switching units
        const from = m.units[unitIdx], to = m.units[i];
        if (from.grams && to.grams) { const conv = (amount() * from.grams) / to.grams; const s2 = split(conv); whole = s2.whole; frac = s2.frac; typed = +conv.toFixed(2); }
        unitIdx = i; buildPicker(); update();
      }, true));
  }

  function correct() {
    const inp = h("input", { class: "f-input big-input", type: "number", inputmode: "numeric", min: "0", value: String(r.points) });
    let cs;
    const save = h("button", { class: "btn-primary big", onClick: () => {
      const val = parseFloat(inp.value);
      if (!Number.isFinite(val) || val < 0) { toast("Enter a number"); return; }
      saveCalibration(item, val / (r.factor || 1), false);
      toast("Points corrected"); cs.close(); update();
    } }, "Save");
    cs = sheet("Correct Points", h("div", { class: "pad" },
      h("p", { class: "setup-p" }, `What does the WW app say ${r.label} of ${item.name} is? Your correction is saved for everyone and scales with the amount.`), inp), { footer: save });
    setTimeout(() => { inp.focus(); inp.select(); }, 300);
  }
}

// Scroll-snap wheel column (iOS picker style).
function wheel(labels, selected, onChange, wide = false) {
  const ITEM = 40;
  const col = h("div", { class: "wheel" + (wide ? " wide" : "") });
  col.append(h("div", { class: "wheel-pad" }), ...labels.map((l) => h("div", { class: "wheel-item" }, l)), h("div", { class: "wheel-pad" }));
  const mark = (i) => [...col.querySelectorAll(".wheel-item")].forEach((el, k) => el.classList.toggle("on", k === i));
  let cur = selected, tm;
  requestAnimationFrame(() => { col.scrollTop = selected * ITEM; mark(selected); });
  col.addEventListener("scroll", () => {
    const i = Math.max(0, Math.min(labels.length - 1, Math.round(col.scrollTop / ITEM)));
    mark(i);
    clearTimeout(tm);
    tm = setTimeout(() => { if (i !== cur) { cur = i; onChange(i); } }, 120);
  });
  col.addEventListener("click", (e) => {
    const items = [...col.querySelectorAll(".wheel-item")];
    const k = items.indexOf(e.target);
    if (k >= 0) col.scrollTo({ top: k * ITEM, behavior: "smooth" });
  });
  return col;
}

export function toggle(on, cb) {
  const el = h("button", { class: "switch" + (on ? " on" : ""), type: "button" }, h("span", { class: "knob" }));
  el.addEventListener("click", () => { on = !on; el.classList.toggle("on", on); cb(on); });
  return el;
}
