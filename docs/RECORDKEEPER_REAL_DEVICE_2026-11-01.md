# 记录官 · 真机验收归档（2026-11-01 第四段）

真机：荣耀 Magic 7 Pro（安卓），系统浏览器 = `com.hihonor.baidu.browser`（百度内核 Chrome/97）。
接入方式：`adb reverse tcp:5173 tcp:5173` + 手机开 `http://localhost:5173`（安全上下文）。
设备 ID `AN6B024C12000102`，截图在 `%TEMP%\rk-device\`。

提交：功能修复 `f07384b`、朗读能力判断 `e4b65b8`、本归档 `docs/`。
**分支 `codex/recordkeeper-v1` 仍未推送。**

---

## 一、本次做完的

### 1. 修了三处真机暴露的缺陷

| # | 现象 | 根因 | 修法 |
|---|------|------|------|
| 1 | 界面写着「正在想…」，树人站着不动 | `today-panel.tsx` 把页面级 `busy`（**存档保存中**）当成「等模型回话」传给树人。按发送键时 `busy` 是 `false` | ChatRoom 新增 `sending` 状态，经 `onWaiting` 回调传到 AssistantScene |
| 2 | 应用内「减少动态效果」怎么点都到不了 `still` | `assistant-scene.tsx` 查 `document.documentElement.classList`，而 `page.tsx` 把 `.reduced` 加在 `.app-shell` 上 | 改查 `sectionRef.current.closest('.reduced')`；应用内开关不走 `matchMedia`，补 `MutationObserver` 盯 `class` |
| 3 | 松手后麦克风不复位：按钮橙色、系统麦克风指示灯亮 | 百度内核的 `SpeechRecognition` **从不触发 `onend`**（真机确认，见下） | `stopVoice` 后挂 900ms 看门狗强收；麦克风开着时，页面任何抬手/取消、切后台、页面离开都当松手 |

第 3 条的实测证据：调试角标打了标记，松手后 `1.2s` 仍是 `end-`（`onend` 没来），
1.5s 后变 `endw`（看门狗接管）。所以**看门狗是这台内核上的主路径，不是兜底**。

### 2. 朗读能力的诚实化（`e4b65b8`）

这台浏览器**没有 `window.speechSynthesis`**（调试角标 `syn0` 直接读出）。
在此之前三处都在装成能用：树人的点击热区、右下角「重读」按钮、设置里默认开着的
「朗读记录官的话」开关——按下去什么都不会发生。

改成：`lib/voice.ts` 加 `ttsStatus()` / `subscribeTts()`（与 `voiceStatus()` 同一套
缓存 + 空订阅写法，避开 `react-hooks/set-state-in-effect`），`AssistantScene` 在
`!ttsOk` 时不渲染 `__touch` 与 `__replay`，设置开关 `disabled` + 关闭 + 标注
「（这台浏览器不支持朗读）」。

### 3. 新增文件 / 改动文件

- `site/components/assistant-scene.tsx` — reduced 检测、`ttsOk` 门控、`onWaiting` 经 props 接入
- `site/components/chat-room.tsx` — `sending`→`onWaiting`、麦克风看门狗、window 级松手兜底
- `site/components/today-panel.tsx` — `waiting` 状态与接线
- `site/lib/voice.ts` — 新增 `ttsStatus` / `subscribeTts`
- `site/app/page.tsx` — 朗读开关按能力禁用

---

## 二、验证到什么程度

### 本次真机核对过的（荣耀 Magic 7 Pro / 百度内核）

| 项 | 结论 |
|----|------|
| 树人五张 WebP 的颜色 | 正常，无偏色 |
| `idle` | 正常，56×71 落在 80px 高的人物条里，土包未被裁 |
| `listening` | 正常，按住麦克风 → `is-listening`、橙红描边 |
| `thinking` | **修好后正常**，裸枝探出树冠可见 |
| `still` | **修好后正常，且双向**：开关打开闭眼，关闭恢复 |
| `speaking` | **无法到达**，见下 |
| 语音输入 | API 存在（弹了 `localhost 是否始终允许…麦克风` 权限框），但识别服务连不上 |
| 麦克风复位 | **修好后正常**，松手 ~0.9s 内复位 |
| 朗读开关 | 显示「（这台浏览器不支持朗读）」、关闭、不可点 |
| 页面横向溢出 | 无 |

`speaking` 为**未验证而非失败**：`window.speechSynthesis === undefined`，
`reading` 在真机上不可能变真，`speaking` 态在这台设备上不存在可达路径。
桌面 Chrome 用同一份代码经 CDP 复验，`speaking` 与「朗读中」标签均正常——
说明这是设备能力差异，不是代码回归。

### 历史检查结果（沿用，本次未重跑）

- 素材验收脚本 `node scripts/check-treant-states.mjs`：20/20（2026-11-01 第三段）
- `tsc --noEmit`：通过（本次每次改动后都重跑）
- ESLint：`chat-room.tsx` / `assistant-scene.tsx` / `today-panel.tsx` / `lib/voice.ts` 0 error。
  `app/page.tsx` 有 17 条 `no-explicit-any`，**改动前后同为 17 条**，属原有问题。

### 明确未验证

1. **怪兽三态**（影子可点、卡片无攻击按钮、释放后留言变成纪念）——
   开发库 `monsters: []`，**没有任何活跃怪兽**，真机上无从触发。不是跳过，是数据里没有。
2. **`speaking` 在这台设备上**——能力缺失，永远到不了。
3. **语音识别可用性**——识别后端连不上（`network` 错误），降级文案正确，但功能不可用。
4. **底部导航栏被浏览器工具栏压住**——见「悬而未决」。
5. **部署后复验**——本次全程 `adb reverse` + 本机 dev server，未发布。

---

## 三、踩过的坑

1. **`busy` 不是「忙」**——它是存档保存中。任何「等模型」的 UI 都应该绑 ChatRoom 的
   `sending`。名称看着对，语义错一层，界面会自相矛盾。
2. **`.reduced` 在 `.app-shell` 上，不在 `<html>` 上**。查 `documentElement` 会永远为
   `false`，而且不报错、不警告——功能静默失效。
3. **百度内核不触发 `SpeechRecognition.onend`**。只靠 `onend` 收尾的状态机会把
   session 永久挂住。这类「浏览器答应会回调但不回调」的行为只能靠真机发现。
4. **`speechSynthesis` 可能整个不存在**。之前只判断了「朗读开关关没关」，
   没判断「这台机器有没有这个 API」。
5. **`adb` 坐标估错三次**：先按缩放图估值，点到了浏览器工具栏跳去百度；
   又点到了「导出人生纪念」触发下载面板。**必须按原图（1280×2800）像素扫描定位**，
   不能用缩略图目测。
6. **`adb shell uiautomator dump` 拿不到网页内容**（百度内核不暴露），
   且 Git Bash 要 `MSYS_NO_PATHCONV=1`。CDP 也连不上（无 `chrome_devtools_remote`）。
   真机上唯一可用的观测手段是 `screencap` + 像素比对 + 临时调试角标。
7. **`KEYCODE_BACK` 会直接退出应用**，页面不拦截返回键。

---

## 四、悬而未决

1. **底部导航栏被浏览器工具栏压住**：截图里 `.bottom-nav` 只露出图标上半截，
   文字标签被百度浏览器的工具栏盖住。这是**真机可用性问题**，在浏览器里打开时
   每次都会遇到。可选方向：
   - 把导航改成随滚动收起的悬浮条；
   - 或用 `env(safe-area-inset-bottom)` + 给页面预留浏览器工具栏高度（但该工具栏
     高度在百度核心里拿不到，`visualViewport` 也未必可靠）；
   - 或引导用户「添加到桌面」全屏打开。
   未做决定，**下次开工要先问用户走哪条**。
2. **语音识别在这台设备上不可用**。识别后端走境外服务器，国内网络连不上。
   降级已经做了（给原因、不自动发送），但「能不能换一条国内可用的识别链路」是
   产品级决定，不是这轮能定的。
3. **`speaking` 永远无法在这台主力设备上验证**。要么接受（这台机器没有朗读），
   要么另行找一台有 `speechSynthesis` 的安卓机验。
4. **怪兽三态未验**：需要先在开发库里造出一只活跃怪兽（记录几条负面情绪），
   才谈得上验。这属于测试数据准备，不是代码问题。

---

## 五、下一步

1. 先问用户「底部导航被压住」怎么处理，再动代码。
2. 造测试数据（活跃怪兽）→ 真机验怪兽三态：影子可点、卡片无攻击按钮、
   释放后那句话变成 `epitaph` 纪念。
3. 素人（数字人形象素材）未开工。
4. 分支仍未推送，未发布。

---

## 六、可复用经验（提出来单独记）

- **「等异步结果」的 UI，信号源必须是发起那次请求的组件**。页面级的 `busy`
  八成是保存/提交，不是请求在飞。名字像不等于语义像。
- **CSS 类挂在哪个元素上，决定 `closest()` 还是 `documentElement`**。
  功能静默失效的典型形态：条件永远为假、无报错。
- **浏览器 API 的能力判断要分三层**：有没有这个 API、这个上下文能不能用
  （安全上下文）、用起来会不会失败（网络/服务端）。三层混在一起就会报错误的错。
- **真机观测手段要有兜底**：没有 CDP、没有 uiautomator 时，
  「临时调试角标 + `screencap` 像素比对」能定位绝大多数状态问题。
  角标记得用完删掉，并在提交前 `grep` 确认。
