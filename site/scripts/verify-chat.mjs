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
