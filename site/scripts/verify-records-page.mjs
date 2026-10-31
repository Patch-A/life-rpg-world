// 记录页：把首页说过的话变成看得见的一段人生。
// 这里锁住三件容易在后续改动里被悄悄破坏的事：
//   1. 记录不能只显示「今天」——过了零点就整批消失，等于没记录
//   2. 收下记录后必须能从列表里看到状态变了（不然人会重复点）
//   3. 首页手机布局那套约束不能被这次改动带回来
process.on('uncaughtException',e=>{console.error(String(e.stack||e).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'[module]'));process.exit(1);});
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const source=p=>readFileSync(new URL(p,root),'utf8');
const page=source('app/page.tsx');
const recordsPage=source('components/records-page.tsx');
const recordsCss=source('components/records-page.css');

// ── 1. 导航与路由 ──
assert.ok(/id:'records',label:'记录'/.test(page),'底部导航必须有「记录」页');
assert.ok(/pages=\[[^\]]*'records'/.test(page),'记录页必须进 pages 白名单，否则刷新后 hash 不认、会跳回今天');
assert.ok(/view==='records'&&<RecordsPage/.test(page),'记录页必须有渲染分支');
// 目标并进世界页之后，导航里不该再单独留一个「目标」——五个 tab 在 366px 上每格只有 73px。
assert.ok(!/id:'tasks',label:'目标'/.test(page),'「目标」已并入世界页，导航里不能再有第五个 tab');
// 但目标页本身必须还能走：世界页的「全部主线」「查看今日行动」靠 go('tasks')。
assert.ok(/view==='tasks'&&/.test(page),'目标页必须保留，世界页的入口指向它');

// ── 2. 记录页不能只显示今天 ──
// 这条是这次要修的核心 bug：chat-room 里 todayRecords 只筛 e.date===today，
// 过了零点昨天说的话就整批消失。记录页必须读全量 journal。
assert.ok(/state\.journal/.test(recordsPage),'记录页必须读全量 journal，不能只读今天');
assert.ok(!/filter\([^)]*date\s*===\s*today\s*\)\s*;?\s*$/m.test(recordsPage.split('const entries')[1]?.slice(0,200)??''),
 '记录页的条目来源不能按「今天」过滤');
// 必须按天分组，否则 14 条记录会糊成一片，看不出哪天说了什么。
assert.ok(/groupByDay/.test(recordsPage),'记录必须按天分组');
assert.ok(/function dayLabel/.test(recordsPage)&&/今天|昨天/.test(recordsPage),'日期要能读成「今天/昨天」，而不是只有 ISO 日期');

// ── 3. 收下要能被看见 ──
// 状态变了必须反映在界面上；没这行，用户点完看不出反应，会重复点。
assert.ok(/STATUS_LABEL/.test(recordsPage)&&/已转行动/.test(recordsPage),'记录卡必须显示状态，收下后要能看到「已转行动」');
assert.ok(/type:'claim-record'/.test(recordsPage),'记录页必须能收下记录（转化成真实行动）');
// 经验上限：同领域每天只有第一条拿得到 30 EXP，按钮上的数字必须跟着刷新，
// 不能写死 +30——写死就是在骗人点。
assert.ok(/availableXP/.test(recordsPage),'收下按钮的经验数必须用 availableXP 实时算');
// 更死的一条：按钮文字必须真的插值了算出来的 left，而不是只写个「+30」。
// 同领域每天只有第一条记录拿得到 30 EXP（见 recalculate 的 cap=l.date+':'+l.domain），
// 后面的都是 0；写死 +30 就是在骗人点。
assert.ok(/\$\{left\} EXP|left>0\?/.test(recordsPage),'收下按钮必须把算出来的经验数插进文案，不能写死 +30');
assert.ok(!/\+\s*30\s*EXP[^`]*`/.test(recordsPage),'收下按钮不许出现写死的 +30 EXP');

// ── 4. 首页手机布局的约束不能被这次改动带回来 ──
const todayCss=source('components/today-panel.css');
assert.ok(/var\(--vvh,100vh\)/.test(todayCss),'手机首页高度必须走 --vvh 兜底，不能退回 dvh（旧内核不认）');
assert.ok(!/100dvh/.test(todayCss),'不许再出现 dvh：荣耀浏览器是 Chrome 97，整条声明会被丢弃');
assert.ok(/\.chat-room__stream\{flex:1;min-height:0;max-height:none\}/.test(todayCss),'手机首页对话流必须撑满剩余高度');

// ── 5. 记录页自己的手机断点 ──
assert.ok(/@media\(max-width:600px\)/.test(recordsCss),'记录页必须有手机断点');
const touch=recordsCss.match(/\.records-entry__claim\{min-height:(\d+)px\}/);
assert.ok(touch&&Number(touch[1])>=36,`收下按钮的触碰高度至少 36px，实际 ${touch?touch[1]+'px':'没写'}`);

console.log('PASS 记录页的导航、全量数据、状态反馈与手机约束成立');
