// Exercise actual handlers against isolated SQLite; model HTTP is explicitly stubbed.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const url=code=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(source('drizzle/'+file));
const db={prepare(sql){let args=[];return{bind(...values){args=values;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return{results:sqlite.prepare(sql).all(...args)};},async run(){return{meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};}};
globalThis.__agentDB=db;globalThis.__agentEnv={DEEPSEEK_API_KEY:'isolated-test',DEEPSEEK_MODEL:'test-model',AI_ENABLED:'true',AI_USER_DAILY_LIMIT:'10',AI_SITE_DAILY_LIMIT:'100'};const oldEnv=process.env.NODE_ENV;process.env.NODE_ENV='production';
const appearance=url(source('lib/appearance.ts')),birthday=url(source('lib/birthday.ts'));
const game=url(source('lib/game.ts').replace("from './appearance'",`from '${appearance}'`).replace("from './birthday'",`from '${birthday}'`));
const contract=url(source('lib/agent-contract.ts').replace("from 'zod'",`from '${import.meta.resolve('zod')}'`));
const provider=url(source('lib/ai/deepseek.ts').replace("from '../agent-contract'",`from '${contract}'`));const guard=url(source('lib/request-guard.ts')),identity=url(source('lib/identity.ts'));
function route(path){return url(source(path).replace("import { env } from 'cloudflare:workers';",'const env=globalThis.__agentEnv;').replace("import { database } from '@/db';",'const database=()=>globalThis.__agentDB;').replaceAll("from '@/lib/game'",`from '${game}'`).replaceAll("from '@/lib/birthday'",`from '${birthday}'`).replaceAll("from '@/lib/identity'",`from '${identity}'`).replaceAll("from '@/lib/agent-contract'",`from '${contract}'`).replaceAll("from '@/lib/ai/deepseek'",`from '${provider}'`).replaceAll("from '@/lib/request-guard'",`from '${guard}'`).replaceAll("from 'zod'",`from '${import.meta.resolve('zod')}'`));}
const save=await import(route('app/api/game/route.ts')),agent=await import(route('app/api/agent/route.ts')),feedback=await import(route('app/api/feedback/route.ts'));const {xp,progress,goalReached,normalizeGame}=await import(game);
const req=(path,user,body,method=body?'POST':'GET',extra={})=>new Request('https://test.invalid'+path,{method,headers:{...(user?{'oai-authenticated-user-id':user}:{}),'Content-Type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})});
let calls=0,invalidCitation=false,lastPayload;
const oldFetch=globalThis.fetch;globalThis.fetch=async(u,options)=>{assert.equal(u,'https://api.deepseek.com/chat/completions');calls++;lastPayload=JSON.parse(options.body);const context=JSON.parse(lastPayload.messages[1].content);const content={summary:context.records.length?'已记录一次提纲行动。':'尚无行动记录，先写三个要点。',adjustment:'先补一个观点的资料。',sourceLogIds:invalidCitation?['not-owned']:context.records.map(r=>r.id),candidates:[{title:'整理三个文章要点',steps:['写出三个观点','按顺序排列'],completionCriteria:'保留一份含三个观点的提纲',minutes:20,reason:'符合20分钟时间约束'}]};return Response.json({choices:[{message:{content:JSON.stringify(content)},finish_reason:'stop'}]});};
try{
 assert.equal((await agent.GET(req('/api/agent',null))).status,401);
 let r=await save.POST(req('/api/game','alice',{revision:0,action:{type:'onboard',name:'测试',gender:'male',focus:'career'}}));assert.equal(r.status,200);let data=await r.json();assert.equal(data.state.birthday,null);assert.equal(data.state.profile.birth,undefined);
 const a={requestId:crypto.randomUUID(),mode:'plan',goalId:'',newGoal:{title:'完成文章',domain:'career',successCriteria:'完成完整草稿',target:120},minutes:20,obstacle:'还没有提纲',consent:true,adult:true};
 assert.equal((await agent.POST(req('/api/agent','alice',{...a,consent:false}))).status,400);assert.equal(calls,0);
 assert.equal((await agent.POST(req('/api/agent','alice',a,'POST',{Origin:'https://other.invalid'}))).status,403);
 r=await agent.POST(req('/api/agent','alice',a));assert.equal(r.status,200);const run=(await r.json()).run;assert.equal(calls,1);assert.equal(lastPayload.messages[1].content.includes('birthday'),false);assert.equal(lastPayload.messages[1].content.includes('photos'),false);
 assert.equal((await agent.POST(req('/api/agent','alice',a))).status,200);assert.equal(calls,1);
 assert.equal((await agent.GET(req('/api/agent?id='+run.id,'bob'))).status,404);
 assert.equal((await save.POST(req('/api/game','alice',{revision:1,action:{type:'agent-confirm',clientId:run.id}}))).status,400);
 assert.equal((await save.POST(req('/api/game','bob',{revision:0,action:{type:'accept-agent',requestId:run.id,index:0}}))).status,400);
 r=await save.POST(req('/api/game','alice',{revision:1,action:{type:'accept-agent',requestId:run.id,index:0,title:'修改后的提纲行动'}}));assert.equal(r.status,200);data=await r.json();let goal=data.state.goals.at(-1),task=data.state.tasks.at(-1);assert.equal(task.title,'修改后的提纲行动');assert.equal(task.goalId,goal.id);assert.equal(xp(data.state),0);
 r=await save.POST(req('/api/game','alice',{revision:1,action:{type:'accept-agent',requestId:run.id,index:0}}));assert.equal(r.status,200);assert.equal((await r.json()).state.tasks.length,2);assert.equal((await (await save.GET(req('/api/game','alice'))).json()).revision,2);
 const review={...a,requestId:crypto.randomUUID(),mode:'review',goalId:goal.id};delete review.newGoal;assert.equal((await agent.POST(req('/api/agent','alice',review))).status,400);
 r=await save.POST(req('/api/game','alice',{revision:2,action:{type:'log',id:task.id,value:120,note:'列好了三个观点，两个需要补资料'}}));assert.equal(r.status,200);data=await r.json();assert.equal(progress(data.state,goal),120);assert.equal(goalReached(data.state,goal),false);assert.equal(xp(data.state),30);
 r=await agent.POST(req('/api/agent','alice',review));assert.equal(r.status,200);const reviewed=(await r.json()).run;
 r=await save.POST(req('/api/game','alice',{revision:3,action:{type:'accept-agent',requestId:reviewed.id,index:null}}));assert.equal(r.status,200);data=await r.json();assert.equal(data.state.reviews.length,1);assert.equal(data.state.tasks.length,2);assert.equal(data.state.reviews[0].sourceLogIds[0],data.state.logs[0].id);assert.equal(xp(data.state),30);
 invalidCitation=true;assert.equal((await agent.POST(req('/api/agent','alice',{...review,requestId:crypto.randomUUID()}))).status,503);invalidCitation=false;
 r=await save.POST(req('/api/game','alice',{revision:4,action:{type:'confirm-goal',id:goal.id}}));assert.equal(r.status,200);data=await r.json();assert.equal(goalReached(data.state,data.state.goals.at(-1)),true);assert.equal(xp(data.state),30);
 const fb={id:crypto.randomUUID(),category:'blocked',helpful:'no',step:'plan',message:'不知道如何记录'};assert.equal((await feedback.POST(req('/api/feedback','alice',fb))).status,201);assert.equal((await feedback.POST(req('/api/feedback','alice',fb))).status,200);assert.equal((await (await feedback.GET(req('/api/feedback','bob'))).json()).items.length,0);assert.equal((await (await feedback.GET(req('/api/feedback','alice'))).json()).items.length,1);
 await feedback.DELETE(req('/api/feedback','bob',{id:fb.id},'DELETE'));assert.equal((await (await feedback.GET(req('/api/feedback','alice'))).json()).items.length,1);await feedback.DELETE(req('/api/feedback','alice',{id:fb.id},'DELETE'));assert.equal((await (await feedback.GET(req('/api/feedback','alice'))).json()).items.length,0);
 globalThis.__agentEnv.AI_USER_DAILY_LIMIT='1';assert.equal((await agent.POST(req('/api/agent','alice',{...a,requestId:crypto.randomUUID()}))).status,429);
 const legacy={...data.state};delete legacy.reviews;delete legacy.agentAccepts;assert.equal(normalizeGame(legacy).reviews.length,0);assert.equal(normalizeGame(legacy).logs.length,data.state.logs.length);
 console.log('PASS AI授权与来源校验、输入最小化、用户隔离、配额和无证据复盘拒绝');
 console.log('PASS 草案幂等、修改确认、原子目标/行动保存、真实记录引用、无效引用拒绝');
 console.log('PASS 手动成功标准确认、XP不由AI更改、旧存档兼容、反馈隔离及本人删除');
}finally{globalThis.fetch=oldFetch;process.env.NODE_ENV=oldEnv;delete globalThis.__agentDB;delete globalThis.__agentEnv;sqlite.close();}
