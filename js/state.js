// Central app state: the loaded profile, local persistence of "who's signed in",
// and all the derived budget math. Writes are debounced to Firestore.
import { loadProfile, saveProfile, slug, watchProfile } from "./db.js";

const LS_KEY = "ww_current_profile";

export const state = {
  id: null,        // profile slug
  data: null,      // profile document
  unsub: null,     // firestore live subscription
  dirty: false,
};

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => fn()); }

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// The weekly cycle resets on a configurable day (default Monday = 1).
export function weekStartKey(d = new Date()) {
  const resetDay = state.data?.settings?.weekResetDay ?? 1;
  const copy = new Date(d);
  const diff = (copy.getDay() - resetDay + 7) % 7;
  copy.setDate(copy.getDate() - diff);
  return todayKey(copy);
}

export function defaultProfile(name) {
  return {
    name: name.trim(),
    createdAt: Date.now(),
    settings: {
      dailyBudget: 23,
      weeklyBudget: 35,
      rollovers: true,        // unused daily points (max 4/day) roll into the weekly bank
      activityAddsToBudget: false,
      units: "imperial",      // imperial => lbs, metric => kg
      sex: "",
      heightIn: null,
      weekResetDay: 1,
    },
    goal: { startWeight: null, goalWeight: null, startDate: todayKey() },
    weighIns: [],             // [{date, weight}]
    log: {},                  // { "YYYY-MM-DD": { meals, activities, water } }
    favorites: [],
    recents: [],
  };
}

// Demo / preview mode — loads realistic sample data WITHOUT touching Firestore.
// Triggered by adding ?demo=1 to the URL. Changes are not saved.
export function loadDemo() {
  const t = new Date();
  const k = (off) => { const d = new Date(t); d.setDate(d.getDate() + off); return todayKey(d); };
  if (state.unsub) { state.unsub(); state.unsub = null; }
  state.id = "__demo__";
  state.data = {
    name: "Sarah",
    settings: { dailyBudget: 23, weeklyBudget: 35, rollovers: true, units: "imperial", sex: "female", heightIn: 65, weekResetDay: 1 },
    goal: { startWeight: 184, goalWeight: 150, startDate: k(-60) },
    weighIns: [
      { date: k(-56), weight: 184 }, { date: k(-49), weight: 182.2 }, { date: k(-42), weight: 180.6 },
      { date: k(-35), weight: 179.1 }, { date: k(-28), weight: 177.8 }, { date: k(-21), weight: 176.0 },
      { date: k(-14), weight: 174.9 }, { date: k(-7), weight: 173.2 }, { date: k(0), weight: 171.8 },
    ],
    log: {
      [k(0)]: {
        meals: {
          breakfast: [
            { name: "Plain nonfat Greek yogurt", serving: "170 g", points: 0, qty: 1, zero: true, nutrition: { calories: 100, protein: 17, sugar: 6, satFat: 0 } },
            { name: "Blueberries", serving: "1 cup", points: 0, qty: 1, zero: true, nutrition: {} },
            { name: "Coffee, black", serving: "1 cup", points: 0, qty: 1, nutrition: {} },
          ],
          lunch: [
            { name: "Turkey sandwich, whole wheat", brand: "", serving: "1 sandwich", points: 7, qty: 1, nutrition: { calories: 320, protein: 28, satFat: 3, sugar: 5 } },
            { name: "Apple", serving: "1 medium", points: 0, qty: 1, zero: true, nutrition: {} },
          ],
          dinner: [
            { name: "Grilled chicken breast", serving: "4 oz", points: 0, qty: 1, zero: true, nutrition: { calories: 187, protein: 35 } },
            { name: "White rice, cooked", serving: "1 cup", points: 5, qty: 1, nutrition: { calories: 205, protein: 4 } },
          ],
          snack: [
            { name: "Dark chocolate square", serving: "1 piece", points: 3, qty: 1, nutrition: { calories: 85, satFat: 3, sugar: 7 } },
          ],
        },
        activities: [{ name: "Walking (brisk)", minutes: 40, points: 4 }],
        water: 5,
      },
    },
    favorites: [], recents: [],
  };
  setCurrentId(null);
  emit();
}

export function getCurrentId() {
  try { return localStorage.getItem(LS_KEY); } catch { return null; }
}
export function setCurrentId(id) {
  try { id ? localStorage.setItem(LS_KEY, id) : localStorage.removeItem(LS_KEY); } catch {}
}

export async function signIn(id) {
  if (state.unsub) { state.unsub(); state.unsub = null; }
  state.id = id;
  state.data = (await loadProfile(id)) || null;
  setCurrentId(id);
  // Live sync so both phones stay in agreement.
  state.unsub = watchProfile(id, (doc) => {
    if (doc && !state.dirty) { state.data = doc; emit(); }
  });
  emit();
}

export async function createProfile(name) {
  const id = slug(name);
  const prof = defaultProfile(name);
  await saveProfile(id, prof);
  await signIn(id);
  return id;
}

export function signOut() {
  if (state.unsub) { state.unsub(); state.unsub = null; }
  state.id = null;
  state.data = null;
  setCurrentId(null);
  emit();
}

// ---- Mutations ----------------------------------------------------------
let saveTimer = null;
export function mutate(fn) {
  if (!state.data) return;
  fn(state.data);
  state.dirty = true;
  emit();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 600);
}

export async function flush() {
  if (!state.id || !state.data) return;
  const snapshot = JSON.parse(JSON.stringify(state.data));
  await saveProfile(state.id, snapshot);
  state.dirty = false;
}

export function dayLog(key = todayKey()) {
  const log = state.data.log || (state.data.log = {});
  if (!log[key]) log[key] = { meals: { breakfast: [], lunch: [], dinner: [], snack: [] }, activities: [], water: 0 };
  if (!log[key].meals) log[key].meals = { breakfast: [], lunch: [], dinner: [], snack: [] };
  if (!log[key].activities) log[key].activities = [];
  return log[key];
}

// ---- Budget math --------------------------------------------------------
export function pointsUsedOn(key) {
  const log = state.data?.log?.[key];
  if (!log || !log.meals) return 0;
  let total = 0;
  for (const meal of Object.values(log.meals)) {
    for (const item of meal) total += item.points * (item.qty || 1);
  }
  return total;
}

export function activityPointsOn(key) {
  const log = state.data?.log?.[key];
  if (!log || !log.activities) return 0;
  return log.activities.reduce((s, a) => s + (a.points || 0), 0);
}

export function budget() {
  const s = state.data.settings;
  const today = todayKey();
  const usedToday = pointsUsedOn(today);
  const dailyBudget = s.dailyBudget || 23;

  // Weekly bank: start of the week's weekly budget, minus any overage spent
  // this week beyond each day's daily budget, plus rolled-over unused daily
  // points (capped at 4/day) from completed days this week.
  const wkStart = new Date(weekStartKey());
  let weeklyUsed = 0;
  let rolled = 0;
  let activityThisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(wkStart);
    d.setDate(d.getDate() + i);
    const key = todayKey(d);
    if (key > today) break;
    const used = pointsUsedOn(key);
    const act = activityPointsOn(key);
    activityThisWeek += act;
    const overDaily = used - dailyBudget;
    if (overDaily > 0) weeklyUsed += overDaily;
    if (key < today && s.rollovers) {
      const unused = dailyBudget - used;
      if (unused > 0) rolled += Math.min(4, unused);
    }
  }
  const weeklyBudget = (s.weeklyBudget || 0) + rolled;
  const weeklyRemaining = weeklyBudget - weeklyUsed;

  const dailyRemaining = dailyBudget - usedToday;
  const activityToday = activityPointsOn(today);

  return {
    dailyBudget,
    usedToday,
    dailyRemaining,
    weeklyBudget,
    weeklyUsed,
    weeklyRemaining,
    rolled,
    activityToday,
    activityThisWeek,
    activityAddsToBudget: !!s.activityAddsToBudget,
  };
}

export function latestWeight() {
  const w = state.data?.weighIns || [];
  if (!w.length) return state.data?.goal?.startWeight ?? null;
  return [...w].sort((a, b) => a.date.localeCompare(b.date)).at(-1).weight;
}
