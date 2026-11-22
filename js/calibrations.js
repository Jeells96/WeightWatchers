// Shared food-points corrections pooled across everyone who uses the app.
// Each correction is stored for its exact food, and together they also apply a
// small automatic adjustment to every other (uncorrected) food, so Points drift
// toward what people actually enter over time.
import { slug, watchCalibrations, writeCalibration, deleteCalibration } from "./db.js";
import { state } from "./state.js";
import { pointsRaw } from "./points.js";

const cal = { entries: {}, unsub: null, onUpdate: null };

export function initCalibrations(onUpdate) {
  cal.onUpdate = onUpdate;
  if (cal.unsub) { cal.unsub(); cal.unsub = null; }
  if (state.id === "__demo__") { cal.entries = demoEntries(); onUpdate && onUpdate(); return; }
  cal.unsub = watchCalibrations((data) => {
    cal.entries = (data && data.entries) || {};
    onUpdate && onUpdate();
  });
}

export function calKey(item) { return slug(item.name) + "|" + slug(item.brand || ""); }

export function calibratedEntry(item) { return cal.entries[calKey(item)] || null; }

// Average of (entered − calculated) across corrections, gently shrunk toward 0
// when few corrections exist, and clamped so it can never swing wildly.
export function biasValue() {
  const deltas = [];
  for (const e of Object.values(cal.entries)) {
    if (e.zero || e.calculated == null) continue;
    deltas.push((e.entered || 0) - (e.calculated || 0));
  }
  if (!deltas.length) return 0;
  const sum = deltas.reduce((a, b) => a + b, 0);
  const b = sum / (deltas.length + 1);
  return Math.max(-3, Math.min(3, b));
}

// Points for an amount of a food. `factor` is the amount relative to the
// food's default serving; `nutrition` is the nutrition for that amount.
// An exact correction scales with the amount; otherwise the calculated value
// gets the shared adjustment (also scaled).
export function pointsFor(item, factor = 1, nutrition = null) {
  if (item.zero) return 0;
  const e = calibratedEntry(item);
  if (e) return Math.max(0, Math.round(e.entered * factor));
  let raw = nutrition ? pointsRaw(nutrition) : null;
  if (raw == null) raw = (item.pointsRaw ?? item.points ?? 0) * factor;
  return Math.max(0, Math.round(raw + biasValue() * factor));
}

// Points for the food's default serving (lists, badges).
export function effectivePoints(item) {
  return pointsFor(item, 1, item.nutrition && Object.keys(item.nutrition).length ? item.nutrition : null);
}

export function saveCalibration(item, entered, zeroState) {
  const calculated = zeroState ? 0 : (item.points ?? 0);
  const entry = {
    name: item.name, brand: item.brand || "", calculated, entered,
    zero: !!zeroState, by: state.data?.name || "", at: Date.now(),
  };
  cal.entries[calKey(item)] = entry;        // optimistic
  cal.onUpdate && cal.onUpdate();
  if (state.id !== "__demo__") writeCalibration(calKey(item), entry).catch(() => {});
}

export function removeByKey(key) {
  delete cal.entries[key];
  cal.onUpdate && cal.onUpdate();
  if (state.id !== "__demo__") deleteCalibration(key).catch(() => {});
}

export function updateEntered(key, entered) {
  const e = cal.entries[key];
  if (!e) return;
  e.entered = entered; e.at = Date.now(); e.by = state.data?.name || e.by;
  cal.onUpdate && cal.onUpdate();
  if (state.id !== "__demo__") writeCalibration(key, e).catch(() => {});
}

export function allCalibrations() {
  return Object.entries(cal.entries)
    .map(([key, e]) => ({ key, ...e }))
    .sort((a, b) => (b.at || 0) - (a.at || 0));
}

function demoEntries() {
  return {
    "cheese-pizza|": { name: "Cheese pizza", brand: "", calculated: 10, entered: 9, zero: false, by: "Sarah", at: Date.now() - 86400000 },
    "turkey-sandwich|": { name: "Turkey sandwich", brand: "", calculated: 9, entered: 8, zero: false, by: "Mike", at: Date.now() - 43200000 },
  };
}
