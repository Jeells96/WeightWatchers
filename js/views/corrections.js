import { h, icon, toast } from "../ui.js";
import { allCalibrations, updateEntered, removeByKey, biasValue } from "../calibrations.js";

export function renderCorrections() {
  const wrap = h("div", { class: "view" });

  wrap.append(h("div", { class: "subpage-head" },
    h("button", { class: "icon-btn", onClick: () => window.__nav("settings") }, icon("back")),
    h("div", { class: "subpage-title" }, "Points corrections"),
    h("span", { style: { width: "38px" } })));

  const entries = allCalibrations();
  const bias = biasValue();

  wrap.append(h("div", { class: "card" },
    h("div", { class: "set-hint" }, "When anyone changes a food's Points, it's saved here and shared. These also gently shift Points on foods no one has corrected yet."),
    bias ? h("div", { class: "bias-line" }, `Right now, uncorrected foods are adjusted by ${bias > 0 ? "+" : "−"}${Math.abs(bias).toFixed(1)} on average.`) : null));

  if (!entries.length) {
    wrap.append(h("div", { class: "card" }, h("div", { class: "empty" }, "No corrections yet. Edit a food's Points when adding it, and it'll show up here.")));
    wrap.append(h("div", { style: { height: "12px" } }));
    return wrap;
  }

  const list = h("div", { class: "card" }, h("div", { class: "card-title" }, `Corrections (${entries.length})`));
  entries.forEach((e) => {
    const input = h("input", { class: "corr-input", type: "number", inputmode: "numeric", min: "0", value: String(e.entered) });
    input.addEventListener("change", () => {
      const v = parseInt(input.value, 10);
      if (!Number.isFinite(v) || v < 0) { input.value = String(e.entered); return; }
      updateEntered(e.key, v);
      toast("Updated");
      window.__rerender();
    });
    list.append(h("div", { class: "corr-row" },
      h("div", { class: "corr-main" },
        h("div", { class: "corr-name" }, e.name + (e.brand ? ` · ${e.brand}` : "")),
        h("div", { class: "corr-sub" }, `Calculated ${e.calculated}${e.by ? " · by " + e.by : ""}${e.at ? " · " + rel(e.at) : ""}`)),
      h("div", { class: "corr-right" }, input, h("div", { class: "corr-arrow" }, "pts")),
      h("button", { class: "li-del", onClick: () => { removeByKey(e.key); window.__rerender(); } }, icon("trash"))));
  });
  wrap.append(list);
  wrap.append(h("div", { style: { height: "12px" } }));
  return wrap;
}

function rel(ts) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
