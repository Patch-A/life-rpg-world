# 记录官 · 2026-11-01 归档

分支 `codex/recordkeeper-v1`，**仍未推送**（无 upstream）。
本次归档时 HEAD = `e918296`。

---

## 一、本次做完的

### 情绪怪兽（已提交 `e918296`）

设计依据：`docs/superpowers/specs/2026-10-31-monsters-and-home-design.md`。

| 文件 | 内容 |
|---|---|
| `site/lib/monsters.ts` | 纯逻辑：`MONSTER_KINDS`、`MONSTER_WEIGHT_HP`、`fadedRatio`、`activeMonsters`、`departedMonsters`、`recentHits`。**只 import 类型** from `lib/game.ts`（避免循环依赖） |
| `site/lib/game.ts` | reducer：`monster-summon` / `monster-hit` / `monster-rename` / `monster-release`；`normalizeGame` 做向后兼容回填（不清空数据） |
| `site/lib/ai/chat-contract.ts`、`deepseek.ts` | 契约新增 `monster`、`mood` 两个字段 |
| `site/lib/chat-payload.ts` | `fitChatTurn` 把新字段一起压进 10KB 上限 |
| `site/app/api/chat/route.ts` | 服务端守卫（怪兽不越权、上限 3 只） |
| `site/components/chat-room.tsx` | 提议 UI（不弹窗、不打断，只在输入框上方多一行） |
| `site/components/monster-shade.tsx` / `.css` | 世界页叠加层 + 怪兽卡片 |
| `site/components/records-page.tsx` / `.css` | 记录页「走过的」碑文区 |
| `site/components/assistant-scene.tsx` / `.css` | 首页陪伴条右下角那块几乎看不见的影子 |
| `site/components/today-panel.tsx` / `.css` | `shadeLevel()` 计算 0–1 的浓度 |

关键设计点（改代码前先读）：
- **没有攻击按钮，任何地方都没有。** 怪兽只靠「过日子、说出来、缓过来」变薄。
- 同时最多 3 只；第 4 只被 reducer 拒掉（「星球上已经有 3 只了，先让一只走掉吧」）。
- `monster-summon` 幂等：同 `clientId` 重复提交不重复生成。
- 释放后 `resolvedAt` 落库，`epitaph` 从**当初那句话**填 —— 怪走了，话留下。
- 首页那块影子**不可点、无名字、无分数**，只是「星球上还有东西在」的一个信号。

### 记录官形象（已提交 `8ce5d3c`）

`site/components/treant.tsx` + `treant.css` —— **SVG 占位素材**，不是终稿。
它钉死的三件事：构图比例、配色（`#7fd6b0` → `#e8c07a`）、`data-state` 状态机
（`idle / speaking / listening / thinking`，`sleeping` 由「减少动态效果」交给 CSS）。
外部只认 `.treant` 盒子和 `data-state` 属性 —— 换真图时不用动任何调用方。

### v2 概念稿核对（本次，未提交代码）

`docs/art/recordkeeper-concept-v2/REVIEW-2026-11-01.md` —— 完整核对结论。
一句话：**方向对，能接，但不能直接用。** 1 个必改（枝端像手）、3 个接入问题
（五状态表切不开、thinking 与 idle 在 56px 下分不出、土包和台座打架）。

---

## 二、验证到什么程度

按 AGENTS.md 第 2 条分开写：

### 本次核对过的（模拟环境）

- 在本地 366×694 和 1280×900 下跑通了怪兽全链路：三只影子都渲染、都可点，
  三个 `.planet-node` 领域标签仍然赢得命中测试（影子没抢点击）
- 卡片显示 名字 / 改名 / 原话 / 已经薄了 N% / hp / 最近挨的几下，**确认没有攻击按钮**
- reducer 端到端（直接 POST `/api/game`）：重复 summon 幂等、第 4 只被拒、
  rename 生效、release 落 `resolvedAt` 并从原话生成 `epitaph`
- 扣血：纯心情轮只触发 `felt`(15)；同一轮重放不再扣（ref 去重）；
  带记录的一轮加 `said`(10) 一次；`log` 在 9/10 不触发、10/10 触发一次、15/10 不再触发
- 首页影子不改变页面高度（694 不变）
- 记录页「走过的」区渲染正确
- typecheck 干净；eslint 只有 `today-panel.tsx` 里一条**既有的** `'Activity' 未使用` 警告

### 没验证的（别当成已验收）

- **真机没看过。** 荣耀 Magic 7 Pro 系统浏览器上，三只影子长什么样、点得动点不动，未知。
- **真模型没验过。** 本机没有模型 key，monster/mood 两个字段是直接 POST reducer 验的，
  DeepSeek 会不会稳定输出这两个字段 —— 未知。
- 五状态表接进状态机后的观感 —— 未知。
- CSS 驱动的状态在 56px 上的辨识度 —— 未知（这是 A 方案最大的不确定点）。

### 环境坑（下次接手先看这几条）

1. **vite HMR 会留旧的 `page.tsx` 模块。** 每个验证脚本 `goto` 之后必须
   `Page.reload({ignoreCache:true})`，否则新组件在 DOM 里全是 `null`。
   这次在这上面浪费了一整轮。
2. **本机 Chrome 默认报 `prefers-reduced-motion: reduce`。** 不先
   `Emulation.setEmulatedMedia` 设成 `no-preference`，所有 CSS 动画量出来都是 `none`。
3. **`top` + `bottom` 不给 `height` 会算成 0 高**（当包含块不是那个定位祖先时）。
   首页那块影子踩过，改成写死 `width/height`。
4. **CDP 的 `evalJS` 里写正则要注意转义**，`/\n+/g` 会抛
   `Invalid regular expression: missing /`。用 `String.fromCharCode(10)` 代替。
5. **`.dev.vars` 的凭据值一个字都不要打印。** 只 `grep -o "^[A-Z_]*="` 看名字。

---

## 三、悬而未决（下次开工先处理）

| 事项 | 状态 |
|---|---|
| 树人 v2 走 A 还是 B | **未定**，REVIEW 里推荐 A |
| 先接树人还是先做语音 | **未定**，下次开工先问用户 |
| `site/public/diag.html` 删不删 | **问了多次，用户始终没答**。它现在会随部署上线 |
| `verify-chat.mjs` 的「「我的」必须有记忆入口并接上弹窗」 | 基线就红，非本项目引起，用户没说要修 |
| 世界页「全部主线」按钮落在 y=728，694 高的屏幕上看不见 | 已知，未修 |
| `chat` 静默裁到 60 条，界面没有任何提示 | 已知，未修 |
| 「点『它记住的事』后自动放大、无法拖动」 | **已修复**（`d4a00d8` 改普通页面，用户真机确认可用）。旧模态自动放大的根因仍未知，只在本项目卡的历史记录里保留 |
| 语音输入（STT）+ 数字人形象素材「素人」 | **两项都没做**（用户 2026-11-01 确认） |

---

## 四、下一步：语音（用户明确要求「记得语音也要做」）

spec §2.2 已定：

- **按住说话 → 转文字填进输入框 → 用户确认后再发。** 不做「说完自动发送」。
- 输入行要重排成 `[输入框][麦克风][圆形发送]`。
- TTS 已有，缺一个开关的显眼位置。

环境事实（已实测，别再猜）：
- `http://localhost:5174` 和 `http://127.0.0.1:5174` **是安全上下文**，麦克风可用。
- `http://192.168.1.5:5174` **不是**，`getUserMedia` 是 `undefined`。
- 所以真机验证走 `adb reverse tcp:5174 tcp:5174` + 手机开 `http://localhost:5174`。
  adb 在 `C:\Users\Patch\AppData\Local\Microsoft\WinGet\Packages\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\platform-tools\adb.exe`。
- 中文识别质量**不保证** —— Web Speech 走浏览器厂商服务，荣耀那台百度内核会不会真调起来，
  只有真机点了才知道。

---

## 五、本次开发的环境残留

- dev server 起在 `127.0.0.1:5174`（PID 6724，日志 `%TEMP%\vite-dev.log`），重启电脑后需重拉。
- CDP 驱动脚本在 `%TEMP%\cdp-claude\`（`cdp.mjs` + 本次写的几个）。
- 开发库 D1 已恢复到注入前状态：`monsters: []`、`journal: 14`、`chat: 38`。
  备份在 `pre-monster-verify.sqlite`。
