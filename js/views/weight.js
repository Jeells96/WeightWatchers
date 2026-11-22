import { h, icon, weightChart, sheet, toast, fmt, prettyDate } from "../ui.js";
import { state, mutate, todayKey, latestWeight, budget } from "../state.js";
import { openActivityLog } from "./activity.js";

export function renderWeight() {
  const wrap = h("div", { class: "view" });
  const s = state.data.settings;
  const unit = s.units === "metric" ? "kg" : "lb";
  const goal = state.data.goal || {};
  const weighIns = [...(state.data.weighIns || [])].sort((a, b) => a.date.localeCompare(b.date));
  const current = latestWeight();

  wrap.append(h("div", { class: "topbar" }, h("span"), h("div", { class: "tb-title" }, "Progress"), h("span")));

  // Hero numbers
  const start = goal.startWeight;
  const target = goal.goalWeight;
  const lostTotal = start != null && current != null ? +(start - current).toFixed(1) : null;
  const toGo = target != null && current != null ? +(current - target).toFixed(1) : null;

  wrap.append(h("div", { class: "card weight-hero" },
    h("div", { class: "wh-current" },
      h("div", { class: "wh-num" }, current != null ? fmt(current, 1) : "–"),
      h("div", { class: "wh-unit" }, unit),
      h("div", { class: "wh-cap" }, "Current")),
    h("div", { class: "wh-side" },
      miniStat("Start", start != null ? fmt(start, 1) : "–", unit),
      miniStat("Goal", target != null ? fmt(target, 1) : "–", unit))));

  // Progress bar toward goal
  if (start != null && target != null && current != null && start !== target) {
    const totalToLose = start - target;
    const done = Math.max(0, Math.min(1, (start - current) / totalToLose));
    wrap.append(h("div", { class: "card" },
      h("div", { class: "weekbar-top" },
        h("span", {}, lostTotal >= 0 ? `${fmt(lostTotal, 1)} ${unit} lost` : `${fmt(-lostTotal, 1)} ${unit} up`),
        h("span", { class: "weekbar-num" }, toGo != null && toGo > 0 ? `${fmt(toGo, 1)} ${unit} to goal` : "Goal reached 🎉")),
      h("div", { class: "weekbar" }, h("div", { class: "weekbar-fill", style: { width: (done * 100) + "%" } }))));
  }

  // Chart
  wrap.append(h("div", { class: "card" },
    h("div", { class: "card-title" }, "Trend"),
    weightChart(weighIns, { goal: target })));

  // Log button
  wrap.append(h("button", { class: "btn-primary big", onClick: () => openWeighIn() }, icon("plus"), "Log weigh-in"));
  const b = budget();
  wrap.append(h("div", { class: "mini-card wide" },
    h("div", { class: "mini-head" }, "ACTIVITY"),
    h("div", { class: "mini-big" }, `${b.activityToday}`, h("span", { class: "mini-unit" }, "Points today")),
    h("div", { class: "mini-sub" }, h("span", {}, `${b.activityThisWeek} activity Points this week`)),
    h("button", { class: "btn-ghost", onClick: () => openActivityLog() }, "Log activity")));

  // History
  if (weighIns.length) {
    const hist = h("div", { class: "card" }, h("div", { class: "card-title" }, "History"));
    [...weighIns].reverse().forEach((w, i, arr) => {
      const prev = arr[i + 1];
      const delta = prev ? +(w.weight - prev.weight).toFixed(1) : null;
      hist.append(h("div", { class: "hist-row" },
        h("div", { class: "hist-date" }, prettyDate(w.date)),
        h("div", { class: "hist-wt" }, `${fmt(w.weight, 1)} ${unit}`),
        h("div", { class: "hist-delta" + (delta == null ? "" : delta <= 0 ? " down" : " up") },
          delta == null ? "" : `${delta <= 0 ? "▼" : "▲"} ${fmt(Math.abs(delta), 1)}`),
        h("button", { class: "li-del", onClick: () => removeWeigh(w.date) }, icon("trash"))));
    });
    wrap.append(hist);
  }

  wrap.append(h("div", { style: { height: "12px" } }));
  return wrap;

  function miniStat(label, val, u) {
    return h("div", { class: "wh-mini" }, h("div", { class: "wh-mini-num" }, `${val}`), h("div", { class: "wh-mini-lbl" }, `${label} (${u})`));
  }
  function removeWeigh(date) { mutate((d) => { d.weighIns = d.weighIns.filter((w) => w.date !== date); }); }
}

export function openWeighIn() {
const unit = state.data.settings.units === "metric" ? "kg" : "lb";
const current = latestWeight();
  const wt = h("input", { class: "f-input big-input", type: "number", inputmode: "decimal", step: "0.1", placeholder: current != null ? fmt(current, 1) : "0.0" });
  const dateInput = h("input", { class: "f-input", type: "date", value: todayKey(), max: todayKey() });
  const body = h("div", { class: "weighin" },
    h("label", { class: "f-label" }, `Weight (${unit})`), wt,
    h("label", { class: "f-label" }, "Date"), dateInput,
    h("button", {
      class: "btn-primary big", onClick: () => {
        const v = parseFloat(wt.value);
        if (!Number.isFinite(v)) { toast("Enter a weight"); return; }
        const date = dateInput.value || todayKey();
        mutate((d) => {
          d.weighIns = [...(d.weighIns || []).filter((w) => w.date !== date), { date, weight: +v.toFixed(1) }];
          if (d.goal.startWeight == null) { d.goal.startWeight = +v.toFixed(1); d.goal.startDate = date; }
        });
        toast("Weigh-in saved");
        sh.close();
      },
    }, "Save"));
  const sh = sheet("Log weigh-in", body);
  setTimeout(() => wt.focus(), 350);
}
