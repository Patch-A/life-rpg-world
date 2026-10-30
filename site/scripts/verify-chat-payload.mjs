// 记录官落库前的两道防线：
//   1. chat-turn 的请求体不能超过 /api/game 的 10KB 上限（超了就会永远重试同一份 payload）
//   2. journal 到 500 条删最旧时，必须在存档里留下「已经裁过」的标记，界面才有话可说
process.on('uncaughtException',e=>{console.error(String(e.stack||e).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'[module]'));process.exit(1);});
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const source=p=>readFileSync(new URL(p,root),'utf8');
const url=code=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const bytes=v=>new TextEncoder().encode(JSON.stringify(v)).length;
const {fitChatTurn}=await import(url(source('lib/chat-payload.ts')));

const zh=n=>'记'.repeat(n);
// 契约允许的最大合法输出：reply 2000 字、records 3 条（summary 200/正文 400/20 个 tag）、记忆 5 条。
// 现实里模型会吐到这个量级附近：900 字倾诉 + 1700 字回复 + 3 条记录 ≈ 11.6KB，已经越线。
const worst={type:'chat-turn',clientId:'0'.repeat(36),userText:zh(1000),reply:zh(2000),posture:'companion',askSwitch:false,
 records:Array.from({length:3},()=>({summary:zh(200),text:zh(400),domain:'mind',tags:Array.from({length:20},()=>zh(20))})),
 memoryCandidates:Array.from({length:5},()=>({text:zh(200),kind:'fact'}))};

assert.ok(bytes({revision:0,action:worst})>10000,'前置：契约允许的最大输出必须真的超过 10KB，否则这组用例测不到任何东西');

const fitted=fitChatTurn(worst);
assert.ok(fitted,'最坏情况也必须压进上限，而不是把用户的话丢掉');
const wire=bytes({revision:999999999,action:fitted});
assert.ok(wire<=10000,`压完之后必须 <= 10000 字节，实际 ${wire}`);

// 压的顺序要保住用户真正在意的部分：原话和回复优先，tag 与记忆先让路。
assert.equal(fitted.userText,worst.userText,'用户的原话不该被截：reducer 本来留 1000 字，压掉就是吞掉用户说的话');
assert.ok(fitted.reply.length>=400,`回复至少要留下开头，实际只剩 ${fitted.reply.length} 字`);
assert.ok(worst.reply.startsWith(fitted.reply),'回复只能切尾，不能改动内容');
assert.ok(fitted.records.length<=worst.records.length,'只能减少记录，不能凭空多出来');
assert.ok(fitted.memoryCandidates.length<=worst.memoryCandidates.length,'只能减少记忆，不能凭空多出来');

// 正常大小的对话必须原样通过，不能因为加了这一层就偷偷改掉用户的记录。
const normal={...worst,userText:zh(40),reply:zh(120),records:[{summary:zh(20),text:zh(30),domain:'mind',tags:['工作']}],memoryCandidates:[{text:zh(15),kind:'fact'}]};
assert.deepEqual(fitChatTurn(normal),normal,'没超上限时必须原样返回，一个字段都不能动');

// 连「一句话 + 一句回复」都放不下时要明确失败，让调用方去提示用户，而不是写一条静默丢内容的记录。
const impossible={...worst,userText:zh(1000),reply:zh(2000),records:[],memoryCandidates:[]};
assert.equal(fitChatTurn(impossible,{limit:200}),null,'压到还是超限时必须返回 null，不能返回一份仍然会被 413 的 payload');
// 只剩用户原话（输入框 maxLength=1000）时也必须放得下，这是「不截用户的话」的前提。
const onlyWords={...worst,userText:zh(1000),reply:zh(400),records:[],memoryCandidates:[]};
const kept=fitChatTurn(onlyWords);
assert.ok(kept,'只剩原话时也必须能发出去');
assert.equal(kept.userText,onlyWords.userText,'输入框允许 1000 字，这条路径上不能有任何一步动用户的原话');

// 压缩要保条数、先砍装饰：3 条记录带着一堆 tag 的超标 payload，压完仍应留 3 条，
// 只是 tag 变少。直接按条数砍会把两条真实记录整条丢掉，而用户说的话本来更值钱。
const tagHeavy={...worst,userText:zh(500),reply:zh(900),records:Array.from({length:3},()=>({summary:zh(80),text:zh(120),domain:'mind',tags:Array.from({length:20},()=>zh(20))})),memoryCandidates:[{text:zh(20),kind:'fact'}]};
assert.ok(bytes({revision:0,action:tagHeavy})>10000,'前置：这条 payload 必须真的超标');
const tagFit=fitChatTurn(tagHeavy);
assert.ok(tagFit,'tagHeavy 必须能压进上限');
assert.equal(tagFit.records.length,3,'砍 tag 就能放下时不该丢整条记录');
assert.ok(tagFit.records.every(r=>r.tags.length<=4),'tag 是装饰，应该最先让路');
assert.ok(tagFit.records.every(r=>r.text&&r.summary),'记录的正文和摘要不能一起被砍空');
assert.ok(bytes({revision:999999999,action:tagFit})<=10000,'tagHeavy 压完必须 <= 10000 字节');

// 长期记忆**不**套「必须是原话子串」的校验——这是个刻意的取舍，钉住它，
// 免得以后有人「顺手补上」把整个记忆功能静默废掉（记忆本来就是提炼过的说法）。
const contract=source('lib/ai/chat-contract.ts');

// 压缩链上不能出现 userText：它最多 1000 字（3000 字节），永远放得下，
// 加一步截它就是给「以后有人放宽输入框」埋一个静默吞字的坑。
const shrinkChain=source('lib/chat-payload.ts').split('const shrink=[')[1].split('];')[0];
assert.ok(!/userText/.test(shrinkChain),'压缩链里不能有 userText：用户的话不是可丢弃的装饰');
const {sanitizeChatResult}=await import(url(contract.replace("from 'zod'",`from '${import.meta.resolve('zod')}'`)));
// 提炼过的记忆（原话「我最近在读一本讲并发的书」→「在读一本讲并发的书」）必须留下；
// 子串校验会把它一起丢掉，那等于记忆功能整体失效。
const out=sanitizeChatResult({
 reply:'嗯。',posture:'companion',askSwitch:false,records:[],quickReplies:[],
 memoryCandidates:[{text:'在读一本讲并发的书',kind:'situation'}],
},'我最近在读一本讲并发的书','companion',false);
assert.deepEqual(out.memoryCandidates.map(m=>m.text),['在读一本讲并发的书'],'提炼过的记忆不能被过滤：它不要求是原话子串');

// ---- 刷新后姿态要接上存档 ----
// 服务端每轮从 state.chat 推算姿态；客户端初值写死 'companion' 时，刷新后会出现
// 「气泡念咨询师的台词、人物用陪伴者的站位和语速」。这条推导是唯一的同步点。
const page=source('app/page.tsx');
const derive=page.match(/const shownPosture[^;]+;/)?.[0]||'';
assert.ok(derive,'page.tsx 必须有 shownPosture 推导，否则刷新后姿态与台词会错位');
assert.ok(/savedPosture/.test(derive)&&/lastAssistant\?\.posture/.test(page),'shownPosture 必须取自存档里最后一个 assistant 轮的 posture');
assert.ok(/^const shownPosture[^=]+=line\?posture:/.test(derive),'本会话已经说过话时要以 onPosture 为准，不能被存档覆盖回去');
assert.ok(/posture=\{shownPosture\}/.test(page),'AssistantScene 必须收到推导后的姿态，否则推导了也没用');

// ---- journal 500 条上限：删最旧可以，静默不行 ----
const appearance=url(source('lib/appearance.ts')),birthday=url(source('lib/birthday.ts')),ids=url(source('lib/ids.ts'));
const game=url(source('lib/game.ts').replace("from './appearance'",`from '${appearance}'`).replace("from './birthday'",`from '${birthday}'`).replace("from './ids'",`from '${ids}'`));
const {reduceGame,blank,normalizeGame}=await import(game);
const at='2026-10-30T12:00:00.000Z';
let s=blank();s.profile={name:'P',focus:'mind',createdAt:at};
s.journal=Array.from({length:500},(_,i)=>({id:'j'+i,date:'2026-10-01',at:'2026-10-01T00:00:00.000Z',text:'旧',summary:'旧'+i,tags:[],posture:'companion',runId:'r'+i,status:'kept'}));
assert.equal(s.settings.journalTrimmed,false,'前置：新存档不该带裁切标记');
s=reduceGame(s,{type:'chat-turn',clientId:'c1',userText:'今天读完一章',reply:'记下了。',posture:'companion',askSwitch:false,records:[{summary:'读完一章',text:'今天读完一章'}],memoryCandidates:[]},new Date(at));
assert.equal(s.journal.length,500,'超过 500 条时仍应保持在 500');
assert.equal(s.journal[s.journal.length-1].summary,'读完一章','新记录要留下');
assert.equal(s.journal[0].summary,'旧1','删的是最旧那条');
assert.equal(s.settings.journalTrimmed,true,'删掉最旧记录时必须留下标记：否则用户永远不知道有记录消失过');
// 旧存档里没有这个字段，读出来必须是 false 而不是 undefined，否则界面会显示假的提示。
assert.equal(normalizeGame({...blank(),settings:{celebrations:true,memoryPromptSeen:false}}).settings.journalTrimmed,false,'旧存档必须兜底成 false');
assert.ok(/journalTrimmed/.test(source('components/life-timeline.tsx')),'人生时间线必须把这个标记显示给用户，否则等于没记');
// 「删了」还不够：spec 的原话是「已归档至导出」，提示必须指向能取回的地方。
assert.ok(/导出存档JSON|导出人生纪念/.test(source('components/life-timeline.tsx')),'裁切提示必须告诉用户去掉哪儿把旧记录取回来');

// 光有 fitChatTurn 不够：发送路径必须真的调用它，否则这道防线只是个没人用的函数。
const room=source('components/chat-room.tsx');
assert.ok(/import\s*\{[^}]*fitChatTurn[^}]*\}\s*from\s*'@\/lib\/chat-payload'/.test(room),'chat-room 必须从 lib/chat-payload 取 fitChatTurn');
assert.ok(/fitChatTurn\(action\)/.test(room),'chat-turn 必须经过 fitChatTurn 压过再发，否则长回复会永远 413');
assert.ok(/if\(!fitted\)/.test(room),'压不进上限时必须有明确提示，而不是把用户的话静默丢掉');

console.log('PASS 对话请求体压进 10KB 上限；journal 超 500 条时留下裁切标记');
