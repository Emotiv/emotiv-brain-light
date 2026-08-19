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

    "panel.devices": "Device",
    "panel.headsets": "Headset",
    "btn.change": "Change",
    "summary.commands": "{count} commands trained",
    "summary.untrained": "Nothing trained yet",
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
    "err.sensitivity_failed": "Could not change the sensitivity. {detail}",


    "setup.title": "Setup",
    "setup.credentials": "Cortex credentials",
    "setup.credentials.hint":
      "Create an app at emotiv.com/my-account/cortex-apps to get these. They are stored only on this computer.",
    "setup.client_id": "Client ID",
    "setup.client_secret": "Client secret",
    "setup.secret_saved": "A secret is already saved. Leave blank to keep it.",
    "setup.bulb": "Smart light",
    "setup.bulb_ip": "Light IP address",
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
    "panel.sensitivity": "Command sensitivity",
    "panel.sensitivity.hint":
      "Higher values make an action easier to trigger, at the cost of more false positives. Saved into the profile, so EMOTIV BCI sees the same values.",
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
    "step.bulb": "Light",

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
    "status.discovering_bulb": "Scanning the network for lights…",
    "status.bulb_found": "Light found at {ip}",
    "status.connecting_bulb": "Connecting to the light at {ip}…",
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
    "err.no_bulb_ip": "Set the light's IP address in Setup, or scan the network.",
    "err.no_bulb_found":
      "No light found on this network. For Yeelight, check that LAN Control is enabled in the app.",
    "err.discover_failed": "Network scan failed: {detail}",
    "err.bulb_unreachable":
      "Cannot reach the light at {ip}. Check the IP and that both devices are on the same network. For Yeelight, LAN Control must be on. ({detail})",
    "err.bulb_music_busy":
      "The bulb refused music mode. Another copy of this app is probably still running and holding it — close it and try again.",

    "log.sys_event": "Cortex system event: {detail}",
    "log.cortex_warning": "Cortex warning {warning_code}: {detail}",

    // ── Training ──────────────────────────────────────────────────────────
    "panel.training": "Training",
    "panel.commands": "Commands",
    "panel.brainmap": "Brain map",
    "panel.brainmap.hint":
      "Each command is drawn at its distance from Neutral. The further out it sits, the more easily the detector tells it apart from doing nothing.",
    "panel.brainmap.empty": "Nothing trained yet.",

    "quality.contact": "Contact quality",
    "quality.eeg": "EEG quality",
    "quality.waiting": "Waiting for the headset…",
    "err.quality_unavailable":
      "This headset does not provide the {stream} stream, so that part of the sensor quality panel stays empty. {detail}",
    "quality.grade.0": "no signal",
    "quality.grade.1": "very poor",
    "quality.grade.2": "poor",
    "quality.grade.3": "fair",
    "quality.grade.4": "good",
    "quality.verdict.good": "Sensors look good. Go ahead and train.",
    "quality.verdict.fair": "Usable, but adjusting the sensors would make a cleaner recording.",
    "quality.verdict.poor":
      "Poor signal. Re-wet or reseat the sensors first — training on this teaches the profile the wrong thing.",

    "cmd.enable": "Switch on",
    "cmd.disable": "Switch off",
    "cmd.times": "{count} recordings kept",
    "cmd.erase.hint": "Delete every recording for this command.",
    "cmd.slots_left": "{left} command slots left.",
    "cmd.slots_full": "All {max} command slots are in use. Switch one off to add another.",

    "btn.train": "Train",
    "btn.retrain": "Train again",
    "btn.erase": "Erase",
    "btn.add_command": "Add",
    "btn.new_profile": "New profile",
    "btn.reset_all": "Reset all",
    "btn.accept": "Keep",
    "btn.discard": "Discard",
    "btn.cancel": "Cancel",
    "btn.create": "Create",

    "confirm.erase": "Delete every recording for {action}?",
    "confirm.reset_all":
      "Erase all training in {profile}? Every command goes back to untrained.",

    "profile.new.title": "New training profile",
    "profile.new.hint": "It starts empty. Train Neutral first, then one command at a time.",

    "train.phase.arming": "Getting ready",
    "train.phase.recording": "Recording",
    "train.phase.review": "Recorded",
    "train.phase.failed": "Not usable",
    "train.getready": "Sit still. Recording starts in a moment.",
    "train.keep": "Keep this recording?",
    "train.keep.hint": "Keeping it adds it to the profile. Discarding it changes nothing.",
    "train.failed": "Cortex could not use that",
    "train.failed.hint":
      "Usually movement, or a sensor that lost contact. Check the quality above and record it again.",
    "train.score": "Recording score",

    "train.instr.neutral":
      "Relax and think of nothing in particular. Stay still — this is the reference every command is measured against.",
    "train.instr.push":
      "Imagine pushing something away from you, and hold that same thought until the light stops changing.",
    "train.instr.pull":
      "Imagine pulling something towards you, and hold that same thought until the light stops changing.",
    "train.instr.lift":
      "Imagine lifting something upwards, and hold that same thought until the light stops changing.",
    "train.instr.drop":
      "Imagine pressing something downwards, and hold that same thought until the light stops changing.",
    "train.instr.left":
      "Imagine moving something to the left, and hold that same thought until the light stops changing.",
    "train.instr.right":
      "Imagine moving something to the right, and hold that same thought until the light stops changing.",
    "train.instr.generic":
      "Hold one steady thought for {action} until the light stops changing. Using the same thought every time is what makes it work.",

    "stat.skill": "Skill rating",
    "stat.threshold": "Threshold",
    "stat.last_score": "Last score",

    "tuning.training_feedback": "Light follows the training",
    "tuning.training_feedback.hint":
      "While a command records, the light starts on a calm blue and crosses to that command's own colour across the eight seconds. Neutral stays still on the blue.",

    "status.creating_profile": "Creating profile {profile}…",
    "status.profile_untrained": "Profile {profile} has nothing trained yet",
    "log.profile_untrained":
      "Profile {profile} has no trained command. Train Neutral first, then a command, in the Training panel.",

    "err.too_many_actions": "Only {max} commands can be switched on at once. Switch one off first.",
    "err.unknown_action": "Cortex does not know a command called {action}.",
    "err.profile_name_empty": "Give the profile a name.",
    "err.profile_exists": "A profile called {profile} already exists.",
    "err.profile_create_failed": "Could not create the profile. {detail}",
    "err.profile_save_failed":
      "Could not save profile {profile}. Training is only kept once the profile saves. ({detail})",
    "err.training_failed": "That training step failed. {detail}",
    "err.commands_failed": "Could not read the profile's commands. {detail}",
    "err.active_actions_failed": "Could not change which commands are switched on. {detail}",
    "err.detection_info_failed": "Could not list the available commands. {detail}",
    "err.trained_actions_failed": "Could not read the training counts. {detail}",
    "err.brain_map_failed": "Could not read the brain map. {detail}",
    "err.threshold_failed": "Could not read the training threshold. {detail}",
    "err.skill_failed": "Could not read the skill rating. {detail}",

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

    "panel.devices": "设备",
    "panel.headsets": "头戴设备",
    "btn.change": "更换",
    "summary.commands": "已训练 {count} 个指令",
    "summary.untrained": "尚未训练任何内容",
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
    "err.sensitivity_failed": "无法修改灵敏度。{detail}",


    "setup.title": "设置",
    "setup.credentials": "Cortex 凭据",
    "setup.credentials.hint":
      "请在 emotiv.com/my-account/cortex-apps 创建应用以获取。凭据仅保存在本机。",
    "setup.client_id": "Client ID",
    "setup.client_secret": "Client Secret",
    "setup.secret_saved": "已保存 Secret。留空则保持不变。",
    "setup.bulb": "智能灯具",
    "setup.bulb_ip": "灯具 IP 地址",
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
    "panel.sensitivity": "指令灵敏度",
    "panel.sensitivity.hint":
      "数值越高越容易触发该动作，但误触发也会增多。设置会保存到配置文件中，EMOTIV BCI 中看到的是同一组数值。",
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
    "step.bulb": "灯具",

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
    "status.discovering_bulb": "正在扫描网络中的灯具…",
    "status.bulb_found": "在 {ip} 找到灯具",
    "status.connecting_bulb": "正在连接 {ip} 的灯具…",
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
    "err.no_bulb_ip": "请在「设置」中填写灯具 IP，或扫描网络。",
    "err.no_bulb_found": "本网络中未找到灯具。若使用 Yeelight，请确认已开启「局域网控制」。",
    "err.discover_failed": "网络扫描失败：{detail}",
    "err.bulb_unreachable":
      "无法连接 {ip} 的灯具。请检查 IP 以及两台设备是否在同一网络。若使用 Yeelight，还需开启「局域网控制」。（{detail}）",
    "err.bulb_music_busy":
      "灯泡拒绝进入音乐模式。很可能仍有另一个本应用实例在占用，请关闭后重试。",

    "log.sys_event": "Cortex 系统事件：{detail}",
    "log.cortex_warning": "Cortex 警告 {warning_code}：{detail}",

    // ── 训练 ──────────────────────────────────────────────────────────────
    "panel.training": "训练",
    "panel.commands": "指令",
    "panel.brainmap": "脑图",
    "panel.brainmap.hint":
      "每个指令按它与「中性」的距离绘制。离得越远，检测器越容易把它和「什么都不想」区分开。",
    "panel.brainmap.empty": "尚未训练任何内容。",

    "quality.contact": "接触质量",
    "quality.eeg": "脑电质量",
    "quality.waiting": "正在等待头戴设备…",
    "err.quality_unavailable":
      "此头戴设备不提供 {stream} 数据流，因此电极质量面板的这一部分会保持为空。{detail}",
    "quality.grade.0": "无信号",
    "quality.grade.1": "很差",
    "quality.grade.2": "较差",
    "quality.grade.3": "一般",
    "quality.grade.4": "良好",
    "quality.verdict.good": "电极状态良好，可以开始训练。",
    "quality.verdict.fair": "勉强可用，调整一下电极会得到更干净的录制。",
    "quality.verdict.poor":
      "信号较差。请先重新润湿或调整电极——用这样的信号训练，只会让配置文件学到错误的模式。",

    "cmd.enable": "启用",
    "cmd.disable": "停用",
    "cmd.times": "已保留 {count} 次录制",
    "cmd.erase.hint": "删除该指令的全部录制。",
    "cmd.slots_left": "还剩 {left} 个指令位。",
    "cmd.slots_full": "{max} 个指令位已全部占用。请先停用一个再添加。",

    "btn.train": "训练",
    "btn.retrain": "重新训练",
    "btn.erase": "清除",
    "btn.add_command": "添加",
    "btn.new_profile": "新建配置文件",
    "btn.reset_all": "全部重置",
    "btn.accept": "保留",
    "btn.discard": "丢弃",
    "btn.cancel": "取消",
    "btn.create": "创建",

    "confirm.erase": "删除「{action}」的全部录制？",
    "confirm.reset_all": "清除 {profile} 中的全部训练？所有指令都将回到未训练状态。",

    "profile.new.title": "新建训练配置文件",
    "profile.new.hint": "新配置文件是空的。请先训练「中性」，然后逐个训练指令。",

    "train.phase.arming": "准备中",
    "train.phase.recording": "录制中",
    "train.phase.review": "录制完成",
    "train.phase.failed": "无法使用",
    "train.getready": "请保持静止，马上开始录制。",
    "train.keep": "保留这次录制？",
    "train.keep.hint": "保留会把它加入配置文件；丢弃则不做任何改变。",
    "train.failed": "Cortex 无法使用这次录制",
    "train.failed.hint": "通常是动作过多，或电极接触不良。请检查上方质量后重新录制。",
    "train.score": "本次得分",

    "train.instr.neutral": "放松，不要特别想什么，并保持静止——这是衡量其他所有指令的基准。",
    "train.instr.push": "想象把某个东西推离自己，并一直保持同一个念头，直到灯光不再变化。",
    "train.instr.pull": "想象把某个东西拉向自己，并一直保持同一个念头，直到灯光不再变化。",
    "train.instr.lift": "想象把某个东西向上抬起，并一直保持同一个念头，直到灯光不再变化。",
    "train.instr.drop": "想象把某个东西向下压，并一直保持同一个念头，直到灯光不再变化。",
    "train.instr.left": "想象把某个东西向左移动，并一直保持同一个念头，直到灯光不再变化。",
    "train.instr.right": "想象把某个东西向右移动，并一直保持同一个念头，直到灯光不再变化。",
    "train.instr.generic":
      "为「{action}」保持一个稳定的念头，直到灯光不再变化。每次都用同一个念头，训练才会奏效。",

    "stat.skill": "熟练度",
    "stat.threshold": "阈值",
    "stat.last_score": "上次得分",

    "tuning.training_feedback": "让灯光跟随训练",
    "tuning.training_feedback.hint":
      "录制指令时，灯光会从平静的蓝色开始，在八秒内过渡到该指令自己的颜色。「中性」则始终保持这一片蓝色不动。",

    "status.creating_profile": "正在创建配置文件 {profile}…",
    "status.profile_untrained": "配置文件 {profile} 尚未训练任何内容",
    "log.profile_untrained":
      "配置文件 {profile} 还没有已训练的指令。请在「训练」面板中先训练「中性」，再训练一个指令。",

    "err.too_many_actions": "同时最多只能启用 {max} 个指令，请先停用一个。",
    "err.unknown_action": "Cortex 中不存在名为 {action} 的指令。",
    "err.profile_name_empty": "请为配置文件取一个名称。",
    "err.profile_exists": "已存在名为 {profile} 的配置文件。",
    "err.profile_create_failed": "无法创建配置文件。{detail}",
    "err.profile_save_failed":
      "无法保存配置文件 {profile}。训练只有在配置文件保存后才会保留。（{detail}）",
    "err.training_failed": "该训练步骤失败。{detail}",
    "err.commands_failed": "无法读取配置文件中的指令。{detail}",
    "err.active_actions_failed": "无法修改已启用的指令。{detail}",
    "err.detection_info_failed": "无法获取可用指令列表。{detail}",
    "err.trained_actions_failed": "无法读取训练次数。{detail}",
    "err.brain_map_failed": "无法读取脑图。{detail}",
    "err.threshold_failed": "无法读取训练阈值。{detail}",
    "err.skill_failed": "无法读取熟练度评分。{detail}",

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
