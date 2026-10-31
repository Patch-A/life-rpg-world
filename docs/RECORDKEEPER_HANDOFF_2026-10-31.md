# 记录官 V1 · 交接说明

**写于**：2026-10-31 晚
**交给**：接手继续开发的模型（GPT-6 / Codex / 其他）
**原作者**：Claude Code（本机会话 f4a93731、253e24d9）
**一句话**：功能基本做完了，本地模拟环境全绿，**但用户手机上有一个 bug 修了 6 轮没修好**，因此整体判定「不可用」。

---

## 0. 先读这五条，能省你半天

1. 用户的手机上，目前**唯一**没通过的是：**「我的 → 它记住的事」点击后无反应 / 自动放大 / 页面拖不动**。
2. **不要再靠读代码猜这个 bug**。上一轮已定位到两条机制并据此改过一版，模拟环境 1x/2x/3x 全通过，**用户真机复测仍然失败**。必须先向用户取一条现象证据（见 §6.6）。
3. 用户设备是**荣耀 Magic 7 Pro（安卓）+ 系统自带浏览器**，访问 `http://192.168.1.5:5174`。前五轮误按 iPhone 排查，方向全错，浪费一天。
4. 这个地址是**非安全上下文**（`http://` + 局域网 IP）。`crypto.randomUUID`、`AbortSignal.timeout`、`navigator.clipboard` 在这里**不存在**，而且异常会被统一包装成「网络连接失败」，误导过三天。
5. **41 个提交只在本地，从未推送**到 `origin`。电脑 2026-10-30 22:26 蓝屏过一次。**接手第一件事建议先 push 一个备份分支。**

---

## 1. 项目是什么

「记录官」= 已有项目 **人生 RPG** 的 V2 玩法层，**不是新项目**。

- 定位：打开首页看到「一个人」，跟它说话，它边聊边把值得记的事抽成 1–3 条记录；用户点「算」才转成行动拿经验；当天可导出 Markdown 进 Obsidian。
- 三层结构：**聊**（首页对话）→ **看**（今日记录 / 导出）→ **得**（经验值，V1 只做「认领记录 → 经验」，其余不做）。
- 助手是**同一个人、两种姿态**：`companion`（陪伴者）/ `counselor`（咨询师），升级姿态需用户同意。
- 开源 + BYOK：部署者填自己的 API key（DeepSeek 默认，可换任意 OpenAI 兼容端点）。

**V1 明确不做**：怪物系统、奖励转盘、房间随季节变化、语音输入（STT）、下棋/PK/社区、3A 画面。

---

## 2. 文件在哪（全部路径）

| 内容 | 路径 |
|---|---|
| 仓库根 | `C:\Users\Patch\life-rpg-world` |
| 应用根目录 | `C:\Users\Patch\life-rpg-world\site` |
| 开发约定（**必读**） | `C:\Users\Patch\life-rpg-world\AGENTS.md` |
| 旧交接文档（历史内容，勿当现状） | `C:\Users\Patch\life-rpg-world\docs\CODEX_HANDOFF.md` |
| **本文件** | `C:\Users\Patch\life-rpg-world\docs\RECORDKEEPER_HANDOFF_2026-10-31.md` |
| 施工计划与逐任务报告 | `C:\Users\Patch\life-rpg-world\.superpowers\sdd\2026-10-30-recordkeeper-v1\` |
| 　└ 总进度 | `...\progress.md`（59KB） |
| 　└ 验收记录 | `...\acceptance.md`（38KB） |
| 　└ 每个任务的 brief / report | `task-1-brief.md` … `task-12-brief.md` |
| 　└ 每轮复审 diff | `review-*.diff` |
| **注意** | `.superpowers\` 被 `.gitignore` 忽略，**不在 git 里**，换机器会丢 |
| Obsidian 项目卡片 | `...\Obsidian Vault\10-项目\对话式AI人生记录官.md` |
| Obsidian 会话档案（摘要） | `...\Obsidian Vault\50-Raw\会话档案\2026\10\记录官开发-会话档案-2026-10-30-至-10-31.md` |
| Obsidian 原始转录副本（18MB，纯日志） | 同目录 `记录官开发-2026-10-30-完整转录.jsonl` |
| 完整会话原文（Claude Code 侧） | `C:\Users\Patch\.claude\projects\C--Users-Patch\253e24d9-….jsonl`（30MB）<br>`C:\Users\Patch\.claude\projects\C--Users-Patch\f4a93731-….jsonl`（18MB） |

---

## 3. 代码状态

```
仓库     C:\Users\Patch\life-rpg-world
分支     codex/recordkeeper-v1
HEAD     19359a7  fix(recordkeeper): 放大后弹窗把屏幕糊死、整页拖不动
相对 main 领先 41 个提交
工作区   干净（git status 为空）
远端     origin → https://github.com/Patch-A/life-rpg-world.git
状态     该分支从未推送；origin 只有 main
```

最近 12 个提交（从新到旧）：

```
19359a7 放大后弹窗把屏幕糊死、整页拖不动          ← 未生效，见 §6
287be77 修复旧 iOS 上发送报「网络连接失败」，手机字号重定
fab7881 手机上记录官的话被切成半句并冒出滚动条
61b0930 手机「目标」页横向溢出、成长页小字、弹窗关闭键点不准
5d4261b 整分支复审 4 项落地（长回复存不上、journal 静默裁剪、刷新后姿态错位、隐私口径）
55cfbca 非安全上下文下 crypto.randomUUID 不存在 → 误报网络连接失败
0913b3e 手机字号抬到可读
f0e11e1 手机「我的」页人物压矮改横排
7812abf 同意标记随对话落库
f511922 清空记忆确认按实际条数说话
9f51f75 清空记忆改用页面级 AlertDialog
565e27b 记忆可见可删、朗读可关、隐私说明与实现对齐
```

---

## 4. 怎么在本机跑起来

**前置（均已满足，无需重装）**：`site\node_modules` 已存在，`site\.dev.vars` 已存在（含模型 key，**不要提交**）。

```powershell
cd C:\Users\Patch\life-rpg-world\site
node scripts/run-framework.mjs dev     # → http://127.0.0.1:5173
```

- 本地数据库是 Miniflare 的**本地 D1**，状态在 `site\.wrangler\state`。
- **手机访问必须另开反向代理到 0.0.0.0:5174**（昨晚用的脚本在 `%TEMP%\cdp\proxy.mjs`，**已被清理，需要重写**：转发到 127.0.0.1:5173 并监听 0.0.0.0）。
- 用户手机入口：`http://192.168.1.5:5174`（IP 可能因路由器变化，先确认）。
- 数据库迁移：应用 `site/drizzle/*.sql` **全部**迁移，不只是第一份。

**验证脚本**（在 `site/` 下跑）：

```powershell
node scripts/verify-chat.mjs          # 32+ 组断言，核心
node scripts/verify-agent.mjs
node scripts/verify-mobile-layout.mjs # 手机布局/视口
node scripts/verify-abort.mjs         # 扫客户端文件里的危险浏览器 API
# 全量：for f in scripts/verify-*.mjs
npx tsc --noEmit
npm run lint      # 基线 31 errors / 35 warnings，别变多
```

**两条基线就红，不是你的改动引起，别去修**：
- `verify-journey.mjs` — 缺异常断言
- `verify-memories-ui.mjs` — Windows 下 `new URL('..').pathname` 拼成 `C:\C:\...` 的路径 bug

---

## 5. 已经做完的部分（可视为功能完成，但见 §6 的「真机」限定）

V1 共 12 个子任务，全部由子代理实现 + 独立复审 + 变异测试（故意改坏代码确认断言会红），逐任务报告在 `.superpowers\sdd\...\`。

| 功能 | 主要文件 |
|---|---|
| 存档结构扩展（journal / chat / memory / monsters 字段，兼容旧存档） | `site/lib/game.ts` |
| 对话轮次落库 `chat-turn`（幂等、不碰经验值） | `site/lib/game.ts` |
| 记录认领 → 行动 → 经验；撤销认领；删除联动 | `site/lib/game.ts`（`claim-record` / `unclaim-record` / `keep-record` / `delete-journal` / `edit-journal`） |
| 长期记忆可见、可删、可清空（页面级确认弹窗，无 `window.confirm`） | `site/components/memory-list.tsx`、`site/app/page.tsx` |
| 聊天契约与脏数据清洗（模型返回畸形不毁整轮） | `site/lib/ai/chat-contract.ts` |
| 模型调用（DeepSeek / 任意 OpenAI 兼容端点、BYOK） | `site/lib/ai/provider.ts`、`site/lib/ai/deepseek.ts` |
| `POST /api/chat`（鉴权、同意校验、18+、双向额度隔离、幂等、失败落库） | `site/app/api/chat/` |
| 聊天上下文最小化（只发白名单字段，不外泄照片/生日） | `site/lib/chat-context.ts` |
| 当天记录导出 Markdown | `site/lib/export-journal.ts` |
| 助手场景组件（占位美术、语音朗读可关、预留季节位） | `site/components/assistant-scene.tsx` |
| 对话区（输入、同意行、记录卡片、删除二次确认、重试不丢内容） | `site/components/chat-room.tsx` |
| 首页两列布局、开场白随时段变化 | `site/app/page.tsx` |

**模拟环境验收 11 项全部通过**（headless Chrome + CDP，安卓视口 412×915 @3x），包括：首屏是人+一句话、开场白是模板、等待态、真实模型往返抽 1–3 条记录、刷新后仍在、认领→XP、两步删除、导出 MD、模型不可用时降级、关朗读不发声、375×667 无横向溢出。

**用户真机明确确认通过的**（只有两项）：
- 发送消息（原报「网络连接失败」）→ 2026-10-30 用户说「现在发送修好了，可以成功发送」
- 手机字号偏小 → 修后用户未再提

---

## 6. 唯一未解决的问题（重点）

### 6.1 用户原话

> 「我的-它记住的事，点击后没反应，自动放大然后无法拖动界面」
> 「我的-它记住的事还是没反应，一样的还没修好」（2026-10-31 00:20，第六轮修复后复测）

### 6.2 已确认的环境事实

- 设备：**荣耀 Magic 7 Pro，安卓，系统自带浏览器**（不是 iOS，不是 Chrome）
- 入口：`http://192.168.1.5:5174`，**非安全上下文**
- 触发现场：进「我的」页 → 点「它记住的事」（`MemoryList`）→ 页面自动放大 + 拖不动

### 6.3 昨晚在 CDP 模拟环境量到的两条机制（有测量支撑，非猜测）

1. **Radix 模态锁吃掉滑动**：弹窗打开时，遮罩上的 `touchmove` **16/16 被 `preventDefault`**；无弹窗时 0/16 → 整页平移失效。
2. **视口错位**：`.game-dialog` 是 `fixed` + `vh/dvh` 居中，量的是**布局视口**；用户放大后看到的是**视觉视口**。2x 下弹窗排到 753px 高，可见区只有 206×458，**关闭键和「全部清空」都在屏幕外**，且弹窗 `scrollHeight === clientHeight`，滚也滚不到。

### 6.4 已做过的修复（提交 `19359a7`）

- 新增 `site/components/viewport-vars.tsx`：写入 `--vvh`/`--vvw`/`--vv-top` 视觉视口变量
- `site/app/globals.css`：`.game-dialog` 位置与限高改绑 `--vvh`；`html[data-vvh='short']` 压缩内边距、隐藏描述
- `site/components/memory-list.css`：列表改三段式
- `globals.css`：`button,a,label{touch-action:manipulation}`（预防双击缩放，**推断，未验证**）
- `site/scripts/verify-mobile-layout.mjs`：新增断言

**结果：模拟环境 1x/2x/3x 全绿，用户真机复测仍失败。**

### 6.5 已被证伪的假设，**不要重走**

| 假设 | 结论 |
|---|---|
| 「用户是 iPhone，Safari 的 `-webkit-` 行为不同」 | ❌ 安卓。前五轮全废 |
| 「是 `crypto.randomUUID` 缺失」 | 该问题确实存在（已修，`lib/ids.ts`），但**与本 bug 无关** |
| 「模拟环境通过 = 真机可用」 | ❌ **这一轮的失败就是这条假设造成的** |
| 「双击缩放导致自动放大」 | ⚠️ 未证实。headless Chrome 不模拟双击手势，无从测量 |
| 「Radix 模态锁是根因」 | ⚠️ 只证明「弹窗开着时拖不动」。**关掉弹窗后整页是否仍拖不动，未向用户确认** |

### 6.6 下一步：先取证，再改代码

**不要继续猜。** 需要用户回答三选一（今晚已经问过，用户选择先交接，尚未回答）：

- **A：完全没反应** — 点下去屏幕没有任何变化
- **B：有遮罩没内容** — 背景变暗了，但没出现列表
- **C：有内容但动不了** — 列表出来了，但滑不动 / 按钮在屏幕外够不到

三者根因完全不同：
- A → `modal` 状态没切换，或点击事件在安卓系统浏览器里根本没收到底（优先查触摸/命中测试，不是样式）
- B → Dialog 挂载了但内容渲染失败或高度塌成 0
- C → 视口/滚动链问题，`19359a7` 那套改动方向对但没覆盖到

**另外必须知道**：昨晚用的 CDP 驱动脚本放在 `%TEMP%\cdp\`，**已被系统清理，一个不剩**。要重现模拟环境需重写（headless Chrome `--remote-debugging-port=9222` + Node 24 内置 `WebSocket` 直连，不新增依赖）。

**真机验证的硬要求**：用真实触摸事件（CDP `Input.dispatchTouchEvent`），**不能用 `element.click()`** — 它绕过命中测试，手指点不通的地方它照样通。

---

## 7. 这个项目反复踩的坑（务必先读）

1. **两套运行环境不相同**。`127.0.0.1` 是安全上下文，`192.168.1.5` 不是。只在 `127.0.0.1` 验证 = 本地全绿、真机全废。这是本 bug 的前身（网络连接失败）耗掉三天的原因。
2. **错误映射会藏根因**。`requestError()` 把任何 `TypeError` 都说成「网络连接失败」。新加浏览器 API 前先问「这台设备上有吗」，并加进 `scripts/verify-abort.mjs` 的白名单扫描。
3. **`position:fixed` + `vh/dvh` 在放大后不可信**。手机上它量布局视口，用户看视觉视口。任何贴边/居中/满屏浮层放大后都可能整块跑出屏幕。
4. **长按/滚动的 CSS 全局污染**：`globals.css` 有全局 `input{min-height:48px}`，会把勾选框撑成 18×48。新写组件要显式覆盖。
5. **`window.confirm` 已全项目禁用**，改用页面级 `AlertDialog`。
6. **写存档只有一条路径**：`POST /api/game` → `reduceGame(state, action)`，带 revision 乐观锁。**不要新开第二条写入口**，否则并发会打架。`/api/chat` 本身不写存档。
7. **经验值只能由用户确认后的行动产生**，模型永远不能直接改 XP。

---

## 8. 关键文件地图

```
site/
  app/
    page.tsx                首页总装（我的页、弹窗分发、MemoryList 挂载点 :124）
    globals.css             全局样式 + 手机断点 + 弹窗视口适配
    layout.tsx              根布局
    api/chat/route.ts       POST /api/chat（额度、同意、18+、幂等）
    api/game/route.ts       唯一存档写入口
  components/
    chat-room.tsx           对话区（输入、同意行、记录卡片、重试）
    memory-list.tsx         长期记忆列表（本 bug 的现场）
    assistant-scene.tsx     助手场景
    viewport-vars.tsx       视觉视口变量（19359a7 新增）
    life-records.tsx        记录页
  lib/
    game.ts                 ★ 核心：Game 类型 + reduceGame 全部 action
    chat-context.ts         发给模型的上下文投影（白名单）
    export-journal.ts       当天导出 MD
    ids.ts                  newId()（非安全上下文安全）
    abort.ts                timeoutSignal(ms)
    ai/provider.ts          BYOK、端点解析、超时
    ai/chat-contract.ts     聊天返回契约 + 清洗
    ai/deepseek.ts          模型调用
  scripts/                  verify-*.mjs（17 个）
  drizzle/                  数据库迁移（必须全部按序应用）
```

---

## 9. 边界与禁止

摘自 `AGENTS.md`，接手必须遵守：

1. 应用根目录是 `site/`，先读 `docs/CODEX_HANDOFF.md`。
2. 区分「本次核对结果」「历史检查结果」「未验证事项」。**源码构建成功 ≠ 手机体验已验收**。
3. 男角色只能穿男装、女角色只能穿女装；衣柜/预览/规则/服务端保持一致。
4. 存档结构变化必须给兼容策略，**不允许用清空数据解决问题**。
5. 不提交 `.env*`、Token、数据库、私密照片、用户存档、依赖、构建产物。
6. 当前身份来自 Sites 可信注入头；迁移到普通服务器必须先做可信认证，**不能信任公网请求里的身份头**。
7. **不主动跑测试**，除非用户要求验证；验证时用现有脚本并说明覆盖边界。
8. 生产环境未触碰、未发布。所有工作都在本地 Miniflare + 局域网地址上。

---

## 10. 交接时建议的动作顺序

1. `git push -u origin codex/recordkeeper-v1`（先备份；用户需确认）
2. 读 `AGENTS.md` → 本文件 → `.superpowers/sdd/2026-10-30-recordkeeper-v1/acceptance.md`
3. 向用户取 §6.6 的 A/B/C 证据
4. 拉本地环境（§4），重写局域网代理
5. 只针对证据对应的那一种根因动手，改完**必须在真机同款入口验证**，不能用 `127.0.0.1` 通过就宣布修好
6. 修好后同步更新 Obsidian 项目卡片 `10-项目\对话式AI人生记录官.md`
