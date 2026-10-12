import { database } from '@/db';
import { blank, reduceGame, normalizeGame } from '@/lib/game';
import { authenticatedUser as user } from '@/lib/identity';
import {candidateSchema,type AgentRun} from '@/lib/agent-contract';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){
 const uid=user(req);if(!uid)return json({error:'请登录后读取存档'},401);
 try{const row=await database().prepare('SELECT data,revision FROM saves WHERE user_id=?').bind(uid).first<{data:string;revision:number}>();return json({state:row?normalizeGame(JSON.parse(row.data)):blank(),revision:row?.revision??0});}catch(e){console.error('load save',e);return json({error:'存档暂时无法加载，请重试'},503);}
}
export async function POST(req:Request){
 const uid=user(req);if(!uid)return json({error:'请登录后保存'},401);
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'请求来源无效'},403);
 if(Number(req.headers.get('content-length'))>10000)return json({error:'提交内容过大'},413);
 let body;try{const raw=await req.text();if(raw.length>10000)return json({error:'提交内容过大'},413);body=JSON.parse(raw);}catch{return json({error:'提交格式无效'},400);}
 if(!body||typeof body!=='object'||!Number.isInteger(body.revision)||body.revision<0||!body.action||typeof body.action.type!=='string')return json({error:'提交格式无效'},400);
 try{
  const db=database();const row=await db.prepare('SELECT data,revision FROM saves WHERE user_id=?').bind(uid).first<{data:string;revision:number}>();
  if(body.action.type==='agent-confirm')return json({error:'请通过草案确认入口保存'},400);
  if(body.action.type==='accept-agent'){
   const state=row?normalizeGame(JSON.parse(row.data)):blank();const requestId=body.action.requestId;
   if(typeof requestId!=='string')return json({error:'草案标识无效'},400);
   if(state.agentAccepts.includes(requestId))return json({state,revision:row?.revision??0});
   const draft=await db.prepare("SELECT result FROM agent_runs WHERE id=? AND user_id=? AND status='complete' AND created_at>=?").bind(requestId,uid,new Date(Date.now()-30*86400000).toISOString()).first<{result:string}>();if(!draft)return json({error:'草案不存在或已过期，请重新生成'},400);
   const run=JSON.parse(draft.result) as AgentRun;let candidate;
   if(body.action.index!==null){const index=body.action.index;if(!Number.isInteger(index)||index<0||index>=run.result.candidates.length)return json({error:'请选择有效的候选行动'},400);const original=run.result.candidates[index];const checked=candidateSchema.safeParse({...original,title:body.action.title??original.title,completionCriteria:body.action.completionCriteria??original.completionCriteria});if(!checked.success)return json({error:'行动名称或完成标准无效'},400);candidate=checked.data;}
   if(!candidate&&run.mode!=='review')return json({error:'请选择一个行动'},400);
   body.action={type:'agent-confirm',clientId:requestId,goalId:run.goalId,newGoal:run.newGoal,candidate,...(run.mode==='review'?{review:{summary:run.result.summary,adjustment:run.result.adjustment,sourceLogIds:run.result.sourceLogIds}}:{})};
  }
  if((row?.revision??0)!==body.revision)return json({error:'另一个页面已更新进度，请重新加载后再试'},409);
  if(body.action.photos!==undefined){const ids=body.action.photos;if(!Array.isArray(ids)||ids.length>3||ids.some((v:unknown)=>typeof v!=='string'))return json({error:'照片信息无效'},400);for(const id of ids){const own=await db.prepare('SELECT id FROM photos WHERE id=? AND user_id=? AND deleted_at IS NULL').bind(id,uid).first();if(!own)return json({error:'照片不存在或无权访问，请重新上传'},400);}}
  let state;try{state=reduceGame(row?normalizeGame(JSON.parse(row.data)):blank(),body.action);}catch(e){return json({error:e instanceof Error?e.message:'操作无效'},400);}
  const revision=body.revision+1;
  const result=row?await db.prepare('UPDATE saves SET data=?,revision=? WHERE user_id=? AND revision=?').bind(JSON.stringify(state),revision,uid,body.revision).run():await db.prepare('INSERT INTO saves(user_id,data,revision) VALUES(?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(uid,JSON.stringify(state),revision).run();
  if(!result.meta.changes)return json({error:'进度已更新，请重新加载'},409);
  return json({state,revision});
 }catch(e){console.error('save game',e);return json({error:'保存未成功，你的输入已保留，请重试'},503);}
}
