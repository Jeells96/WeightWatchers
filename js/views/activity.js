import { h, icon, sheet, toast, prettyDate } from "../ui.js";
import { state, mutate, dayLog, todayKey, budget } from "../state.js";

// Rough activity Points: ~ intensity factor * minutes, scaled. Not WW's exact
// FitPoints formula (proprietary), but consistent and reasonable.
const ACTIVITIES = [
  { name: "Walking (casual)", rate: 0.07 },
  { name: "Walking (brisk)", rate: 0.11 },
  { name: "Running", rate: 0.22 },
  { name: "Cycling", rate: 0.16 },
  { name: "Swimming", rate: 0.18 },
  { name: "Strength training", rate: 0.12 },
  { name: "Yoga / Pilates", rate: 0.08 },
  { name: "HIIT", rate: 0.2 },
  { name: "Elliptical", rate: 0.14 },
  { name: "Housework / chores", rate: 0.06 },
  { name: "Dancing", rate: 0.13 },
  { name: "Hiking", rate: 0.15 },
];

function pointsFor(rate, minutes) { return Math.max(0, Math.round(rate * minutes)); }

export function renderActivity() {
  const wrap = h("div", { class: "view" });
  const b = budget();
  const dl = dayLog();

  wrap.append(h("div", { class: "day-header" }, h("div", { class: "greet" }, "Activity")));

  wrap.append(h("div", { class: "card activity-hero" },
    icon("flame", "flame-ico"),
    h("div", {},
      h("div", { class: "ah-num" }, String(b.activityToday)),
      h("div", { class: "ah-lbl" }, "activity Points today")),
    h("div", { class: "ah-week" },
      h("div", { class: "ah-num small" }, String(b.activityThisWeek)),
      h("div", { class: "ah-lbl" }, "this week"))));

  wrap.append(h("button", { class: "btn-primary big", onClick: () => openLog() }, icon("plus"), "Log activity"));

  const list = h("div", { class: "card" }, h("div", { class: "card-title" }, "Today"));
  const acts = dl.activities || [];
  if (!acts.length) list.append(h("div", { class: "meal-empty", onClick: () => openLog() }, "No activity logged yet"));
  acts.forEach((a, idx) => list.append(h("div", { class: "logged-item" },
    h("div", { class: "li-main" },
      h("div", { class: "li-name" }, a.name),
      h("div", { class: "li-sub" }, `${a.minutes} min`)),
    h("div", { class: "li-pts earned" }, `+${a.points}`),
    h("button", { class: "li-del", onClick: () => mutate(() => dayLog().activities.splice(idx, 1)) }, icon("trash")))));
  wrap.append(list);

  wrap.append(h("div", { style: { height: "12px" } }));
  return wrap;

  function openLog() {
    let chosen = ACTIVITIES[0];
    const minutes = h("input", { class: "f-input big-input", type: "number", inputmode: "numeric", value: "30", min: "1" });
    const ptsPreview = h("div", { class: "act-preview" }, "+2 Points");
    function update() { ptsPreview.textContent = `+${pointsFor(chosen.rate, parseInt(minutes.value, 10) || 0)} Points`; }
    const select = h("div", { class: "act-list" },
      ...ACTIVITIES.map((a) => h("button", {
        class: "act-opt" + (a === chosen ? " on" : ""),
        onClick: (e) => { chosen = a; select.querySelectorAll(".act-opt").forEach((x) => x.classList.remove("on")); e.currentTarget.classList.add("on"); update(); },
      }, a.name)));
    minutes.addEventListener("input", update);
    const body = h("div", { class: "actlog" },
      h("label", { class: "f-label" }, "Activity"), select,
      h("label", { class: "f-label" }, "Minutes"), minutes,
      ptsPreview,
      h("button", {
        class: "btn-primary big", onClick: () => {
          const min = parseInt(minutes.value, 10);
          if (!min || min < 1) { toast("Enter minutes"); return; }
          const pts = pointsFor(chosen.rate, min);
          mutate(() => dayLog().activities.push({ name: chosen.name, minutes: min, points: pts, at: Date.now() }));
          toast(`+${pts} activity Points`);
          sh.close();
        },
      }, "Save"));
    update();
    const sh = sheet("Log activity", body, { full: true });
  }
}
