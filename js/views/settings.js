import { h, icon, toast, fmt } from "../ui.js";
import { state, mutate, signOut, flush } from "../state.js";
import { toggle } from "../foodsearch.js";
import { getUsdaKey, setUsdaKey, usingDemoKey } from "../foods.js";

export function renderSettings() {
  const wrap = h("div", { class: "view" });
  const s = state.data.settings;
  const goal = state.data.goal || (state.data.goal = {});
  const unit = s.units === "metric" ? "kg" : "lb";

  wrap.append(h("div", { class: "day-header" }, h("div", { class: "greet" }, "Settings")));

  // Profile
  wrap.append(h("div", { class: "card profile-card" },
    h("div", { class: "avatar" }, (state.data.name || "?").trim().charAt(0).toUpperCase()),
    h("div", {},
      h("div", { class: "profile-name" }, state.data.name),
      h("div", { class: "profile-sub" }, "Tap below to switch profile"))));

  // Friends
  const pending = (state.data.requestsIn || []).length;
  wrap.append(h("div", { class: "card nav-card", onClick: () => window.__nav("friends") },
    h("div", { class: "nav-ico" }, icon("star")),
    h("div", { class: "nav-main" },
      h("div", { class: "nav-title" }, "Friends"),
      h("div", { class: "nav-sub" }, pending ? `${pending} new request${pending > 1 ? "s" : ""}` : `${(state.data.friends || []).length} connected`)),
    pending ? h("span", { class: "nav-badge" }, String(pending)) : null,
    icon("chevron", "chev")));

  // Points budget
  wrap.append(section("Points budget", [
    numRow("Daily Points budget", s.dailyBudget, (v) => setSetting("dailyBudget", v)),
    numRow("Weekly Points bank", s.weeklyBudget, (v) => setSetting("weeklyBudget", v)),
    switchRow("Roll over unused daily Points", s.rollovers, (on) => setSetting("rollovers", on), "Up to 4 unused Points a day move into your weekly bank."),
  ]));

  // Goal & weight
  wrap.append(section("Goal", [
    numRow(`Starting weight (${unit})`, goal.startWeight, (v) => setGoal("startWeight", v), true),
    numRow(`Goal weight (${unit})`, goal.goalWeight, (v) => setGoal("goalWeight", v), true),
  ]));

  // Points corrections
  wrap.append(h("div", { class: "card nav-card", onClick: () => window.__nav("corrections") },
    h("div", { class: "nav-ico" }, icon("edit")),
    h("div", { class: "nav-main" },
      h("div", { class: "nav-title" }, "Points corrections"),
      h("div", { class: "nav-sub" }, "See and adjust every food correction")),
    icon("chevron", "chev")));

  // Food database (USDA key) — a key is baked into the app; this field is only
  // for optionally overriding it on this device.
  const keyInput = h("input", { class: "f-input", type: "text", autocapitalize: "none", autocorrect: "off",
    placeholder: "Optional: override key on this device", value: "" });
  keyInput.addEventListener("change", () => {
    setUsdaKey(keyInput.value);
    toast(keyInput.value.trim() ? "Custom key saved on this device" : "Using the built-in key");
    keyInput.value = "";
    window.__rerender();
  });
  const dbStatus = usingDemoKey()
    ? h("div", { class: "set-hint warn" }, "No key configured — using the shared demo key (limited). Add a free key below.")
    : h("div", { class: "set-hint ok" }, "✓ Full food database active (~600,000 foods).");
  wrap.append(h("div", { class: "card settings-sec" },
    h("div", { class: "card-title" }, "Food database"),
    h("div", { class: "set-row col" },
      dbStatus,
      h("div", { class: "set-hint" }, "A free USDA FoodData Central key is already built in. You only need this field if you want to use your own key on this device (get one at fdc.nal.usda.gov/api-key-signup)."),
      keyInput),
  ));

  // Units & profile
  wrap.append(section("Preferences", [
    choiceRow("Units", [["imperial", "Pounds (lb)"], ["metric", "Kilograms (kg)"]], s.units, (v) => setSetting("units", v)),
    choiceRow("Week resets on", [["1", "Monday"], ["0", "Sunday"]], String(s.weekResetDay ?? 1), (v) => setSetting("weekResetDay", parseInt(v, 10))),
  ]));

  wrap.append(h("button", {
    class: "btn-ghost danger", onClick: async () => { await flush(); signOut(); window.__boot(); },
  }, "Switch profile"));

  wrap.append(h("div", { class: "app-foot" }, "Weight Watchers · personal build"));
  wrap.append(h("div", { style: { height: "18px" } }));
  return wrap;

  function setSetting(k, v) { mutate((d) => { d.settings[k] = v; }); window.__rerender(); }
  function setGoal(k, v) { mutate((d) => { (d.goal = d.goal || {})[k] = v; }); window.__rerender(); }

  function section(title, rows) {
    return h("div", { class: "card settings-sec" }, h("div", { class: "card-title" }, title), ...rows);
  }
  function numRow(label, val, cb, decimal = false) {
    const inp = h("input", {
      class: "set-input", type: "number", inputmode: decimal ? "decimal" : "numeric",
      step: decimal ? "0.1" : "1", value: val ?? "", placeholder: "–",
    });
    inp.addEventListener("change", () => {
      const v = decimal ? parseFloat(inp.value) : parseInt(inp.value, 10);
      cb(Number.isFinite(v) ? v : null);
    });
    return h("div", { class: "set-row" }, h("div", { class: "set-label" }, label), inp);
  }
  function switchRow(label, on, cb, hint) {
    return h("div", { class: "set-row col" },
      h("div", { class: "set-row inner" }, h("div", { class: "set-label" }, label), toggle(on, cb)),
      hint ? h("div", { class: "set-hint" }, hint) : null);
  }
  function choiceRow(label, options, value, cb) {
    const seg = h("div", { class: "seg small" },
      ...options.map(([v, l]) => h("button", { class: "seg-btn" + (v === value ? " on" : ""), onClick: (e) => { cb(v); } }, l)));
    return h("div", { class: "set-row col" }, h("div", { class: "set-label" }, label), seg);
  }
}
