import { h, icon, toast, fmt, sheet } from "../ui.js";
import { slug, loadProfile, hashPin } from "../db.js";
import { signIn, createProfile, mutate, state, flush, todayKey, checkPin, suggestBudget } from "../state.js";
import { ZERO_POINT_LIST } from "../zeropoint-list.js";

const logo = () => h("div", { class: "wordmark big", html:
  `<span class="ww">WW</span><span class="ww-name">Weight&nbsp;Watchers</span>` });

// First screen: just Log in or Create account. No account names are shown.
export function renderGate(root) {
  const screen = h("div", { class: "gate" });
  screen.append(logo());
  screen.append(h("div", { class: "gate-sub" }, "Track your Points, food & weight"));
  screen.append(h("div", { class: "gate-actions" },
    h("button", { class: "btn-primary big add-profile", onClick: () => showLogin(root) }, "Log in"),
    h("button", { class: "btn-gate-ghost", onClick: () => renderSetup(root) }, "Create account")));
  root.replaceChildren(screen);
}

// Log in: type your name, then your PIN. Nothing is pre-filled.
function showLogin(root) {
  const screen = h("div", { class: "gate" });
  const nameInput = h("input", { class: "f-input big-input", placeholder: "Your name",
    autocapitalize: "words", autocomplete: "off", autocorrect: "off" });

  async function submit() {
    const name = nameInput.value.trim();
    if (!name) { toast("Enter your name"); return; }
    cont.disabled = true;
    let prof = null;
    try { prof = await loadProfile(slug(name)); } catch {}
    cont.disabled = false;
    if (!prof) { toast(`No account found for "${name}"`); return; }
    const done = async () => {
      root.replaceChildren(h("div", { class: "gate loading" }, h("div", { class: "spinner" })));
      await signIn(slug(name));
      window.__boot();
    };
    if (prof.pinHash) promptPin(prof, done);
    else done();
  }

  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  const cont = h("button", { class: "btn-primary big add-profile", onClick: submit }, "Continue");

  screen.append(
    h("div", { class: "gate-top" }, h("button", { class: "icon-btn ghost", onClick: () => renderGate(root) }, icon("back"))),
    logo(),
    h("div", { class: "gate-sub" }, "Log in to your account"),
    h("div", { class: "gate-form" },
      h("label", { class: "f-label light" }, "Name"), nameInput, cont,
      h("button", { class: "btn-gate-ghost", onClick: () => renderSetup(root) }, "Create a new account instead")));
  root.replaceChildren(screen);
  setTimeout(() => nameInput.focus(), 250);
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
    heightFt: "", heightIn: "", heightCm: "", age: "", mode: "lose", budgetSet: false,
    startWeight: "", goalWeight: "",
    dailyBudget: 23, weeklyBudget: 35,
  };
  let step = 0;
  const steps = ["name", "pin", "body", "goal", "mode", "budget", "zeropoint"];

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
    else if (steps[step] === "mode") stepMode(body);
    else if (steps[step] === "zeropoint") stepZero(body);
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
      h("label", { class: "f-label" }, "Age"), ageInput(),
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

  function ageInput() {
    const a = h("input", { class: "f-input", type: "number", inputmode: "numeric", placeholder: "Age", value: data.age });
    a.addEventListener("input", () => (data.age = a.value));
    return a;
  }
  function heightInches() {
    if (data.units === "imperial") { const t = (parseInt(data.heightFt, 10) || 0) * 12 + (parseInt(data.heightIn, 10) || 0); return t || null; }
    const cm = parseFloat(data.heightCm); return Number.isFinite(cm) ? +(cm / 2.54).toFixed(1) : null;
  }

  function stepMode(body) {
    const MODES = [
      { key: "lose", title: "LOSE", ico: "bolt", tag: "RECOMMENDED", text: "Steady, flexible weight loss. A great fit if you're just starting or want room for real life.",
        bullets: ["Daily Points budget fitted to your body and goal", "Weekly Points so you never miss out"] },
      { key: "allin", title: "ALL-IN", ico: "dumbbell", tag: "New", text: "A focused push for faster results when you're ready for a challenge.",
        bullets: ["Protein, fiber, water and activity targets", "A tighter daily Points budget"] },
      { key: "maintain", title: "MAINTAIN", ico: "infinity", text: "For holding steady at a weight you're happy with, or taking a break from losing.",
        bullets: ["A larger, adjustable daily Points budget"] },
    ];
    body.append(
      h("div", { class: "ob-kicker" }, "Personalize your program"),
      h("h1", { class: "setup-h" }, "Choose your ", h("span", { class: "ob-accent" }, "mode")),
      h("p", { class: "setup-p" }, "Pick the pace that fits your life. You can change it any time."),
      ...MODES.map((m) => h("button", { class: "mode-card" + (data.mode === m.key ? " on" : ""), onClick: () => { data.mode = m.key; data.budgetSet = false; draw(); } },
        m.tag ? h("span", { class: "mode-tag" + (m.tag === "New" ? " soft" : "") }, m.tag) : null,
        h("div", { class: "mode-top" }, h("span", { class: "mode-title" }, m.title), icon(m.ico)),
        h("div", { class: "mode-text" }, m.text),
        ...m.bullets.map((x) => h("div", { class: "mode-b" }, icon("check"), x)))),
      h("button", { class: "btn-primary big", onClick: next }, "Next"));
  }

  function stepBudget(body) {
    if (!data.budgetSet) {
      const sug = suggestBudget({ sex: data.sex, age: parseInt(data.age, 10), heightIn: heightInches(),
        weightLb: data.units === "metric" ? parseFloat(data.startWeight) / 0.4536 : parseFloat(data.startWeight), mode: data.mode });
      data.dailyBudget = sug.daily; data.weeklyBudget = sug.weekly; data.budgetSet = true;
    }
    const ringBox = h("div");
    const paint = () => ringBox.replaceChildren(h("div", { class: "pts-card ob-ring" }, h("div", { class: "pts-row" },
      h("div", { class: "pts-side" }, h("div", { class: "pts-side-num" }, String(data.weeklyBudget)), h("div", { class: "pts-side-lbl" }, "Weeklies")),
      obRing(data.dailyBudget),
      h("div", { class: "pts-side" }, h("div", { class: "pts-side-num" }, "0"), h("div", { class: "pts-side-lbl" }, "Used")))));
    const stepper = (label, key) => {
      const val = h("span", { class: "ob-step-val" }, String(data[key]));
      const set = (d) => { data[key] = Math.max(0, data[key] + d); val.textContent = String(data[key]); paint(); };
      return h("div", { class: "ob-step" }, h("span", {}, label),
        h("div", { class: "ob-step-ctl" }, h("button", { onClick: () => set(-1) }, "–"), val, h("button", { onClick: () => set(1) }, "+")));
    };
    paint();
    body.append(
      h("h1", { class: "setup-h" }, "Your Points Budget"),
      h("p", { class: "setup-p" }, "Estimated from your body, goal and mode. Stay within it to keep losing at a steady pace. If your plan gives you different numbers, adjust them below."),
      ringBox,
      stepper("Daily Points", "dailyBudget"),
      stepper("Weeklies", "weeklyBudget"),
      h("div", { class: "ob-explain" },
        h("h3", {}, "Daily Points"), h("p", {}, "Your everyday budget — spend it on any foods you like."),
        h("h3", {}, "Weeklies"), h("p", {}, "A weekly cushion that kicks in once your daily Points run out.")),
      h("div", { class: "ob-tip" }, h("span", { class: "ob-tip-tag" }, "PRO TIP"),
        h("p", {}, "Filling up on ZeroPoint foods — fruit, veggies, eggs, beans and lean protein — makes it much easier to stay on budget.")),
      h("button", { class: "btn-primary big", onClick: next }, "Next"));
  }

  function stepZero(body) {
    const EM = { "Vegetables (incl. potatoes)": ["🥔", "🥒", "🥦", "🥕"], "Tofu & tempeh": ["🧈", "🫘", "🥢", "🍱"], "Chicken & turkey": ["🍗", "🦃", "🥪", "🍖"],
      "Oats": ["🥣", "🌾", "🥄", "🫙"], "Beans, peas & lentils": ["🫘", "🫛", "🥗", "🌯"], "Lean meats": ["🥩", "🍖", "🐄", "🐑"], "Fruit": ["🍈", "🍎", "🍇", "🍌"],
      "Fish & shellfish": ["🐟", "🦐", "🍣", "🦀"], "Eggs": ["🍳", "🥚", "🥘", "🧆"], "Corn & popcorn": ["🌽", "🍿", "🌾", "🫓"], "Yogurt & cottage cheese": ["🥛", "🍶", "🥣", "🧀"] };
    body.append(
      h("h1", { class: "setup-h" }, "The power of ZeroPoint foods"),
      h("p", { class: "setup-p" }, "These filling, nutrient-packed foods don't count against your budget. Use them as meal bases, snacks and add-ins."),
      h("div", { class: "zp-card" }, ...ZERO_POINT_LIST.map((g) => h("div", { class: "zp-group" },
        h("div", { class: "zp-name" }, g.group),
        h("div", { class: "zp-row" }, ...(EM[g.group] || ["⭐", "⭐", "⭐", "⭐"]).map((e) => h("div", { class: "zp-bubble" }, h("span", {}, e), h("b", {}, "0"))),
          h("div", { class: "zp-more" }, String(g.items.length)))))),
      h("p", { class: "setup-p" }, "They're not unlimited — start with your usual portions and have more if you're still hungry."),
      h("button", { class: "btn-primary big", onClick: finish }, "Start tracking"));
  }

  function obRing(n) {
    const el = h("div", { class: "pts-ring" });
    el.innerHTML = `<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="90" fill="none" stroke="var(--brand-300)" stroke-width="20"/></svg><div class="pr-center"><div class="pr-num">${n}</div><div class="pr-lbl">Left</div></div>`;
    return el;
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
      d.settings.weeklyBudget = data.weeklyBudget ?? 28;
      d.settings.mode = data.mode;
      d.settings.age = parseInt(data.age, 10) || null;
      const sw = parseFloat(data.startWeight), gw = parseFloat(data.goalWeight);
      d.goal = { startDate: todayKey(), startWeight: Number.isFinite(sw) ? sw : null, goalWeight: Number.isFinite(gw) ? gw : null };
      if (Number.isFinite(sw)) d.weighIns = [{ date: todayKey(), weight: +sw.toFixed(1) }];
    });
    await flush();
    window.__boot();
  }

  function segBtn(label, on, cb) { return h("button", { class: "seg-btn" + (on ? " on" : ""), onClick: cb }, label); }
}
