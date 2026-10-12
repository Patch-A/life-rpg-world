import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { database } from '@/db';
import { authenticatedUser } from '@/lib/identity';
import { normalizeGame,day,progress,type Game } from '@/lib/game';
import { ageAt } from '@/lib/birthday';
import { generateActions,ModelError } from '@/lib/ai/deepseek';
import { boundedBody,noStore,RequestError } from '@/lib/request-guard';
import type { AgentRun } from '@/lib/agent-contract';
export const dynamic='force-dynamic';
const input=z.object({requestId:z.string().uuid(),mode:z.enum(['plan','review']),goalId:z.string().max(80).default(''),newGoal:z.object({title:z.string().trim().min(1).max(80),domain:z.enum(['mind','career']),successCriteria:z.string().trim().min(1).max(300),target:z.number().int().min(1).max(100000)}).optional(),minutes:z.number().int().min(1).max(120),obstacle:z.string().trim().max(400),consent:z.literal(true),adult:z.literal(true)});
const limit=(v:string|undefined,fallback:number)=>{const n=Number(v);return Number.isInteger(n)&&n>0?Math.min(n,10000):fallback;};
const cutoff=()=>new Date(Date.now()-30*86400000).toISOString();
export async function GET(req:Request){
 const uid=authenticatedUser(req);if(!uid)return noStore({error:'请登录后使用行动助手'},401);
 try{const db=database();const usage=await db.prepare('SELECT COUNT(*) AS n FROM agent_runs WHERE user_id=? AND date=?').bind(uid,day()).first<{n:number}>();const dailyLimit=limit(env.AI_USER_DAILY_LIMIT,10);
 const id=new URL(req.url).searchParams.get('id');if(id){const row=await db.prepare("SELECT result,status FROM agent_runs WHERE id=? AND user_id=? AND created_at>=?").bind(id,uid,cutoff()).first<{result:string;status:string}>();if(!row)return noStore({error:'草案不存在、已过期或无权访问'},404);return noStore({status:row.status,run:row.result?JSON.parse(row.result):null});}
 return noStore({available:!!env.DEEPSEEK_API_KEY&&env.AI_ENABLED!=='false',model:env.DEEPSEEK_MODEL||'deepseek-flash',remaining:Math.max(0,dailyLimit-(usage?.n||0)),dailyLimit});
 }catch{return noStore({error:'行动助手暂时无法加载，请重试'},503);}
}
export async function POST(req:Request){
 const uid=authenticatedUser(req);if(!uid)return noStore({error:'请登录后使用行动助手'},401);
 let runId='';try{
 const raw=await boundedBody(req);const checked=input.safeParse(raw);if(!checked.success)throw new RequestError('请填写目标、时间，并确认成年试用与AI数据说明');const a=checked.data;
 if(!env.DEEPSEEK_API_KEY||env.AI_ENABLED==='false')return noStore({error:'AI服务尚未启用，请使用手动行动；也可以从反馈入口联系维护者。'},503);
 const db=database();const saved=await db.prepare('SELECT data FROM saves WHERE user_id=?').bind(uid).first<{data:string}>();if(!saved)throw new RequestError('请先创建角色');const state=normalizeGame(JSON.parse(saved.data) as Game);if(!state.profile)throw new RequestError('请先创建角色');if(state.profile.birth&&ageAt(state.profile.birth,day())<18)throw new RequestError('当前AI试用面向成年人；手动记录仍可使用',403);
 const previous=await db.prepare('SELECT user_id,result,status FROM agent_runs WHERE id=?').bind(a.requestId).first<{user_id:string;result:string;status:string}>();if(previous){if(previous.user_id!==uid)return noStore({error:'请求标识无效'},409);return previous.status==='complete'?noStore({run:JSON.parse(previous.result)}):noStore({error:'这次请求已经处理，请查看已有草案或发起一次新请求。'},409);}
 const goal=a.goalId?state.goals.find(g=>g.id===a.goalId):undefined;if(a.goalId&&!goal)throw new RequestError('所选目标不存在');if(!goal&&!a.newGoal)throw new RequestError('请选择或填写目标');if(goal&&(goal.paused||goal.completionChoice||goal.confirmedAt))throw new RequestError('请选择仍在推进的目标');if(goal&&!['mind','career'].includes(goal.domain))throw new RequestError('首版AI支持学习、创作与个人项目目标，其他方向可手动记录');
 if(a.mode==='review'&&!goal)throw new RequestError('请先选择已有目标，再复盘');
 const records=goal?state.logs.filter(l=>!l.undone&&l.goalId===goal.id).sort((x,y)=>y.date.localeCompare(x.date)||y.at.localeCompare(x.at)).slice(0,12).map(l=>({id:l.id,title:l.title,date:l.date,value:l.value,unit:l.unit,note:(l.note||'').slice(0,350)})):[];
 if(a.mode==='review'&&!records.length)throw new RequestError('这个目标还没有行动记录。先记录真实行动，再做复盘。');
 // One SQL insert reserves both per-user and site quotas atomically, including in-flight calls.
 const createdAt=new Date().toISOString();const reservation=await db.prepare("INSERT INTO agent_runs(id,user_id,date,goal_id,status,result,created_at) SELECT ?,?,?,?,'pending','',? WHERE (SELECT COUNT(*) FROM agent_runs WHERE user_id=? AND date=?)<? AND (SELECT COUNT(*) FROM agent_runs WHERE date=?)<? AND NOT EXISTS(SELECT 1 FROM agent_runs WHERE user_id=? AND status='pending' AND created_at>?)").bind(a.requestId,uid,day(),goal?.id||'',createdAt,uid,day(),limit(env.AI_USER_DAILY_LIMIT,10),day(),limit(env.AI_SITE_DAILY_LIMIT,100),uid,new Date(Date.now()-90000).toISOString()).run();
 if(!reservation.meta.changes)return noStore({error:'已有建议正在生成，或今日AI次数已用完。请稍后再试，手动记录仍可使用。'},429);runId=a.requestId;
 const model=env.DEEPSEEK_MODEL||'deepseek-flash';const goalContext=goal?{title:goal.title,successCriteria:goal.successCriteria||'按用户设置的累计目标',target:goal.target,unit:goal.unit,progress:progress(state,goal)}:{...a.newGoal,unit:'分钟',progress:0};
 const result=await generateActions(env.DEEPSEEK_API_KEY,model,{mode:a.mode,goal:goalContext,availableMinutes:a.minutes,obstacle:a.obstacle,records},a.minutes,new Set(records.map(l=>l.id)));
 if(a.mode==='review'&&!result.sourceLogIds.length)throw new ModelError('复盘未引用实际记录，本次没有保存，请重试。');
 const run:AgentRun={id:a.requestId,mode:a.mode,goalId:goal?.id||'',...(!goal?{newGoal:{...a.newGoal!,unit:'分钟' as const}}:{}),result,createdAt,model};
 await db.prepare("UPDATE agent_runs SET status='complete',result=? WHERE id=? AND user_id=?").bind(JSON.stringify(run),a.requestId,uid).run();
 // Expired proposals are inaccessible; bounded lazy cleanup avoids unbounded maintenance writes.
 await db.prepare('DELETE FROM agent_runs WHERE id IN (SELECT id FROM agent_runs WHERE created_at<? LIMIT 100)').bind(cutoff()).run();
 return noStore({run});
 }catch(e){if(runId)try{await database().prepare("UPDATE agent_runs SET status='failed' WHERE id=? AND user_id=?").bind(runId,uid).run();}catch{}
 if(e instanceof RequestError||e instanceof ModelError)return noStore({error:e.message},e.status);console.error('agent operation failed');return noStore({error:'建议暂时未能保存，本次没有改动存档。请稍后重试。'},503);}
}
export async function DELETE(req:Request){const uid=authenticatedUser(req);if(!uid)return noStore({error:'请登录后删除草案'},401);try{const a=z.object({id:z.string().uuid()}).parse(await boundedBody(req));await database().prepare('DELETE FROM agent_runs WHERE id=? AND user_id=? AND status!=?').bind(a.id,uid,'pending').run();return noStore({deleted:true});}catch(e){return noStore({error:e instanceof RequestError?e.message:'草案删除未完成'},e instanceof RequestError?e.status:400);}}
