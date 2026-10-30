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
// ---- 记忆管理页：单条删除只删指定 id、清空全部、绝不触碰生日与人生纪念 ----
const memFacts=[
 {id:'mf1',text:'在读一本讲并发的书',kind:'situation',firstSeen:'2026-10-01T00:00:00.000Z',lastSeen:'2026-10-01T00:00:00.000Z',weight:1},
 {id:'mf2',text:'喜欢清晨写作',kind:'preference',firstSeen:'2026-10-02T00:00:00.000Z',lastSeen:'2026-10-02T00:00:00.000Z',weight:3},
 {id:'mf3',text:'住在上海',kind:'fact',firstSeen:'2026-09-01T00:00:00.000Z',lastSeen:'2026-09-30T00:00:00.000Z',weight:1},
];
const memBase={...merged,memory:memFacts};
const oneGone=reduceGame(memBase,{type:'delete-memory-fact',id:'mf1'},new Date());
assert.equal(oneGone.memory.length,2,'单条删除只能删掉一条');
assert.deepEqual(oneGone.memory.map(m=>m.id),['mf2','mf3'],'单条删除必须只删指定 id，其他事实原样保留');
const unknownGone=reduceGame(memBase,{type:'delete-memory-fact',id:'不存在'},new Date());
assert.deepEqual(unknownGone.memory.map(m=>m.id),['mf1','mf2','mf3'],'id 不存在时不得退化成清空全部');
const allGone=reduceGame(memBase,{type:'delete-memory-fact'},new Date());
assert.equal(allGone.memory.length,0,'不带 id 必须清空全部记忆');
// 差分：两份存档只在 birthdays / milestones 上不同，清空全部记忆后记忆部分必须一致，
// 且生日与人生纪念原样保留（delete-memory 是给它们用的，不能被记忆删除顺手带走）。
const memPlain={...memBase,birthdays:[],milestones:[]};
const memWith={...memBase,
 birthdays:[{id:'bd1',year:2000,date:'2000-01-01',label:'不该被删的生日',calendar:'solar',adjustment:'',age:26,note:'',wish:'',photos:[],at:'',updatedAt:'',archived:false}],
 milestones:[{id:'ms1',kind:'custom',title:'不该被删的纪念',date:'2020-01-01',note:'',photos:[],at:'',updatedAt:'',archived:false}]};
const clearPlain=reduceGame(memPlain,{type:'delete-memory-fact'},new Date());
const clearWith=reduceGame(memWith,{type:'delete-memory-fact'},new Date());
assert.deepEqual(clearWith.memory,clearPlain.memory,'生日/纪念不影响清空记忆的结果');
assert.equal(clearPlain.memory.length,0,'差分两侧都必须真的清空');
assert.equal(clearWith.birthdays.length,1,'清空记忆不得删除生日');
assert.equal(clearWith.birthdays[0].id,'bd1');
assert.equal(clearWith.milestones.length,1,'清空记忆不得删除人生纪念');
assert.equal(clearWith.milestones[0].id,'ms1');
console.log('PASS 记忆单条删除、清空全部、不触碰生日与人生纪念');
// 记忆管理页结构冒烟：渲染测试宿主不存在，只能守住「派发哪个动作、清空前有没有确认」。
const memoryList=source('components/memory-list.tsx');
assert.ok(memoryList.includes("act({type:'delete-memory-fact',id:m.id})"),'单条删除必须派发带 id 的 delete-memory-fact');
assert.ok(memoryList.includes("act({type:'delete-memory-fact'})"),'清空必须派发不带 id 的 delete-memory-fact');
assert.equal(memoryList.includes("type:'delete-memory'"),false,'记忆管理页不得调用生日/纪念用的 delete-memory');
assert.ok(memoryList.includes('它还没有记住什么'),'空记忆时必须给出那句文案');
// 先确认两个标记都存在，再比较先后：标记缺失时 indexOf 返回 -1 会让比较恒真。
const clearCall=memoryList.indexOf("act({type:'delete-memory-fact'})");
const clearConfirm=memoryList.indexOf('window.confirm');
assert.ok(clearCall>-1&&clearConfirm>-1,'清空调用与清空确认都必须存在');
assert.ok(clearCall>clearConfirm,'清空必须先确认，再派发删除');
console.log('PASS 记忆管理页结构：单条/清空分别派发、清空前必须确认、不碰 delete-memory');
// 朗读开关：写入的必须就是 assistant-scene 读的那个值（关 = '0'），否则用户关不掉朗读。
const assistantScene=source('components/assistant-scene.tsx');
const pageSource=source('app/page.tsx');
assert.ok(/localStorage\.getItem\('life-rpg-voice'\)\s*===\s*'0'/.test(assistantScene),'记录官必须以 === \'0\' 判断朗读已关闭');
assert.ok(/localStorage\.getItem\('life-rpg-voice'\)\s*!==\s*'0'/.test(pageSource),'首次加载必须按同一读法恢复开关状态');
assert.ok(/const \[voice,setVoice\]=useState\(true\)/.test(pageSource),'朗读开关默认开启，且是独立的 UI 状态');
assert.ok(/localStorage\.setItem\('life-rpg-voice',v\?'1':'0'\)/.test(pageSource),'写入值必须与读法精确配对：开=1 关=0');
assert.equal(/localStorage\.setItem\('life-rpg-voice'[^)]*'true'/.test(pageSource),false,'不得写入 true/false：读法只认 0，会失配');
assert.ok(pageSource.includes("open('memory-facts')")&&pageSource.includes("modal==='memory-facts'"),'「我的」必须有记忆入口并接上弹窗');
console.log('PASS 朗读开关读写值配对（关=0），我的页有记忆入口');
// 聊天契约：防编造、姿态升级需同意、降级放行、契约限流
const agentContract=url(source('lib/agent-contract.ts').replace("from 'zod'",`from '${import.meta.resolve('zod')}'`));
const chatContract=url(source('lib/ai/chat-contract.ts').replaceAll("from '@/lib/game'",`from '${game}'`).replace("from 'zod'",`from '${import.meta.resolve('zod')}'`));
const aiProvider=url(source('lib/ai/provider.ts'));
const provider=url(source('lib/ai/deepseek.ts').replace("from '../agent-contract'",`from '${agentContract}'`).replace("from './chat-contract'",`from '${chatContract}'`).replace("from './provider'",`from '${aiProvider}'`));
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
const wrapDb=sqlite=>({prepare(sql){let args=[];return{bind(...values){args=values;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){if(failCleanup&&sql.includes('LIMIT 100'))throw new Error('cleanup failed');return{meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};}});
const chatDb=wrapDb(chatSqlite);
globalThis.__chatDB=chatDb;
globalThis.__chatEnv={DEEPSEEK_API_KEY:'isolated-test',DEEPSEEK_MODEL:'test-model',AI_USER_DAILY_LIMIT:'10',AI_SITE_DAILY_LIMIT:'100'};
const guardUrl=url(source('lib/request-guard.ts')),identityUrl=url(source('lib/identity.ts'));
const chatRoute=()=>url(source('app/api/chat/route.ts').replace("import { env } from 'cloudflare:workers';",'const env=globalThis.__chatEnv;').replace("import { database } from '@/db';",'const database=()=>globalThis.__chatDB;').replaceAll("from '@/lib/game'",`from '${game}'`).replaceAll("from '@/lib/birthday'",`from '${birthday}'`).replaceAll("from '@/lib/identity'",`from '${identityUrl}'`).replaceAll("from '@/lib/ai/deepseek'",`from '${provider}'`).replaceAll("from '@/lib/ai/provider'",`from '${aiProvider}'`).replaceAll("from '@/lib/ai/chat-contract'",`from '${chatContract}'`).replaceAll("from '@/lib/chat-context'",`from '${chatContext}'`).replaceAll("from '@/lib/request-guard'",`from '${guardUrl}'`).replaceAll("from 'zod'",`from '${import.meta.resolve('zod')}'`));
const agentRouteUrl=()=>url(source('app/api/agent/route.ts').replace("import { env } from 'cloudflare:workers';",'const env=globalThis.__chatEnv;').replace("import { database } from '@/db';",'const database=()=>globalThis.__chatDB;').replaceAll("from '@/lib/game'",`from '${game}'`).replaceAll("from '@/lib/birthday'",`from '${birthday}'`).replaceAll("from '@/lib/identity'",`from '${identityUrl}'`).replaceAll("from '@/lib/agent-contract'",`from '${agentContract}'`).replaceAll("from '@/lib/ai/deepseek'",`from '${provider}'`).replaceAll("from '@/lib/ai/provider'",`from '${aiProvider}'`).replaceAll("from '@/lib/request-guard'",`from '${guardUrl}'`).replaceAll("from 'zod'",`from '${import.meta.resolve('zod')}'`));
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
 // 反向额度隔离：换一个全新空库重跑，站点日计数才能从 0 起算
 // （留在主库的话，之前累积的聊天行会把限额占满，这条断言就算不出区分度）
 const freshSqlite=new DatabaseSync(':memory:');
 for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())freshSqlite.exec(source('drizzle/'+f));
 globalThis.__chatDB=wrapDb(freshSqlite);
 freshSqlite.prepare('INSERT INTO saves(user_id,data,revision) VALUES(?,?,0)').run('frank',chatSaved);
 globalThis.__chatEnv.AI_CHAT_USER_DAILY_LIMIT='5';globalThis.__chatEnv.AI_CHAT_SITE_DAILY_LIMIT='5';
 const freshDay=gameDay();
 // 4 条已完成 + 1 条在途：分别压到用户日计数、站点日计数与 NOT EXISTS 在途锁三处过滤
 for(const row of [...Array.from({length:4},()=>({status:'complete',result:'{}'})),{status:'pending',result:''}])
  freshSqlite.prepare("INSERT INTO agent_runs(id,user_id,date,goal_id,status,result,created_at) VALUES(?,?,?,'g-agent',?,?,?)").run(crypto.randomUUID(),'frank',freshDay,row.status,row.result,new Date().toISOString());
 assert.equal(Number(freshSqlite.prepare('SELECT COUNT(*) AS n FROM agent_runs').get().n),5);
 assert.equal(Number(freshSqlite.prepare("SELECT COUNT(*) AS n FROM agent_runs WHERE goal_id='__chat__'").get().n),0,'空库起点：没有任何聊天行');
 const frankRes=await chat.POST(chatReq('frank',{...chatBody,requestId:crypto.randomUUID()}));
 assert.equal(frankRes.status,200,'5 条 agent 行（含一条在途）不得占用额度同为 5 的聊天配额');
 const frankRunId=(await frankRes.json()).run.id;
 // agent 的 DELETE 不得删除聊天行，否则额度会被一次删除悄悄重置
 globalThis.__chatEnv.AI_CHAT_USER_DAILY_LIMIT='1';
 assert.equal((await chat.POST(chatReq('frank',{...chatBody,requestId:crypto.randomUUID()}))).status,429,'额度为 1 且已用掉 1 次');
 const delRes=await agent.DELETE(new Request('https://test.invalid/api/agent',{method:'DELETE',headers:{'oai-authenticated-user-id':'frank','Content-Type':'application/json'},body:JSON.stringify({id:frankRunId})}));
 assert.equal(delRes.status,200);
 assert.equal(Number(freshSqlite.prepare('SELECT COUNT(*) AS n FROM agent_runs WHERE id=?').get(frankRunId).n),1,'/api/agent 的 DELETE 不得删除聊天行');
 assert.equal((await chat.POST(chatReq('frank',{...chatBody,requestId:crypto.randomUUID()}))).status,429,'聊天行没被删除，额度不得被重置');
 globalThis.__chatEnv.AI_CHAT_USER_DAILY_LIMIT='50';globalThis.__chatEnv.AI_CHAT_SITE_DAILY_LIMIT='500';
 freshSqlite.close();globalThis.__chatDB=chatDb;
 console.log('PASS 聊天路由：鉴权、同意校验、姿态打回、防编造、切换按钮过滤、双向额度隔离、18+、停用开关、幂等与失败落库');
}finally{globalThis.fetch=chatOldFetch;process.env.NODE_ENV=oldNodeEnv;delete globalThis.__chatDB;delete globalThis.__chatEnv;chatSqlite.close();}
// ---- 自带模型：回落链、端点可换、能力降级、围栏剥离 ----
const {resolveProvider,buildChatRequest,stripJsonFences,postWithFallback}=await import(aiProvider);
// 回落链：AI_API_KEY 优先，旧名 DEEPSEEK_API_KEY 仍可用；都没配返回 null
assert.equal(resolveProvider({DEEPSEEK_API_KEY:'k'}).key,'k');
assert.equal(resolveProvider({AI_API_KEY:'a',DEEPSEEK_API_KEY:'d'}).key,'a');
assert.equal(resolveProvider({AI_API_KEY:'  '}),null,'纯空白 key 视为没配');
assert.equal(resolveProvider({}),null);
// 端点与能力
const open=resolveProvider({AI_API_KEY:'k',AI_BASE_URL:'http://localhost:11434/'});
assert.equal(open.baseUrl,'http://localhost:11434');
assert.equal(open.isDeepSeek,false);
const ds=resolveProvider({DEEPSEEK_API_KEY:'k'});
assert.equal(ds.baseUrl,'https://api.deepseek.com');
assert.equal(ds.model,'deepseek-chat');
assert.equal(buildChatRequest(ds,'s',{}).url,'https://api.deepseek.com/chat/completions');
assert.equal(buildChatRequest(open,'s',{}).url,'http://localhost:11434/chat/completions');
// 能力降级单独成组：变异时能独立定位，不与 isDeepSeek 断言互相遮蔽
assert.equal('thinking' in buildChatRequest(open,'s',{}).body,false,'非 DeepSeek 不发送 thinking');
assert.equal(buildChatRequest(ds,'s',{}).body.thinking.type,'disabled','DeepSeek 端点必须发送 thinking');
// 默认模型做成参数：缺省值随调用方走，显式配置的模型名优先
assert.equal(resolveProvider({DEEPSEEK_API_KEY:'k'},'deepseek-flash').model,'deepseek-flash');
assert.equal(resolveProvider({DEEPSEEK_API_KEY:'k',AI_MODEL:'custom'},'deepseek-flash').model,'custom','显式配置优先于参数默认');
assert.equal(resolveProvider({DEEPSEEK_API_KEY:'k'}).model,'deepseek-chat','不传参数时仍以 DEFAULT_MODEL 兜底');
assert.equal(resolveProvider({AI_API_KEY:'k',AI_MODEL:'qwen3'}).model,'qwen3');
assert.equal(resolveProvider({AI_API_KEY:'k',AI_MODEL:'qwen3',DEEPSEEK_MODEL:'old'}).model,'qwen3','AI_MODEL 优先于旧名');
// 剥围栏
assert.equal(stripJsonFences('```json\n{"a":1}\n```'),'{"a":1}');
assert.equal(stripJsonFences('{"a":1}'),'{"a":1}');
console.log('PASS 自带模型：回落链、端点可换、能力降级、围栏剥离');
// 端点 400 且点名 response_format 时去掉重试一次；其他 400 原样返回
let fsCalls=[];
const fsFetch=async(u,init)=>{fsCalls.push({u,body:JSON.parse(init.body),auth:init.headers.Authorization});return fsCalls.length===1?new Response('unknown field response_format',{status:400}):Response.json({ok:1});};
const retried=await postWithFallback(open,buildChatRequest(open,'s',{}),fsFetch);
assert.equal(retried.status,200);assert.equal(fsCalls.length,2);
assert.equal('response_format' in fsCalls[0].body,true);assert.equal('response_format' in fsCalls[1].body,false,'重试必须去掉 response_format');
assert.equal(fsCalls[1].u,'http://localhost:11434/chat/completions');assert.equal(fsCalls[1].auth,'Bearer k');
fsCalls=[];
const other400=async(u,init)=>{fsCalls.push(JSON.parse(init.body));return new Response('bad temperature',{status:400});};
assert.equal((await postWithFallback(open,buildChatRequest(open,'s',{}),other400)).status,400);
assert.equal(fsCalls.length,1,'与 response_format 无关的 400 不重试');
// 端到端：generateChat 打到非 DeepSeek 端点，URL 跟 baseUrl 走且不带 thinking
const oldChatFetch=globalThis.fetch;let openSeen;
globalThis.fetch=async(u,options)=>{openSeen={u,body:JSON.parse(options.body)};return Response.json({choices:[{message:{content:JSON.stringify({reply:'在听。',posture:'companion',askSwitch:false,records:[],memoryCandidates:[],quickReplies:[]})},finish_reason:'stop'}]});};
try{
 await generateChat('local-key','qwen3',{},'http://localhost:11434/');
 assert.equal(openSeen.u,'http://localhost:11434/chat/completions');
 assert.equal('thinking' in openSeen.body,false,'非 DeepSeek 端点不得发送 thinking');
 assert.equal(openSeen.body.model,'qwen3');
}finally{globalThis.fetch=oldChatFetch;}
console.log('PASS 非 DeepSeek 端点：response_format 自动降级、URL 与 thinking 随端点切换');
// ---- 路由层：只配 AI_API_KEY 也能聊；AI_BASE_URL 换端点后请求跟着走 ----
{
 const prevEnv=process.env.NODE_ENV;process.env.NODE_ENV='production';
 const byokSqlite=new DatabaseSync(':memory:');
 for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())byokSqlite.exec(source('drizzle/'+f));
 byokSqlite.prepare('INSERT INTO saves(user_id,data,revision) VALUES(?,?,0)').run('gina',chatSaved);
 globalThis.__chatDB=wrapDb(byokSqlite);
 globalThis.__chatEnv={AI_API_KEY:'byok-key',AI_MODEL:'own-model',AI_BASE_URL:'http://localhost:11434/'};
 const byokOldFetch=globalThis.fetch;let byokSeen;
 globalThis.fetch=async(u,options)=>{byokSeen={u,body:JSON.parse(options.body),auth:options.headers.Authorization};return Response.json({choices:[{message:{content:JSON.stringify({reply:'在听。',posture:'companion',askSwitch:false,records:[],memoryCandidates:[],quickReplies:[]})},finish_reason:'stop'}]});};
 try{
  // 路由把 env 在模块加载时绑定成常量，这里用带 fragment 的新模块实例，确保读到本次的 __chatEnv
  const {POST}=await import(chatRoute()+'#byok');
  const byokRes=await POST(chatReq('gina',{requestId:crypto.randomUUID(),userText,prevPosture:'companion',switchConsent:false,consent:true,adult:true}));
  assert.equal(byokRes.status,200,'只配 AI_API_KEY 就能聊天，不依赖旧名');
  assert.equal(byokSeen.u,'http://localhost:11434/chat/completions','AI_BASE_URL 决定请求端点');
  assert.equal(byokSeen.auth,'Bearer byok-key');
  assert.equal(byokSeen.body.model,'own-model');assert.equal('thinking' in byokSeen.body,false,'自建端点不发送 thinking');
  delete globalThis.__chatEnv.AI_API_KEY;
  const empty=await POST(chatReq('gina',{requestId:crypto.randomUUID(),userText,prevPosture:'companion',switchConsent:false,consent:true,adult:true}));
  assert.equal(empty.status,503,'AI_API_KEY 与 DEEPSEEK_API_KEY 都没配时 503');
  assert.equal((await empty.json()).error,'还没有配置模型。把 API Key 填进环境变量后就能聊了，手动记录不受影响。');
 }finally{globalThis.fetch=byokOldFetch;process.env.NODE_ENV=prevEnv;delete globalThis.__chatDB;delete globalThis.__chatEnv;byokSqlite.close();}
 console.log('PASS 路由层自带模型：AI_API_KEY 单独可用、AI_BASE_URL 生效、都没配时 503');
}
// ---- 默认模型按路由区分：行动助手仍是 deepseek-flash，记录官是 deepseek-chat ----
{
 const prevEnv=process.env.NODE_ENV;process.env.NODE_ENV='production';
 const defSqlite=new DatabaseSync(':memory:');
 for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())defSqlite.exec(source('drizzle/'+f));
 globalThis.__chatDB=wrapDb(defSqlite);
 const getModel=async(tag)=>{const {GET}=await import(agentRouteUrl()+'#'+tag);const res=await GET(new Request('https://test.invalid/api/agent',{headers:{'oai-authenticated-user-id':'alice'}}));return(await res.json()).model;};
 try{
  globalThis.__chatEnv={DEEPSEEK_API_KEY:'k'};
  assert.equal(await getModel('a1'),'deepseek-flash','行动助手未配模型时默认仍是 deepseek-flash，不得被统一成 chat');
  globalThis.__chatEnv={AI_API_KEY:'k'};
  assert.equal(await getModel('a2'),'deepseek-flash','换 AI_API_KEY 后行动助手默认模型不变');
  globalThis.__chatEnv={AI_API_KEY:'k',AI_MODEL:'custom-agent'};
  assert.equal(await getModel('a3'),'custom-agent','显式配置的模型名优先于路由默认');
 }finally{process.env.NODE_ENV=prevEnv;delete globalThis.__chatDB;delete globalThis.__chatEnv;defSqlite.close();}
 console.log('PASS 默认模型按路由区分：行动助手 deepseek-flash、显式配置优先');
}
// ---- 导出当天 Markdown：格式骨架、只导当天、今日口径 ----
// 模块替换：export-journal.ts 内部 import './game'，必须换成脚本里已有的 game 数据 URL，
// 否则会 ERR_UNSUPPORTED_RESOLVE_REQUEST（verify-agent 曾因此坏了两个任务）。
const exportJournalUrl=url(source('lib/export-journal.ts').replaceAll("from './game'",`from '${game}'`));
const {journalMarkdown,exportJournal}=await import(exportJournalUrl);
const {completedActions:expCompleted}=await import(game);
const expDate='2026-10-30';
const expMemory='独一无二的记忆事实：他在写一本关于潮汐的书';
const expState={...blank(),
 goals:[{id:'g1',title:'读书',domain:'mind',target:300,unit:'分钟',deadline:'',paused:false,createdAt:''}],
 tasks:[
  {id:'t1',title:'读一章',domain:'mind',target:30,unit:'分钟',repeat:true,goalId:'g1',archived:false},
  {id:'t2',title:'跑步',domain:'health',target:10,unit:'分钟',repeat:false,goalId:'',archived:false},
  {id:'t3',title:'昨天跑步',domain:'health',target:10,unit:'分钟',repeat:false,goalId:'',archived:false},
 ],
 logs:[
  // 同一天同一行动拆成两条：完成项按「达标一次」算 1，记录行却有 2 条，用来区分口径
  {id:'l1',taskId:'t1',title:'读一章',domain:'mind',value:15,unit:'分钟',goalId:'g1',xp:30,date:expDate,at:expDate+'T10:40:00.000Z',undone:false,photos:['exp-photo-xyz']},
  {id:'l2',taskId:'t1',title:'读一章',domain:'mind',value:15,unit:'分钟',goalId:'g1',xp:0,date:expDate,at:expDate+'T10:50:00.000Z',undone:false},
  {id:'l3',taskId:'t2',title:'跑步',domain:'health',value:10,unit:'分钟',goalId:'',xp:0,date:expDate,at:expDate+'T11:05:00.000Z',undone:false},
  {id:'l4',taskId:'t3',title:'昨天那条',domain:'health',value:10,unit:'分钟',goalId:'',xp:30,date:'2026-10-29',at:'2026-10-29T11:05:00.000Z',undone:false},
  {id:'l5',taskId:'t1',title:'撤销的那条',domain:'mind',value:15,unit:'分钟',goalId:'g1',xp:30,date:expDate,at:expDate+'T12:00:00.000Z',undone:true},
 ],
 // 数组顺序刻意与时间相反（晚的排在前面）：删掉按 at 排序会立刻被行序断言抓到。
 // j4 的摘要里带换行 + 假标题，验证换行被压平、不会打断 Markdown 结构。
 // j5/j6 的 at 分别是空串与 null，验证不会凭空渲染出 1970 转出来的 08:00。
 journal:[
  {id:'j4',date:expDate,at:'2026-10-30T12:10:00.000Z',text:'原话四',summary:'第一段\n## 假标题',tags:[],posture:'companion',runId:'r1',status:'kept'},
  {id:'j5',date:expDate,at:'',text:'原话五',summary:'空时刻的记录',tags:[],posture:'companion',runId:'r1',status:'kept'},
  {id:'j2',date:expDate,at:'2026-10-30T11:05:00.000Z',text:'有点累，但比昨天好',summary:'有点累，但比昨天好',tags:[],posture:'companion',runId:'r1',status:'kept'},
  {id:'j1',date:expDate,at:'2026-10-30T10:40:00.000Z',text:'今天看完了第三章，卡在并发这一节',summary:'看完第三章，卡在并发',domain:'mind',tags:[],posture:'companion',runId:'r1',status:'pending'},
  {id:'j3',date:'2026-10-29',at:'2026-10-29T09:00:00.000Z',text:'昨天的原话',summary:'昨天的记录摘要',domain:'career',tags:[],posture:'companion',runId:'r0',status:'kept'},
 ],
 // 人生纪念与生日与照片：spec §6.11 明写只导当天 journal，这些都不得进入导出。
 milestones:[{id:'ms',kind:'custom',title:'不该导出的纪念',date:'2020-01-01',note:'纪念备注',photos:[],at:'',updatedAt:'',archived:false}],
 birthdays:[{id:'bd',year:2000,date:'2000-01-01',label:'不该导出的生日',calendar:'solar',adjustment:'',age:26,note:'',wish:'',photos:[],at:'',updatedAt:'',archived:false}],
 chat:[
  {id:'c1',date:expDate,at:'2026-10-30T10:35:00.000Z',role:'user',text:'今天蛮累的，想早点睡',posture:'companion'},
  {id:'c2',date:expDate,at:'2026-10-30T10:35:05.000Z',role:'assistant',text:'听起来你需要先休息一下',posture:'companion'},
  {id:'c3',date:'2026-10-29',at:'2026-10-29T09:00:00.000Z',role:'user',text:'昨天的对话',posture:'companion'},
  {id:'c4',date:'2026-10-29',at:'2026-10-29T09:00:05.000Z',role:'assistant',text:'昨天的回复',posture:'companion'},
 ],
 memory:[{id:'m1',text:expMemory,kind:'fact',firstSeen:'2026-10-01T00:00:00.000Z',lastSeen:'2026-10-30T00:00:00.000Z',weight:1}],
};
const expMd=journalMarkdown(expState,expDate);
// 骨架：YAML 头、三节标题、日期与来源
assert.ok(expMd.startsWith('---\ndate: '),'必须以 YAML 头开头');
assert.ok(expMd.includes('date: '+expDate));
assert.ok(expMd.includes('source: life-rpg-recordkeeper'));
assert.ok(expMd.includes('## 记录')&&expMd.includes('## 对话摘录')&&expMd.includes('## 今日'));
assert.ok(expMd.includes('# 10月30日'),'标题用「月日」');
// 不允许出现 JS 值泄露
assert.equal(expMd.includes('undefined'),false,'导出不得出现 undefined');
assert.equal(expMd.includes('[object Object]'),false,'导出不得出现对象字面量');
assert.equal(expMd.includes('mood'),false,'V1 没有情绪数据，不得输出 mood 行');
// 记录行：上海时区 24 小时制、领域名、summary（不是原话 text）
assert.ok(expMd.includes('- 18:40 · 认知 · 看完第三章，卡在并发'),'记录行 = 时刻 · 领域 · 摘要');
assert.ok(expMd.includes('- 19:05 · 状态 · 有点累，但比昨天好'),'没有 domain 的记录用「状态」');
assert.equal(expMd.includes('今天看完了第三章'),false,'记录行用 summary，不用原话 text');
// 排序：fixture 数组里晚的在前，导出必须是按 at 的正序（删掉 sort 会红）
const i1840=expMd.indexOf('- 18:40 · 认知'),i1905=expMd.indexOf('- 19:05 · 状态'),i2010=expMd.indexOf('- 20:10 · 状态');
assert.ok(i1840>=0&&i1905>=0&&i2010>=0,'三条正序记录都应出现');
assert.ok(i1840<i1905&&i1905<i2010,'记录行必须按 at 正序，与 journal 数组顺序无关');
// 换行压平：摘要里的 \n## 不得把导出切成新的 Markdown 标题
assert.equal(expMd.includes('\n## 假标题'),false,'摘要里的换行不得打断 Markdown 结构');
assert.ok(expMd.includes('- 20:10 · 状态 · 第一段 ## 假标题'),'换行应被压成同一行内的空格');
// 空 at 不得渲染出假时刻（空串本身就会被 Date 判成 Invalid Date，真正的区分度在下一条 null 用例）
assert.ok(expMd.includes('- 状态 · 空时刻的记录'),'空字符串 at 不产生时刻');
assert.equal(expMd.includes('08:00'),false,'空 at 不得渲染出假时刻');
// at:null 是唯一能区分「有守卫」与「没守卫」的输入：new Date(null) 是 1970，上海时间正好 08:00。
// 单独成状态是为了不触发多元素排序（排序比较器对 null 无守卫，且真实存档里 at 恒为字符串）。
const nullAtMd=journalMarkdown({...blank(),journal:[{id:'jn',date:expDate,at:null,text:'原话六',summary:'缺时刻的记录',tags:[],posture:'companion',runId:'r1',status:'kept'}]},expDate);
assert.ok(nullAtMd.includes('- 状态 · 缺时刻的记录'),'null at 仍要输出记录行，只是没有时刻');
assert.equal(nullAtMd.includes('08:00'),false,'null at 不得渲染成 1970 转出来的假时刻 08:00');
assert.equal(nullAtMd.includes('undefined'),false,'null at 不得写成 undefined');
// 对话摘录用 `> ` 引用，用户/助手分别标注「我 / 它」
assert.ok(expMd.includes('> 我：今天蛮累的，想早点睡'));
assert.ok(expMd.includes('> 它：听起来你需要先休息一下'));
// 边界：只导当天，不含其他日期、不含 memory、不含撤销记录
assert.equal(expMd.includes('昨天的记录摘要'),false,'不得导出其他日期的记录');
assert.equal(expMd.includes('昨天的对话'),false,'不得导出其他日期的对话');
assert.equal(expMd.includes('2026-10-29'),false,'不得出现其他日期');
assert.equal(expMd.includes(expMemory),false,'导出绝不含 memory 事实');
assert.equal(expMd.includes('撤销的那条'),false,'撤销的记录不导出');
// 差分断言：只改 memory 的内容/条数，导出必须逐字相同。
// 这样任何形式的泄漏（原文、条数、kind、截断）都会红，不依赖文本唯一性。
const expMoreMemory={...expState,memory:[...expState.memory,{id:'m2',text:'另一条记忆',kind:'preference',firstSeen:'2026-10-02T00:00:00.000Z',lastSeen:'2026-10-02T00:00:00.000Z',weight:3}]};
assert.equal(journalMarkdown({...expState,memory:[]},expDate),expMd,'memory 为空不得改变导出');
assert.equal(journalMarkdown(expMoreMemory,expDate),expMd,'memory 条数与内容变化不得改变导出');
// 差分断言：人生纪念 / 生日 / 照片同理——去掉它们，导出必须逐字相同。
const expNoExtras={...expState,milestones:[],birthdays:[],logs:expState.logs.map(l=>({...l,photos:undefined}))};
assert.equal(journalMarkdown(expNoExtras,expDate),expMd,'人生纪念、生日、照片都不得进入导出');
assert.equal(expMd.includes('exp-photo-xyz'),false,'照片 id 不得出现在导出里');
assert.equal(expMd.includes('不该导出的纪念'),false,'人生纪念不得进入导出');
assert.equal(expMd.includes('不该导出的生日'),false,'生日不得进入导出');
// 今日口径：完成项 = completedActions（达标一次算 1），经验 = 当日未撤销 log 的 xp 之和
const expDayLogs=expState.logs.filter(l=>!l.undone&&l.date===expDate);
const expN=expCompleted(expState,{date:expDate}),expM=expDayLogs.reduce((n,l)=>n+l.xp,0);
assert.equal(expDayLogs.length,3,'构造数据：当天 3 条记录行');
assert.equal(expN,2,'构造数据：完成 2 项（与记录条数不同，能抓口径错误）');
assert.equal(expM,30);
assert.ok(expMd.includes(`完成 ${expN} 项 · 经验 +${expM}`),'今日行须与 completedActions / 当日 xp 一致');
assert.equal(expMd.includes('完成 3 项'),false,'完成项不能退化成当天记录条数');
// 空的一天：不崩、记录节给提示、没有对话就整节略去、今日仍写 0
const emptyMd=journalMarkdown(blank(),'2026-10-30');
assert.ok(emptyMd.includes('今天还没有记录'));
assert.ok(emptyMd.includes('## 记录')&&emptyMd.includes('## 今日'));
assert.equal(emptyMd.includes('## 对话摘录'),false,'当天没有对话就整节略去');
assert.ok(emptyMd.includes('完成 0 项 · 经验 +0'));
assert.equal(emptyMd.includes('undefined'),false);
assert.ok(emptyMd.startsWith('---\ndate: 2026-10-30\nsource: life-rpg-recordkeeper\n---\n\n# 10月30日'));
// 对话摘录最多 8 条，超量取当天最近 8 条并保持时间正序
const manyTurns={...blank(),chat:Array.from({length:10},(_,i)=>({id:'x'+i,date:expDate,at:'2026-10-30T0'+i+':00:00.000Z',role:i%2?'assistant':'user',text:'第'+i+'条'}))};
const manyMd=journalMarkdown(manyTurns,expDate);
assert.equal((manyMd.match(/^> /gm)||[]).length,8,'对话摘录最多 8 条');
assert.equal(manyMd.includes('第1条'),false,'超量时保留最近的 8 条');
assert.equal(manyMd.includes('第2条'),true);
console.log('PASS 导出格式骨架、只导当天、领域回退与今日口径');
// 下载：文件名、MIME、内容与纯函数一致；不真的点浏览器链接
const oldDoc=globalThis.document,oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL,oldSetTimeout=globalThis.setTimeout;
let dlBlob,dlDownload,dlClicked=false;const revoked=[];
URL.createObjectURL=b=>{dlBlob=b;return 'blob:stub';};
URL.revokeObjectURL=u=>revoked.push(u);
globalThis.document={createElement:()=>({set href(v){},get href(){return '';},set download(v){dlDownload=v;},get download(){return dlDownload;},click(){dlClicked=true;}})};
globalThis.setTimeout=fn=>{fn();return 0;};
try{exportJournal(expState,expDate);}finally{globalThis.document=oldDoc;URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;globalThis.setTimeout=oldSetTimeout;}
assert.equal(dlDownload,`${expDate}-记录官.md`,'下载文件名');
assert.equal(dlClicked,true,'必须触发下载点击');
assert.equal(dlBlob.type,'text/markdown;charset=utf-8','MIME 类型');
assert.equal(await dlBlob.text(),journalMarkdown(expState,expDate),'下载内容与纯函数一致');
assert.deepEqual(revoked,['blob:stub'],'下载后释放 blob URL');
console.log('PASS 导出下载文件名、MIME 与内容');
// keep-record（点「不算」）：只把 pending 变 kept，不动经验、logs、tasks；claimed 不可降级
const kept=reduceGame(after,{type:'keep-record',id:after.journal[0].id},new Date());
assert.equal(kept.journal[0].status,'kept','pending 记录应变为 kept');
assert.equal(kept.journal[0].logId,undefined,'keep 不应生成 log');
assert.equal(kept.logs.length,after.logs.length,'keep 不得新增记录');
assert.equal(kept.tasks.length,after.tasks.length,'keep 不得新增行动');
assert.equal(xp(kept),xp(after),'keep 不得改变经验值');
// 重复调用同一 id 必须报错，而不是静默成功
assert.throws(()=>reduceGame(kept,{type:'keep-record',id:kept.journal[0].id},new Date()),/只留着/,'重复 keep 应报出真实原因');
// 已认领的记录不能被「不算」降级
assert.throws(()=>reduceGame(c,{type:'keep-record',id:c.journal[0].id},new Date()),/已经认领/,'已认领记录不能降级为 kept');
assert.equal(c.journal[0].status,'claimed','失败的 keep 不得改动原状态');
// kept 之后仍可再认领
const reclaimed=reduceGame(kept,{type:'claim-record',id:kept.journal[0].id},new Date());
assert.equal(reclaimed.journal[0].status,'claimed','kept 记录可以再认领');
console.log('PASS keep-record 只留记录、不动经验、已认领不可降级');
// edit-journal：只改摘要，不动原文/领域/时刻/状态/logId，也不重算经验
const editedKept=reduceGame(kept,{type:'edit-journal',id:kept.journal[0].id,summary:'  换成自己的说法  '},new Date());
assert.equal(editedKept.journal[0].summary,'换成自己的说法','摘要必须 trim 后写入');
assert.equal(editedKept.journal[0].text,kept.journal[0].text,'不得改原文');
assert.equal(editedKept.journal[0].domain,kept.journal[0].domain,'不得改领域');
assert.equal(editedKept.journal[0].at,kept.journal[0].at,'不得改时刻');
assert.equal(editedKept.journal[0].status,'kept','不得改状态');
assert.equal(editedKept.journal[0].logId,undefined,'不得凭空生成关联日志');
assert.equal(editedKept.journal.length,kept.journal.length,'不得增删记录');
assert.equal(editedKept.tasks.length,kept.tasks.length,'不得新建行动');
assert.equal(xp(editedKept),xp(kept),'改摘要不得改变经验值');
// pending 同样可以改摘要
const editedPending=reduceGame(after,{type:'edit-journal',id:after.journal[0].id,summary:'pending 也能改'},new Date());
assert.equal(editedPending.journal[0].summary,'pending 也能改');
assert.equal(editedPending.journal[0].status,'pending','改摘要不得顺手认领');
// 已转为行动的记录不能改：摘要与已生成的行动/日志已经绑定
assert.throws(()=>reduceGame(c,{type:'edit-journal',id:c.journal[0].id,summary:'想改'},new Date()),/已转为行动的记录不能再改摘要/);
assert.equal(c.journal[0].summary,after.journal[0].summary,'失败的编辑不得改动原摘要');
// 空摘要、找不到的记录都必须报错，而不是静默成功
assert.throws(()=>reduceGame(after,{type:'edit-journal',id:after.journal[0].id,summary:'   '},new Date()),/摘要不能为空/);
assert.throws(()=>reduceGame(after,{type:'edit-journal',id:'不存在',summary:'有效摘要'},new Date()),/记录不存在/);
// 201 字截断到 200，与 chat-turn 的 summary 上限一致
const longEdited=reduceGame(after,{type:'edit-journal',id:after.journal[0].id,summary:'长'.repeat(201)},new Date());
assert.equal(longEdited.journal[0].summary.length,200);
assert.equal(longEdited.journal[0].text,after.journal[0].text,'截断只作用于摘要');
console.log('PASS edit-journal 只改摘要、claimed 不可改、空值与缺失报错、200 字截断');
// 开场白：四个时段各一句、记录数口径、无记录不带数字、模型不可用那句
const assistantLine=url(source('lib/assistant-line.ts'));
const {openingLine,TIRED_LINE}=await import(assistantLine);
const lineHours=[8,14,20,2];
const lineFour=lineHours.map(hour=>openingLine('companion','2026-10-30',3,hour));
lineFour.forEach(l=>assert.ok(typeof l==='string'&&l.trim().length>0,'四个时段都必须有开场白'));
assert.equal(new Set(lineFour).size,4,'四个时段必须是四句不同的话');
assert.ok(lineFour.every(l=>l.includes('3')),'有记录时要说出当天记录数');
const lineZero=lineHours.map(hour=>openingLine('counselor','2026-10-30',0,hour));
assert.ok(lineZero.every(l=>!/\d/.test(l)),'没有记录时整句不出现数字');
assert.notEqual(openingLine('companion','2026-10-30',0,8),openingLine('counselor','2026-10-30',0,8),'咨询师语气必须与陪伴者不同');
assert.ok(TIRED_LINE.includes('今天它有点累'),'模型不可用的那句必须包含「今天它有点累」');
assert.ok(TIRED_LINE.includes('可以先用表单记录'),'必须给出表单记录的退路');
assert.equal(/\d/.test(TIRED_LINE),false,'模型不可用那句不得出现数字');
console.log('PASS 开场白四时段不同、记录数口径、无记录不带数字、模型不可用文案');
// unclaim-record（撤销认领）：记录退回 kept 并保留，日志撤销、行动归档、经验回收
const claimBase=reduceGame(after,{type:'claim-record',id:after.journal[0].id},new Date());
const claimedLogId=claimBase.journal[0].logId,claimedTaskId=claimBase.tasks.at(-1).id;
const unclaimed=reduceGame(claimBase,{type:'unclaim-record',id:after.journal[0].id},new Date());
assert.equal(unclaimed.journal.length,claimBase.journal.length,'撤销认领不得删除记录');
assert.equal(unclaimed.journal[0].status,'kept','撤销认领后记录退回 kept');
assert.equal(unclaimed.journal[0].logId,undefined,'撤销认领必须清掉旧 log 引用');
assert.equal(unclaimed.logs.find(l=>l.id===claimedLogId).undone,true,'对应 log 应撤销');
assert.equal(xp(unclaimed),xp(after),'撤销认领应回收经验');
assert.equal(unclaimed.tasks.find(t=>t.id===claimedTaskId).archived,true,'没有未撤销记录的自动行动应归档');
assert.ok(journalMarkdown(unclaimed,after.journal[0].date).includes('认知 · 看完第三章'),'撤销认领后记录仍出现在当日导出里');
// 撤销认领后可以再认领，且指向新的 log
const reclaim=reduceGame(unclaimed,{type:'claim-record',id:after.journal[0].id},new Date());
assert.equal(reclaim.journal[0].status,'claimed');
assert.ok(reclaim.journal[0].logId&&reclaim.journal[0].logId!==claimedLogId,'再认领必须生成新 log');
assert.equal(reclaim.logs.find(l=>l.id===reclaim.journal[0].logId).undone,false);
// 只有 claimed 能撤销认领
assert.throws(()=>reduceGame(after,{type:'unclaim-record',id:after.journal[0].id},new Date()),/只有已认领/, 'pending 不能撤销认领');
assert.throws(()=>reduceGame(kept,{type:'unclaim-record',id:kept.journal[0].id},new Date()),/只有已认领/,'kept 不能撤销认领');
console.log('PASS 撤销认领保留记录、回收经验、可再次认领');
// claim-record 只认白名单状态：脏 status（undefined / archived）不得认领发经验
const noStatus={...after,journal:[{...after.journal[0],status:undefined}]};
assert.throws(()=>reduceGame(noStatus,{type:'claim-record',id:after.journal[0].id},new Date()),/记录不存在/,'status undefined 不得认领');
const archivedStatus={...after,journal:[{...after.journal[0],status:'archived'}]};
assert.throws(()=>reduceGame(archivedStatus,{type:'claim-record',id:after.journal[0].id},new Date()),/记录不存在/,'未知 status 不得认领');
console.log('PASS claim-record 只认 pending/kept 白名单');
// chatConsent：旧存档默认 false，写入后可持久，其他 settings 改动不得重置它
assert.equal(normalizeGame(legacy).settings.chatConsent,false,'旧存档应补成未同意');
assert.equal(blank().settings.chatConsent,false);
const consented=reduceGame(after,{type:'settings',chatConsent:true},new Date());
assert.equal(consented.settings.chatConsent,true,'应能写入聊天同意');
assert.equal(reduceGame(consented,{type:'settings',celebrations:false},new Date()).settings.chatConsent,true,'改其他设置不得清掉同意');
assert.equal(reduceGame(consented,{type:'settings'},new Date()).settings.chatConsent,true,'空 settings action 不得清掉同意');
console.log('PASS chatConsent 默认关闭、可写入且不被其他设置重置');
// 结构冒烟：chat-room.tsx 没有渲染测试宿主，只能守住这几处一旦退化就会烧额度/丢记录的结构。
const chatRoom=source('components/chat-room.tsx');
assert.ok(/const retry=unsaved\.current/.test(chatRoom),'未落库的那一轮必须被记住以便重试');
// 先断言标记存在，再断言顺序：标记一旦消失，indexOf 返回 -1 不能让比较恒真。
const retryMark=chatRoom.indexOf('if(retry)');
assert.ok(retryMark>-1,'必须存在 if(retry) 重试短路');
const callsChat=chatRoom.indexOf("fetch('/api/chat'");
assert.ok(callsChat>-1,'必须存在 /api/chat 调用');
assert.ok(callsChat>retryMark,'重试必须在发请求之前短路，不能再烧一次额度');
assert.ok(chatRoom.indexOf('onLine(')>chatRoom.indexOf('}catch(err)'),'onLine 必须在 try 之外：落库成功后回调抛错不得回填原文');
// 运行时守卫必须存在且必须能拦住
assert.ok(/if\(!retry&&!canSend\)return;/.test(chatRoom),'缺了 canSend 运行时守卫，回车提交可绕过勾选');
// 同意行 UI 必须真的渲染两个勾选框，且发送按钮真的读 canSend
assert.ok((chatRoom.match(/chat-room__consent-item/g)||[]).length>=2,'同意行必须渲染两个勾选框');
assert.ok(/disabled=\{[^}]*canSend[^}]*\}/.test(chatRoom),'发送按钮必须真的受 canSend 约束');
// 同意行必须在 !consentDone 时才渲染
assert.ok(/!consentDone&&/.test(chatRoom),'同意行必须只在未同意时出现');
assert.ok(chatRoom.includes('state.settings.chatConsent')&&chatRoom.includes('chatConsent:true'),'同意门槛必须读存档并写回存档');
// 同意文案必须如实披露实际发送的四类内容（chat-context 会带 recentChat 与 memory）
assert.ok(chatRoom.includes('对话原文（最近 40 条）'),'同意文案必须披露对话原文发送');
assert.ok(chatRoom.includes('长期记忆（最多 40 条）'),'同意文案必须披露长期记忆发送');
assert.ok(chatRoom.includes('目标与近期行动记录'),'同意文案必须披露目标与近期行动记录');
assert.ok(chatRoom.includes('储蓄进度'),'同意文案必须披露储蓄进度');
assert.ok(chatRoom.includes('照片、生日、人生纪念不会发送'),'不会发送那半句保持不变');
assert.ok(chatRoom.includes("type:'unclaim-record'")&&chatRoom.includes("type:'keep-record'"),'记录卡必须提供保留与撤销认领');
assert.ok(chatRoom.indexOf("type:'unclaim-record'")!==-1&&chatRoom.indexOf("type:'delete-journal',id:entry.id")>chatRoom.indexOf("type:'unclaim-record'"),'撤销认领与删除必须是两个不同的动作');
// 删除必须两步确认：初次点「删除」只进入确认态，真正删除留在确认分支里
assert.ok(/useState<string\|null>\(null\)/.test(chatRoom),'删除确认态必须用 useState<string|null> 记住是哪一条');
const firstDelete=chatRoom.indexOf('aria-label={`删除这条记录');
assert.ok(firstDelete>-1,'必须保留初次「删除」按钮');
// 取整个 <button>…</button>：从它前面的 <button 截到下一个 </button>，避免截到 onClick 里的 =>
const firstButton=chatRoom.slice(chatRoom.lastIndexOf('<button',firstDelete),chatRoom.indexOf('</button>',firstDelete));
assert.ok(firstButton.includes('删除'),'初次按钮文案是「删除」');
assert.ok(!firstButton.includes('delete-journal'),'初次点「删除」不得一键永久删除，必须先进入确认态');
assert.ok(chatRoom.includes('确定删除？'),'确认态必须问「确定删除？」');
assert.ok(chatRoom.includes('删除后这条记录就不能恢复了'),'必须说明删除不可恢复');
assert.ok(chatRoom.indexOf("type:'delete-journal',id:entry.id")>chatRoom.indexOf('确定删除？'),'真正的删除动作必须出现在确认态之后');
console.log('PASS 对话区结构冒烟：重试复用、通知时序、同意门槛与披露、撤销与两步删除');
// 503 与摘要编辑：没有渲染测试宿主，只能守住「分支还在、真的派发、顺序正确」。
const catchMark=chatRoom.indexOf('}catch(err)');
const api503=chatRoom.indexOf('err instanceof ApiError&&err.status===503');
const tiredLine=chatRoom.indexOf('onLine(TIRED_LINE)');
const redError=chatRoom.indexOf('toast.error(requestError(err))');
assert.ok(catchMark>-1,'必须保留请求失败的 catch');
assert.ok(chatRoom.includes('ApiError'),'必须从 api-client 引入 ApiError，而不是靠文案判断 503');
assert.ok(api503>catchMark,'503 判别必须写在请求失败的 catch 里');
assert.ok(tiredLine>api503,'503 分支必须让助手说出 TIRED_LINE');
assert.ok(redError>tiredLine,'503 分支不得落到 toast.error：红条只留给其他错误');
const editOpen=chatRoom.indexOf('chat-room__edit-open');
assert.ok(editOpen>-1,'未认领的记录必须有「修改」入口');
assert.ok(chatRoom.includes("type:'edit-journal',id:entry.id"),'保存摘要必须真的派发 edit-journal');
assert.ok(/entry\.status!==['"]claimed['"]/.test(chatRoom),'已转为行动的记录不得显示修改入口');
assert.ok(chatRoom.includes('disabled={locked||!draft.trim()}'),'空摘要必须禁用保存');
assert.ok(chatRoom.includes('maxLength={200}'),'摘要输入必须与 reducer 的上限一致');
console.log('PASS 对话区结构冒烟：503 让助手说话、摘要可改且 claimed 不给入口');
// ---- 首页结构：page.tsx 没有渲染测试宿主，只能做源码断言；但每条都必须能真的变红 ----
const page=source('app/page.tsx');
// 先确认标记存在，再断言内容：标记缺失时 indexOf 返回 -1 会让比较恒真。
const assistantMount=[...page.matchAll(/<ActionAssistant[\s\S]*?\/>/g)];
assert.equal(assistantMount.length,1,'ActionAssistant 必须只挂载一次');
const todayBranch=page.indexOf("{view==='today'&&<><TodayPanel");
const tasksBranch=page.indexOf("{view==='tasks'&&<div className=\"tasks-layout\">");
const growthBranch=page.indexOf("{view==='growth'&&<div className=\"growth-layout\">");
assert.ok(todayBranch>-1,"必须保留今天的对话优先块");
assert.ok(tasksBranch>-1,"必须保留 view==='tasks' 目标页块，ActionAssistant 就挂在这里");
assert.ok(growthBranch>tasksBranch,'成长页块必须留在目标页块之后，才能界定任务块的范围');
assert.equal(page.includes("view==='today'||view==='tasks'"),false,"ActionAssistant 不得回到 today||tasks 的挂载条件");
const assistantMountAt=page.indexOf('<ActionAssistant');
assert.ok(assistantMountAt>-1,'必须仍然挂载 ActionAssistant');
assert.ok(assistantMountAt>todayBranch,'ActionAssistant 不得挂在今天页分支内');
assert.ok(assistantMountAt>tasksBranch,'ActionAssistant 必须挂在目标页分支内，不得挪回今天页');
assert.ok(assistantMountAt<growthBranch,'ActionAssistant 必须收在目标页分支内，不得提到无条件渲染');
// 任务块内部的大括号是配平的，挂载点之前应当恰好还差一个未闭合的 `{`（就是 `{view==='tasks'&&` 那个）。
// 组件被挪到分支外面渲染时差值是 0，断言立刻变红；只看位置先后是抓不到这种情况的。
const branchSeg=page.slice(tasksBranch,assistantMountAt);
let branchDepth=0;
for(const ch of branchSeg){if(ch==='{')branchDepth++;else if(ch==='}')branchDepth--;}
assert.equal(branchDepth,1,"ActionAssistant 必须嵌在 view==='tasks' 分支的 JSX 内部，不能在分支外单独渲染");
// onReplay 只能通知，绝不能改 line：一旦回填，朗读 effect 与重读会互相触发。
// 真正的绑定在 today-panel 里（page.tsx 目前不传 onReplay），所以先确认恰好绑定一次再断言内容。
const todayPanel=source('components/today-panel.tsx');
const replayBind=[...todayPanel.matchAll(/onReplay=\{[^}]*\}/g)];
assert.equal(replayBind.length,1,'首页必须给 onReplay 传且只传一个回调');
assert.ok(/onReplay=\{\(\)=>undefined\}/.test(todayPanel),'onReplay 必须是空回调：重读只由 AssistantScene 自己负责');
assert.equal(replayBind.some(m=>/setLine|onLine|onPosture/.test(m[0])),false,'onReplay 绝不能回填 line 或姿态');
// 朗读是一次性信号：onLine 置真后必须复位，否则切页回来会未经点击自动重读。
assert.ok(page.indexOf('setSpeaking(true)')>-1,'onLine 仍要把 speaking 置真，这一次才朗读');
const speakingOff=page.indexOf('setSpeaking(false)');
assert.ok(speakingOff>-1,'speaking 必须复位：缺 setSpeaking(false) 时切页回来会自动重读');
// 复位还必须在依赖 speaking 的 useEffect 里真正被执行：写进一个没人调用的函数等于没写。
const effectBefore=page.lastIndexOf('useEffect(',speakingOff);
const effectAfter=page.indexOf('},[speaking])',speakingOff);
assert.ok(effectBefore>-1&&effectAfter>speakingOff&&effectAfter-effectBefore<400,'setSpeaking(false) 必须写在依赖 speaking 的 useEffect 里，而不是别处的死代码');
console.log('PASS 首页结构：ActionAssistant 只挂目标页、onReplay 不改 line、speaking 一次性复位');
// ---- 同意行「主句 + 折叠详情」：主句仍要说清对话与记录会发出去，清单默认收起 ----
const consentAt=chatRoom.indexOf('className="chat-room__consent"');
assert.ok(consentAt>-1,'必须保留同意行容器 chat-room__consent');
const consentEnd=chatRoom.indexOf('</div>',consentAt);
assert.ok(consentEnd>consentAt,'同意行容器必须闭合');
const consentBlock=chatRoom.slice(consentAt,consentEnd);
const detailsTags=[...consentBlock.matchAll(/<details[^>]*>/g)];
assert.equal(detailsTags.length,1,'同意行必须有且只有一个折叠详情');
assert.ok(consentBlock.includes('<summary>具体发送什么</summary>'),'折叠区入口必须是「具体发送什么」');
assert.equal(detailsTags.some(m=>/\bopen\b/.test(m[0])),false,'折叠详情必须默认收起，不能加 open');
const consentLabels=[...consentBlock.matchAll(/<label className="chat-room__consent-item">([\s\S]*?)<\/label>/g)];
assert.equal(consentLabels.length,2,'同意行必须保留两个勾选框');
assert.ok(consentLabels[0][1].includes('我已满 18 岁'),'第一条勾选框是「我已满 18 岁」');
const mainSentence=consentLabels[1][1];
assert.ok(mainSentence.includes('同意'),'第二条勾选框必须以「同意」开头，说清这是授权');
assert.ok(mainSentence.includes('对话')&&mainSentence.includes('记录'),'同意主句必须说明对话和记录都会发送给模型');
assert.equal(/照片|生日|纪念/.test(mainSentence),false,'披露清单已收进折叠区，不占主句');
assert.ok(consentBlock.indexOf('照片、生日、人生纪念不会发送')>consentBlock.indexOf('<details'),'不发送的照片、生日、人生纪念仍须在折叠区内保留');
console.log('PASS 同意行主句说清对话与记录、清单进默认收起的 details');

