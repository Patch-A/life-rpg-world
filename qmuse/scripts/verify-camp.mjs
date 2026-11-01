// In-memory behavioral checks. No cloud calls, user data, or model requests.
import {build} from 'esbuild';
import assert from 'node:assert/strict';
const result=await build({entryPoints:['src/lib/camp.ts','src/lib/game.ts'],bundle:true,write:false,outdir:'unused',platform:'node',format:'esm',plugins:[{name:'domain-assets-only',setup(b){b.onResolve({filter:/asset-urls$/},()=>({path:'asset-urls',namespace:'domain-assets-only'}));b.onLoad({filter:/.*/,namespace:'domain-assets-only'},()=>({contents:'export const assetUrl = name => name;',loader:'js'}));}}]});
const modules={};
for(const file of result.outputFiles){const name=file.path.split(/[\\/]/).at(-1).replace('.js','');modules[name]=await import('data:text/javascript;base64,'+Buffer.from(file.text).toString('base64'));}
const {blank,reduceGame,normalizeGame,xp}=modules.game;
const {campProgress}=modules.camp;
const now=new Date('2026-10-27T08:00:00.000Z');
const base=reduceGame(blank(),{type:'onboard',name:'虚构回归角色',gender:'male',avatarId:'male',focus:'career',goalTitle:'虚构创作',goalTarget:60,goalUnit:'分钟',taskTitle:'虚构一步',taskTarget:10},new Date(now.getTime()-86400000));
const task=base.tasks[0],empty=structuredClone(base);
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name);}
const curious=reduceGame(base,{type:'event',id:'arrival',choice:'一份好奇心'},now);
const courage=reduceGame(base,{type:'event',id:'arrival',choice:'一点勇气'},now);
check('same existing event yields two persistent paths and no XP',()=>{assert.equal(campProgress(curious).path,'curiosity');assert.equal(campProgress(courage).path,'courage');assert.equal(xp(curious),xp(base));assert.equal(xp(courage),xp(base));assert.equal(base.events.length,0);});
check('repeat event cannot claim again',()=>assert.throws(()=>reduceGame(curious,{type:'event',id:'arrival',choice:'一点勇气'},now),/已完成/));
const logAction={type:'log',taskId:task.id,value:10,date:'2026-10-27',note:'虚构行为回归，不是真实使用结果。'};
// Action payload uses the same id as the original record form.
logAction.id=task.id;
const recorded=reduceGame(curious,logAction,new Date(now.getTime()+1000));
check('record after event supplies traceable echo without changing reward rules',()=>{assert.equal(campProgress(recorded).echo.id,recorded.logs[0].id);assert.equal(xp(recorded),30);});
check('serialized original snapshot restores path and echo without migration',()=>{const restored=normalizeGame(JSON.parse(JSON.stringify(recorded)));assert.equal(campProgress(restored).path,'curiosity');assert.equal(campProgress(restored).echo.id,recorded.logs[0].id);assert.deepEqual(restored.goals,recorded.goals);});
const undone=reduceGame(recorded,{type:'undo',id:recorded.logs[0].id},new Date(now.getTime()+2000));
check('undo removes echo and recalculates XP while preserving event',()=>{assert.equal(campProgress(undone).echo,undefined);assert.equal(campProgress(undone).path,'curiosity');assert.equal(xp(undone),0);});
check('pre-event, financial, invalid-time and orphan records do not light camp',()=>{for(const patch of [{at:new Date(now.getTime()-1000).toISOString()},{unit:'元'},{direction:'deposit'},{at:'bad-date'},{taskId:'missing-task'}]){const s=structuredClone(recorded);Object.assign(s.logs[0],patch);assert.equal(campProgress(s).echo,undefined);}});
check('no goals or tasks has a safe empty scene',()=>{empty.goals=[];empty.tasks=[];assert.equal(campProgress(empty).tasks.length,0);assert.equal(campProgress(empty).path,null);});
check('paused goals hide suggested tasks without deleting records',()=>{const paused=reduceGame(curious,{type:'pause',id:task.goalId},now);assert.equal(campProgress(paused).tasks.length,0);assert.equal(paused.events.length,1);});
check('legacy snapshot is not mutated by deriving scene',()=>{const before=JSON.stringify(recorded);campProgress(recorded);assert.equal(JSON.stringify(recorded),before);});
console.log(`${passed} in-memory checks passed. No production cloud persistence claim.`);
