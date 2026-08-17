// Translations. The backend never sends finished text — it sends a code plus
// parameters, and this is where that becomes a sentence in the chosen language.

const I18N = {
  en: {
    "lang.name": "English",

    "app.title": "EMOTIV Brain Light",
    "app.subtitle": "Drive a smart light with your brain",

    "welcome.title": "Choose your language",
    "welcome.hint": "You can change this any time from the header.",
    "welcome.continue": "Continue",
    "welcome.brand.title": "Which light do you have?",
    "welcome.brand.hint": "You can change this later under Settings.",
    "brand.yeelight.desc": "Wi-Fi bulb with LAN Control enabled",
    "brand.lifx.desc": "Wi-Fi light on the LIFX LAN protocol",
    "setup.brand": "Light brand",
    "setup.bulb.hint.yeelight":
      "Enable LAN Control in the Yeelight or Xiaomi Home app first. The light and this computer must be on the same network.",
    "setup.bulb.hint.lifx":
      "LIFX needs no extra setting — the light and this computer just have to be on the same network.",

    "mode.metrics": "Performance Metrics",
    "mode.metrics.desc": "The strongest metric picks the colour",
    "mode.commands": "Mental Commands",
    "mode.commands.desc": "A trained BCI profile picks the colour",

    "btn.start": "Start",
    "btn.stop": "Stop",
    "btn.save": "Save",
    "btn.discover": "Scan network",
    "btn.retry": "Retry",
    "btn.clear": "Clear",
    "btn.settings": "Settings",
    "btn.close": "Close",
    "btn.refresh": "Refresh",

    "panel.devices": "Headset",
    "panel.profiles": "Trained profiles",
    "panel.no_headsets": "No headset listed. Turn yours on and hit Refresh.",
    "panel.connect_first": "Pick a headset first.",

    "tag.connected": "connected",
    "tag.virtual": "virtual",
    "tag.loaded": "loaded",
    "headset.status.discovered": "found",
    "headset.status.connecting": "connecting",
    "headset.status.connected": "connected",

    "status.pick_headset": "Pick a headset from the list.",
    "status.pick_profile": "Pick a trained profile from the list.",
    "status.connecting_headset": "Connecting to {headset}…",

    "err.headset_not_found": "Headset {headset} is no longer in the list. Hit Refresh.",
    "err.no_headset_selected": "Connect a headset before loading a profile.",
    "err.profile_incompatible":
      "Profile {profile} was trained on a different headset model, so {headset} cannot load it. Pick another profile, or train a new one on this headset.",
    "err.not_running": "Press Start first.",


    "setup.title": "Setup",
    "setup.credentials": "Cortex credentials",
    "setup.credentials.hint":
      "Create an app at emotiv.com/my-account/cortex-apps to get these. They are stored only on this computer.",
    "setup.client_id": "Client ID",
    "setup.client_secret": "Client secret",
    "setup.secret_saved": "A secret is already saved. Leave blank to keep it.",
    "setup.bulb": "Smart light",
    "setup.bulb_ip": "Light IP address",
    "setup.bulb.hint":
      "Enable LAN Control in the Xiaomi Home app first. The bulb and this computer must be on the same network.",
    "setup.profile": "Trained profile",
    "setup.profile.hint": "Mental Commands needs a profile trained in EMOTIV BCI.",
    "setup.profile.none": "— select a profile —",
    "setup.no_profiles": "No profiles found for this account.",

    "tuning.title": "Tuning",
    "tuning.smooth": "Transition smoothness",
    "tuning.smooth.hint": "Higher means slower, more melted colour changes.",
    "tuning.bright_min": "Minimum brightness",
    "tuning.bright_max": "Maximum brightness",
    "tuning.score_mode": "Metric comparison",
    "tuning.score_mode.adaptive": "Adaptive (vs. your own baseline)",
    "tuning.score_mode.raw": "Raw values",
    "tuning.score_mode.hint":
      "Raw metric values sit in different ranges per metric, so raw comparison tends to lock onto one colour. Adaptive scores each metric against your own moving baseline.",

    "panel.live": "Live",
    "panel.status": "Status",
    "panel.log": "Event log",
    "panel.colour": "Current colour",
    "panel.actions": "Trained actions",
    "panel.waiting": "Waiting for data…",
    "panel.leader": "Leading",
    "panel.power": "Detection strength",

    "step.credentials": "Credentials",
    "step.cortex": "Cortex service",
    "step.access": "App access",
    "step.headset": "Headset",
    "step.session": "Session",
    "step.profile": "Profile",
    "step.stream": "Data stream",
    "step.bulb": "Bulb",

    "state.idle": "Idle",
    "state.pending": "Working…",
    "state.ok": "OK",
    "state.error": "Problem",

    "metric.eng": "Engagement",
    "metric.exc": "Excitement",
    "metric.str": "Stress",
    "metric.rel": "Relaxation",
    "metric.int": "Interest",
    "metric.attention": "Attention",
    "metric.lex": "Long-term excitement",

    "action.neutral": "Neutral",
    "action.push": "Push",
    "action.pull": "Pull",
    "action.lift": "Lift",
    "action.drop": "Drop",
    "action.left": "Left",
    "action.right": "Right",
    "action.rotateLeft": "Rotate left",
    "action.rotateRight": "Rotate right",
    "action.rotateClockwise": "Rotate clockwise",
    "action.rotateCounterClockwise": "Rotate counter-clockwise",
    "action.rotateForwards": "Rotate forward",
    "action.rotateReverse": "Rotate backward",
    "action.disappear": "Disappear",

    "status.connecting": "Connecting to the Cortex service…",
    "status.requesting_access": "Checking app access…",
    "status.searching_headsets": "Looking for headsets…",
    "status.headset_ready": "Headset {headset} connected",
    "status.session_reused": "Reusing the existing session",
    "status.session_created": "Session created",
    "status.session_recovered": "Recovered an existing session",
    "status.loading_profile": "Loading profile {profile}…",
    "status.profile_loaded": "Profile {profile} loaded",
    "status.streaming": "Receiving data",
    "status.reconnecting": "Connection lost — retrying…",
    "status.discovering_bulb": "Scanning the network for bulbs…",
    "status.bulb_found": "Bulb found at {ip}",
    "status.connecting_bulb": "Connecting to the bulb at {ip}…",
    "status.bulb_ready": "Light ready at {ip}",

    "err.no_credentials": "Enter your Cortex Client ID and secret in Setup.",
    "err.cortex_unreachable":
      "Cannot reach the Cortex service. Is EMOTIV Launcher running? ({detail})",
    "err.access_pending":
      "EMOTIV Launcher has not approved this app yet. Open the Launcher and accept the request, then retry. ({detail})",
    "err.bad_credentials":
      "Cortex rejected these credentials. Double-check the Client ID and secret. ({detail})",
    "err.no_token": "Cortex did not return a token.",
    "err.no_headset":
      "No headset found. Turn it on, and make sure it is paired in EMOTIV Launcher.",
    "err.headset_connect_timeout":
      "Headset {headset} did not confirm the connection; continuing anyway.",
    "err.headset_disconnected": "The headset disconnected.",
    "err.no_profile_selected": "Pick a trained profile in Setup to use Mental Commands.",
    "err.profile_not_found": "Profile {profile} does not exist on this account.",
    "err.profile_load_failed": "Could not load profile {profile}. ({detail})",
    "err.profile_unload_failed":
      "Could not unload the profile {profile} that was already on the headset. ({detail})",
    "err.profile_untrained":
      "Profile {profile} has no trained action besides Neutral. Train at least one command in EMOTIV BCI first.",
    "err.subscribe_failed": "Cortex refused the {stream} stream. ({detail})",
    "err.timeout": "Cortex did not answer {method} in time.",
    "err.cortex_api": "Cortex error {api_code}: {detail}",
    "err.not_connected": "Not connected to Cortex.",
    "err.stale_connection":
      "The Cortex connection went stale (warning 11). Reopening it — this usually recovers on its own.",
    "err.unexpected": "Unexpected error: {detail}",
    "err.parse": "Could not read a Cortex message: {detail}",
    "err.profiles_failed": "Could not list profiles. {detail}",
    "err.actions_failed": "Could not read the profile's trained actions. {detail}",
    "err.mode_switch_failed": "Could not switch mode. {detail}",
    "err.no_bulb_ip": "Set the bulb IP address in Setup, or scan the network.",
    "err.no_bulb_found":
      "No light found on this network. For Yeelight, check that LAN Control is enabled in the app.",
    "err.discover_failed": "Network scan failed: {detail}",
    "err.bulb_unreachable":
      "Cannot reach the light at {ip}. Check the IP and that both devices are on the same network. For Yeelight, LAN Control must be on. ({detail})",
    "err.bulb_music_busy":
      "The bulb refused music mode. Another copy of this app is probably still running and holding it — close it and try again.",

    "log.sys_event": "Cortex system event: {detail}",
    "log.cortex_warning": "Cortex warning {warning_code}: {detail}",

    "log.empty": "Nothing yet.",
    "running.yes": "Running",
    "running.no": "Stopped",
  },

  zh: {
    "lang.name": "中文",

    "app.title": "EMOTIV Brain Light",
    "app.subtitle": "用脑电控制智能灯具",

    "welcome.title": "请选择语言",
    "welcome.hint": "之后可以随时在顶部切换。",
    "welcome.continue": "继续",
    "welcome.brand.title": "你使用哪种灯？",
    "welcome.brand.hint": "之后可以在「设置」中更改。",
    "brand.yeelight.desc": "已开启局域网控制的 Wi-Fi 灯泡",
    "brand.lifx.desc": "使用 LIFX 局域网协议的 Wi-Fi 灯具",
    "setup.brand": "灯具品牌",
    "setup.bulb.hint.yeelight":
      "请先在 Yeelight 或米家 App 中开启「局域网控制」。灯具与本机需在同一网络。",
    "setup.bulb.hint.lifx": "LIFX 无需额外设置，灯具与本机在同一网络即可。",

    "mode.metrics": "表现指标",
    "mode.metrics.desc": "由最强的指标决定颜色",
    "mode.commands": "意念指令",
    "mode.commands.desc": "由已训练的 BCI 配置文件决定颜色",

    "btn.start": "开始",
    "btn.stop": "停止",
    "btn.save": "保存",
    "btn.discover": "扫描网络",
    "btn.retry": "重试",
    "btn.clear": "清空",
    "btn.settings": "设置",
    "btn.close": "关闭",
    "btn.refresh": "刷新",

    "panel.devices": "头戴设备",
    "panel.profiles": "已训练的配置文件",
    "panel.no_headsets": "未列出任何设备。请开机后点击「刷新」。",
    "panel.connect_first": "请先选择头戴设备。",

    "tag.connected": "已连接",
    "tag.virtual": "虚拟",
    "tag.loaded": "已加载",
    "headset.status.discovered": "已发现",
    "headset.status.connecting": "连接中",
    "headset.status.connected": "已连接",

    "status.pick_headset": "请从列表中选择头戴设备。",
    "status.pick_profile": "请从列表中选择已训练的配置文件。",
    "status.connecting_headset": "正在连接 {headset}…",

    "err.headset_not_found": "设备 {headset} 已不在列表中，请点击「刷新」。",
    "err.no_headset_selected": "加载配置文件前请先连接头戴设备。",
    "err.profile_incompatible":
      "配置文件 {profile} 是在其他型号的设备上训练的，{headset} 无法加载。请换一个配置文件，或在此设备上重新训练。",
    "err.not_running": "请先点击「开始」。",


    "setup.title": "设置",
    "setup.credentials": "Cortex 凭据",
    "setup.credentials.hint":
      "请在 emotiv.com/my-account/cortex-apps 创建应用以获取。凭据仅保存在本机。",
    "setup.client_id": "Client ID",
    "setup.client_secret": "Client Secret",
    "setup.secret_saved": "已保存 Secret。留空则保持不变。",
    "setup.bulb": "智能灯具",
    "setup.bulb_ip": "灯泡 IP 地址",
    "setup.bulb.hint":
      "请先在米家 App 中开启「局域网控制」。灯泡与本机需在同一网络。",
    "setup.profile": "已训练的配置文件",
    "setup.profile.hint": "意念指令模式需要在 EMOTIV BCI 中训练过的配置文件。",
    "setup.profile.none": "— 请选择配置文件 —",
    "setup.no_profiles": "此账号下没有找到配置文件。",

    "tuning.title": "调节",
    "tuning.smooth": "过渡平滑度",
    "tuning.smooth.hint": "数值越大，颜色变化越慢越柔和。",
    "tuning.bright_min": "最低亮度",
    "tuning.bright_max": "最高亮度",
    "tuning.score_mode": "指标比较方式",
    "tuning.score_mode.adaptive": "自适应（对比个人基线）",
    "tuning.score_mode.raw": "原始数值",
    "tuning.score_mode.hint":
      "各项指标的原始数值范围不同，直接比较容易一直停在同一种颜色。自适应会把每项指标与你自己的移动基线做比较。",

    "panel.live": "实时",
    "panel.status": "状态",
    "panel.log": "事件日志",
    "panel.colour": "当前颜色",
    "panel.actions": "已训练的动作",
    "panel.waiting": "等待数据…",
    "panel.leader": "当前最强",
    "panel.power": "识别强度",

    "step.credentials": "凭据",
    "step.cortex": "Cortex 服务",
    "step.access": "应用授权",
    "step.headset": "头戴设备",
    "step.session": "会话",
    "step.profile": "配置文件",
    "step.stream": "数据流",
    "step.bulb": "灯泡",

    "state.idle": "空闲",
    "state.pending": "处理中…",
    "state.ok": "正常",
    "state.error": "异常",

    "metric.eng": "参与度",
    "metric.exc": "兴奋度",
    "metric.str": "压力",
    "metric.rel": "放松度",
    "metric.int": "兴趣度",
    "metric.attention": "注意力",
    "metric.lex": "长期兴奋度",

    "action.neutral": "中性",
    "action.push": "推",
    "action.pull": "拉",
    "action.lift": "上升",
    "action.drop": "下降",
    "action.left": "向左",
    "action.right": "向右",
    "action.rotateLeft": "向左旋转",
    "action.rotateRight": "向右旋转",
    "action.rotateClockwise": "顺时针旋转",
    "action.rotateCounterClockwise": "逆时针旋转",
    "action.rotateForwards": "向前旋转",
    "action.rotateReverse": "向后旋转",
    "action.disappear": "消失",

    "status.connecting": "正在连接 Cortex 服务…",
    "status.requesting_access": "正在检查应用授权…",
    "status.searching_headsets": "正在搜索头戴设备…",
    "status.headset_ready": "头戴设备 {headset} 已连接",
    "status.session_reused": "复用现有会话",
    "status.session_created": "会话已创建",
    "status.session_recovered": "已恢复现有会话",
    "status.loading_profile": "正在加载配置文件 {profile}…",
    "status.profile_loaded": "配置文件 {profile} 已加载",
    "status.streaming": "正在接收数据",
    "status.reconnecting": "连接中断 — 正在重试…",
    "status.discovering_bulb": "正在扫描网络中的灯泡…",
    "status.bulb_found": "在 {ip} 找到灯泡",
    "status.connecting_bulb": "正在连接 {ip} 的灯泡…",
    "status.bulb_ready": "灯具就绪（{ip}）",

    "err.no_credentials": "请在「设置」中填写 Cortex Client ID 与 Secret。",
    "err.cortex_unreachable":
      "无法连接 Cortex 服务。EMOTIV Launcher 是否已启动？（{detail}）",
    "err.access_pending":
      "EMOTIV Launcher 尚未批准此应用。请打开 Launcher 接受请求后重试。（{detail}）",
    "err.bad_credentials":
      "Cortex 拒绝了这组凭据，请核对 Client ID 与 Secret。（{detail}）",
    "err.no_token": "Cortex 未返回令牌。",
    "err.no_headset": "未找到头戴设备。请开机，并确认已在 EMOTIV Launcher 中配对。",
    "err.headset_connect_timeout": "头戴设备 {headset} 未确认连接，仍继续执行。",
    "err.headset_disconnected": "头戴设备已断开。",
    "err.no_profile_selected": "请在「设置」中选择一个已训练的配置文件以使用意念指令。",
    "err.profile_not_found": "此账号下不存在配置文件 {profile}。",
    "err.profile_load_failed": "无法加载配置文件 {profile}。（{detail}）",
    "err.profile_unload_failed": "无法卸载头戴设备上已有的配置文件 {profile}。（{detail}）",
    "err.profile_untrained":
      "配置文件 {profile} 除「中性」外没有已训练的动作。请先在 EMOTIV BCI 中训练至少一个指令。",
    "err.subscribe_failed": "Cortex 拒绝了 {stream} 数据流。（{detail}）",
    "err.timeout": "Cortex 未及时响应 {method}。",
    "err.cortex_api": "Cortex 错误 {api_code}：{detail}",
    "err.not_connected": "尚未连接 Cortex。",
    "err.stale_connection": "Cortex 连接已失效（警告 11）。正在重新建立连接，通常会自动恢复。",
    "err.unexpected": "意外错误：{detail}",
    "err.parse": "无法解析 Cortex 消息：{detail}",
    "err.profiles_failed": "无法获取配置文件列表。{detail}",
    "err.actions_failed": "无法读取配置文件中已训练的动作。{detail}",
    "err.mode_switch_failed": "无法切换模式。{detail}",
    "err.no_bulb_ip": "请在「设置」中填写灯泡 IP，或扫描网络。",
    "err.no_bulb_found": "本网络中未找到灯具。若使用 Yeelight，请确认已开启「局域网控制」。",
    "err.discover_failed": "网络扫描失败：{detail}",
    "err.bulb_unreachable":
      "无法连接 {ip} 的灯泡。请检查 IP、局域网控制是否开启，以及两台设备是否在同一网络。（{detail}）",
    "err.bulb_music_busy":
      "灯泡拒绝进入音乐模式。很可能仍有另一个本应用实例在占用，请关闭后重试。",

    "log.sys_event": "Cortex 系统事件：{detail}",
    "log.cortex_warning": "Cortex 警告 {warning_code}：{detail}",

    "log.empty": "暂无记录。",
    "running.yes": "运行中",
    "running.no": "已停止",
  },
};

let LANG = "en";

function setLang(lang) {
  LANG = I18N[lang] ? lang : "en";
  document.documentElement.lang = LANG === "zh" ? "zh-CN" : "en";
}

function tHas(key) {
  const table = I18N[LANG] || I18N.en;
  return table[key] !== undefined || I18N.en[key] !== undefined;
}

function t(key, params) {
  const table = I18N[LANG] || I18N.en;
  let text = table[key];
  if (text === undefined) text = I18N.en[key];
  if (text === undefined) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.split("{" + k + "}").join(v === undefined || v === null ? "" : String(v));
    }
  }
  // Drop placeholders left without a value, so "{detail}" never leaks on screen.
  return text.replace(/\{[a-zA-Z_]+\}/g, "").replace(/\(\s*\)/g, "").trim();
}
