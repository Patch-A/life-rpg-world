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
const {normalizeGame,blank}=await import(game);
const legacy={profile:{name:'测试',focus:'mind',createdAt:new Date().toISOString()},goals:[],tasks:[],logs:[],events:[],milestones:[],claims:[],equipped:'explorer',birthday:null,birthdays:[],birthdayQueue:[],reviews:[],agentAccepts:[],settings:{celebrations:true,memoryPromptSeen:false}};
const n=normalizeGame(legacy);
assert.deepEqual(n.journal,[]);assert.deepEqual(n.chat,[]);assert.deepEqual(n.memory,[]);assert.deepEqual(n.monsters,[]);
assert.equal(n.logs.length,0);assert.equal(n.profile.name,'测试');
assert.deepEqual(blank().journal,[]);
console.log('PASS 旧存档补齐新字段且不清空既有数据');
