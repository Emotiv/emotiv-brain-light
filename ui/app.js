// Frontend. Talks to Python through window.pywebview.api.* and receives backend
// events through window.pushEvent(), which the engine calls via evaluate_js.

const STEPS = ["credentials", "cortex", "access", "headset", "session", "profile", "stream", "bulb"];

const state = {
  settings: {},
  metricPalette: {},
  mode: "metrics",
  running: false,
  profiles: [],
  headsets: [],
  selectedHeadset: "",
  loadedProfile: "",
  actionColors: {},
  actionOrder: [],
  sensitivity: [],
  steps: {},
  scores: {},
  leader: null,

  // Training
  commands: { enabled: [], disabled: [], trained: {}, available: [], max_active: 4 },
  quality: {},
  qualityView: "cq",
  trainingResult: null,
  training: null, // { action, phase, started, score, threshold }

  // Folding. A card auto-folds once at the moment its choice is made, and
  // never again — after that it is the user's to open and close.
  changingProfile: false,
  autoFoldedFor: "",
};

// Contact quality and EEG quality share one 0-4 grading per sensor: 0 is
// nothing at all, 4 is good. EMOTIV colours them the same way everywhere.
const QUALITY_COLORS = ["#4a4f5a", "#ff5468", "#f2974e", "#e9cc40", "#50e17d"];

// How long Cortex records one command. It signals both ends on the `sys`
// stream, so this only paces the countdown between them.
const TRAINING_SECONDS = 8;

// Where each electrode sits on a head seen from above, nose up, on a unit
// circle. Every EMOTIV headset names its sensors after 10-20 positions, so one
// table covers Insight, EPOC, EPOC X and MN8 alike.
const SENSOR_POSITIONS = {
  Nz: [0, -1], Fp1: [-0.309, -0.951], Fp2: [0.309, -0.951],
  AF7: [-0.55, -0.75], AF3: [-0.34, -0.76], AF4: [0.34, -0.76], AF8: [0.55, -0.75],
  F7: [-0.809, -0.587], F3: [-0.4, -0.52], Fz: [0, -0.5], F4: [0.4, -0.52], F8: [0.809, -0.587],
  FC5: [-0.63, -0.28], FC1: [-0.22, -0.26], FC2: [0.22, -0.26], FC6: [0.63, -0.28],
  T7: [-0.98, 0], C3: [-0.5, 0], Cz: [0, 0], C4: [0.5, 0], T8: [0.98, 0],
  T9: [-1.0, 0.18], T10: [1.0, 0.18],
  CP5: [-0.63, 0.28], CP1: [-0.22, 0.26], CP2: [0.22, 0.26], CP6: [0.63, 0.28],
  P7: [-0.809, 0.587], P3: [-0.4, 0.52], Pz: [0, 0.5], P4: [0.4, 0.52], P8: [0.809, 0.587],
  PO3: [-0.34, 0.76], PO4: [0.34, 0.76],
  O1: [-0.309, 0.951], Oz: [0, 1], O2: [0.309, 0.951],
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ─── i18n for static elements ─────────────────────────────────────────────
function applyStaticI18n() {
  $$("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const text = t(key);
    if (el.tagName === "OPTION") el.textContent = text;
    else el.textContent = text;
  });
  $$(".lang-chip").forEach((b) => b.classList.toggle("active", b.dataset.lang === LANG));
  renderRunButton();
  renderRunningPill();
  renderSteps();
  renderMetricBars();
  renderActionChips();
  renderSensitivity();
  renderLeader();
  renderProfileOptions();
  renderHeadsets();
  renderProfiles();
  renderCommands();
  renderQuality();
  renderBrainmap();
  renderTrainingCard();
  renderSummaries();
  if ($("#in-brand")) syncBrandHint();
}

// ─── Buttons / status ─────────────────────────────────────────────────────
function renderRunButton() {
  const btn = $("#btn-run");
  btn.textContent = state.running ? t("btn.stop") : t("btn.start");
  btn.classList.toggle("stop", state.running);
}

function renderRunningPill() {
  const pill = $("#running-pill");
  pill.textContent = state.running ? t("running.yes") : t("running.no");
  pill.classList.toggle("on", state.running);
  $("#brand-dot").classList.toggle("live", state.running);
}

function renderSteps() {
  const host = $("#steps");
  host.innerHTML = "";
  for (const step of STEPS) {
    // The "profile" step only makes sense in Mental Commands mode.
    if (step === "profile" && state.mode !== "commands") continue;

    const info = state.steps[step] || { state: "idle" };
    const el = document.createElement("div");
    el.className = "step " + (info.state || "idle");

    const dot = document.createElement("div");
    dot.className = "step-dot";

    const body = document.createElement("div");
    const name = document.createElement("div");
    name.className = "step-name";
    name.textContent = t("step." + step);
    body.appendChild(name);

    if (info.code) {
      const msg = document.createElement("div");
      msg.className = "step-msg";
      msg.textContent = t(info.code, info.params);
      body.appendChild(msg);
    }

    el.appendChild(dot);
    el.appendChild(body);
    host.appendChild(el);
  }
}

// ─── Log ──────────────────────────────────────────────────────────────────
const logEntries = [];

function addLog(level, code, params) {
  logEntries.push({ level, code, params, time: new Date() });
  if (logEntries.length > 300) logEntries.shift();
  renderLog();
}

function renderLog() {
  const host = $("#log");
  if (!logEntries.length) {
    host.innerHTML = `<div class="log-line info"><span class="log-text">${t("log.empty")}</span></div>`;
    return;
  }
  const atBottom = host.scrollHeight - host.scrollTop - host.clientHeight < 40;
  host.innerHTML = "";
  for (const e of logEntries) {
    const line = document.createElement("div");
    line.className = "log-line " + e.level;
    const time = document.createElement("span");
    time.className = "log-time";
    time.textContent = e.time.toTimeString().slice(0, 8);
    const text = document.createElement("span");
    text.className = "log-text";
    text.textContent = t(e.code, e.params);
    line.appendChild(time);
    line.appendChild(text);
    host.appendChild(line);
  }
  if (atBottom) host.scrollTop = host.scrollHeight;
}

// ─── Mode ─────────────────────────────────────────────────────────────────
function renderMode() {
  $$(".mode-card").forEach((c) => c.classList.toggle("active", c.dataset.mode === state.mode));
  $("#metrics-view").classList.toggle("hidden", state.mode !== "metrics");
  $("#commands-view").classList.toggle("hidden", state.mode !== "commands");
  renderSteps();
  renderProfiles();
  renderTrainingCard();
  updateLiveEmpty();
}

function updateLiveEmpty() {
  const hasData =
    state.mode === "metrics" ? Object.keys(state.scores).length > 0 : state.actionOrder.length > 0;
  $("#live-empty").classList.toggle("hidden", hasData);
}

// ─── Metrics ──────────────────────────────────────────────────────────────
function renderMetricBars() {
  const host = $("#metric-bars");
  host.innerHTML = "";
  for (const [key, color] of Object.entries(state.metricPalette)) {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.dataset.metric = key;
    if (key === state.leader) row.classList.add("leading");

    const name = document.createElement("div");
    name.className = "bar-name";
    const sw = document.createElement("i");
    sw.className = "swatch";
    sw.style.background = color;
    const label = document.createElement("span");
    label.textContent = t("metric." + key);
    name.appendChild(sw);
    name.appendChild(label);

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.background = color;
    const score = state.scores[key];
    fill.style.width = ((score || 0) * 100).toFixed(1) + "%";
    track.appendChild(fill);

    const value = document.createElement("div");
    value.className = "bar-value";
    value.textContent = score === undefined ? "—" : score.toFixed(2);

    row.appendChild(name);
    row.appendChild(track);
    row.appendChild(value);
    host.appendChild(row);
  }
}

function updateMetricBars() {
  for (const [key, score] of Object.entries(state.scores)) {
    const row = $(`.bar-row[data-metric="${key}"]`);
    if (!row) continue;
    row.querySelector(".bar-fill").style.width = (score * 100).toFixed(1) + "%";
    row.querySelector(".bar-value").textContent = score.toFixed(2);
    row.classList.toggle("leading", key === state.leader);
  }
}

// ─── Devices: headsets and profiles ───────────────────────────────────────
function pickItem({ id, label, tag, tagClass, selected, onClick }) {
  const btn = document.createElement("button");
  btn.className = "pick-item" + (selected ? " selected" : "");
  btn.dataset.id = id;

  const radio = document.createElement("i");
  radio.className = "pick-radio";
  const main = document.createElement("span");
  main.className = "pick-main";
  main.textContent = label;

  btn.appendChild(radio);
  btn.appendChild(main);
  if (tag) {
    const tagEl = document.createElement("span");
    tagEl.className = "pick-tag " + (tagClass || "");
    tagEl.textContent = tag;
    btn.appendChild(tagEl);
  }
  btn.addEventListener("click", () => onClick(btn));
  return btn;
}

function renderHeadsets() {
  const host = $("#headset-list");
  host.innerHTML = "";
  host.classList.toggle("scroll", state.headsets.length > 4);
  $("#headset-empty").classList.toggle("hidden", state.headsets.length > 0);

  for (const h of state.headsets) {
    const connected = h.status === "connected";
    host.appendChild(
      pickItem({
        id: h.id,
        label: h.id,
        tag: h.virtual
          ? t("tag.virtual")
          : connected
          ? t("tag.connected")
          : tHas("headset.status." + h.status)
          ? t("headset.status." + h.status)
          : h.status,
        tagClass: h.virtual ? "virtual" : connected ? "connected" : "",
        selected: h.id === state.selectedHeadset,
        onClick: async (btn) => {
          if (!state.running) return addLog("error", "err.not_running", {});
          $$("#headset-list .pick-item").forEach((b) => (b.disabled = true));
          const res = await window.pywebview.api.select_headset(h.id);
          $$("#headset-list .pick-item").forEach((b) => (b.disabled = false));
          if (res && res.ok === false) addLog("error", res.code, res.params || {});
        },
      })
    );
  }
}

function renderProfiles() {
  const host = $("#profile-list");
  host.innerHTML = "";
  host.classList.toggle("scroll", state.profiles.length > 4);

  // Profiles only matter in BCI mode, and only once a headset is connected.
  const relevant = state.mode === "commands";
  $("#profile-block").classList.toggle("hidden", !relevant);
  if (!relevant) return;

  const ready = !!state.selectedHeadset;
  $("#profile-empty").classList.toggle("hidden", ready && state.profiles.length > 0);
  $("#profile-empty").textContent = ready ? t("setup.no_profiles") : t("panel.connect_first");
  if (!ready) return;

  // Once one is loaded the list has done its job. Show the answer and keep the
  // other twenty-eight profiles behind a button.
  const settled = state.loadedProfile && !state.changingProfile;
  $("#btn-change-profile").classList.toggle("hidden", !settled);
  const listed = settled ? [state.loadedProfile] : state.profiles;

  for (const name of listed) {
    host.appendChild(
      pickItem({
        id: name,
        label: name,
        tag: name === state.loadedProfile ? t("tag.loaded") : "",
        tagClass: "connected",
        selected: name === state.loadedProfile,
        onClick: async () => {
          if (!state.running) return addLog("error", "err.not_running", {});
          $$("#profile-list .pick-item").forEach((b) => (b.disabled = true));
          const res = await window.pywebview.api.select_profile(name);
          $$("#profile-list .pick-item").forEach((b) => (b.disabled = false));
          if (res && res.ok === false) addLog("error", res.code, res.params || {});
        },
      })
    );
  }
}

// ─── Mental commands ──────────────────────────────────────────────────────
function renderActionChips() {
  const host = $("#action-chips");
  host.innerHTML = "";
  const all = ["neutral", ...state.actionOrder];
  for (const action of all) {
    const color = state.actionColors[action] || "#666";
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.dataset.action = action;
    chip.style.borderColor = color + "55";

    const sw = document.createElement("i");
    sw.className = "swatch";
    sw.style.background = color;
    const label = document.createElement("span");
    label.textContent = t("action." + action) === "action." + action ? action : t("action." + action);

    chip.appendChild(sw);
    chip.appendChild(label);
    host.appendChild(chip);
  }
}

// Cortex stores one sensitivity per trainable action, 1 to 10, aligned with the
// action order and skipping neutral — the same order the slot colours follow.
function renderSensitivity() {
  const host = $("#sensitivity-list");
  const block = $("#sensitivity-block");
  host.innerHTML = "";

  const actions = state.actionOrder;
  block.classList.toggle("hidden", actions.length === 0);
  if (!actions.length) return;

  actions.forEach((action, i) => {
    const colour = state.actionColors[action] || "#666";
    const value = state.sensitivity[i] ?? 5;

    const row = document.createElement("div");
    row.className = "sens-row";
    row.dataset.action = action;

    const name = document.createElement("div");
    name.className = "sens-name";
    const sw = document.createElement("i");
    sw.className = "swatch";
    sw.style.background = colour;
    const label = document.createElement("span");
    label.textContent = tHas("action." + action) ? t("action." + action) : action;
    name.appendChild(sw);
    name.appendChild(label);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "1";
    slider.max = "10";
    slider.step = "1";
    slider.value = String(value);
    slider.style.accentColor = colour;

    const readout = document.createElement("div");
    readout.className = "sens-value";
    readout.textContent = String(value);

    // Show the new number while dragging, but only talk to Cortex on release —
    // a request per pixel would flood the session.
    slider.addEventListener("input", () => (readout.textContent = slider.value));
    slider.addEventListener("change", () => commitSensitivity(i, Number(slider.value), row));

    row.appendChild(name);
    row.appendChild(slider);
    row.appendChild(readout);
    host.appendChild(row);
  });
}

async function commitSensitivity(index, value, row) {
  if (!state.running) {
    addLog("error", "err.not_running", {});
    renderSensitivity();
    return;
  }
  const next = state.actionOrder.map((_, i) => state.sensitivity[i] ?? 5);
  next[index] = value;

  row.classList.add("busy");
  try {
    const res = await window.pywebview.api.set_sensitivity(next);
    if (res && res.ok === false) {
      addLog("error", res.code, res.params || {});
      renderSensitivity();
    }
  } finally {
    row.classList.remove("busy");
  }
}

function highlightAction(action) {
  $$("#action-chips .chip").forEach((chip) => {
    const on = chip.dataset.action === action;
    chip.classList.toggle("active", on);
    const color = state.actionColors[chip.dataset.action] || "#666";
    chip.style.background = on ? color + "26" : "rgba(255,255,255,0.05)";
    chip.style.borderColor = on ? color : color + "55";
  });
}

// ─── Current target ───────────────────────────────────────────────────────
function renderLeader() {
  const label = state.leader
    ? state.mode === "metrics"
      ? t("metric." + state.leader)
      : t("action." + state.leader) === "action." + state.leader
      ? state.leader
      : t("action." + state.leader)
    : "—";
  $("#leader-label").textContent = label;
}

function applyTarget(data) {
  const color = data.color || "#5ab0ee";
  document.documentElement.style.setProperty("--live", color);
  $("#leader-hex").textContent = color.toUpperCase();
  $("#leader-hsv").textContent = `H ${data.hue}°  S ${data.sat}%  V ${data.bright}%`;

  state.leader = data.label;
  renderLeader();

  if (state.mode === "metrics") {
    // Cortex drops a metric from the sample while it is inactive. Replacing the
    // whole object would blank that bar; merging keeps the last known reading on
    // screen until a fresh one arrives.
    state.scores = { ...state.scores, ...(data.scores || {}) };
    updateMetricBars();
  } else {
    const power = data.power || 0;
    $("#cmd-power-value").textContent = power.toFixed(2);
    const bar = $("#cmd-power-bar");
    bar.style.width = (power * 100).toFixed(1) + "%";
    bar.style.background = color;
    highlightAction(data.label);
  }
  updateLiveEmpty();
}

// ─── Training: sensor quality ─────────────────────────────────────────────
// Two different questions, and a headset can pass one while failing the other.
// Contact quality asks whether the electrode is touching skin well enough to
// read anything; EEG quality asks whether what arrives is brain signal rather
// than jaw, movement or mains hum. Training on a bad signal produces a
// signature that never fires, so both are on screen before anyone records.

function qualityColor(grade) {
  return QUALITY_COLORS[Math.max(0, Math.min(4, Math.round(grade || 0)))];
}

// A number that ticks over twice a second is movement, not information: the
// eye keeps going back to it and learns nothing. What actually matters is
// which electrode is bad and roughly how good the whole thing is — so the
// dots carry the detail and one badge carries the summary.
function qualityGrade(percent) {
  return percent >= 80 ? "good" : percent >= 50 ? "fair" : "poor";
}

function overallQuality() {
  const q = state.quality || {};
  const both = [q.cq_overall, q.eq_overall].filter((v) => typeof v === "number");
  return both.length ? Math.min(...both) : null;
}

function renderQuality() {
  const q = state.quality || {};
  const has = typeof q.cq_overall === "number" || typeof q.eq_overall === "number";
  $("#quality-block").classList.toggle("hidden", !state.selectedHeadset);

  const shown = state.qualityView === "eq" ? q.eq_overall : q.cq_overall;
  $("#q-big").textContent = typeof shown === "number" ? Math.round(shown) + "%" : "—";
  $("#q-big").style.color = typeof shown === "number"
    ? qualityColor((Math.max(0, Math.min(100, shown)) / 100) * 4)
    : "";

  drawHeadmap($("#headmap"), (state.quality || {})[state.qualityView] || {}, {
    radius: 62, cx: 80, cy: 92, dot: 7, labels: true,
  });

  const verdict = $("#q-verdict");
  const worst = overallQuality();
  if (!has || worst === null) {
    verdict.textContent = t("quality.waiting");
    verdict.className = "small muted";
  } else {
    const grade = qualityGrade(worst);
    verdict.textContent = t("quality.verdict." + grade);
    verdict.className = "small " + grade;
  }
  renderDevicePill();
}

/** The device the app is on, with its sensors, kept in the header. */
function renderDevicePill() {
  const pill = $("#device-pill");
  pill.classList.toggle("hidden", !state.running || !state.selectedHeadset);
  if (!state.selectedHeadset) return;

  $("#pill-name").textContent = state.selectedHeadset;
  // The header shows contact quality: an electrode that is not touching is the
  // failure worth noticing from across the room.
  drawHeadmap($("#pill-head"), (state.quality || {}).cq || {}, {
    radius: 17, cx: 22, cy: 26, dot: 3, labels: false, viewBox: true,
  });

  const badge = $("#pill-quality");
  const worst = overallQuality();
  badge.textContent = worst === null ? "—" : Math.round(worst);
  badge.className = "quality-badge" + (worst === null ? "" : " " + qualityGrade(worst));
  pill.title = worst === null ? state.selectedHeadset
    : state.selectedHeadset + " — " + t("quality.contact") + " " +
      Math.round(state.quality.cq_overall || 0) + "%, " +
      t("quality.eeg") + " " + Math.round(state.quality.eq_overall || 0) + "%";
}

/** Head seen from above, nose up — the orientation every EMOTIV app draws, so
 *  the left and right of the picture match the user's own head. */
function drawHeadmap(svg, grades, opts) {
  if (!svg) return;
  const { radius: r, cx, cy, dot, labels } = opts;
  const names = Object.keys(grades);

  // One shape for the head, and the nose as an open chevron resting on it.
  // Drawing the outline as an arc-with-nose path instead put the arc's
  // endpoints off the circle, so SVG re-centred it on a circle of its own and
  // the head came out doubled and visibly off.
  const noseHalf = Math.PI / 18;                     // 10° either side of centre
  const bx = r * Math.sin(noseHalf);
  const by = r * Math.cos(noseHalf);

  let out =
    '<circle class="head-outline" cx="' + cx + '" cy="' + cy + '" r="' + r + '" />' +
    '<path class="head-nose" d="M ' + (cx - bx) + " " + (cy - by) +
      " L " + cx + " " + (cy - r - r * 0.15) +
      " L " + (cx + bx) + " " + (cy - by) + '" />';

  names.forEach((name, i) => {
    let pos = SENSOR_POSITIONS[name];
    if (!pos) {
      // An unrecognised label still gets a dot: hiding it would quietly drop a
      // sensor the user can see on the headset in their hands.
      const angle = (i / Math.max(names.length, 1)) * Math.PI * 2;
      pos = [Math.sin(angle) * 0.8, -Math.cos(angle) * 0.8];
    }
    const x = cx + pos[0] * r * 0.82;
    const y = cy + pos[1] * r * 0.82;
    const grade = Math.max(0, Math.min(4, Math.round(grades[name] || 0)));
    out += '<circle class="sensor" cx="' + x + '" cy="' + y + '" r="' + dot + '" fill="' +
      qualityColor(grade) + '">';
    if (labels) out += "<title>" + escapeText(name + " — " + t("quality.grade." + grade)) + "</title>";
    out += "</circle>";
    if (labels) {
      out += '<text class="sensor-label" x="' + x + '" y="' + (y + dot + 8) + '">' +
        escapeText(name) + "</text>";
    }
  });
  svg.innerHTML = out;
}

// ─── Folding ──────────────────────────────────────────────────────────────
function setCollapsed(id, collapsed) {
  const card = document.getElementById(id);
  if (card) card.classList.toggle("collapsed", collapsed);
}

function isCollapsed(id) {
  const card = document.getElementById(id);
  return !!card && card.classList.contains("collapsed");
}

/** Fold the pickers away once the choice behind them has been made.
 *  Runs once per profile, so it never fights a card the user reopened. */
function autoFold() {
  const key = state.loadedProfile || state.selectedHeadset;
  if (!key || state.autoFoldedFor === key) return;
  state.autoFoldedFor = key;

  const ready = state.mode === "commands" ? !!state.loadedProfile : !!state.selectedHeadset;
  if (ready) setCollapsed("devices-card", true);

  // An untrained profile is the one case where the panel is the point.
  const trained = Object.keys(state.commands.trained || {}).length;
  setCollapsed("training-card", trained > 0);
}

function renderSummaries() {
  const parts = [];
  if (state.selectedHeadset) parts.push(state.selectedHeadset);
  if (state.mode === "commands" && state.loadedProfile) parts.push(state.loadedProfile);
  $("#devices-summary").textContent = parts.length ? parts.join("  ·  ") : t("status.pick_headset");

  const trained = state.commands.trained || {};
  const count = Object.keys(trained).filter((a) => a !== "neutral").length;
  const skill = state.trainingResult && typeof state.trainingResult.skill === "number"
    ? "  ·  " + t("stat.skill") + " " + Math.round(state.trainingResult.skill * 100) + "%"
    : "";
  $("#training-summary").textContent = count
    ? t("summary.commands", { count }) + skill
    : t("summary.untrained");
}

// ─── Training: the command roster ─────────────────────────────────────────
// One row per command, the way EmotivBCI lists them: name, how many accepted
// recordings stand behind it, a switch, and the buttons that change it.

function renderCommands() {
  const host = $("#command-list");
  if (!host) return;
  host.innerHTML = "";

  const { enabled, disabled, trained } = state.commands;
  const rows = ["neutral", ...enabled, ...disabled];

  for (const action of rows) {
    host.appendChild(commandRow(action, enabled.includes(action)));
  }
  renderAddCommand();
}

function commandRow(action, on) {
  const row = document.createElement("div");
  row.className = "cmd-row" + (action !== "neutral" && !on ? " off" : "");
  row.dataset.action = action;

  // Neutral is not a slot: it always exists, always keeps its own colour, and
  // cannot be switched off or removed.
  const isNeutral = action === "neutral";
  const color = state.actionColors[action] || (isNeutral ? "#ff0066" : "#666");
  const times = state.commands.trained[action] || 0;

  const toggleCell = document.createElement("div");
  if (!isNeutral) {
    const toggle = document.createElement("button");
    toggle.className = "toggle" + (on ? " on" : "");
    toggle.title = t(on ? "cmd.disable" : "cmd.enable");
    toggle.addEventListener("click", () => toggleCommand(action, !on, row));
    toggleCell.appendChild(toggle);
  }

  const name = document.createElement("div");
  name.className = "cmd-name";
  const sw = document.createElement("i");
  sw.className = "swatch";
  sw.style.background = color;
  const label = document.createElement("span");
  label.textContent = actionLabel(action);
  name.appendChild(sw);
  name.appendChild(label);

  const count = document.createElement("div");
  count.className = "cmd-count" + (times ? "" : " none");
  count.textContent = times || "—";
  count.title = t("cmd.times", { count: times });

  const actions = document.createElement("div");
  actions.className = "cmd-actions";

  const train = document.createElement("button");
  train.className = "btn tiny primary";
  train.textContent = t(times ? "btn.retrain" : "btn.train");
  train.addEventListener("click", () => startTraining(action));
  actions.appendChild(train);

  // Erase is only offered when there is something to erase.
  if (times) {
    const erase = document.createElement("button");
    erase.className = "btn tiny ghost danger";
    erase.textContent = t("btn.erase");
    erase.title = t("cmd.erase.hint");
    erase.addEventListener("click", async () => {
      if (!confirm(t("confirm.erase", { action: actionLabel(action) }))) return;
      await callTraining(() => window.pywebview.api.erase_training(action), erase, row);
    });
    actions.appendChild(erase);
  }

  row.appendChild(toggleCell);
  row.appendChild(name);
  row.appendChild(count);
  row.appendChild(actions);
  return row;
}

function renderAddCommand() {
  const select = $("#in-add-command");
  const button = $("#btn-add-command");
  const hint = $("#add-command-hint");
  if (!select) return;

  const { enabled, disabled, available, max_active } = state.commands;
  const taken = new Set([...enabled, ...disabled]);
  const free = (available || []).filter((a) => !taken.has(a));
  const full = enabled.length >= max_active;

  select.innerHTML = "";
  for (const action of free) {
    const opt = document.createElement("option");
    opt.value = action;
    opt.textContent = actionLabel(action);
    select.appendChild(opt);
  }

  select.disabled = full || !free.length;
  button.disabled = full || !free.length;
  hint.textContent = full
    ? t("cmd.slots_full", { max: max_active })
    : t("cmd.slots_left", { left: max_active - enabled.length });
}

async function toggleCommand(action, on, row) {
  const { enabled, max_active } = state.commands;
  if (on && enabled.length >= max_active) {
    addLog("error", "err.too_many_actions", { max: max_active });
    return;
  }
  const next = on ? [...enabled, action] : enabled.filter((a) => a !== action);
  await callTraining(() => window.pywebview.api.set_active_actions(next), null, row);
}

/** Run one training call with the row disabled, and surface whatever comes back. */
async function callTraining(fn, button, row) {
  if (!state.running) return addLog("error", "err.not_running", {});
  if (button) button.disabled = true;
  if (row) row.classList.add("busy");
  try {
    const res = await fn();
    if (res && res.ok === false) addLog("error", res.code, res.params || {});
    return res;
  } finally {
    if (button) button.disabled = false;
    if (row) row.classList.remove("busy");
  }
}

async function createProfile() {
  const name = $("#in-new-profile").value.trim();
  if (!name) return;
  const button = $("#btn-create-profile");
  button.disabled = true;
  try {
    const res = await window.pywebview.api.create_profile(name);
    if (res && res.ok === false) {
      addLog("error", res.code, res.params || {});
      return;
    }
    $("#profile-overlay").classList.add("hidden");
  } finally {
    button.disabled = false;
  }
}

function renderTrainingCard() {
  // Training needs a loaded profile: every call it makes is scoped to one.
  const show = state.mode === "commands" && state.running && !!state.loadedProfile;
  $("#training-card").classList.toggle("hidden", !show);
}

// ─── Training: the brain map ──────────────────────────────────────────────
// Cortex gives one point per command. Neutral is pinned at the origin and
// every other command sits at its distance from it, which is the only number
// that matters: a command drawn on top of neutral is one the detector cannot
// tell apart from doing nothing at all.

function renderBrainmap() {
  const svg = $("#brainmap");
  if (!svg) return;

  const points = (state.trainingResult && state.trainingResult.brain_map) || [];
  const cx = 140;
  const cy = 156;
  const r = 128;

  let out = "";
  for (const ring of [0.25, 0.5, 0.75, 1]) {
    const rr = r * ring;
    out += '<path class="bm-arc" d="M ' + (cx - rr) + " " + cy + " A " + rr + " " + rr +
      " 0 0 1 " + (cx + rr) + " " + cy + '" />';
  }
  out += '<line class="bm-axis" x1="' + (cx - r) + '" y1="' + cy + '" x2="' + (cx + r) +
    '" y2="' + cy + '" />';

  const legend = [];
  for (const point of points) {
    const [px, py] = point.coordinates || [0, 0];
    const distance = Math.min(1, Math.hypot(px, py));
    const x = cx + px * r;
    const y = cy - Math.abs(py) * r;
    const color = state.actionColors[point.action] || "#ff0066";

    out +=
      '<circle class="bm-halo" cx="' + x + '" cy="' + y + '" r="13" fill="' + color + '" />' +
      '<circle class="bm-dot" cx="' + x + '" cy="' + y + '" r="6.5" fill="' + color + '" />';
    legend.push({ action: point.action, color, distance });
  }
  svg.innerHTML = out;

  const host = $("#brainmap-legend");
  host.innerHTML = "";
  for (const item of legend) {
    const row = document.createElement("div");
    row.className = "bm-legend-row";
    const sw = document.createElement("i");
    sw.className = "swatch";
    sw.style.background = item.color;
    const label = document.createElement("span");
    label.textContent = actionLabel(item.action);
    const dist = document.createElement("span");
    dist.className = "dist";
    // Neutral is the origin, so its own distance is not a number worth showing.
    dist.textContent = item.action === "neutral" ? "—" : item.distance.toFixed(2);
    row.appendChild(sw);
    row.appendChild(label);
    row.appendChild(dist);
    host.appendChild(row);
  }
  if (!legend.length) {
    host.innerHTML = '<div class="muted small">' + escapeText(t("panel.brainmap.empty")) + "</div>";
  }

  renderTrainingStats();
}

function renderTrainingStats() {
  const host = $("#training-stats");
  const result = state.trainingResult || {};
  host.innerHTML = "";

  const rows = [
    ["stat.skill", typeof result.skill === "number" ? Math.round(result.skill * 100) + "%" : null],
    ["stat.threshold", typeof result.threshold === "number" ? result.threshold.toFixed(2) : null],
    ["stat.last_score", typeof result.last_score === "number" ? result.last_score.toFixed(2) : null],
  ];
  for (const [key, value] of rows) {
    if (value === null) continue;
    const row = document.createElement("div");
    row.className = "stat-row";
    const label = document.createElement("span");
    label.textContent = t(key);
    const b = document.createElement("b");
    b.textContent = value;
    row.appendChild(label);
    row.appendChild(b);
    host.appendChild(row);
  }
}

// ─── Training: the eight-second window ────────────────────────────────────
// Cortex opens and closes the window itself, on the `sys` stream. The
// countdown here only fills the gap between MC_Started and MC_Succeeded, so it
// can never disagree with what is actually being recorded.

let trainingTimer = null;

async function startTraining(action) {
  if (!state.running) return addLog("error", "err.not_running", {});

  state.training = { action, phase: "arming", started: 0, score: null, threshold: null };
  renderTrainingOverlay();
  $("#training-overlay").classList.remove("hidden");

  const res = await window.pywebview.api.start_training(action);
  if (res && res.ok === false) {
    addLog("error", res.code, res.params || {});
    closeTrainingOverlay();
  }
}

function onTrainingEvent(data) {
  const event = data.event;
  if (!state.training && event !== "MC_Started") return;

  if (event === "MC_Started") {
    if (!state.training) state.training = { action: data.action, score: null };
    state.training.phase = "recording";
    state.training.started = Date.now();
    startCountdown();
  } else if (event === "MC_Succeeded") {
    stopCountdown();
    state.training.phase = "review";
  } else if (event === "MC_Failed") {
    stopCountdown();
    state.training.phase = "failed";
  } else if (event === "MC_Completed" || event === "MC_Rejected") {
    // The decision is in and the profile has been saved: nothing left to show.
    // Fold the panel too — what the user wants to look at now is the light.
    closeTrainingOverlay();
    if (event === "MC_Completed") setCollapsed("training-card", true);
    return;
  }
  renderTrainingOverlay();
}

function startCountdown() {
  stopCountdown();
  trainingTimer = setInterval(renderTrainingOverlay, 100);
}

function stopCountdown() {
  if (trainingTimer) clearInterval(trainingTimer);
  trainingTimer = null;
}

function closeTrainingOverlay() {
  stopCountdown();
  state.training = null;
  $("#training-overlay").classList.add("hidden");
}

function renderTrainingOverlay() {
  const training = state.training;
  if (!training) return;

  const action = training.action || "neutral";
  const color = state.actionColors[action] || "#ff0066";
  $("#train-swatch").style.background = color;
  $("#train-action-name").textContent = actionLabel(action);

  const ring = $("#train-ring-fill");
  const count = $("#train-count");
  const phase = $("#train-phase");
  const instruction = $("#train-instruction");
  const circumference = 2 * Math.PI * 52;

  let progress = 0;
  count.classList.remove("small");

  if (training.phase === "arming") {
    phase.className = "train-phase";
    phase.textContent = t("train.phase.arming");
    count.textContent = "…";
    instruction.textContent = t("train.getready");
  } else if (training.phase === "recording") {
    const elapsed = (Date.now() - training.started) / 1000;
    progress = Math.min(1, elapsed / TRAINING_SECONDS);
    phase.className = "train-phase";
    phase.textContent = t("train.phase.recording");
    count.textContent = Math.max(0, Math.ceil(TRAINING_SECONDS - elapsed));
    instruction.textContent = instructionFor(action);
  } else if (training.phase === "review") {
    progress = 1;
    phase.className = "train-phase ok";
    phase.textContent = t("train.phase.review");
    count.classList.add("small");
    count.textContent = t("train.keep");
    instruction.textContent = t("train.keep.hint");
  } else if (training.phase === "failed") {
    progress = 1;
    phase.className = "train-phase err";
    phase.textContent = t("train.phase.failed");
    count.classList.add("small");
    count.textContent = t("train.failed");
    instruction.textContent = t("train.failed.hint");
  }

  ring.style.strokeDashoffset = String(circumference * (1 - progress));
  ring.style.stroke = training.phase === "failed" ? "var(--err)" : color;

  renderTrainingScore();
  renderTrainingButtons();
}

function renderTrainingScore() {
  const training = state.training;
  const box = $("#train-score");
  const show = training.phase === "review" && typeof training.score === "number";
  box.classList.toggle("hidden", !show);
  if (!show) return;

  const score = Math.max(0, Math.min(1, training.score));
  $("#train-score-value").textContent = score.toFixed(2);
  const bar = $("#train-score-bar");
  bar.style.width = (score * 100).toFixed(0) + "%";
  // Judged against the profile's own threshold, not an invented number.
  const threshold = typeof training.threshold === "number" ? training.threshold : 0.75;
  bar.style.background = score >= threshold ? "var(--ok)" : "var(--warn)";
}

function renderTrainingButtons() {
  const host = $("#train-buttons");
  const training = state.training;
  host.innerHTML = "";

  const add = (label, className, onClick) => {
    const button = document.createElement("button");
    button.className = "btn " + className;
    button.textContent = label;
    button.addEventListener("click", async () => {
      $$("#train-buttons .btn").forEach((b) => (b.disabled = true));
      await onClick();
    });
    host.appendChild(button);
    return button;
  };

  if (training.phase === "review") {
    add(t("btn.discard"), "ghost", async () => {
      const res = await window.pywebview.api.reject_training();
      if (res && res.ok === false) addLog("error", res.code, res.params || {});
      closeTrainingOverlay();
    });
    add(t("btn.accept"), "primary", async () => {
      const res = await window.pywebview.api.accept_training();
      if (res && res.ok === false) {
        addLog("error", res.code, res.params || {});
        closeTrainingOverlay();
      }
    });
  } else if (training.phase === "failed") {
    add(t("btn.close"), "ghost", async () => closeTrainingOverlay());
    add(t("btn.retry"), "primary", async () => {
      const action = training.action;
      closeTrainingOverlay();
      await startTraining(action);
    });
  } else {
    // Nothing to decide yet: the only way out is to abandon the recording,
    // which Cortex treats exactly like discarding it.
    add(t("btn.cancel"), "ghost", async () => {
      await window.pywebview.api.reject_training();
      closeTrainingOverlay();
    });
  }
}

function actionLabel(action) {
  return tHas("action." + action) ? t("action." + action) : action;
}

function instructionFor(action) {
  return tHas("train.instr." + action)
    ? t("train.instr." + action)
    : t("train.instr.generic", { action: actionLabel(action) });
}

function escapeText(value) {
  return String(value).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
}

// ─── Settings ─────────────────────────────────────────────────────────────
function renderProfileOptions() {
  const sel = $("#in-profile");
  const current = state.settings.profile || "";
  sel.innerHTML = "";

  const none = document.createElement("option");
  none.value = "";
  none.textContent = t("setup.profile.none");
  sel.appendChild(none);

  for (const name of state.profiles) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (name === current) opt.selected = true;
    sel.appendChild(opt);
  }
  $("#no-profiles-note").classList.toggle("hidden", state.profiles.length > 0);
}

function syncBrandHint() {
  const brand = $("#in-brand").value || "yeelight";
  $("#brand-hint").textContent = t("setup.bulb.hint." + brand);
}

function fillSettingsForm() {
  const s = state.settings;
  $("#in-brand").value = s.light_brand || "yeelight";
  syncBrandHint();
  $("#in-client-id").value = s.client_id || "";
  $("#in-client-secret").value = "";
  $("#secret-saved-note").classList.toggle("hidden", !s.client_secret_set);
  $("#in-bulb-ip").value = s.bulb_ip || "";
  $("#in-score-mode").value = s.score_mode || "adaptive";
  $("#in-smooth").value = s.smooth_tau ?? 0.45;
  $("#in-bright-min").value = s.bright_min ?? 12;
  $("#in-bright-max").value = s.bright_max ?? 100;
  $("#in-training-feedback").checked = s.training_light_feedback !== false;
  syncTuningLabels();
  renderProfileOptions();
}

function syncTuningLabels() {
  $("#lbl-smooth").textContent = Number($("#in-smooth").value).toFixed(2) + "s";
  $("#lbl-bmin").textContent = $("#in-bright-min").value + "%";
  $("#lbl-bmax").textContent = $("#in-bright-max").value + "%";
}

async function saveSettings() {
  const payload = {
    client_id: $("#in-client-id").value.trim(),
    light_brand: $("#in-brand").value,
    bulb_ip: $("#in-bulb-ip").value.trim(),
    profile: $("#in-profile").value,
    score_mode: $("#in-score-mode").value,
    smooth_tau: Number($("#in-smooth").value),
    bright_min: Number($("#in-bright-min").value),
    bright_max: Number($("#in-bright-max").value),
    training_light_feedback: $("#in-training-feedback").checked,
  };
  // Blank secret = keep whatever is stored, so it is never wiped by accident.
  const secret = $("#in-client-secret").value.trim();
  if (secret) payload.client_secret = secret;

  state.settings = await window.pywebview.api.save_settings(payload);
  fillSettingsForm();
  $("#settings").classList.add("hidden");
}

// ─── Events coming from Python ────────────────────────────────────────────
window.pushEvent = function (event, data) {
  switch (event) {
    case "status":
      state.steps[data.step] = { state: data.state, code: data.code, params: data.params };
      renderSteps();
      if (data.state === "error" && data.code) addLog("error", data.code, data.params);
      break;
    case "log":
      addLog(data.level, data.code, data.params);
      break;
    case "target":
      applyTarget(data);
      break;
    case "profiles":
      state.profiles = data.items || [];
      renderProfileOptions();
      renderProfiles();
      break;
    case "headsets":
      state.headsets = data.items || [];
      state.selectedHeadset = data.selected || "";
      renderHeadsets();
      renderProfiles();
      renderDevicePill();
      renderQuality();
      renderSummaries();
      if (state.mode === "metrics") autoFold();
      break;
    case "actions":
      state.actionOrder = data.order || [];
      state.actionColors = data.colors || {};
      state.loadedProfile = data.profile || state.loadedProfile;
      state.changingProfile = false;
      renderActionChips();
      renderProfiles();
      renderSensitivity();
      renderSummaries();
      updateLiveEmpty();
      break;
    case "sensitivity":
      state.sensitivity = data.values || [];
      renderSensitivity();
      break;
    case "commands":
      state.changingProfile = false;
      state.commands = {
        enabled: data.enabled || [],
        disabled: data.disabled || [],
        trained: data.trained || {},
        available: data.available || [],
        max_active: data.max_active || 4,
      };
      state.loadedProfile = data.profile || state.loadedProfile;
      renderCommands();
      renderTrainingCard();
      renderSummaries();
      autoFold();
      break;
    case "quality":
      state.quality = data || {};
      renderQuality();
      break;
    case "training":
      onTrainingEvent(data);
      break;
    case "training_score":
      if (state.training) {
        state.training.score = data.score;
        state.training.threshold = data.threshold;
        renderTrainingOverlay();
      }
      break;
    case "training_result":
      state.trainingResult = data;
      renderBrainmap();
      renderSummaries();
      break;
    case "running":
      state.running = data.running;
      // A new session starts from a clean slate — held-over readings from the
      // previous run would be stale, not "last known".
      if (data.running) state.scores = {};
      if (!data.running) {
        state.selectedHeadset = "";
        state.loadedProfile = "";
        state.sensitivity = [];
        state.quality = {};
        state.trainingResult = null;
        state.commands = { enabled: [], disabled: [], trained: {}, available: [], max_active: 4 };
        state.changingProfile = false;
        state.autoFoldedFor = "";
        setCollapsed("devices-card", false);
        closeTrainingOverlay();
        renderHeadsets();
        renderProfiles();
        renderCommands();
        renderQuality();
        renderBrainmap();
        renderTrainingCard();
      }
      renderRunButton();
      renderRunningPill();
      renderDevicePill();
      renderSummaries();
      break;
    case "mode":
      state.mode = data.mode;
      renderMode();
      break;
  }
};

// ─── First-run wizard ─────────────────────────────────────────────────────
function showWelcomeStep(step) {
  $("#welcome").classList.remove("hidden");
  $("#app").classList.add("hidden");
  $("#welcome-language").classList.toggle("hidden", step !== "language");
  $("#welcome-brand").classList.toggle("hidden", step !== "brand");
}

function finishWelcome() {
  $("#welcome").classList.add("hidden");
  $("#app").classList.remove("hidden");
  applyStaticI18n();
  renderMode();
  fillSettingsForm();
  renderLog();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────
async function boot() {
  const info = await window.pywebview.api.get_state();
  state.settings = info.settings;
  state.metricPalette = info.metric_palette;
  state.mode = info.settings.mode || "metrics";
  state.profiles = info.profiles || [];

  if (!info.settings.language) {
    showWelcomeStep("language");
  } else {
    setLang(info.settings.language);
    // An install that predates the brand picker lands here with a language but
    // no brand; send it straight to the step it is missing.
    if (!info.settings.light_brand) showWelcomeStep("brand");
    else $("#app").classList.remove("hidden");
  }

  applyStaticI18n();
  renderMode();
  fillSettingsForm();
  renderLog();
}

function wire() {
  $$("#welcome-language .lang-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      setLang(btn.dataset.lang);
      state.settings = await window.pywebview.api.save_settings({ language: btn.dataset.lang });
      applyStaticI18n();
      if (state.settings.light_brand) finishWelcome();
      else showWelcomeStep("brand");
    })
  );

  $$(".brand-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      state.settings = await window.pywebview.api.save_settings({ light_brand: btn.dataset.brand });
      finishWelcome();
    })
  );

  $$(".lang-chip").forEach((btn) =>
    btn.addEventListener("click", async () => {
      setLang(btn.dataset.lang);
      state.settings = await window.pywebview.api.save_settings({ language: btn.dataset.lang });
      applyStaticI18n();
      renderMode();
      renderLog();
    })
  );

  $$(".mode-card").forEach((card) =>
    card.addEventListener("click", async () => {
      const mode = card.dataset.mode;
      if (mode === state.mode) return;
      state.mode = mode;
      renderMode();
      const res = await window.pywebview.api.set_mode(mode, $("#in-profile").value);
      if (res && res.ok === false) addLog("error", res.code, { detail: res.detail });
    })
  );

  $("#btn-run").addEventListener("click", async () => {
    $("#btn-run").disabled = true;
    try {
      const res = state.running
        ? await window.pywebview.api.stop()
        : await window.pywebview.api.start();
      if (res && res.ok === false && res.code) addLog("error", res.code, res.params || {});
    } finally {
      $("#btn-run").disabled = false;
    }
  });

  $("#btn-settings").addEventListener("click", () => {
    fillSettingsForm();
    $("#settings").classList.remove("hidden");
  });
  $("#btn-close-settings").addEventListener("click", () => $("#settings").classList.add("hidden"));
  $("#btn-save").addEventListener("click", saveSettings);
  $("#btn-clear-log").addEventListener("click", () => {
    logEntries.length = 0;
    renderLog();
  });

  $("#btn-refresh-headsets").addEventListener("click", async () => {
    const btn = $("#btn-refresh-headsets");
    btn.disabled = true;
    try {
      const res = await window.pywebview.api.refresh_headsets();
      if (res && res.ok === false) addLog("error", res.code, res.params || {});
    } finally {
      btn.disabled = false;
    }
  });

  $("#btn-discover").addEventListener("click", async () => {
    const btn = $("#btn-discover");
    btn.disabled = true;
    try {
      const ip = await window.pywebview.api.discover_bulb();
      if (ip) $("#in-bulb-ip").value = ip;
    } finally {
      btn.disabled = false;
    }
  });

  ["#in-smooth", "#in-bright-min", "#in-bright-max"].forEach((sel) =>
    $(sel).addEventListener("input", syncTuningLabels)
  );

  $("#in-brand").addEventListener("change", syncBrandHint);

  // A card head folds its own card; the header pill reaches the device card
  // from anywhere.
  $$(".card-head").forEach((head) =>
    head.addEventListener("click", () =>
      setCollapsed(head.dataset.collapse, !isCollapsed(head.dataset.collapse))
    )
  );

  $("#device-pill").addEventListener("click", () => {
    const open = isCollapsed("devices-card");
    setCollapsed("devices-card", !open);
    if (open) $("#devices-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  $("#btn-change-profile").addEventListener("click", () => {
    state.changingProfile = true;
    renderProfiles();
  });

  // ── Training ──
  $$(".q-tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      state.qualityView = tab.dataset.quality;
      $$(".q-tab").forEach((b) => b.classList.toggle("active", b === tab));
      renderQuality();
    })
  );

  $("#btn-add-command").addEventListener("click", async () => {
    const action = $("#in-add-command").value;
    if (!action) return;
    await callTraining(
      () => window.pywebview.api.set_active_actions([...state.commands.enabled, action]),
      $("#btn-add-command")
    );
  });

  $("#btn-new-profile").addEventListener("click", () => {
    $("#in-new-profile").value = "";
    $("#profile-overlay").classList.remove("hidden");
    $("#in-new-profile").focus();
  });
  $("#btn-cancel-profile").addEventListener("click", () =>
    $("#profile-overlay").classList.add("hidden")
  );
  $("#btn-create-profile").addEventListener("click", createProfile);
  $("#in-new-profile").addEventListener("keydown", (e) => {
    if (e.key === "Enter") createProfile();
  });

  $("#btn-reset-all").addEventListener("click", async () => {
    if (!confirm(t("confirm.reset_all", { profile: state.loadedProfile }))) return;
    await callTraining(() => window.pywebview.api.reset_training(), $("#btn-reset-all"));
  });
}

// A blank window with no explanation is the worst possible failure mode, so any
// bootstrap error is painted on screen and stashed for the Python side. The
// notice is an overlay rather than a body rewrite: a bridge that shows up late
// on a slow machine can still recover, and the app DOM underneath survives.
function fatalScreen(message) {
  window.__bootError = String(message);
  let box = document.getElementById("fatal-notice");
  if (!box) {
    box = document.createElement("div");
    box.id = "fatal-notice";
    box.className = "overlay";
    document.body.appendChild(box);
  }
  const safe = window.__bootError.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  box.innerHTML =
    '<div class="welcome-card" style="text-align:left">' +
    '<h1 style="font-size:18px;margin-bottom:12px">The interface failed to start</h1>' +
    '<pre style="white-space:pre-wrap;color:#ff5468;font-size:12px;margin:0">' + safe + "</pre></div>";
}

function clearFatalScreen() {
  const box = document.getElementById("fatal-notice");
  if (box) box.remove();
  window.__bootError = "";
}

window.addEventListener("error", (e) => fatalScreen(e.message + " @ " + e.filename + ":" + e.lineno));
window.addEventListener("unhandledrejection", (e) => fatalScreen(e.reason));

window.addEventListener("pywebviewready", () => {
  clearFatalScreen();
  try {
    wire();
    boot();
  } catch (e) {
    fatalScreen(e && e.stack ? e.stack : e);
  }
});

// If the pywebview bridge never announces itself, say so instead of sitting on
// an empty window forever.
setTimeout(() => {
  if (!window.pywebview || !window.pywebview.api) {
    fatalScreen("window.pywebview.api was never injected (pywebviewready did not fire).");
  }
}, 8000);
