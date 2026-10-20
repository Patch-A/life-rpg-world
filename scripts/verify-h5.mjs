// Real HTTP acceptance against a dedicated loopback server and disposable fixtures.
// Default mode needs no key/network. Explicit real-AI mode uses only fictional
// fixtures and the separately selected existing test-only credential.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=path.join(root,'outputs','h5-submission');
const data=path.join(root,'outputs','h5-acceptance-'+randomUUID());
await mkdir(data,{recursive:true});
const port=Number(process.env.H5_VERIFY_PORT||3188),origin=`http://127.0.0.1:${port}`;
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local verification port.');
const realAI=process.argv.includes('--real-ai');
let testKey='';
if(realAI){
 const keyIndex=process.argv.indexOf('--key-file'),file=process.argv[keyIndex+1];
 if(keyIndex<0||!file||!path.isAbsolute(file))throw Error('Real AI verification requires an explicit absolute --key-file for an existing ignored test credential.');
 const content=await readFile(file,'utf8');
 const match=content.match(/^\s*DEEPSEEK_API_KEY\s*=\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s#]+))\s*$/m);
 testKey=match?.[1]||match?.[2]||match?.[3]||'';
 if(!testKey)throw Error('The selected local test credential is not configured.');
}
const environment={...process.env,H5_DATA_DIR:data,APP_ORIGIN:origin,AI_ENABLED:realAI?'true':'false',DEEPSEEK_API_KEY:testKey,NEXT_TELEMETRY_DISABLED:'1'};
function manage(...args){return execFileSync(process.execPath,['scripts/manage.mjs',...args],{cwd:app,env:environment,encoding:'utf8',stdio:['ignore','pipe','pipe']});}
manage('init');
for(const name of ['alice','bob'])manage('invite','--out',path.join(data,name+'.json'));
const alice=JSON.parse(await readFile(path.join(data,'alice.json'),'utf8'));
const bob=JSON.parse(await readFile(path.join(data,'bob.json'),'utf8'));
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:app,env:environment,stdio:['ignore','pipe','pipe']});
let startup='';child.stdout.on('data',x=>{startup+=x;});child.stderr.on('data',x=>{startup+=x;});
const checks=[];
const pass=label=>{checks.push(label);console.log('PASS '+label);};
async function request(route,{cookie,method='GET',body,headers={},raw=false}={}){
 const response=await fetch(origin+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:origin}:{}),...(body!==undefined&&!raw?{'Content-Type':'application/json'}:{}),...headers},...(body===undefined?{}:{body:raw?body:JSON.stringify(body)}),signal:AbortSignal.timeout(route==='/api/agent'&&method==='POST'?65000:15000),redirect:'manual'});
 return response;
}
async function json(response){assert.match(response.headers.get('content-type')||'',/application\/json/);return response.json();}
async function login(account){const response=await request('/api/access',{method:'POST',body:{code:account.invitationCode}});assert.equal(response.status,200,'invitation login');const header=response.headers.get('set-cookie')||'';assert.match(header,/HttpOnly/i);assert.match(header,/SameSite=Lax/i);return header.split(';')[0];}
try{
 let ready=false;
 for(let attempt=0;attempt<30;attempt++){try{const response=await request('/api/access');if(response.status===200){ready=true;break;}}catch{}if(child.exitCode!==null)break;await new Promise(resolve=>setTimeout(resolve,300));}
 assert(ready,'Dedicated local server did not become ready. '+startup.slice(-800));
 for(const route of ['/','/demo','/access','/about','/play']){const response=await request(route);assert.equal(response.status,200,route);assert.match(response.headers.get('content-type')||'',/text\/html/);}
 assert.match(await (await request('/')).text(),realAI?/真实 AI 已启用/:/当前真实 AI 尚未启用/);
 pass('Public entry, demo, access, about and play return HTML; actual AI availability is labelled');
 for(const route of ['/api/game','/api/photos?list=1','/api/agent','/api/feedback']){assert.equal((await request(route)).status,401,route);assert.equal((await request(route,{headers:{'oai-authenticated-user-id':alice.accountId}})).status,401,'forged Sites identity');}
 assert.equal((await request('/api/access',{method:'POST',body:{code:alice.invitationCode},headers:{Origin:'https://other.invalid'}})).status,403);
 assert.equal((await request('/api/access',{method:'POST',body:{code:alice.invitationCode},headers:{Origin:'https://other.invalid','X-Forwarded-Host':'other.invalid','X-Forwarded-Proto':'https'}})).status,403);
 assert.equal((await request('/api/access',{method:'POST',body:{code:'rpg_'+'0'.repeat(48)}})).status,401);
 pass('Anonymous/forged identities and cross-origin login are rejected');
 const a=await login(alice),b=await login(bob);
 assert.equal((await json(await request('/api/access',{cookie:a}))).authenticated,true);
 const onboard={type:'onboard',name:'虚构验收A',gender:'female',avatarId:'female',focus:'career',goalTitle:'完成一份虚构项目提纲',goalTarget:120,goalUnit:'分钟',taskTitle:'列出三个项目要点',taskTarget:10};
 let response=await request('/api/game',{cookie:a,method:'POST',body:{revision:0,action:onboard}});assert.equal(response.status,200);let state=await json(response);
 assert.equal(state.revision,1);assert.equal(state.state.profile.name,'虚构验收A');assert.equal((await json(await request('/api/game',{cookie:b}))).state.profile,null);
 const action={type:'log',id:state.state.tasks[0].id,value:10,note:'验收用虚构文字，不是真实用户进展'};
 const concurrent=await Promise.all([request('/api/game',{cookie:a,method:'POST',body:{revision:1,action}}),request('/api/game',{cookie:a,method:'POST',body:{revision:1,action}})]);
 assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,409]);
 state=await json(await request('/api/game',{cookie:a}));assert.equal(state.revision,2);assert.equal(state.state.logs.length,1);
 assert.equal((await request('/api/game',{cookie:a,method:'POST',body:{revision:2,action:{type:'agent-confirm'}}})).status,400);
 pass('Independent invitations, private saves, reload persistence and concurrent revision protection');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
 response=await request('/api/photos',{cookie:a,method:'POST',body:png,raw:true,headers:{'Content-Type':'image/png'}});assert.equal(response.status,201);const photo=await json(response);
 const image=await request('/api/photos?id='+photo.id,{cookie:a});assert.equal(image.status,200);assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
 assert.equal((await request('/api/photos?id='+photo.id,{cookie:b})).status,404);
 assert.equal((await request('/api/photos',{cookie:b,method:'DELETE',body:{id:photo.id,revision:0}})).status,404);
 pass('Private photo upload/read bytes and cross-account read/delete rejection');
 const id=randomUUID(),feedback={id,category:'blocked',helpful:'untried',step:'entry',message:'虚构验收反馈，不代表真实用户意见'};
 assert.equal((await request('/api/feedback',{cookie:a,method:'POST',body:feedback})).status,201);
 assert.equal((await request('/api/feedback',{cookie:a,method:'POST',body:feedback})).status,200);
 assert.equal((await json(await request('/api/feedback',{cookie:a}))).items.length,1);assert.equal((await json(await request('/api/feedback',{cookie:b}))).items.length,0);
 await request('/api/feedback',{cookie:b,method:'DELETE',body:{id}});assert.equal((await json(await request('/api/feedback',{cookie:a}))).items.length,1);
 pass('Feedback receipt, request idempotency and cross-account isolation');
 assert.equal((await json(await request('/api/agent',{cookie:a}))).available,realAI);
 if(realAI){
  const input={requestId:randomUUID(),mode:'plan',goalId:state.state.goals[0].id,minutes:20,obstacle:'这是软件验收的虚构项目，只需帮助列一份项目提纲。',consent:true,adult:true};
  response=await request('/api/agent',{cookie:a,method:'POST',body:input});const result=await json(response);assert.equal(response.status,200,result.error||'real AI plan');const run=result.run;
  assert(run.result.candidates.length>0);assert.equal((await json(await request('/api/game',{cookie:a}))).revision,state.revision,'AI must not mutate the save');
  assert.equal((await request('/api/agent?id='+run.id,{cookie:b})).status,404);
  const accept={revision:state.revision,action:{type:'accept-agent',requestId:run.id,index:0,title:run.result.candidates[0].title.slice(0,70)+'（虚构验收）'}};
  response=await request('/api/game',{cookie:a,method:'POST',body:accept});assert.equal(response.status,200);state=await json(response);
  assert.equal((await json(await request('/api/game',{cookie:a,method:'POST',body:accept}))).revision,state.revision,'repeat confirmation');
  const task=state.state.tasks.find(x=>x.originRunId===run.id);assert(task,'confirmed candidate becomes a task');
  response=await request('/api/game',{cookie:a,method:'POST',body:{revision:state.revision,action:{type:'log',id:task.id,value:task.target,note:'软件验收专用虚构记录：已写出三个提纲要点，其中一个待补资料。'}}});assert.equal(response.status,200);state=await json(response);
  response=await request('/api/agent',{cookie:a,method:'POST',body:{...input,requestId:randomUUID(),mode:'review'}});const review=await json(response);assert.equal(response.status,200,review.error||'real AI review');
  assert(review.run.result.sourceLogIds.length>0);assert(review.run.result.sourceLogIds.every(id=>state.state.logs.some(log=>log.id===id)));
  response=await request('/api/game',{cookie:a,method:'POST',body:{revision:state.revision,action:{type:'accept-agent',requestId:review.run.id,index:null}}});assert.equal(response.status,200);state=await json(response);
  assert.equal(state.state.reviews.length,1);
  pass('Real DeepSeek plan, editable confirmation, idempotency, fictional record, cited review and saved review; no automatic save');
 }else{
  response=await request('/api/agent',{cookie:a,method:'POST',body:{requestId:randomUUID(),mode:'plan',goalId:state.state.goals[0].id,minutes:20,obstacle:'',consent:true,adult:true}});assert.equal(response.status,503);
  const db=new DatabaseSync(path.join(data,'life-rpg.sqlite'));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM agent_runs').get().n,0);db.close();
  pass('Disabled AI cannot issue provider requests or reserve a model run');
 }
 assert.equal((await request('/api/access',{cookie:a,method:'DELETE'})).status,200);assert.equal((await request('/api/game',{cookie:a})).status,401);
 const again=await login(alice);assert.equal((await json(await request('/api/game',{cookie:again}))).state.logs.length,state.state.logs.length);
 manage('revoke',alice.accountId);assert.equal((await request('/api/game',{cookie:again})).status,401);assert.equal((await request('/api/access',{method:'POST',body:{code:alice.invitationCode}})).status,401);
 assert.equal((await request('/api/game',{cookie:b})).status,200);
 pass('Logout invalidates session; revoked account cannot reuse sessions or invitations; another account stays available');
 await writeFile(path.join(root,'outputs',realAI?'h5-real-ai-acceptance.json':'h5-http-acceptance.json'),JSON.stringify({date:new Date().toISOString(),checks,passed:checks.length,scope:realAI?'dedicated loopback HTTP, fictional fixtures, two real DeepSeek calls using existing test-only credential; no browser/phone/public deployment':'dedicated loopback HTTP, fictional fixtures, AI disabled; no browser/phone/real model/network verification',fixtureDirectory:data},null,2)+'\n');
 console.log('H5 acceptance passed: '+checks.length+' groups. '+(realAI?'Two real model calls with fictional fixtures; no production data.':'No production data or model service used.'));
}finally{child.kill();}
