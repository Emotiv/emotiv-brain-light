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
  steps: {},
  scores: {},
  leader: null,
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
  renderLeader();
  renderProfileOptions();
  renderHeadsets();
  renderProfiles();
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

  for (const name of state.profiles) {
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
    state.scores = data.scores || {};
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

function fillSettingsForm() {
  const s = state.settings;
  $("#in-client-id").value = s.client_id || "";
  $("#in-client-secret").value = "";
  $("#secret-saved-note").classList.toggle("hidden", !s.client_secret_set);
  $("#in-bulb-ip").value = s.bulb_ip || "";
  $("#in-score-mode").value = s.score_mode || "adaptive";
  $("#in-smooth").value = s.smooth_tau ?? 0.45;
  $("#in-bright-min").value = s.bright_min ?? 12;
  $("#in-bright-max").value = s.bright_max ?? 100;
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
    bulb_ip: $("#in-bulb-ip").value.trim(),
    profile: $("#in-profile").value,
    score_mode: $("#in-score-mode").value,
    smooth_tau: Number($("#in-smooth").value),
    bright_min: Number($("#in-bright-min").value),
    bright_max: Number($("#in-bright-max").value),
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
      break;
    case "actions":
      state.actionOrder = data.order || [];
      state.actionColors = data.colors || {};
      state.loadedProfile = data.profile || state.loadedProfile;
      renderActionChips();
      renderProfiles();
      updateLiveEmpty();
      break;
    case "running":
      state.running = data.running;
      if (!data.running) {
        state.selectedHeadset = "";
        state.loadedProfile = "";
        renderHeadsets();
        renderProfiles();
      }
      renderRunButton();
      renderRunningPill();
      break;
    case "mode":
      state.mode = data.mode;
      renderMode();
      break;
  }
};

// ─── Bootstrap ────────────────────────────────────────────────────────────
async function boot() {
  const info = await window.pywebview.api.get_state();
  state.settings = info.settings;
  state.metricPalette = info.metric_palette;
  state.mode = info.settings.mode || "metrics";
  state.profiles = info.profiles || [];

  if (!info.settings.language) {
    $("#welcome").classList.remove("hidden");
  } else {
    setLang(info.settings.language);
    $("#app").classList.remove("hidden");
  }

  applyStaticI18n();
  renderMode();
  fillSettingsForm();
  renderLog();
}

function wire() {
  $$(".lang-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      setLang(btn.dataset.lang);
      state.settings = await window.pywebview.api.save_settings({ language: btn.dataset.lang });
      $("#welcome").classList.add("hidden");
      $("#app").classList.remove("hidden");
      applyStaticI18n();
      renderMode();
      fillSettingsForm();
      renderLog();
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
}

window.addEventListener("pywebviewready", () => {
  wire();
  boot();
});
