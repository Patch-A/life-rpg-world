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
