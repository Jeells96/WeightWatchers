import { h, icon, toast, fmt, sheet } from "../ui.js";
import { listProfiles, slug, loadProfile, hashPin } from "../db.js";
import { signIn, createProfile, mutate, state, flush, todayKey, checkPin } from "../state.js";

const logo = () => h("div", { class: "wordmark big", html:
  `<span class="ww">WW</span><span class="ww-name">Weight&nbsp;Watchers</span>` });

export async function renderGate(root) {
  root.replaceChildren(h("div", { class: "gate loading" }, h("div", { class: "spinner" })));
  let profiles = [];
  try { profiles = await listProfiles(); } catch {}

  const screen = h("div", { class: "gate" });
  screen.append(logo());
  screen.append(h("div", { class: "gate-sub" }, "Who's tracking today?"));

  const list = h("div", { class: "gate-list" });
  profiles.forEach((p) => {
    list.append(h("button", { class: "gate-profile", onClick: () => enter(p.id) },
      h("div", { class: "avatar" }, (p.name || "?").charAt(0).toUpperCase()),
      h("div", { class: "gate-pname" }, p.name),
      icon("chevron", "chev")));
  });
  screen.append(list);

  screen.append(h("button", { class: "btn-primary big add-profile", onClick: () => startCreate() },
    icon("plus"), profiles.length ? "Add another profile" : "Create your profile"));

  root.replaceChildren(screen);

  async function enter(id, name) {
    let prof = null;
    try { prof = await loadProfile(id); } catch {}
    if (prof && prof.pinHash) {
      promptPin(prof, async () => {
        root.replaceChildren(h("div", { class: "gate loading" }, h("div", { class: "spinner" })));
        await signIn(id);
        window.__boot();
      });
      return;
    }
    root.replaceChildren(h("div", { class: "gate loading" }, h("div", { class: "spinner" })));
    await signIn(id);
    window.__boot();
  }

  function startCreate() { renderSetup(root); }
}

// A reusable 4-digit PIN entry sheet. onOk() runs when the PIN matches.
export function promptPin(profile, onOk) {
  let entry = "";
  const dots = h("div", { class: "pin-dots" });
  const err = h("div", { class: "pin-err" }, "");
  const body = h("div", { class: "pinpad-wrap" },
    h("div", { class: "pin-head" }, `Enter ${profile.name}'s PIN`), dots, err);
  renderDots();
  const pad = h("div", { class: "pinpad" });
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
  keys.forEach((k) => {
    if (k === "") { pad.append(h("span", {})); return; }
    pad.append(h("button", {
      class: "pin-key" + (k === "del" ? " del" : ""),
      onClick: () => press(k),
    }, k === "del" ? icon("back") : k));
  });
  body.append(pad);
  const sh = sheet("PIN", body, { full: false });

  function renderDots() {
    dots.replaceChildren(...[0, 1, 2, 3].map((i) => h("span", { class: "pin-dot" + (i < entry.length ? " on" : "") })));
  }
  async function press(k) {
    err.textContent = "";
    if (k === "del") { entry = entry.slice(0, -1); renderDots(); return; }
    if (entry.length >= 4) return;
    entry += k; renderDots();
    if (entry.length === 4) {
      const ok = await checkPin(profile, entry);
      if (ok) { sh.close(); onOk(); }
      else { err.textContent = "Wrong PIN, try again"; entry = ""; setTimeout(renderDots, 120); navigator.vibrate?.(60); }
    }
  }
}

// Multi-step setup for a brand-new profile.
export function renderSetup(root, { editing = false } = {}) {
  const data = {
    name: "", pin: "", pin2: "", sex: "", units: "imperial",
    heightFt: "", heightIn: "", heightCm: "",
    startWeight: "", goalWeight: "",
    dailyBudget: 23, weeklyBudget: 35,
  };
  let step = 0;
  const steps = ["name", "pin", "body", "goal", "budget"];

  const screen = h("div", { class: "setup" });
  root.replaceChildren(screen);
  draw();

  function draw() {
    screen.replaceChildren();
    screen.append(h("div", { class: "setup-top" },
      step > 0 ? h("button", { class: "icon-btn", onClick: () => { step--; draw(); } }, icon("back")) : h("button", { class: "icon-btn", onClick: () => renderGate(root) }, icon("close")),
      h("div", { class: "setup-dots" }, ...steps.map((_, i) => h("span", { class: "dot" + (i === step ? " on" : i < step ? " done" : "") }))),
      h("span", { style: { width: "34px" } })));

    const body = h("div", { class: "setup-body" });
    if (steps[step] === "name") stepName(body);
    else if (steps[step] === "pin") stepPin(body);
    else if (steps[step] === "body") stepBody(body);
    else if (steps[step] === "goal") stepGoal(body);
    else if (steps[step] === "budget") stepBudget(body);
    screen.append(body);
  }

  function next() { if (step < steps.length - 1) { step++; draw(); } else finish(); }

  function stepName(body) {
    const inp = h("input", { class: "f-input big-input", placeholder: "First and last name", value: data.name, autocapitalize: "words", autocomplete: "name", autofocus: true });
    inp.addEventListener("input", () => (data.name = inp.value));
    body.append(
      h("h1", { class: "setup-h" }, "What's your name?"),
      h("p", { class: "setup-p" }, "Enter your first and last name. This is how you'll find and sign in to your profile."),
      inp,
      h("button", { class: "btn-primary big", onClick: () => { if (!data.name.trim()) { toast("Enter your name"); return; } next(); } }, "Continue"));
    setTimeout(() => inp.focus(), 250);
  }

  function stepPin(body) {
    const p1 = h("input", { class: "f-input big-input pin-input", type: "tel", inputmode: "numeric", maxlength: "4", placeholder: "• • • •", value: data.pin });
    const p2 = h("input", { class: "f-input big-input pin-input", type: "tel", inputmode: "numeric", maxlength: "4", placeholder: "• • • •", value: data.pin2 });
    const clean = (v) => v.replace(/\D/g, "").slice(0, 4);
    p1.addEventListener("input", () => { data.pin = clean(p1.value); p1.value = data.pin; });
    p2.addEventListener("input", () => { data.pin2 = clean(p2.value); p2.value = data.pin2; });
    body.append(
      h("h1", { class: "setup-h" }, "Set a 4-digit PIN"),
      h("p", { class: "setup-p" }, "You'll enter this to open your profile — including on another phone. It keeps your account private."),
      h("label", { class: "f-label" }, "PIN"), p1,
      h("label", { class: "f-label" }, "Confirm PIN"), p2,
      h("button", {
        class: "btn-primary big", onClick: () => {
          if (!/^\d{4}$/.test(data.pin)) { toast("PIN must be 4 digits"); return; }
          if (data.pin !== data.pin2) { toast("PINs don't match"); return; }
          next();
        },
      }, "Continue"));
    setTimeout(() => p1.focus(), 250);
  }

  function stepBody(body) {
    const unitSeg = h("div", { class: "seg" },
      segBtn("lb / ft", data.units === "imperial", () => { data.units = "imperial"; draw(); }),
      segBtn("kg / cm", data.units === "metric", () => { data.units = "metric"; draw(); }));
    const sexSeg = h("div", { class: "seg" },
      segBtn("Female", data.sex === "female", () => { data.sex = "female"; draw(); }),
      segBtn("Male", data.sex === "male", () => { data.sex = "male"; draw(); }),
      segBtn("Other", data.sex === "other", () => { data.sex = "other"; draw(); }));
    let heightField;
    if (data.units === "imperial") {
      const ft = h("input", { class: "f-input", type: "number", inputmode: "numeric", placeholder: "ft", value: data.heightFt });
      const inch = h("input", { class: "f-input", type: "number", inputmode: "numeric", placeholder: "in", value: data.heightIn });
      ft.addEventListener("input", () => (data.heightFt = ft.value));
      inch.addEventListener("input", () => (data.heightIn = inch.value));
      heightField = h("div", { class: "two-col" }, ft, inch);
    } else {
      const cm = h("input", { class: "f-input", type: "number", inputmode: "numeric", placeholder: "cm", value: data.heightCm });
      cm.addEventListener("input", () => (data.heightCm = cm.value));
      heightField = cm;
    }
    body.append(
      h("h1", { class: "setup-h" }, "A little about you"),
      h("label", { class: "f-label" }, "Units"), unitSeg,
      h("label", { class: "f-label" }, "Sex"), sexSeg,
      h("label", { class: "f-label" }, "Height"), heightField,
      h("button", { class: "btn-primary big", onClick: next }, "Continue"));
  }

  function stepGoal(body) {
    const unit = data.units === "metric" ? "kg" : "lb";
    const sw = h("input", { class: "f-input big-input", type: "number", inputmode: "decimal", step: "0.1", placeholder: `Current (${unit})`, value: data.startWeight });
    const gw = h("input", { class: "f-input big-input", type: "number", inputmode: "decimal", step: "0.1", placeholder: `Goal (${unit})`, value: data.goalWeight });
    sw.addEventListener("input", () => (data.startWeight = sw.value));
    gw.addEventListener("input", () => (data.goalWeight = gw.value));
    body.append(
      h("h1", { class: "setup-h" }, "Your weight goal"),
      h("p", { class: "setup-p" }, "You can change these any time in Settings."),
      h("label", { class: "f-label" }, "Current weight"), sw,
      h("label", { class: "f-label" }, "Goal weight"), gw,
      h("button", { class: "btn-primary big", onClick: next }, "Continue"));
  }

  function stepBudget(body) {
    const daily = h("input", { class: "f-input big-input", type: "number", inputmode: "numeric", value: data.dailyBudget });
    const weekly = h("input", { class: "f-input big-input", type: "number", inputmode: "numeric", value: data.weeklyBudget });
    daily.addEventListener("input", () => (data.dailyBudget = parseInt(daily.value, 10) || 0));
    weekly.addEventListener("input", () => (data.weeklyBudget = parseInt(weekly.value, 10) || 0));
    body.append(
      h("h1", { class: "setup-h" }, "Your Points budget"),
      h("p", { class: "setup-p" }, "Enter the daily and weekly Points from your plan. Not sure yet? The defaults are a common starting point — adjust later."),
      h("label", { class: "f-label" }, "Daily Points budget"), daily,
      h("label", { class: "f-label" }, "Weekly Points bank"), weekly,
      h("button", { class: "btn-primary big", onClick: finish }, "Start tracking"));
  }

  async function finish() {
    const name = data.name.trim();
    if (!name) { toast("Enter your name"); step = 0; draw(); return; }
    if (!/^\d{4}$/.test(data.pin) || data.pin !== data.pin2) { toast("Set a matching 4-digit PIN"); step = 1; draw(); return; }
    // Don't overwrite someone else's existing profile with the same name.
    try {
      const existing = await loadProfile(slug(name));
      if (existing) { toast(`"${name}" is already taken — try a different name`); step = 0; draw(); return; }
    } catch {}
    screen.replaceChildren(h("div", { class: "gate loading" }, h("div", { class: "spinner" })));
    const pinHash = await hashPin(data.pin);
    let heightIn = null;
    if (data.units === "imperial") {
      const ft = parseInt(data.heightFt, 10) || 0, inch = parseInt(data.heightIn, 10) || 0;
      if (ft || inch) heightIn = ft * 12 + inch;
    } else {
      const cm = parseFloat(data.heightCm);
      if (Number.isFinite(cm)) heightIn = +(cm / 2.54).toFixed(1);
    }
    await createProfile(name, pinHash);
    mutate((d) => {
      d.settings.units = data.units;
      d.settings.sex = data.sex;
      d.settings.heightIn = heightIn;
      d.settings.dailyBudget = data.dailyBudget || 23;
      d.settings.weeklyBudget = data.weeklyBudget || 35;
      const sw = parseFloat(data.startWeight), gw = parseFloat(data.goalWeight);
      d.goal = { startDate: todayKey(), startWeight: Number.isFinite(sw) ? sw : null, goalWeight: Number.isFinite(gw) ? gw : null };
      if (Number.isFinite(sw)) d.weighIns = [{ date: todayKey(), weight: +sw.toFixed(1) }];
    });
    await flush();
    window.__boot();
  }

  function segBtn(label, on, cb) { return h("button", { class: "seg-btn" + (on ? " on" : ""), onClick: cb }, label); }
}
