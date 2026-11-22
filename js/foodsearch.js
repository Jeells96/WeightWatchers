// The add-food experience: search + barcode + serving adjustment, shared by
// the My Day screen and the Food tab.
import { h, icon, sheet, toast, fmt } from "./ui.js";
import { searchLocal, searchOpenFoodFacts, searchUSDA, lookupBarcode, finalizeItem, foodCategories, foodsInCategory } from "./foods.js";
import { pointsFromNutrition } from "./points.js";
import { state, mutate, dayLog, todayKey } from "./state.js";
import { effectivePoints, calibratedEntry, saveCalibration, removeByKey, calKey, biasValue } from "./calibrations.js";

const MEALS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snacks" },
];

export function openAddFood(defaultMeal = "breakfast", dateKey = todayKey(), opts = {}) {
  let meal = defaultMeal;
  const body = h("div", { class: "addfood" });

  const mealRow = h("div", { class: "seg" },
    ...MEALS.map((m) =>
      h("button", {
        class: "seg-btn" + (m.key === meal ? " on" : ""),
        onClick: (e) => {
          meal = m.key;
          body.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("on"));
          e.currentTarget.classList.add("on");
        },
      }, m.label)));

  const input = h("input", {
    class: "search-input", type: "search", placeholder: "Search foods…",
    autocomplete: "off", autocorrect: "off", autocapitalize: "none",
  });
  const scanBtn = h("button", { class: "scan-btn", onClick: () => startScan() }, icon("barcode"), "Scan");
  const searchRow = h("div", { class: "search-row" },
    h("div", { class: "search-field" }, icon("search", "search-ico"), input), scanBtn);

  const tabs = h("div", { class: "pill-tabs" });
  const results = h("div", { class: "results" });

  const TABS = [
    { key: "search", label: "Search" },
    { key: "recents", label: "Recent" },
    { key: "favorites", label: "Favorites" },
    { key: "quick", label: "Quick add" },
  ];
  let active = "search";
  function renderTabs() {
    tabs.replaceChildren(...TABS.map((t) =>
      h("button", { class: "pill" + (t.key === active ? " on" : ""), onClick: () => { active = t.key; renderTabs(); runTab(); } }, t.label)));
  }

  function runTab() {
    if (active === "recents") showList(state.data.recents || [], "No recent foods yet.");
    else if (active === "favorites") showList(state.data.favorites || [], "Tap the star on any food to save it here.");
    else if (active === "quick") showQuickAdd();
    else doSearch(input.value);
  }

  function showList(items, empty) {
    results.replaceChildren();
    if (!items.length) { results.append(emptyState(empty)); return; }
    items.forEach((it) => results.append(foodRow(it)));
  }

  function emptyState(msg) { return h("div", { class: "empty" }, msg); }

  let searchToken = 0;
  async function doSearch(q) {
    const query = q.trim();
    if (!query) { showBrowse(); return; }
    const token = ++searchToken;
    // Instant local results first.
    const local = searchLocal(query);
    const header = (label) => h("div", { class: "results-group" }, label);
    const render = (localItems, remoteItems, searching) => {
      const nodes = [];
      if (localItems.length) { nodes.push(header("Common foods")); localItems.forEach((it) => nodes.push(foodRow(it))); }
      if (searching) nodes.push(h("div", { class: "searching" }, h("span", { class: "mini-spin" }), "Searching the food database…"));
      else if (remoteItems && remoteItems.length) { nodes.push(header("All foods")); remoteItems.forEach((it) => nodes.push(foodRow(it))); }
      if (!localItems.length && !searching && (!remoteItems || !remoteItems.length)) {
        nodes.push(emptyState("No matches. Scan the barcode, or use Quick add to enter points yourself."));
      }
      results.replaceChildren(...nodes);
    };
    render(local, null, true);
    // Comprehensive database: USDA first (huge, generic + branded), then
    // fall back to Open Food Facts if USDA is unavailable or empty.
    let remote = [];
    try {
      remote = await searchUSDA(query);
    } catch {
      try { remote = await searchOpenFoodFacts(query); } catch { remote = []; }
    }
    if (token !== searchToken) return;
    if (!remote.length) { try { remote = await searchOpenFoodFacts(query); } catch {} }
    if (token !== searchToken) return;
    const seen = new Set(local.map((x) => x.name.toLowerCase()));
    const filtered = remote.filter((x) => !seen.has(x.name.toLowerCase()));
    render(local, filtered, false);
  }

  // Browse-by-category when the search box is empty.
  function showBrowse() {
    const nodes = [];
    const recents = state.data.recents || [];
    if (recents.length) {
      nodes.push(h("div", { class: "results-group" }, "Recent"));
      recents.slice(0, 5).forEach((it) => nodes.push(foodRow(it)));
    }
    nodes.push(h("div", { class: "results-group" }, "Browse foods"));
    const grid = h("div", { class: "cat-grid" });
    foodCategories().forEach((c) => grid.append(
      h("button", { class: "cat-card", onClick: () => openCategory(c.name) },
        h("span", { class: "cat-emoji" }, c.icon),
        h("span", { class: "cat-name" }, c.name),
        h("span", { class: "cat-count" }, `${c.count}`))));
    nodes.push(grid);
    results.replaceChildren(...nodes);
  }

  function openCategory(name) {
    const items = foodsInCategory(name);
    const nodes = [h("button", { class: "cat-back", onClick: () => showBrowse() }, icon("back"), "All categories"),
      h("div", { class: "results-group" }, name)];
    items.forEach((it) => nodes.push(foodRow(it)));
    results.replaceChildren(...nodes);
  }

  function foodRow(item) {
    const pts = effectivePoints(item);
    const edited = calibratedEntry(item) != null;
    return h("button", { class: "food-row", onClick: () => openDetail(item) },
      h("div", { class: "food-main" },
        h("div", { class: "food-name" }, item.name),
        h("div", { class: "food-sub" }, [item.brand, item.serving].filter(Boolean).join(" · "))),
      h("div", { class: "food-right" },
        h("div", { class: "pts-badge" + (item.zero ? " zero" : "") + (edited ? " edited" : "") }, String(pts)),
        h("div", { class: "pts-word" }, edited ? "edited" : "Points")));
  }

  function showQuickAdd() {
    results.replaceChildren();
    const name = h("input", { class: "f-input", placeholder: "Food name" });
    const pts = h("input", { class: "f-input", type: "number", inputmode: "numeric", min: "0", placeholder: "Points" });
    results.append(h("div", { class: "quickadd" },
      h("label", { class: "f-label" }, "Name"), name,
      h("label", { class: "f-label" }, "Points"), pts,
      h("button", {
        class: "btn-primary", onClick: () => {
          const p = parseInt(pts.value, 10);
          if (!name.value.trim() || !Number.isFinite(p)) { toast("Enter a name and points"); return; }
          addToLog(finalizeItem({ name: name.value.trim(), serving: "1 serving", nutrition: {} }), 1, p);
        },
      }, "Add to " + MEALS.find((m) => m.key === meal).label)));
  }

  function openDetail(item) {
    let qty = 1;
    let zero = item.zero;
    const n = item.nutrition || {};
    const calculated = () => (item.points ?? pointsFromNutrition(n) ?? 0);
    const hasEntry = () => calibratedEntry(item) != null;
    // Per-serving points: exact correction if one exists, else calculated + the
    // shared adjustment (so new foods benefit from everyone's corrections).
    const perServing = () => {
      if (zero) return 0;
      const e = calibratedEntry(item);
      if (e) return e.entered;
      return Math.max(0, Math.round(calculated() + biasValue()));
    };

    const ptsEl = h("div", { class: "detail-pts" });
    function recompute() {
      ptsEl.replaceChildren(
        h("div", { class: "detail-pts-num" }, String(Math.round(perServing() * qty))),
        h("div", { class: "detail-pts-lbl" }, "Points"));
    }
    const qtyEl = h("div", { class: "qty-val" }, "1");
    const stepper = h("div", { class: "stepper" },
      h("button", { class: "step", onClick: () => { qty = Math.max(0.5, +(qty - 0.5).toFixed(1)); qtyEl.textContent = qty; recompute(); } }, "–"),
      qtyEl,
      h("button", { class: "step", onClick: () => { qty = +(qty + 0.5).toFixed(1); qtyEl.textContent = qty; recompute(); } }, "+"));

    // Editable Points value (per serving) — saved to the shared pool so it
    // matches next time, for everyone.
    const ptsField = h("input", { class: "pts-edit-input", type: "number", inputmode: "numeric", min: "0", value: String(perServing()) });
    const ptsStatus = h("div", { class: "pts-edit-status" });
    function refreshStatus() {
      ptsField.value = String(perServing());
      const e = calibratedEntry(item);
      ptsStatus.replaceChildren(
        e != null
          ? h("span", { class: "edited-tag" }, `Corrected · calculated ${calculated()}` + (e.by ? ` · by ${e.by}` : ""))
          : h("span", {}, `Auto-calculated${zero ? " · ZeroPoint" : ""}`),
        e != null ? h("button", { class: "link-btn", onClick: () => { removeByKey(calKey(item)); refreshStatus(); recompute(); } }, "Reset") : null);
    }
    const editRow = h("div", { class: "pts-edit" },
      h("div", { class: "pts-edit-top" },
        h("div", { class: "pts-edit-label" }, "Points per serving"),
        ptsField),
      ptsStatus);
    ptsField.addEventListener("change", () => {
      const v = parseInt(ptsField.value, 10);
      if (!Number.isFinite(v) || v < 0) { refreshStatus(); return; }
      if (v === calculated() && !zero) { removeByKey(calKey(item)); }
      else { if (zero) zero = false; saveCalibration(item, v, zero); }
      refreshStatus(); recompute();
    });

    const nutr = h("div", { class: "nutr-grid" },
      nutrCell("Calories", n.calories, "cal"),
      nutrCell("Protein", n.protein, "g"),
      nutrCell("Sat fat", n.satFat, "g"),
      nutrCell("Sugar", n.sugar, "g"));

    const zeroToggle = h("label", { class: "toggle-row" },
      h("span", {}, "ZeroPoint food"),
      toggle(zero, (on) => { zero = on; refreshStatus(); recompute(); }));

    recompute(); refreshStatus();
    const body2 = h("div", { class: "detail" },
      h("div", { class: "detail-head" },
        h("div", {},
          h("div", { class: "detail-name" }, item.name),
          h("div", { class: "detail-serv" }, [item.brand, item.serving].filter(Boolean).join(" · "))),
        ptsEl),
      h("div", { class: "detail-row" }, h("span", {}, "Servings"), stepper),
      editRow,
      zeroToggle,
      Object.keys(n).length ? h("div", { class: "detail-sec-label" }, "Per serving") : null,
      Object.keys(n).length ? nutr : null,
      h("button", { class: "btn-primary big", onClick: () => { addToLog(item, qty, perServing()); detail.close(); } },
        "Add to " + MEALS.find((m) => m.key === meal).label));
    const detail = sheet(item.name, body2);
  }

  function nutrCell(label, val, unit) {
    return h("div", { class: "nutr-cell" },
      h("div", { class: "nutr-val" }, val == null ? "–" : fmt(val, 1)),
      h("div", { class: "nutr-lbl" }, label + (val == null ? "" : " " + unit)));
  }

  function addToLog(item, qty, overridePoints) {
    const entry = {
      ...item,
      qty,
      points: overridePoints != null ? overridePoints : item.points,
      loggedAt: Date.now(),
    };
    mutate((d) => {
      const dl = dayLog(dateKey);
      dl.meals[meal].push(entry);
      // recents (dedupe by name+brand, cap 30)
      d.recents = [{ ...item }, ...(d.recents || []).filter((r) => !(r.name === item.name && r.brand === item.brand))].slice(0, 30);
    });
    toast(`Added to ${MEALS.find((m) => m.key === meal).label}`);
  }

  // ---- Barcode scanning ----
  async function startScan() {
    const video = h("video", { class: "scan-video", playsinline: true, muted: true });
    const scanBody = h("div", { class: "scanwrap" }, video,
      h("div", { class: "scan-frame" }),
      h("div", { class: "scan-hint" }, "Point the camera at a barcode"));
    const sc = sheet("Scan barcode", scanBody, { full: true });
    let reader, controls;
    try {
      const mod = await import("https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm");
      reader = new mod.BrowserMultiFormatReader();
      controls = await reader.decodeFromVideoDevice(undefined, video, async (result, err, ctrl) => {
        if (result) {
          ctrl.stop();
          sc.close();
          await handleCode(result.getText());
        }
      });
    } catch (e) {
      scanBody.replaceChildren(h("div", { class: "empty" },
        "Camera isn't available here. Make sure you allowed camera access, or search by name instead."));
    }
    const origClose = sc.close;
  }

  async function handleCode(code) {
    toast("Looking up " + code + "…");
    try {
      const item = await lookupBarcode(code);
      if (!item) { toast("Not found — try searching by name"); return; }
      openDetail(item);
    } catch { toast("Lookup failed"); }
  }

  let t;
  input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => doSearch(input.value), 260); });

  body.append(mealRow, searchRow, tabs, results);
  renderTabs();
  doSearch("");
  const s = sheet("Add food", body, { full: true });
  if (opts.scan) setTimeout(() => startScan(), 300);
  else setTimeout(() => input.focus(), 350);
  return s;
}

function toggle(on, cb) {
  const el = h("button", { class: "switch" + (on ? " on" : ""), type: "button" }, h("span", { class: "knob" }));
  el.addEventListener("click", () => { on = !on; el.classList.toggle("on", on); cb(on); });
  return el;
}
export { toggle };
