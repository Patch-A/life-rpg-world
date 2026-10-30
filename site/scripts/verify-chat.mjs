// 记录官：只验证存档结构，不涉及 API 路由（后续任务再补）。
process.on('uncaughtException',e=>{console.error(String(e.stack||e).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'[module]'));process.exit(1);});
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const url=code=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const appearance=url(source('lib/appearance.ts')),birthday=url(source('lib/birthday.ts'));
const game=url(source('lib/game.ts').replace("from './appearance'",`from '${appearance}'`).replace("from './birthday'",`from '${birthday}'`));
// 旧存档兼容 + 新字段默认值
const {normalizeGame,blank,reduceGame,xp}=await import(game);
const legacy={profile:{name:'测试',focus:'mind',createdAt:new Date().toISOString()},goals:[],tasks:[],logs:[],events:[],milestones:[],claims:[],equipped:'explorer',birthday:null,birthdays:[],birthdayQueue:[],reviews:[],agentAccepts:[],settings:{celebrations:true,memoryPromptSeen:false}};
const n=normalizeGame(legacy);
assert.deepEqual(n.journal,[]);assert.deepEqual(n.chat,[]);assert.deepEqual(n.memory,[]);assert.deepEqual(n.monsters,[]);
assert.equal(n.logs.length,0);assert.equal(n.profile.name,'测试');
assert.deepEqual(blank().journal,[]);
console.log('PASS 旧存档补齐新字段且不清空既有数据');
// 聊天写入、幂等、记忆合并、不动经验值
const start=reduceGame(blank(),{type:'onboard',name:'测试',focus:'mind',gender:'male'},new Date());
const turn={type:'chat-turn',clientId:crypto.randomUUID(),userText:'今天看完了第三章，卡在并发',reply:'卡住的地方具体是哪一步？',posture:'companion',records:[{summary:'看完第三章',text:'今天看完了第三章',domain:'mind',tags:['学习']}],memoryCandidates:[{text:'在读一本讲并发的书',kind:'situation'}]};
const after=reduceGame(start,turn,new Date());
assert.equal(after.chat.length,2);
assert.equal(after.chat[0].role,'user');assert.equal(after.chat[1].role,'assistant');
assert.equal(after.journal.length,1);assert.equal(after.journal[0].status,'pending');assert.equal(after.journal[0].runId,turn.clientId);
assert.equal(after.journal[0].text,'今天看完了第三章');
assert.equal(after.memory.length,1);assert.equal(after.memory[0].weight,1);
assert.equal(xp(after),xp(start),'聊天不应改变经验值');
// 幂等：同一个 clientId 重复提交不重复写
assert.equal(reduceGame(after,turn,new Date()).chat.length,2);
// 记忆合并：同样的话再说一次，weight 变 2 而不是新增一条
const again={...turn,clientId:crypto.randomUUID(),memoryCandidates:[{text:'在读一本讲并发的书',kind:'situation'}]};
const merged=reduceGame(after,again,new Date());
assert.equal(merged.memory.length,1);assert.equal(merged.memory[0].weight,2);
console.log('PASS 聊天写入、幂等、记忆合并、不动经验值');
// 模型字段异常（未知 domain、空 summary、空正文、空记忆）不阻断对话写入
const bad={type:'chat-turn',clientId:crypto.randomUUID(),userText:'今天试了新工具',reply:'x'.repeat(2500),posture:'companion',records:[{summary:'记录一',text:'今天试了新工具',domain:'study',tags:[]},{summary:'',text:'摘要为空会被丢掉',domain:'mind',tags:[]},{summary:'正文为空会被丢掉',text:'',domain:'mind',tags:[]},{summary:'记录二',text:'有效的第二条',domain:'mind',tags:[]}],memoryCandidates:[{text:'',kind:'fact'},{text:'喜欢用命令行',kind:'preference'}]};
const sanitized=reduceGame(start,bad,new Date());
assert.equal(sanitized.chat.length,2);assert.equal(sanitized.chat[1].text.length,2000);
assert.equal(sanitized.journal.length,2);
assert.equal(sanitized.journal[0].domain,undefined);assert.equal(sanitized.journal[0].summary,'记录一');
assert.equal(sanitized.journal[1].summary,'记录二');
assert.equal(sanitized.memory.length,1);assert.equal(sanitized.memory[0].text,'喜欢用命令行');
console.log('PASS 模型字段异常不阻断对话写入');
// 认领记录为行动、当日领域经验上限、删除联动撤销、记忆可删
const jid=after.journal[0].id;
const c=reduceGame(after,{type:'claim-record',id:jid},new Date());
assert.equal(c.journal[0].status,'claimed');assert.ok(c.journal[0].logId);
assert.equal(c.tasks.length,after.tasks.length+1);assert.equal(c.tasks.at(-1).unit,'次');assert.equal(c.tasks.at(-1).repeat,false);assert.equal(c.tasks.at(-1).title,'看完第三章');
assert.equal(c.logs.length,after.logs.length+1);assert.equal(c.logs.at(-1).value,1);assert.equal(c.logs.at(-1).id,c.journal[0].logId);assert.equal(c.logs.at(-1).note,'今天看完了第三章');
assert.equal(xp(c),xp(after)+30,'认领后应得一次领域经验');
// 当日该领域经验已满时，认领成功但 +0，且不报错
const second={...turn,clientId:crypto.randomUUID(),records:[{summary:'又学了一点',text:'又学了一点',domain:'mind',tags:[]}],memoryCandidates:[]};
let d=reduceGame(c,second,new Date());
d=reduceGame(d,{type:'claim-record',id:d.journal[1].id},new Date());
assert.equal(d.journal[1].status,'claimed');assert.equal(xp(d),xp(c),'同日同领域不重复给经验');
// 删除已认领的记录，对应 Log 一并撤销
const claim2LogId=d.journal[1].logId;
const e=reduceGame(d,{type:'delete-journal',id:d.journal[1].id},new Date());
assert.equal(e.journal.length,d.journal.length-1);assert.equal(e.logs.find(l=>l.id===claim2LogId).undone,true);
// 删除唯一一条已认领记录，经验随之归零（不留经验），自动生成的行动归档而不是留成孤儿
const solo=reduceGame(c,{type:'delete-journal',id:jid},new Date());
assert.equal(solo.logs.find(l=>l.id===c.journal[0].logId).undone,true);assert.equal(xp(solo),0,'删除记录应撤销对应经验');
assert.equal(solo.tasks.find(t=>t.id===c.tasks.at(-1).id).archived,true,'行动没有未撤销记录时应归档');
assert.equal(solo.tasks.length,c.tasks.length,'归档不物理删除行动');
// 删除待认领的记录不动 Log
const pend=reduceGame(after,{type:'delete-journal',id:after.journal[0].id},new Date());
assert.equal(pend.journal.length,0);assert.equal(pend.logs.length,after.logs.length);assert.equal(xp(pend),xp(after));
// 重复认领报错
assert.throws(()=>reduceGame(c,{type:'claim-record',id:jid},new Date()),/已经认领/);
// 无方向的记录认领时归入认知
const fallback=reduceGame(sanitized,{type:'claim-record',id:sanitized.journal[0].id},new Date());
assert.equal(fallback.tasks.at(-1).domain,'mind');assert.equal(fallback.tasks.at(-1).originRunId,sanitized.journal[0].runId);
// 认领同样受行动数量与记录容量上限约束，避免绕开手动创建的守卫
const fullTasks={...after,tasks:Array.from({length:100},(_,i)=>({id:'t'+i,title:'观察',domain:'mind',target:1,unit:'次',repeat:false,goalId:'',archived:false}))};
assert.throws(()=>reduceGame(fullTasks,{type:'claim-record',id:after.journal[0].id},new Date()),/请先归档/);
const fullLogs={...after,logs:Array.from({length:10000},(_,i)=>({id:'l'+i,taskId:'',title:'观察',domain:'mind',value:1,unit:'次',goalId:'',xp:0,date:'2026-01-01',at:'2026-01-01T00:00:00.000Z',undone:true}))};
assert.throws(()=>reduceGame(fullLogs,{type:'claim-record',id:after.journal[0].id},new Date()),/容量上限/);
// 认领生成的行动标题与手动行动一致，截断到 80 字
const longTurn={...turn,clientId:crypto.randomUUID(),records:[{summary:'长'.repeat(100),text:'正文',domain:'health',tags:[]}],memoryCandidates:[]};
const longState=reduceGame(start,longTurn,new Date());
const longClaim=reduceGame(longState,{type:'claim-record',id:longState.journal[0].id},new Date());
assert.equal(longClaim.tasks.at(-1).title.length,80);assert.equal(longClaim.logs.at(-1).title.length,80);
// 记忆删除与清空（delete-memory-fact；生日/纪念的 delete-memory 由 verify-birthday 覆盖）
assert.equal(reduceGame(merged,{type:'delete-memory-fact',id:merged.memory[0].id},new Date()).memory.length,0);
assert.equal(reduceGame(merged,{type:'delete-memory-fact'},new Date()).memory.length,0);
assert.equal(reduceGame(merged,{type:'delete-memory-fact',id:'不存在'},new Date()).memory.length,1);
console.log('PASS 认领成行动、经验上限、删除联动、记忆可删');
// 聊天契约：防编造、姿态升级需同意、降级放行、契约限流
const agentContract=url(source('lib/agent-contract.ts').replace("from 'zod'",`from '${import.meta.resolve('zod')}'`));
const chatContract=url(source('lib/ai/chat-contract.ts').replaceAll("from '@/lib/game'",`from '${game}'`).replace("from 'zod'",`from '${import.meta.resolve('zod')}'`));
const provider=url(source('lib/ai/deepseek.ts').replace("from '../agent-contract'",`from '${agentContract}'`).replace("from './chat-contract'",`from '${chatContract}'`));
const {chatResultSchema,sanitizeChatResult}=await import(chatContract);
const {generateChat,CHAT_TIMEOUT_MS}=await import(provider);
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
// 4b 上一轮已是咨询师、模型也回咨询师 → 保持咨询师，不因缺同意被打回
assert.equal(sanitizeChatResult(raw,userText,'counselor',false).posture,'counselor');
assert.equal(sanitizeChatResult(raw,userText,'counselor',false).askSwitch,false);
// 4c 空正文记录必须丢弃（text.includes('') 恒真，不能靠 schema 的 min(1) 兜底）
assert.equal(sanitizeChatResult({...raw,posture:'companion',records:[{summary:'空正文',text:'',domain:'mind',tags:[]}]},userText,'companion',false).records.length,0);
assert.equal(sanitizeChatResult({...raw,posture:'companion',records:[{summary:'空白正文',text:'   ',domain:'mind',tags:[]}]},userText,'companion',false).records.length,0);
// 5 超量不报错：4 条合法记录进 sanitize，产出恰好前 3 条
const four=[{summary:'一',text:'今天看完了第三章',domain:'mind',tags:[]},{summary:'二',text:'卡在并发',domain:'mind',tags:[]},{summary:'三',text:'今天',domain:'health',tags:[]},{summary:'四',text:'并发',domain:'career',tags:[]}];
const fourOut=sanitizeChatResult(chatResultSchema.parse({...raw,records:four}),userText,'companion',true);
assert.equal(fourOut.records.length,3);assert.deepEqual(fourOut.records.map(r=>r.summary),['一','二','三']);
// 5b 4 条里混 2 条脏的：脏的丢弃，剩 2 条正常返回，不抛
const mixed=sanitizeChatResult(chatResultSchema.parse({...raw,records:[{summary:'一',text:'今天看完了第三章',domain:'mind',tags:[]},{summary:'编的',text:'我昨天还学了英语',domain:'mind',tags:[]},{summary:'空',text:'',domain:'mind',tags:[]},{summary:'二',text:'卡在并发',domain:'study',tags:null}]}),userText,'companion',true);
assert.equal(mixed.records.length,2);assert.deepEqual(mixed.records.map(r=>r.summary),['一','二']);assert.equal(mixed.records[1].domain,undefined);
// 5c quickReplies 超 3 条：schema 不抛，sanitize 清后切到 3
const many=chatResultSchema.parse({...raw,quickReplies:Array.from({length:5},(_,i)=>({label:'选项'+i,kind:i?'say':'accept-switch'}))});
assert.equal(many.quickReplies.length,5);
const manyOut=sanitizeChatResult(many,userText,'companion',true);
assert.equal(manyOut.quickReplies.length,3);assert.deepEqual(manyOut.quickReplies.map(q=>q.label),['选项0','选项1','选项2']);
// 5d quickReplies 里混脏元素（空 label / 非对象）也只丢单条
const qDirty=sanitizeChatResult(chatResultSchema.parse({...raw,quickReplies:[{label:'',kind:'say'},'x',{label:'好',kind:'other'}]}),userText,'companion',true);
assert.equal(qDirty.quickReplies.length,1);assert.equal(qDirty.quickReplies[0].kind,'say');
console.log('PASS 防编造、姿态升级需同意、降级放行、超量清洗后截断');
// 去重后仍超量时兜底截断到 3；不修改入参
const dup={...raw,records:[{summary:'a',text:'今天',domain:'mind',tags:[]},{summary:'a',text:'今天',domain:'mind',tags:[]},{summary:'b',text:'看完',domain:'mind',tags:[]},{summary:'c',text:'第三章',domain:'mind',tags:[]},{summary:'d',text:'并发',domain:'mind',tags:[]}]};
const cut=sanitizeChatResult(dup,userText,'companion',true);
assert.equal(cut.records.length,3);assert.deepEqual(cut.records.map(r=>r.text),['今天','看完','第三章']);
assert.equal(dup.records.length,5);assert.equal(raw.records.length,2);
console.log('PASS 记录去重与超量兜底、入参不被改写');
// 元素级宽松：单条脏数据只修正或丢弃，不把整轮对话打成 503；条数上限交给 sanitize 截断
const dirty={reply:'收到',posture:'companion',askSwitch:false,records:[
  {summary:'长正文',text:'长'.repeat(401),domain:'study',tags:null},
  {summary:'',text:'没有摘要',domain:'mind',tags:[]},
  'not-an-object'],memoryCandidates:[...Array.from({length:7},(_,i)=>({text:'记忆'+i,kind:'mood'})),{text:'认识但不认识的类型被丢',kind:'emotion'}],quickReplies:null};
// kind 非法的记忆候选一律丢弃（不静默标成 fact 污染长期记忆）
const parsed=chatResultSchema.parse(dirty);
assert.equal(parsed.records.length,1);
assert.equal(parsed.records[0].text.length,400);
assert.equal(parsed.records[0].domain,undefined);
assert.deepEqual(parsed.records[0].tags,[]);
assert.equal(parsed.memoryCandidates.length,0);
assert.deepEqual(parsed.memoryCandidates,[]);
const mixedMem=chatResultSchema.parse({...raw,memoryCandidates:[{text:'喜欢清晨写作',kind:'emotion'},{text:'在写一本书',kind:'situation'},{text:'另一个',kind:'weird'}]});
assert.deepEqual(mixedMem.memoryCandidates,[{text:'在写一本书',kind:'situation'}]);
assert.deepEqual(parsed.quickReplies,[]);
assert.equal(sanitizeChatResult(chatResultSchema.parse({...raw,memoryCandidates:Array.from({length:7},(_,i)=>({text:'记忆'+i,kind:'fact'}))}),'别的话','companion',false).memoryCandidates.length,5);
assert.deepEqual(chatResultSchema.parse({...raw,records:null,memoryCandidates:null,quickReplies:null}).records,[]);
// 数组字段若被写成单个对象，保留而不是静默清空
const singleObj=chatResultSchema.parse({...raw,records:{summary:'单条',text:'卡在并发',tags:[]},memoryCandidates:{text:'在写一本书',kind:'situation'},quickReplies:{label:'继续说',kind:'say'}});
assert.equal(singleObj.records.length,1);assert.equal(singleObj.records[0].summary,'单条');
assert.equal(singleObj.memoryCandidates.length,1);assert.equal(singleObj.quickReplies.length,1);
assert.equal(chatResultSchema.parse({...raw,records:new Array(4).fill(raw.records[0])}).records.length,4,'schema 不因条数超量整轮失败');
console.log('PASS 脏元素就地修正、条数超量不失败、数组 null 补空、单对象不清空');
// 顶层字段宽容化：单处格式异常不整轮丢弃
const strBool=chatResultSchema.parse({...raw,askSwitch:'false'});
assert.equal(strBool.askSwitch,false);assert.equal(typeof strBool.askSwitch,'boolean');
assert.equal(chatResultSchema.parse({...raw,askSwitch:'true'}).askSwitch,true);
assert.equal(chatResultSchema.parse({...raw,askSwitch:'maybe'}).askSwitch,false);
assert.equal(chatResultSchema.parse({...raw,askSwitch:undefined}).askSwitch,false);
assert.equal(chatResultSchema.parse({...raw,posture:'therapist'}).posture,'companion');
assert.equal(chatResultSchema.parse({...raw,posture:undefined}).posture,'companion');
assert.equal(chatResultSchema.parse({...raw,posture:'counselor'}).posture,'counselor');
const longReply=chatResultSchema.parse({...raw,reply:'长'.repeat(2500)});
assert.equal(longReply.reply.length,2000);
// 空/非字符串 reply 仍整轮失败：助手不说话这一轮没有意义
assert.throws(()=>chatResultSchema.parse({...raw,reply:''}));
assert.throws(()=>chatResultSchema.parse({...raw,reply:42}));
console.log('PASS 顶层 posture/askSwitch/reply 宽容化，仅空 reply 仍失败');
// generateChat：同一 endpoint 与请求参数、长度耗尽/非 JSON/额度耗尽的降级
const oldFetch=globalThis.fetch;let seen;
globalThis.fetch=async(u,options)=>{seen={u,body:JSON.parse(options.body),signal:options.signal};return Response.json({choices:[{message:{content:JSON.stringify({reply:'先说说卡在哪一步？',posture:'companion',askSwitch:false,records:[],memoryCandidates:[],quickReplies:[]})},finish_reason:'stop'}]});};
try{
 const chat=await generateChat('test-key','test-model',{history:[]});
 assert.equal(seen.u,'https://api.deepseek.com/chat/completions');
 assert.equal(seen.body.stream,false);assert.deepEqual(seen.body.thinking,{type:'disabled'});assert.deepEqual(seen.body.response_format,{type:'json_object'});
 assert.ok(seen.body.max_tokens>=2000,'max_tokens 应与 reply.max(2000) 对齐');
 assert.equal(CHAT_TIMEOUT_MS,45000);assert.ok(seen.signal instanceof AbortSignal);assert.equal(chat.posture,'companion');
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:'{}'},finish_reason:'length'}]});
 await assert.rejects(()=>generateChat('test-key','test-model',{}),/未完整/);
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:'不是JSON'},finish_reason:'stop'}]});
 await assert.rejects(()=>generateChat('test-key','test-model',{}),/不完整/);
 globalThis.fetch=async()=>new Response('{}',{status:429});
 await assert.rejects(()=>generateChat('test-key','test-model',{}),e=>e.status===429);
}finally{globalThis.fetch=oldFetch;}
console.log('PASS 模型调用参数、45秒超时常量、max_tokens对齐与失败降级');
// 上下文投影：隐私字段不进 JSON、超量裁剪、已撤销记录不发送、净额与今日经验口径
const chatContext=url(source('lib/chat-context.ts').replaceAll("from '@/lib/game'",`from '${game}'`));
const {buildChatContext}=await import(chatContext);
const {day:gameDay,progress:gameProgress,level:gameLevel}=await import(game);
const ctxToday=gameDay();
const ctxProfile={...c.profile,name:'隐私名字',birth:{date:'1990-01-01'}};
const ctxGoals=[
 {id:'g-read',title:'读完一本书',domain:'mind',target:300,unit:'分钟',deadline:'',paused:false,createdAt:''},
 {id:'g-save',title:'旅行基金',domain:'wealth',target:5000,unit:'元',deadline:'',paused:false,createdAt:'',initial:1000},
];
// 24 条填充记录日期在 09-01..09-24，用于验证「取最近 20 条后翻转成时间正序」
const ctxFillers=Array.from({length:24},(_,i)=>{const d='2026-09-'+String(i+1).padStart(2,'0');return {id:'f'+i,taskId:'',title:'记录'+i,domain:'career',value:1,unit:'次',goalId:'',xp:0,date:d,at:d+'T00:00:00.000Z',undone:false};});
const ctxLogs=[
 {id:'read-1',taskId:'',title:'读完一章',domain:'mind',value:20,unit:'分钟',goalId:'g-read',xp:30,date:ctxToday,at:'2026-10-30T09:00:00.000Z',undone:false,note:'今天读完一章'},
 {id:'save-in',taskId:'',title:'旅行基金',domain:'wealth',value:1200,unit:'元',goalId:'g-save',xp:30,date:ctxToday,at:'2026-10-30T08:00:00.000Z',undone:false,direction:'deposit',photos:['photo_00000000-0000-0000-0000-000000000001']},
 {id:'save-out',taskId:'',title:'旅行基金',domain:'wealth',value:200,unit:'元',goalId:'g-save',xp:0,date:'2026-10-27',at:'2026-10-27T08:00:00.000Z',undone:false,direction:'withdraw'},
 {id:'undone',taskId:'',title:'不该出现的撤销记录',domain:'mind',value:5,unit:'分钟',goalId:'',xp:30,date:ctxToday,at:'2026-10-30T10:00:00.000Z',undone:true},
 // 同一天（09-25）的上午与晚间两条：日期相同、at 不同，用来证明排序按 at 而非 date；数组里上午在前，若误按 date 排序会被发现
 {id:'same-morning',taskId:'',title:'同日上午',domain:'health',value:1,unit:'次',goalId:'',xp:0,date:'2026-09-25',at:'2026-09-25T06:00:00.000Z',undone:false},
 {id:'same-night',taskId:'',title:'同日晚间',domain:'health',value:1,unit:'次',goalId:'',xp:0,date:'2026-09-25',at:'2026-09-25T22:00:00.000Z',undone:false},
 ...ctxFillers,
];
const ctxMemory=Array.from({length:45},(_,i)=>({id:'m'+i,text:'记忆'+i,kind:['fact','preference','situation'][i%3],firstSeen:'2026-09-01T00:00:00.000Z',lastSeen:'2026-09-01T00:00:00.000Z',weight:1}));
const ctxChat=Array.from({length:100},(_,i)=>({id:'h'+i,date:ctxToday,at:'2026-10-30T00:00:00.000Z',role:i%2?'assistant':'user',text:'第'+i+'条'}));
const ctxState={...c,profile:ctxProfile,goals:ctxGoals,logs:ctxLogs,chat:ctxChat,memory:ctxMemory,
 milestones:[{id:'ms',kind:'custom',title:'纪念不该出现',date:'2020-01-01',note:'',photos:['photo_00000000-0000-0000-0000-000000000002'],at:'',updatedAt:'',archived:false}],
 birthdays:[{id:'bd',year:2000,date:'2000-01-01',label:'生日不该出现',calendar:'solar',adjustment:'',age:26,note:'',wish:'',photos:[],at:'',updatedAt:'',archived:false}],
 birthdayQueue:[{year:2000,date:'2000-01-01',label:'生日队列不该出现',calendar:'solar',adjustment:''}]};
const snapshot=o=>JSON.stringify(o);
const ctxInputBefore=snapshot([ctxState.logs,ctxState.memory,ctxState.chat]);
const ctx=buildChatContext(ctxState,{userText:'这个月还剩多少',prevPosture:'counselor',switchConsent:false});
const ctxJson=JSON.stringify(ctx);
// 隐私边界：整份 JSON 里不能出现照片 id、出生日期、生日、人生纪念或用户姓名
assert.equal(ctxJson.includes('photo_'),false,'不得发送照片');
assert.equal(ctxJson.includes('birth'),false,'不得发送生日');
assert.equal(ctxJson.includes('milestone'),false,'不得发送人生纪念');
assert.equal(ctxJson.includes('隐私名字'),false,'不得发送用户姓名');
assert.equal(ctxJson.includes('不该出现'),false,'撤销记录与纪念/生日内容都不得出现');
assert.equal(snapshot([ctxState.logs,ctxState.memory,ctxState.chat]),ctxInputBefore,'投影不得改写入参');
// 只投影白名单字段，防止后续新增字段顺手带出隐私数据
assert.deepEqual(Object.keys(ctx).sort(),['goals','level','memory','prevPosture','recentChat','recentLogs','savings','todayXp','userText']);
assert.deepEqual(Object.keys(ctx.goals[0]).sort(),['domain','progress','target','title','unit']);
assert.deepEqual(Object.keys(ctx.recentLogs[0]).sort(),['date','domain','title','unit','value']);
assert.deepEqual(Object.keys(ctx.memory[0]).sort(),['kind','text']);
assert.deepEqual(Object.keys(ctx.recentChat[0]).sort(),['role','text']);
assert.equal(ctx.userText,'这个月还剩多少');assert.equal(ctx.prevPosture,'counselor');
// 超量裁剪：40 条 chat、40 条记忆、20 条记录
assert.equal(ctx.recentChat.length,40,'聊天超量裁剪到最近 40 条');
assert.equal(ctx.recentChat[0].text,'第60条');assert.equal(ctx.recentChat.at(-1).text,'第99条');
assert.ok(ctx.recentChat.every(t=>t.role==='user'||t.role==='assistant'));
assert.equal(buildChatContext({...ctxState,chat:ctxChat.slice(-10)},{userText:'x',prevPosture:'companion',switchConsent:false}).recentChat.length,10,'不足 40 条全取');
assert.equal(ctx.memory.length,40);assert.equal(ctx.memory[0].text,'记忆5');assert.equal(ctx.memory.at(-1).text,'记忆44');
// 目标、储蓄净额（含取出与起始存款）、最近记录与今日经验
assert.equal(ctx.goals.length,2);assert.equal(ctx.goals[0].progress,20);assert.equal(ctx.goals[1].progress,2000);
assert.equal(ctx.goals[1].progress,gameProgress(ctxState,ctxGoals[1]),'储蓄净值复用 progress');
assert.deepEqual(ctx.savings,[{title:'旅行基金',net:2000}],'储蓄只含元目标且扣除取出与起始存款');
assert.equal(ctx.recentLogs.length,20,'最近记录最多 20 条');
assert.equal(ctx.recentLogs[0].title,'记录9');assert.equal(ctx.recentLogs.at(-1).title,'读完一章');
assert.ok(ctx.recentLogs.every(l=>l.title!=='不该出现的撤销记录'),'已撤销的记录不发送');
// 排序区分度：半天/晚间同日，必须按 at 升序（返回对象没有 at 字段，只能靠 title 先后断言）
const orderTitles=ctx.recentLogs.map(l=>l.title);
const morningAt=orderTitles.indexOf('同日上午'),nightAt=orderTitles.indexOf('同日晚间');
assert.ok(morningAt>=0&&nightAt>=0,'同日两条都应落在最近 20 条窗口内');
assert.ok(morningAt<nightAt,'同一天内须按 at 升序：上午在晚间之前');
assert.equal(ctx.recentLogs[morningAt].date,'2026-09-25');
assert.equal(ctx.recentLogs[nightAt].date,'2026-09-25');
assert.ok(ctx.recentLogs.every((l,i,a)=>i===0||a[i-1].date<=l.date),'记录按时间正序返回');
assert.equal(ctx.todayXp,60,'今日经验只算当天未撤销记录');
assert.equal(ctx.level,gameLevel(ctxState));
console.log('PASS 上下文隐私白名单、超量裁剪、撤销记录不发送、净额与今日经验口径');
// 时区区分度：把 Date 定格在 UTC 2026-10-30 17:00（上海 10-31 01:00），只有上海当天那条算今日经验
const RealDate=Date;
let fakeNow=new RealDate('2026-10-30T17:00:00.000Z');
class FakeDate extends RealDate{
 constructor(...args){if(args.length===0)super(fakeNow.getTime());else super(...args);}
 static now(){return fakeNow.getTime();}
}
const tzState={...c,goals:[],tasks:[],chat:[],memory:[],logs:[
 {id:'tz-sh',taskId:'',title:'上海今天',domain:'mind',value:1,unit:'次',goalId:'',xp:30,date:'2026-10-31',at:'2026-10-30T16:30:00.000Z',undone:false},
 {id:'tz-utc',taskId:'',title:'UTC今天',domain:'health',value:1,unit:'次',goalId:'',xp:10,date:'2026-10-30',at:'2026-10-30T04:00:00.000Z',undone:false},
 {id:'tz-old',taskId:'',title:'更早的',domain:'career',value:1,unit:'次',goalId:'',xp:20,date:'2026-10-29',at:'2026-10-29T04:00:00.000Z',undone:false},
 {id:'tz-undone',taskId:'',title:'当天撤销',domain:'social',value:1,unit:'次',goalId:'',xp:30,date:'2026-10-31',at:'2026-10-30T15:00:00.000Z',undone:true}]};
let tzCtx,tzDay;
globalThis.Date=FakeDate;
try{tzDay=gameDay();tzCtx=buildChatContext(tzState,{userText:'今天怎么样',prevPosture:'companion',switchConsent:false});}finally{globalThis.Date=RealDate;}
assert.equal(globalThis.Date,RealDate,'伪造的 Date 必须复原');
assert.equal(tzDay,'2026-10-31','day() 应使用上海时区');
assert.equal(tzCtx.todayXp,30,'今日经验按上海当天算：UTC 昨天那条不算，撤销那条也不算');
console.log('PASS 今日经验按上海时区判定，UTC 昨天与已撤销记录都不计入');
// ---- 聊天路由：鉴权、同意校验、姿态打回、防编造、切换按钮过滤、双向额度隔离、18+、停用开关、幂等与失败落库 ----
// ChatTurn.askSwitch 必须落入存档，路由才能判断「上一轮是不是真的问过」
const askedTurn=reduceGame(start,{...turn,clientId:crypto.randomUUID(),askSwitch:true},new Date());
assert.equal(askedTurn.chat.at(-1).askSwitch,true,'assistant 轮必须保存 askSwitch');
assert.equal(reduceGame(start,{...turn,clientId:crypto.randomUUID()},new Date()).chat.at(-1).askSwitch,false,'未断言的旧轮次按 false 处理');
console.log('PASS chat-turn 持久化 askSwitch，未问过的轮次视为 false');
const oldNodeEnv=process.env.NODE_ENV;process.env.NODE_ENV='production';
const {readdirSync}=await import('node:fs');
const {DatabaseSync}=await import('node:sqlite');
const chatSqlite=new DatabaseSync(':memory:');
for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())chatSqlite.exec(source('drizzle/'+f));
let failCleanup=false; // 让 30 天惰性清理抛错，验证它不会把已保存的回复降级
const chatDb={prepare(sql){let args=[];return{bind(...values){args=values;return this;},async first(){return chatSqlite.prepare(sql).get(...args)||null;},async run(){if(failCleanup&&sql.includes('LIMIT 100'))throw new Error('cleanup failed');return{meta:{changes:Number(chatSqlite.prepare(sql).run(...args).changes)}};}};}};
globalThis.__chatDB=chatDb;
globalThis.__chatEnv={DEEPSEEK_API_KEY:'isolated-test',DEEPSEEK_MODEL:'test-model',AI_USER_DAILY_LIMIT:'10',AI_SITE_DAILY_LIMIT:'100'};
const guardUrl=url(source('lib/request-guard.ts')),identityUrl=url(source('lib/identity.ts'));
const chatRoute=()=>url(source('app/api/chat/route.ts').replace("import { env } from 'cloudflare:workers';",'const env=globalThis.__chatEnv;').replace("import { database } from '@/db';",'const database=()=>globalThis.__chatDB;').replaceAll("from '@/lib/game'",`from '${game}'`).replaceAll("from '@/lib/birthday'",`from '${birthday}'`).replaceAll("from '@/lib/identity'",`from '${identityUrl}'`).replaceAll("from '@/lib/ai/deepseek'",`from '${provider}'`).replaceAll("from '@/lib/ai/chat-contract'",`from '${chatContract}'`).replaceAll("from '@/lib/chat-context'",`from '${chatContext}'`).replaceAll("from '@/lib/request-guard'",`from '${guardUrl}'`).replaceAll("from 'zod'",`from '${import.meta.resolve('zod')}'`));
const agentRouteUrl=()=>url(source('app/api/agent/route.ts').replace("import { env } from 'cloudflare:workers';",'const env=globalThis.__chatEnv;').replace("import { database } from '@/db';",'const database=()=>globalThis.__chatDB;').replaceAll("from '@/lib/game'",`from '${game}'`).replaceAll("from '@/lib/birthday'",`from '${birthday}'`).replaceAll("from '@/lib/identity'",`from '${identityUrl}'`).replaceAll("from '@/lib/agent-contract'",`from '${agentContract}'`).replaceAll("from '@/lib/ai/deepseek'",`from '${provider}'`).replaceAll("from '@/lib/request-guard'",`from '${guardUrl}'`).replaceAll("from 'zod'",`from '${import.meta.resolve('zod')}'`));
const chatSaved=JSON.stringify(reduceGame(blank(),{type:'onboard',name:'测试',gender:'male',focus:'mind'},new Date()));
const baseState=JSON.parse(chatSaved),atNow=new Date().toISOString(),todayNow=gameDay();
const saveWith=turns=>JSON.stringify({...baseState,chat:turns});
const insertSave=(user,data)=>chatSqlite.prepare('INSERT INTO saves(user_id,data,revision) VALUES(?,?,0)').run(user,data);
insertSave('alice',chatSaved);insertSave('bob',chatSaved);insertSave('erin',chatSaved);
// 上一轮真的是咨询师 → 本轮可以保持咨询师
insertSave('carol',saveWith([{id:'carol-u',date:todayNow,at:atNow,role:'user',text:'最近有点累',posture:'companion'},{id:'carol-a',date:todayNow,at:atNow,role:'assistant',text:'先休息一下。',posture:'counselor'}]));
// 上一轮陪伴者明确问了要不要切换 → switchConsent 才生效
insertSave('dave',saveWith([{id:'dave-u',date:todayNow,at:atNow,role:'user',text:'我想被推着走',posture:'companion'},{id:'dave-a',date:todayNow,at:atNow,role:'assistant',text:'要不要换成更直接的方式？',posture:'companion',askSwitch:true}]));
// 未成年人
insertSave('minor',JSON.stringify({...baseState,profile:{...baseState.profile,birth:{date:'2015-01-01',calendar:'solar',year:2015,month:1,day:1,leapMonth:false}}}));
const chatOldFetch=globalThis.fetch;let modelCalls=0,chatMode='counselor',servedFabricated=false,lastChatContext=null;
const chatStub=async(u,options)=>{
 assert.equal(u,'https://api.deepseek.com/chat/completions');modelCalls++;
 lastChatContext=JSON.parse(JSON.parse(options.body).messages[1].content);
 const content=chatMode==='counselor'
  ?{reply:'卡在哪一步？',posture:'counselor',askSwitch:false,records:[{summary:'真记录',text:'今天看完了第三章',domain:'mind',tags:[]},{summary:'编的记录',text:'我昨天还学了英语',domain:'mind',tags:[]}],memoryCandidates:[{text:'在读讲并发的书',kind:'situation'}],quickReplies:[{label:'继续说',kind:'say'},{label:'换成咨询师',kind:'accept-switch'}]}
  :{reply:'我在听。',posture:'companion',askSwitch:true,records:[],memoryCandidates:[],quickReplies:[{label:'慢慢说',kind:'say'},{label:'换成咨询师',kind:'accept-switch'}]};
 if(content.records.some(r=>r.text==='我昨天还学了英语'))servedFabricated=true;
 return Response.json({choices:[{message:{content:JSON.stringify(content)},finish_reason:'stop'}]});
};
const agentStub=async()=>Response.json({choices:[{message:{content:JSON.stringify({summary:'先写三个要点。',adjustment:'补一个观点的资料。',sourceLogIds:[],candidates:[{title:'整理三个要点',steps:['写出三个观点'],completionCriteria:'有一份含三个观点的提纲',minutes:20,reason:'符合时间约束'}]})},finish_reason:'stop'}]});
globalThis.fetch=chatStub;
const reqFor=(path,user,body)=>new Request('https://test.invalid'+path,{method:'POST',headers:{...(user?{'oai-authenticated-user-id':user}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)});
const chatReq=(user,body)=>reqFor('/api/chat',user,body);
try{
 const chat=await import(chatRoute());
 const chatBody={requestId:crypto.randomUUID(),userText,prevPosture:'companion',switchConsent:false,consent:true,adult:true};
 assert.equal((await chat.POST(chatReq(null,chatBody))).status,401,'未登录 401');
 assert.equal((await chat.POST(chatReq('alice',{...chatBody,consent:undefined}))).status,400,'缺 consent 400');
 assert.equal((await chat.POST(chatReq('alice',{...chatBody,adult:undefined}))).status,400,'缺 adult 400');
 assert.equal((await chat.POST(chatReq('alice',{...chatBody,userText:'   '}))).status,400,'纯空白不占额度也不调模型');
 assert.equal(modelCalls,0,'参数不合法时不应调用模型');
 delete globalThis.__chatEnv.DEEPSEEK_API_KEY;
 const noKey=await chat.POST(chatReq('alice',chatBody));
 assert.equal(noKey.status,503,'没配 key 返回 503');
 assert.equal((await noKey.json()).error,'还没有配置模型。把 API Key 填进环境变量后就能聊了，手动记录不受影响。');
 globalThis.__chatEnv.DEEPSEEK_API_KEY='isolated-test';
 globalThis.__chatEnv.AI_ENABLED='false';
 assert.equal((await chat.POST(chatReq('alice',chatBody))).status,503,'AI_ENABLED=false 时同样停用');
 delete globalThis.__chatEnv.AI_ENABLED;
 const beforeMinor=modelCalls;
 assert.equal((await chat.POST(chatReq('minor',chatBody))).status,403,'未成年人在服务端硬拦截');
 assert.equal(modelCalls,beforeMinor,'18+ 拦截前不调用模型');
 assert.equal(chatSqlite.prepare('SELECT COUNT(*) AS n FROM agent_runs').get().n,0,'被拒绝的请求不占额度');
 // 首轮：客户端谎报 prevPosture=counselor，但存档里没有上一轮 → 必须按陪伴者处理
 const firstId=crypto.randomUUID();
 let res=await chat.POST(chatReq('alice',{...chatBody,requestId:firstId,prevPosture:'counselor'}));
 assert.equal(res.status,200);
 const firstRun=(await res.json()).run;
 assert.equal(firstRun.id,firstId);assert.equal(typeof firstRun.createdAt,'string');
 assert.equal(firstRun.reply.posture,'companion','prevPosture 由存档推算，客户端谎报无效');
 assert.equal(firstRun.reply.askSwitch,true,'打回后必须重新征求切换');
 assert.equal(servedFabricated,true,'桩确实返回了编造记录，下一条断言才有区分度');
 assert.deepEqual(firstRun.reply.records.map(r=>r.text),['今天看完了第三章'],'编造的记录必须被丢弃');
 assert.equal(firstRun.reply.quickReplies.some(q=>q.kind==='accept-switch'),true,'征求切换时保留同意按钮');
 assert.equal(lastChatContext.prevPosture,'companion','上下文里的上一轮姿态来自存档');
 assert.equal(JSON.stringify(lastChatContext).includes(userText),true,'上下文带上用户原话');
 assert.equal(JSON.stringify(lastChatContext).includes('birth'),false,'上下文不带生日');
 assert.equal(chatSqlite.prepare('SELECT goal_id FROM agent_runs WHERE id=?').get(firstId).goal_id,'__chat__');
 // 首轮直接发 switchConsent:true 也不能进咨询师：上一轮没人问过
 res=await chat.POST(chatReq('alice',{...chatBody,requestId:crypto.randomUUID(),prevPosture:'counselor',switchConsent:true}));
 const liar=(await res.json()).run;
 assert.equal(liar.reply.posture,'companion','switchConsent 只在上一轮 askSwitch=true 时认');
 assert.equal(liar.reply.askSwitch,true);
 // 存档里上一轮是咨询师 → 保持咨询师，askSwitch=false，且不摆切换按钮
 res=await chat.POST(chatReq('carol',{...chatBody,requestId:crypto.randomUUID()}));
 const steady=(await res.json()).run;
 assert.equal(steady.reply.posture,'counselor','存档上一轮是咨询师时不必重新征求');
 assert.equal(steady.reply.askSwitch,false);
 assert.equal(steady.reply.quickReplies.some(q=>q.kind==='accept-switch'),false,'askSwitch=false 时不得出现同意切换按钮');
 assert.equal(steady.reply.quickReplies.some(q=>q.kind==='say'),true);
 // 上一轮问过、用户点头 → 真的进咨询师
 res=await chat.POST(chatReq('dave',{...chatBody,requestId:crypto.randomUUID(),switchConsent:true}));
 assert.equal((await res.json()).run.reply.posture,'counselor','上一轮 askSwitch=true 时同意有效');
 // 上一轮问过、用户没点头 → 仍被打回
 res=await chat.POST(chatReq('dave',{...chatBody,requestId:crypto.randomUUID(),switchConsent:false}));
 const noNod=(await res.json()).run;
 assert.equal(noNod.reply.posture,'companion');assert.equal(noNod.reply.askSwitch,true);
 // 模型自己回陪伴者但主张升级 → askSwitch 被压回 false，切换按钮一并去掉
 chatMode='companion';
 res=await chat.POST(chatReq('alice',{...chatBody,requestId:crypto.randomUUID()}));
 const quiet=(await res.json()).run;
 assert.equal(quiet.reply.posture,'companion');assert.equal(quiet.reply.askSwitch,false);
 assert.equal(quiet.reply.quickReplies.some(q=>q.kind==='accept-switch'),false,'陪伴者姿态不摆切换按钮');
 chatMode='counselor';
 const callsBefore=modelCalls;
 res=await chat.POST(chatReq('alice',{...chatBody,requestId:firstId}));
 assert.equal(res.status,200);assert.deepEqual((await res.json()).run,firstRun);assert.equal(modelCalls,callsBefore,'重复请求不再调用模型');
 assert.equal((await chat.POST(chatReq('bob',{...chatBody,requestId:firstId}))).status,409,'他人不能复用请求标识');
 const chatCount=(user='alice')=>Number(chatSqlite.prepare("SELECT COUNT(*) AS n FROM agent_runs WHERE user_id=? AND date=? AND goal_id='__chat__'").get(user,gameDay()).n);
 assert.equal(chatCount(),3,'alice 已有 3 条：首轮、谎报同意、陪伴者；幂等重放不新增');
 while(chatCount()<11){const loop=await chat.POST(chatReq('alice',{...chatBody,requestId:crypto.randomUUID()}));assert.equal(loop.status,200);}
 assert.equal(chatCount(),11,'聊天默认额度 50，不能沿用 /api/agent 的 10');
 globalThis.__chatEnv.AI_CHAT_USER_DAILY_LIMIT='11';
 assert.equal((await chat.POST(chatReq('alice',{...chatBody,requestId:crypto.randomUUID()}))).status,429,'用户额度按 AI_CHAT_USER_DAILY_LIMIT 计');
 globalThis.__chatEnv.AI_CHAT_USER_DAILY_LIMIT='50';globalThis.__chatEnv.AI_CHAT_SITE_DAILY_LIMIT='11';
 assert.equal((await chat.POST(chatReq('bob',{...chatBody,requestId:crypto.randomUUID()}))).status,429,'站点额度按 AI_CHAT_SITE_DAILY_LIMIT 计');
 globalThis.__chatEnv.AI_CHAT_SITE_DAILY_LIMIT='500';
 const pendingId=crypto.randomUUID();
 chatSqlite.prepare("INSERT INTO agent_runs(id,user_id,date,goal_id,status,result,created_at) VALUES(?,?,?,'__chat__','pending','',?)").run(pendingId,'alice',gameDay(),new Date().toISOString());
 assert.equal((await chat.POST(chatReq('alice',{...chatBody,requestId:crypto.randomUUID()}))).status,429,'已有回复生成中时不得再发');
 chatSqlite.prepare('DELETE FROM agent_runs WHERE id=?').run(pendingId);
 // 反向隔离 1：行动助手的行不能吃掉聊天额度（注意此前 AI_USER_DAILY_LIMIT=10）
 for(let i=0;i<10;i++)chatSqlite.prepare("INSERT INTO agent_runs(id,user_id,date,goal_id,status,result,created_at) VALUES(?,?,?,'g-agent','complete','{}',?)").run(crypto.randomUUID(),'erin',gameDay(),new Date().toISOString());
 assert.equal(chatCount('erin'),0);
 assert.equal((await chat.POST(chatReq('erin',{...chatBody,requestId:crypto.randomUUID()}))).status,200,'agent 行不得占用聊天额度');
 // 幂等查询只认本路由自己的聊天行：撞上 agent 行或 30 天前的旧行都必须重新生成，而不是把别人的结果当 ChatRun 返回
 const clashId=crypto.randomUUID();
 chatSqlite.prepare("INSERT INTO agent_runs(id,user_id,date,goal_id,status,result,created_at) VALUES(?,?,?,'g-agent','complete',?,?)").run(clashId,'erin',gameDay(),JSON.stringify({id:clashId,mode:'plan',result:{}}),new Date().toISOString());
 const clash=await chat.POST(chatReq('erin',{...chatBody,requestId:clashId}));
 assert.equal(clash.status,409,'撞上行动助手草案的 id 必须拒绝，不能当聊天结果回放');
 assert.equal(chatSqlite.prepare('SELECT goal_id FROM agent_runs WHERE id=?').get(clashId).goal_id,'g-agent','拒绝时不得改动对方的行');
 const staleId=crypto.randomUUID();
 chatSqlite.prepare("INSERT INTO agent_runs(id,user_id,date,goal_id,status,result,created_at) VALUES(?,?,?,'__chat__','complete',?,?)").run(staleId,'erin',gameDay(),JSON.stringify({id:staleId,reply:{reply:'旧的'}}),new Date(Date.now()-40*86400000).toISOString());
 const stale=await chat.POST(chatReq('erin',{...chatBody,requestId:staleId}));
 assert.equal(stale.status,200);
 assert.notEqual((await stale.json()).run.reply.reply,'旧的','超过 30 天的旧行不得回放');
 // 反向隔离 2：聊天行不能吃掉行动助手额度（alice 已有 11 条聊天行）
 globalThis.fetch=agentStub;
 const agent=await import(agentRouteUrl());
 const agentBody={requestId:crypto.randomUUID(),mode:'plan',goalId:'',newGoal:{title:'完成文章',domain:'career',successCriteria:'完成完整草稿',target:120},minutes:20,obstacle:'还没有提纲',consent:true,adult:true};
 const agentRes=await agent.POST(reqFor('/api/agent','alice',agentBody));
 assert.equal(agentRes.status,200,'聊天行不得占用 /api/agent 的额度');
 globalThis.fetch=chatStub;
 // 模型失败：预留行置 failed
 const failId=crypto.randomUUID();
 globalThis.fetch=async()=>new Response('{}',{status:500});
 res=await chat.POST(chatReq('alice',{...chatBody,requestId:failId}));
 assert.equal(res.status,503);
 assert.equal(chatSqlite.prepare('SELECT status FROM agent_runs WHERE id=?').get(failId).status,'failed','模型失败时必须把预留行置 failed');
 globalThis.fetch=chatStub;
 // 清理是尽力而为：30 天惰性删除抛错也不能把已经保存好的回复翻成 failed
 const cleanupId=crypto.randomUUID();
 failCleanup=true;
 res=await chat.POST(chatReq('alice',{...chatBody,requestId:cleanupId}));
 failCleanup=false;
 assert.equal(res.status,200,'清理失败不得让客户端收 503');
 assert.equal(chatSqlite.prepare('SELECT status FROM agent_runs WHERE id=?').get(cleanupId).status,'complete','已完成的回复不得被清理失败降级');
 assert.equal(chatSqlite.prepare("SELECT data FROM saves WHERE user_id='alice'").get().data,chatSaved,'聊天路由不写存档');
 assert.equal(chatSqlite.prepare("SELECT COUNT(*) AS n FROM agent_runs WHERE user_id='alice' AND goal_id<>'__chat__'").get().n,1,'alice 的非聊天行只有上面那次 /api/agent 调用');
 assert.equal(chatSqlite.prepare('SELECT id FROM agent_runs WHERE user_id=? AND goal_id<>\'__chat__\'').get('alice').id,agentBody.requestId,'聊天路由没有写入任何 agent 行');
 console.log('PASS 聊天路由：鉴权、同意校验、姿态打回、防编造、切换按钮过滤、双向额度隔离、18+、停用开关、幂等与失败落库');
}finally{globalThis.fetch=chatOldFetch;process.env.NODE_ENV=oldNodeEnv;delete globalThis.__chatDB;delete globalThis.__chatEnv;chatSqlite.close();}
