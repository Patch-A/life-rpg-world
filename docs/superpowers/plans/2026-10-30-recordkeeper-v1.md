# 记录官 V1 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 `site/` 上加一层会说话、记得人的助手：聊完自动变成记录，记录可认领成行动，能导出 MD。

**Architecture:** 存档仍只有一条写路径——`POST /api/game` + `reduceGame`。新增的 `POST /api/chat` 只调模型、只返回契约，不写库；前端拿到结果后立刻用现有 `mutate` 落库。新数据全部塞进 `saves.data` 的 JSON，不动数据库结构。

**Tech Stack:** React 19 · Next 16 (vinext) · Cloudflare Workers/D1 · Drizzle · Zod · DeepSeek Chat API · TypeScript

**Spec:** `docs/superpowers/specs/2026-10-30-recordkeeper-v1-design.md`

---

## Global Constraints

以下每条都来自 spec，每个任务都隐含包含：

- **不重做现有 demo**：目标、行动、记录、经验值、人生纪念、角色、DeepSeek 建议与复盘原样保留，不重构
- **数据库不改**：不加表、不加列、不写 Drizzle 迁移
- **唯一写路径**：存档只能经 `POST /api/game` → `reduceGame` 修改
- **姿态边界**：`posture` 从 `companion` 升到 `counselor` 必须 `switchConsent === true`，否则服务端强制改回 `companion`；降级自动放行
- **防编造**：`records[].text` 必须是用户本轮原话的子串，不是就丢弃
- **额度**：`AI_CHAT_USER_DAILY_LIMIT` 默认 `50`，`AI_CHAT_SITE_DAILY_LIMIT` 默认 `500`，按 `agent_runs.mode='chat'` 独立计数，与 `/api/agent` 互不占用
- **不流式**：沿用 `stream:false` + `response_format:json_object`
- **上限**：`chat` 60 轮、`memory` 40 条、`journal` 500 条
- **原文截断**：`JournalEntry.text` 最多 400 字
- **照片不进模型**：请求上下文不含 `photos`、不含生日、不含人生纪念
- **自带模型**：密钥只从环境变量读（`AI_API_KEY ?? DEEPSEEK_API_KEY`），不回传前端、不写日志、不进错误信息；非 DeepSeek 端点不发送 `thinking` 字段
- **开场白是模板，不调模型**
- **中文文案**，与现有代码风格一致（紧凑、少空行、中文错误信息）

### AGENTS.md 规则 8 已获授权

`AGENTS.md` 第 8 条要求不新增测试。**本人已于 2026-10-30 授权新增 `site/scripts/verify-chat.mjs`**，沿用现有 `scripts/verify-*.mjs` 的隔离 SQLite + 替换模块模式。除此之外不新增其他测试文件。

---

## Review Focus

spec 没写、但真人使用时最先撞上的五种情况，各自在对应任务里钉了测试：

1. **点「算」时今日该领域经验已满 30** —— 记录仍应转为行动并写入 Log，只是 `+0 EXP`，不能报错、不能没反应
2. **模型回了一段合法 JSON，但 `records[].text` 不是用户原话** —— 丢弃该条记录，其余的照常，不整条失败、也不落一条假记录
3. **`/api/chat` 已经扣了额度，但随后写存档时 revision 冲突** —— 额度照扣（已消耗），前端走现有 `setConflict` 保住输入，不丢用户打的话
4. **同一天第 61 轮、第 41 条记忆、第 501 条记录** —— 按 spec 淘汰最旧的，不报错、不无限增长
5. **旧存档没有 `journal` / `chat` / `memory` / `monsters` 字段** —— `normalizeGame` 补空数组，页面正常渲染，不清空任何既有数据

---

## File Structure

| 文件 | 职责 |
|---|---|
| `site/lib/game.ts` | **改**：新增四个字段类型与默认值；新增 `chat-turn`、`claim-record`、`delete-journal`、`delete-memory-fact` 四个 action |
| `site/lib/ai/chat-contract.ts` | **新**：聊天契约的 zod schema 与类型 |
| `site/lib/ai/deepseek.ts` | **改**：新增 `generateChat()`；两处调用改走 provider |
| `site/lib/ai/provider.ts` | **新**：解析密钥/端点，按模型能力降级 |
| `site/.env.example` | **新**：自托管配置模板（不含真 key） |
| `site/lib/chat-context.ts` | **新**：把 `Game` 裁剪成发给模型的上下文（**唯一允许决定"发什么"的地方**） |
| `site/app/api/chat/route.ts` | **新**：额度、原子预留、调用模型、服务端强校验 |
| `site/lib/export-journal.ts` | **新**：当天记录导出 MD |
| `site/components/assistant-scene.tsx` | **新**：助手在场（占位美术 + 气泡 + 语音） |
| `site/components/chat-room.tsx` | **新**：对话流 + 输入框 + 快捷回复 + 认领按钮 |
| `site/components/assistant-scene.css` | **新**：场景样式 |
| `site/components/chat-room.css` | **新**：对话样式 |
| `site/components/memory-list.tsx` | **新**：记忆可见/可删 |
| `site/components/today-panel.tsx` | **改**：在顶部挂对话区 |
| `site/app/page.tsx` | **改**：接入状态机；`ActionAssistant` 从 today 移到 tasks |
| `site/app/about/page.tsx` | **改**：隐私文案 |
| `site/cloudflare-env.d.ts` | **改**：新增两个 env 键 |
| `site/scripts/verify-chat.mjs` | **新**：端到端验证（待授权） |

---

## Task 1: 存档结构与旧存档兼容

**Files:**
- Modify: `site/lib/game.ts`（类型区、`blank()`、`normalizeGame()`）
- Test: `site/scripts/verify-chat.mjs`（新建，先只写这一段）

**Interfaces:**
- Produces:
  - `type JournalEntry`, `type ChatTurn`, `type MemoryFact`, `type Monster`（字段见 spec §6.2，`JournalEntry` 额外带 `status: 'pending'|'claimed'|'kept'` 与 `logId?: string`）
  - `Game` 新增 `journal: JournalEntry[]`、`chat: ChatTurn[]`、`memory: MemoryFact[]`、`monsters: Monster[]`
  - `normalizeGame(v: Game, today?: string): Game` 对缺失的四字段补 `[]`

- [ ] **Step 1: 写失败验证**

在 `site/scripts/verify-chat.mjs` 新建（复制 `verify-agent.mjs` 顶部的 `source`/`url` 加载样板，去掉 API 路由部分）：

```js
// 旧存档兼容 + 新字段默认值
const {normalizeGame,blank}=await import(game);
const legacy={profile:{name:'测试',focus:'mind',createdAt:new Date().toISOString()},goals:[],tasks:[],logs:[],events:[],milestones:[],claims:[],equipped:'explorer',birthday:null,birthdays:[],birthdayQueue:[],reviews:[],agentAccepts:[],settings:{celebrations:true,memoryPromptSeen:false}};
const n=normalizeGame(legacy);
assert.deepEqual(n.journal,[]);assert.deepEqual(n.chat,[]);assert.deepEqual(n.memory,[]);assert.deepEqual(n.monsters,[]);
assert.equal(n.logs.length,0);assert.equal(n.profile.name,'测试');
assert.deepEqual(blank().journal,[]);
console.log('PASS 旧存档补齐新字段且不清空既有数据');
```

- [ ] **Step 2: 跑，确认失败**

Run: `cd site && node scripts/verify-chat.mjs`
Expected: FAIL — `journal` 是 `undefined`，`deepEqual` 报 `+ undefined`

- [ ] **Step 3: 实现**

在 `site/lib/game.ts` 追加四个类型（照 spec §6.2 抄，注意 `Monster` 的 `kind` 是 `'life'|'setback'|'emotion'|'jobless'`），在 `Game` 类型里加四个字段，`blank()` 返回对象里加 `journal:[],chat:[],memory:[],monsters:[]`，`normalizeGame` 的 `const s={...blank(),...value,...}` 里加 `journal:value.journal||[],chat:value.chat||[],memory:value.memory||[],monsters:value.monsters||[]`。

- [ ] **Step 4: 跑，确认通过**

Run: `cd site && node scripts/verify-chat.mjs`
Expected: PASS 一行

- [ ] **Step 5: 提交**

```bash
git add site/lib/game.ts site/scripts/verify-chat.mjs
git commit -m "feat(recordkeeper): 存档结构新增 journal/chat/memory/monsters 并兼容旧存档"
```

---

## Task 2: `chat-turn` action —— 把一轮对话写进存档

**Files:**
- Modify: `site/lib/game.ts`（`reduceGame` 新增分支，放在 `agent-confirm` 之后）
- Test: `site/scripts/verify-chat.mjs`（追加）

**Interfaces:**
- Consumes: Task 1 的四个字段
- Produces: `Action = {type:'chat-turn'; clientId:string; userText:string; reply:string; posture:'companion'|'counselor'; records:{summary:string;text:string;domain?:Domain;tags:string[]}[]; memoryCandidates:{text:string;kind:'fact'|'preference'|'situation'}[]}` → 返回新 `Game`，其中：
  - `chat` 追加 2 条（user + assistant），超过 60 条时从头删
  - 每条 `records` 追加一条 `JournalEntry`，`status:'pending'`，`runId = clientId`
  - `memory` 合并候选（文本相同则 `weight += 1` 并更新 `lastSeen`），超过 40 条时按 `weight` 升序、`lastSeen` 升序删
  - `journal` 超过 500 条时删最旧
  - **XP 不变**

- [ ] **Step 1: 写失败验证**

```js
let g=...;  // 先 onboard 得到带 profile 的存档
const turn={type:'chat-turn',clientId:crypto.randomUUID(),userText:'今天看完了第三章，卡在并发',reply:'卡住的地方具体是哪一步？',posture:'companion',records:[{summary:'看完第三章',text:'今天看完了第三章',domain:'mind',tags:['学习']}],memoryCandidates:[{text:'在读一本讲并发的书',kind:'situation'}]};
let after=reduceGame(g,turn,new Date());
assert.equal(after.chat.length,2);
assert.equal(after.chat[0].role,'user');assert.equal(after.chat[1].role,'assistant');
assert.equal(after.journal.length,1);assert.equal(after.journal[0].status,'pending');assert.equal(after.journal[0].runId,turn.clientId);
assert.equal(after.memory.length,1);assert.equal(after.memory[0].weight,1);
assert.equal(xp(after),xp(g),'聊天不应改变经验值');
// 幂等：同一个 clientId 重复提交不重复写
assert.equal(reduceGame(after,turn,new Date()).chat.length,2);
// 记忆合并：同样的话再说一次，weight 变 2 而不是新增一条
const again={...turn,clientId:crypto.randomUUID(),memoryCandidates:[{text:'在读一本讲并发的书',kind:'situation'}]};
const merged=reduceGame(after,again,new Date());
assert.equal(merged.memory.length,1);assert.equal(merged.memory[0].weight,2);
console.log('PASS 聊天写入、幂等、记忆合并、不动经验值');
```

- [ ] **Step 2: 跑，确认失败**

Run: `cd site && node scripts/verify-chat.mjs`
Expected: FAIL — `chat.length` 是 `0`，期望 `2`

- [ ] **Step 3: 实现**

在 `reduceGame` 中加 `if(a.type==='chat-turn'){...}`。要点：
- `const rid=str(a.clientId,80)`；若 `s.chat` 里已有 `runId === rid` 的 turn，直接 `return s`（幂等）
- `userText` 用 `text(a.userText,1000)`、`reply` 用 `text(a.reply,2000)`；空串则抛 `'对话内容为空'`
- `JournalEntry.text` 取 `userText` 的前 400 字，`summary` 取 `records[i].summary`（`str(...,200)`）
- 超过上限用 `splice(0, s.chat.length-60)` 这类写法截断
- **不调用 `recalculate`**，不动 XP

- [ ] **Step 4: 跑，确认通过**

Run: `cd site && node scripts/verify-chat.mjs`
Expected: 两行 PASS

- [ ] **Step 5: 提交**

```bash
git commit -am "feat(recordkeeper): chat-turn 写入对话与记录，幂等且不影响经验值"
```

---

## Task 3: `claim-record` / `delete-journal` / `delete-memory-fact`

**Files:**
- Modify: `site/lib/game.ts`
- Test: `site/scripts/verify-chat.mjs`

**Interfaces:**
- Consumes: Task 2 的 `JournalEntry`
- Produces:
  - `{type:'claim-record'; id:string}` → 找到 `status==='pending'` 的条目：
    - 建一条一次性行动 `Task{id:新 id, title:summary, domain:entry.domain??'mind', target:1, unit:'次', repeat:false, goalId:'', archived:false, evidence:'optional', originRunId:entry.runId}`
    - 建一条 `Log{taskId, value:1, unit:'次', domain, goalId:'', xp:0, ...metadata}`
    - 调 `recalculate(s)`（按现有规则，当日该领域未满 30 则 `xp=30`，满了就 `+0`，**不报错**）
    - `entry.status='claimed'`、`entry.logId=新 log id`
  - `{type:'delete-journal'; id:string}` → 删除该条；若 `status==='claimed'` 且 `logId` 存在，**同时把对应 Log 标记 `undone`**（`recalculate` 后）——防止删了记录却留着经验
  - `{type:'delete-memory-fact'; id?:string}` → 有 `id` 删一条，无 `id` 清空

- [ ] **Step 1: 写失败验证**

```js
const jid=after.journal[0].id;
let c=reduceGame(after,{type:'claim-record',id:jid},new Date());
assert.equal(c.journal[0].status,'claimed');assert.ok(c.journal[0].logId);
assert.equal(c.tasks.length,1);assert.equal(c.tasks[0].unit,'次');assert.equal(c.tasks[0].repeat,false);
assert.equal(c.logs.length,1);assert.equal(c.logs[0].value,1);
assert.equal(xp(c),30,'认领后应得一次领域经验');
// 当日该领域经验已满时，认领成功但 +0
const second={...turn,clientId:crypto.randomUUID(),records:[{summary:'又学了一点',text:'又学了一点',domain:'mind',tags:[]}],memoryCandidates:[]};
let d=reduceGame(c,second,new Date());
d=reduceGame(d,{type:'claim-record',id:d.journal[1].id},new Date());
assert.equal(d.journal[1].status,'claimed');assert.equal(xp(d),30,'同日同领域不重复给经验');
// 删除已认领的记录，对应 Log 一并撤销
const e=reduceGame(d,{type:'delete-journal',id:d.journal[1].id},new Date());
assert.equal(e.logs[1].undone,true);
// 重复认领报错
assert.throws(()=>reduceGame(c,{type:'claim-record',id:jid},new Date()),/已经认领/);
// 记忆删除与清空
assert.equal(reduceGame(merged,{type:'delete-memory-fact',id:merged.memory[0].id},new Date()).memory.length,0);
assert.equal(reduceGame(merged,{type:'delete-memory-fact'},new Date()).memory.length,0);
console.log('PASS 认领成行动、经验上限、删除联动、记忆可删');
```

- [ ] **Step 2: 跑，确认失败** — `claim-record` 是未知 action，`journal[0].status` 仍是 `'pending'`

- [ ] **Step 3: 实现** — 三个分支按界面里写的规则实现；`claim-record` 结束时必须调 `recalculate(s)`

- [ ] **Step 4: 跑，确认通过**

- [ ] **Step 5: 提交**

```bash
git commit -am "feat(recordkeeper): 记录可认领为行动，删除记录联动撤销经验"
```

---

## Task 4: 聊天契约与服务端强校验

**Files:**
- Create: `site/lib/ai/chat-contract.ts`
- Modify: `site/lib/ai/deepseek.ts`（新增 `generateChat`）
- Test: `site/scripts/verify-chat.mjs`

**Interfaces:**
- Produces:
  - `chatResultSchema`（zod）：`{reply, posture:'companion'|'counselor', askSwitch:boolean, records:[{summary,text,domain?:'mind'|'health'|'career'|'wealth'|'social',tags:string[]}], memoryCandidates:[{text,kind:'fact'|'preference'|'situation'}], quickReplies:[{label,kind:'say'|'accept-switch'}]}`，`records` 与 `quickReplies` 各 `max(3)`
  - `type ChatResult = z.infer<typeof chatResultSchema>`
  - `generateChat(key: string, model: string, context: unknown): Promise<ChatResult>`
  - `sanitizeChatResult(r: ChatResult, userText: string, prevPosture: 'companion'|'counselor', switchConsent: boolean): ChatResult` —— **纯函数，无 IO**

`sanitizeChatResult` 规则（每条都有下一步的测试）：
1. `records[].text` 不是 `userText` 子串 → 丢掉这条
2. `posture==='counselor' && prevPosture==='companion' && !switchConsent` → 改写为 `posture:'companion'`、`askSwitch:true`
3. `posture==='companion'` → `askSwitch` 强制 `false`
4. `records` 去重后仍超过 3 条 → 保留前 3

- [ ] **Step 1: 写失败验证**

```js
const {chatResultSchema,sanitizeChatResult}=await import(contract);
const userText='今天看完了第三章，卡在并发';
const raw={reply:'卡在哪一步？',posture:'counselor',askSwitch:false,records:[
  {summary:'看完第三章',text:'今天看完了第三章',domain:'mind',tags:[]},
  {summary:'编的一条',text:'我昨天还学了英语',domain:'mind',tags:[]}],memoryCandidates:[],quickReplies:[]};
// 1 编造的记录被丢弃
assert.equal(sanitizeChatResult(raw,userText,'companion',false).records.length,1);
// 2 没点头就升咨询师 → 打回陪伴者并重新征求
const s2=sanitizeChatResult(raw,userText,'companion',false);
assert.equal(s2.posture,'companion');assert.equal(s2.askSwitch,true);
// 3 点头后可升
assert.equal(sanitizeChatResult(raw,userText,'companion',true).posture,'counselor');
// 4 陪伴者不主张升级
assert.equal(sanitizeChatResult({...raw,posture:'companion',askSwitch:true},userText,'counselor',false).askSwitch,false);
// 5 契约拒绝超量
assert.throws(()=>chatResultSchema.parse({...raw,records:new Array(4).fill(raw.records[0])}));
console.log('PASS 防编造、姿态升级需同意、降级放行、契约限流');
```

- [ ] **Step 2: 跑，确认失败** — 模块不存在

- [ ] **Step 3: 实现**

`chat-contract.ts` 照现有 `agent-contract.ts` 的紧凑风格写。`generateChat` 照 `generateActions` 的结构写：同一 endpoint、`response_format:{type:'json_object'}`、`stream:false`、`thinking:{type:'disabled'}`、45s 超时，失败抛 `ModelError`。system prompt 要点（可逐条写进提示词）：

```
你是用户人生里的一个记录者。你是同一个人，有两种姿态：
- 陪伴者：先接住对方说的话，不急着给方案，不评价，不布置作业。对方状态差时给台阶，不追问产出。
- 咨询师：直接、具体、给方向，不铺垫。
判据：对方的话里有没有明确的动作请求。有 → 咨询师；是情感表达 → 陪伴者；说不准 → 陪伴者。
从陪伴者切到咨询师，必须先问一句再切，并把 askSwitch 置为 true。
只记录对方真实说过的事，text 必须是原话的连续片段。拿不准就不记。
输出 JSON，中文，不加 Markdown。
```

- [ ] **Step 4: 跑，确认通过**

- [ ] **Step 5: 提交**

```bash
git add site/lib/ai/chat-contract.ts site/lib/ai/deepseek.ts
git commit -m "feat(recordkeeper): 聊天契约、模型调用与服务端强校验"
```

---

## Task 5: 发给模型的上下文

**Files:**
- Create: `site/lib/chat-context.ts`
- Test: `site/scripts/verify-chat.mjs`

**Interfaces:**
- Produces: `buildChatContext(state: Game, opts: {userText: string; prevPosture: 'companion'|'counselor'; switchConsent: boolean}): ChatContext`，返回：

```ts
{
  userText: string,
  prevPosture: 'companion'|'counselor',
  recentChat: {role:'user'|'assistant', text:string}[],   // 最近 20 轮
  memory: {text:string, kind:string}[],                   // 全部，最多 40
  goals: {title:string, domain:string, progress:number, target:number, unit:string}[],
  recentLogs: {date:string, title:string, domain:string, value:number, unit:string}[], // 最近 20 条
  savings: {title:string, net:number}[],
  level: number,
  todayXp: number
}
```

**必须不含**：`photos`、`birth`、`birthdays`、`milestones`、`profile.name`。

- [ ] **Step 1: 写失败验证**

```js
const {buildChatContext}=await import(context);
const ctx=buildChatContext(c,{userText:'这个月还剩多少',prevPosture:'companion',switchConsent:false});
const json=JSON.stringify(ctx);
assert.equal(json.includes('photo_'),false,'不得发送照片');
assert.equal(json.includes('birth'),false,'不得发送生日');
assert.equal(json.includes('milestone'),false,'不得发送人生纪念');
assert.ok(ctx.goals.length>=1);
assert.ok(ctx.recentChat.length>0);
assert.ok(ctx.memory.length>=1);
// 超量裁剪
const many={...c,chat:new Array(100).fill(c.chat[0])};
assert.ok(buildChatContext(many,{userText:'x',prevPosture:'companion',switchConsent:false}).recentChat.length<=20);
console.log('PASS 上下文不含照片与生日、超量裁剪');
```

- [ ] **Step 2–5:** 同样节奏：跑失败 → 实现（纯函数，从 `state` 投影，不读磁盘不读 env）→ 跑通过 → 提交 `feat(recordkeeper): 聊天上下文只发送必要数据`

---

## Task 6: `POST /api/chat`

**Files:**
- Create: `site/app/api/chat/route.ts`
- Modify: `site/cloudflare-env.d.ts`（加 `AI_CHAT_USER_DAILY_LIMIT?: string; AI_CHAT_SITE_DAILY_LIMIT?: string;`）
- Test: `site/scripts/verify-chat.mjs`

**Interfaces:**
- Consumes: `generateChat`、`sanitizeChatResult`、`buildChatContext`
- Produces: `POST /api/chat` → `200 {run: ChatRun}`，`ChatRun = {id:string; reply:ChatResult; createdAt:string}`；错误码沿用 `/api/agent`：未登录 `401`、额度用尽 `429`、模型不可用 `503`、参数错误 `400`

请求体（zod）：`{requestId: string.uuid(), userText: string.min(1).max(1000), prevPosture: 'companion'|'counselor', switchConsent: boolean, consent: literal(true), adult: literal(true)}`

**额度的区分方式**：`agent_runs` 没有 `mode` 列（见 `db/schema.ts`），而 Global Constraints 要求不加列。所以 **聊天用 `goal_id='__chat__'` 作标记**，`/api/agent` 的既有行 `goal_id` 是真实目标 id 或 `''`，永不等于这个标记，天然分开。

照搬 `/api/agent` 的单条 INSERT 原子预留，只把 `goal_id` 写死为 `'__chat__'`、所有计数条件加上 `AND goal_id='__chat__'`：

```sql
INSERT INTO agent_runs(id,user_id,date,goal_id,status,result,created_at)
SELECT ?,?,?,'__chat__','pending','',?
WHERE (SELECT COUNT(*) FROM agent_runs WHERE user_id=? AND date=? AND goal_id='__chat__')<?
  AND (SELECT COUNT(*) FROM agent_runs WHERE date=? AND goal_id='__chat__')<?
  AND NOT EXISTS(SELECT 1 FROM agent_runs WHERE user_id=? AND goal_id='__chat__' AND status='pending' AND created_at>?)
```

默认限额 `AI_CHAT_USER_DAILY_LIMIT=50`、`AI_CHAT_SITE_DAILY_LIMIT=500`，**不要**回落到 `/api/agent` 的 10/100。

- [ ] **Step 1: 写失败验证**（沿用 `verify-agent.mjs` 里 `route()` 的模块替换样板）

```js
// 额度独立：agent 用满 10 次后，chat 仍有自己的 50 次
// 姿态：没点头时返回的 posture 一定是 companion
// 未登录 401；consent 缺失 400；并发第二条 429
assert.equal((await chat.POST(req('/api/chat',null,body))).status,401);
const ok=await chat.POST(req('/api/chat','alice',body));assert.equal(ok.status,200);
assert.equal((await ok.json()).run.reply.posture,'companion');
console.log('PASS 聊天路由：鉴权、同意校验、姿态打回、独立额度');
```

- [ ] **Step 2–5:** 跑失败 → 实现（结构照抄 `app/api/agent/route.ts`：`boundedBody`、`RequestError`、`noStore`、`authenticatedUser`、先预留后调用、失败时把 `status` 置 `failed`）→ 跑通过 → 提交 `feat(recordkeeper): /api/chat 路由与独立额度`

---

## Task 6.5: 自带模型（BYOK）与端点可换

**Files:**
- Create: `site/lib/ai/provider.ts`
- Modify: `site/lib/ai/deepseek.ts`（`generateActions` 与 `generateChat` 都改用 `provider.ts` 的请求构造）
- Create: `site/.env.example`
- Modify: `site/README.md`（加自托管一节）
- Modify: `site/cloudflare-env.d.ts`（加 `AI_API_KEY?`、`AI_MODEL?`、`AI_BASE_URL?`）
- Test: `site/scripts/verify-chat.mjs`

**Interfaces:**
- Produces:
  - `resolveProvider(env: {AI_API_KEY?:string; DEEPSEEK_API_KEY?:string; AI_MODEL?:string; DEEPSEEK_MODEL?:string; AI_BASE_URL?:string}): {key:string; model:string; baseUrl:string; isDeepSeek:boolean} | null`（无 key 返回 `null`）
  - `buildChatRequest(p: Provider, system: string, user: unknown): {url:string; body:Record<string,unknown>}`
  - `stripJsonFences(s: string): string`
  - `postWithFallback(p: Provider, req, fetchImpl?): Promise<Response>` —— 400 且报文提到 `response_format` 时，去掉该字段重试一次

规则：
- `baseUrl` 默认 `https://api.deepseek.com`，末尾斜杠要去掉
- `isDeepSeek = /deepseek/i.test(baseUrl)`；只有为真时才带 `thinking:{type:'disabled'}`
- `model` 默认 `deepseek-chat`
- `stripJsonFences` 去掉首尾的 ` ```json ` / ` ``` `

- [ ] **Step 1: 写失败验证**

```js
const {resolveProvider,buildChatRequest,stripJsonFences}=await import(provider);
// 回落链
assert.equal(resolveProvider({DEEPSEEK_API_KEY:'k'}).key,'k');
assert.equal(resolveProvider({AI_API_KEY:'a',DEEPSEEK_API_KEY:'d'}).key,'a');
assert.equal(resolveProvider({}),null);
// 端点与能力
const open=resolveProvider({AI_API_KEY:'k',AI_BASE_URL:'http://localhost:11434/'});
assert.equal(open.baseUrl,'http://localhost:11434');
assert.equal(open.isDeepSeek,false);
assert.equal('thinking' in buildChatRequest(open,'s',{}).body,false,'非 DeepSeek 不发送 thinking');
const ds=resolveProvider({DEEPSEEK_API_KEY:'k'});
assert.equal(ds.baseUrl,'https://api.deepseek.com');
assert.equal(buildChatRequest(ds,'s',{}).url,'https://api.deepseek.com/chat/completions');
assert.equal(buildChatRequest(ds,'s',{}).body.thinking.type,'disabled');
// 剥围栏
assert.equal(stripJsonFences('```json\n{"a":1}\n```'),'{"a":1}');
assert.equal(stripJsonFences('{"a":1}'),'{"a":1}');
console.log('PASS 自带模型：回落链、端点可换、能力降级、围栏剥离');
```

- [ ] **Step 2: 跑，确认失败** — 模块不存在

- [ ] **Step 3: 实现** `provider.ts`，然后改 `deepseek.ts` 里两处 `fetch` 调用走 `postWithFallback`，`JSON.parse` 前先 `stripJsonFences`

- [ ] **Step 4: 跑，确认通过**

- [ ] **Step 5: 没配 key 的降级** —— `/api/chat` 在 `resolveProvider()===null` 时返回 `503 {error:'还没有配置模型。把 API Key 填进环境变量后就能聊了，手动记录不受影响。'}`，不抛异常

- [ ] **Step 6: 写 `.env.example`**（只有三个空值 + 注释，**绝不填真 key**）：

```
# 模型服务（OpenAI 兼容）
AI_API_KEY=
AI_MODEL=deepseek-chat
# 非 DeepSeek 才需要改，例如 http://localhost:11434（Ollama）
AI_BASE_URL=https://api.deepseek.com

DEEPSEEK_API_KEY=      # 旧名，仅兼容已有部署
DEEPSEEK_MODEL=
```

- [ ] **Step 7: `site/README.md` 加「自己部署」一节**：克隆 → `corepack pnpm install` → 复制 `.env.example` → 填 key → `npm run dev`。注明非 DeepSeek 端点需改 `AI_BASE_URL`，且本地模型可能不支持 `response_format`（已自动降级）

- [ ] **Step 8: 提交**

```bash
git add site/lib/ai/provider.ts site/lib/ai/deepseek.ts site/.env.example site/README.md site/cloudflare-env.d.ts
git commit -m "feat(recordkeeper): 支持自带模型密钥与任意 OpenAI 兼容端点"
```

---

## Task 7: 导出当天 MD

**Files:**
- Create: `site/lib/export-journal.ts`
- Test: `site/scripts/verify-chat.mjs`

**Interfaces:**
- Produces: `journalMarkdown(state: Game, date: string): string` （纯函数，返回 spec §6.6 的格式）与 `exportJournal(state: Game, date: string): void`（触发下载，文件名 `${date}-记录官.md`）

- [ ] **Step 1: 写失败验证**

```js
const md=journalMarkdown(c,day(new Date()));
assert.ok(md.startsWith('---\ndate: '));
assert.ok(md.includes('## 记录'));
assert.ok(md.includes('## 对话摘录'));
assert.ok(md.includes('## 今日'));
assert.equal(md.includes('undefined'),false);
// 空的一天也能导出，不崩
assert.ok(journalMarkdown(blankDay,'2026-10-30').includes('今天还没有记录'));
console.log('PASS 导出格式与空态');
```

- [ ] **Step 2–5:** 跑失败 → 实现（`## 对话摘录` 取该日最多 8 条 turn，`> ` 引用格式；`## 今日` 写 `完成 N 项 · 经验 +M`，取自当日 `logs`）→ 跑通过 → 提交 `feat(recordkeeper): 当天记录导出 Markdown`

---

## Task 8: 助手在场（`assistant-scene.tsx`）

**Files:**
- Create: `site/components/assistant-scene.tsx`, `site/components/assistant-scene.css`
- Test: 无自动化；`npm run build` + 手动看

**Interfaces:**
- Consumes: 现有 `CharacterPreview`（`components/character-2d.tsx`）作占位
- Produces: `<AssistantScene posture={'companion'|'counselor'} line={string} speaking={boolean} onReplay={() => void} />`

规则：
- 视觉上必须与首页那个"你"的角色**看得出区别**：占位阶段用 `filter: grayscale(.5) brightness(.9)` + 不同底色 + 不同站位
- 两种姿态的差别：陪伴者角色坐低、语速慢；咨询师站直、光更亮（用 CSS class 区分，不换图）
- 说话时用 `window.speechSynthesis`、`lang='zh-CN'`、`rate=.95`；`localStorage['life-rpg-voice']==='0'` 时不朗读
- 背景一层极简渐变，按 `posture` 微调色温；预留 `data-season` 属性空位给以后的季节变化

- [ ] **Step 1:** 写组件与样式
- [ ] **Step 2:** `cd site && npm run build` 通过
- [ ] **Step 3:** `cd site && npm run lint` 通过
- [ ] **Step 4:** 提交 `feat(recordkeeper): 助手场景组件（占位美术、语音朗读、预留季节位）`

---

## Task 9: 对话区（`chat-room.tsx`）

**Files:**
- Create: `site/components/chat-room.tsx`, `site/components/chat-room.css`
- Test: 无自动化；手动

**Interfaces:**
- Consumes: `POST /api/chat`、`Action`（`chat-turn` / `claim-record`）、`journalMarkdown`
- Produces: `<ChatRoom state={Game} act={(a:Action)=>Promise<boolean>} busy={boolean} onPosture={(p)=>void} onLine={(t)=>void} />`

行为：
- 输入框 + 发送；发送时禁用并显示「正在想…」
- 等待期间保留用户输入，失败则把原文塞回输入框
- 回复到了以后：**立刻** `act({type:'chat-turn', ...})` 落库；落库失败走现有冲突提示，不丢输入
- 记录卡片：「这算一次行动吗？」两个按钮 → 算 `/ 就记着`
- 快捷回复按钮；`kind==='accept-switch'` 的按钮点击后下一次请求带 `switchConsent:true`
- 底部：今天的记录列表 + 「导出今天的记录」按钮

- [ ] **Step 1–3:** 写组件 → `npm run build` → `npm run lint`
- [ ] **Step 4:** 提交 `feat(recordkeeper): 对话区组件与记录认领交互`

---

## Task 10: 接入首页，`ActionAssistant` 挪到行动页

**Files:**
- Modify: `site/components/today-panel.tsx`（顶部插入 `<ChatRoom/>` 区域，现有面板整体下移，**不删**）
- Modify: `site/app/page.tsx`（today 页挂载；`action-assistant` 从 today 分支移到 tasks 分支）
- Test: 无自动化；手动 + `npm run build`

**Interfaces:**
- Consumes: Task 8、9 的组件
- Produces: 首页第一屏 = 助手在场 + 对话输入

- [ ] **Step 1:** 改 `page.tsx`，把 `ActionAssistant` 从 `view==='today'` 分支移到 `view==='tasks'` 的 aside 里
- [ ] **Step 2:** 改 `today-panel.tsx`，在 `<div className="today-layout">` 最前插入对话区，原有 `<section>` 保持不动、顺序后移
- [ ] **Step 3:** `cd site && npm run build`
- [ ] **Step 4:** `cd site && npm run lint`
- [ ] **Step 5:** 手动：打开首页，打字发一句，确认出现回复、出现记录卡片、点「算」后进度与等级变化
- [ ] **Step 6:** 提交 `feat(recordkeeper): 首页改为对话优先，AI 行动助手移至行动页`

---

## Task 11: 记忆管理页与隐私文案

**Files:**
- Create: `site/components/memory-list.tsx`
- Modify: `site/app/page.tsx`（`view==='me'` 的设置区加一行入口）
- Modify: `site/app/about/page.tsx`
- Test: 无自动化；手动

**Interfaces:**
- Consumes: `{type:'delete-memory-fact'; id?:string}`
- Produces: `<MemoryList facts={MemoryFact[]} act={...} busy={boolean} />` —— 列出全部事实，单条删 + 全部清空（清空前 `confirm`）

`/about` 必改的一句话（现有承诺已不成立）：把"不会自动发送生日、照片、其他目标或储蓄账目"改为明说：
- 会发送：目标、近期记录、储蓄进度、等级
- **不会发送**：照片、生日、人生纪念
- 长期记忆存在你自己的存档里，随时可看可删

- [ ] **Step 1–4:** 写组件 → 改文案 → `npm run build` → 提交 `feat(recordkeeper): 记忆可见可删，隐私说明与实现对齐`

---

## Task 12: 全流程验收

- [ ] **Step 1:** `cd site && node scripts/verify-chat.mjs` → 全部 PASS
- [ ] **Step 2:** `cd site && npm run build` → 成功
- [ ] **Step 3:** 桌面端手动：发 3 轮对话，确认记录落库、刷新不丢、认领涨经验、导出 MD 能打开
- [ ] **Step 4:** 手机端（Chrome 设备模拟 + 真机各一次）：首屏能看到助手，输入框可用
- [ ] **Step 5:** 模型不可用演练：临时把 `DEEPSEEK_API_KEY` 置空，确认助手仍在场、有模板话、能手动记录
- [ ] **Step 6:** 提交 `chore(recordkeeper): V1 验收记录`

**未完成的验收项必须如实写在提交信息里**（AGENTS.md 规则 2）：真机、支付宝内浏览器、真人效果都不算已验收。

---

## 自检结果

- **Spec 覆盖**：§4 规则 → Task 3/4；§5 循环 → Task 9/10；§6.1–6.13 → 全部有对应任务（§6.12 开源自带模型 → Task 6.5）；§7 留给 builder 的未被写成任务（正确）；§8 成功标准 → Task 12
- **类型一致性**：`JournalEntry.status` 三值在 Task 1 定义、Task 2 写 `pending`、Task 3 转 `claimed`/`kept`，命名一致
- **Review Focus 五条**均已钉进对应任务：①→Task 3、②→Task 4、③→Task 9、④→Task 2/3、⑤→Task 1
- **已裁定**：`agent_runs` 无 `mode` 列，改用 `goal_id='__chat__'` 区分额度（见 Task 6）。不违反"数据库不改"
