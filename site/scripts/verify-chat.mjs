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
