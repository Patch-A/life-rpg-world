import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { database } from '@/db';
import { authenticatedUser } from '@/lib/identity';
import { normalizeGame,day,type Game } from '@/lib/game';
import { ageAt } from '@/lib/birthday';
import { generateChat,ModelError } from '@/lib/ai/deepseek';
import { resolveProvider } from '@/lib/ai/provider';
import { sanitizeChatResult,type ChatResult } from '@/lib/ai/chat-contract';
import { buildChatContext } from '@/lib/chat-context';
import { boundedBody,noStore,RequestError } from '@/lib/request-guard';
import { canSummonMonster } from '@/lib/monsters';
export const dynamic='force-dynamic';
// prevPosture 仍保留在契约里以兼容前端，但已不采信：服务端从存档推算。
const input=z.object({requestId:z.string().uuid(),userText:z.string().trim().min(1).max(1000),prevPosture:z.enum(['companion','counselor']),switchConsent:z.boolean(),consent:z.literal(true),adult:z.literal(true)});
const limit=(v:string|undefined,fallback:number)=>{const n=Number(v);return Number.isInteger(n)&&n>0?Math.min(n,10000):fallback;};
const NO_MODEL='还没有配置模型。把 API Key 填进环境变量后就能聊了，手动记录不受影响。';
const cutoff=()=>new Date(Date.now()-30*86400000).toISOString();
export type ChatRun={id:string;reply:ChatResult;createdAt:string};
export async function POST(req:Request){
 const uid=authenticatedUser(req);if(!uid)return noStore({error:'请登录后使用记录官'},401);
 let runId='';try{
 const raw=await boundedBody(req);const checked=input.safeParse(raw);if(!checked.success)throw new RequestError('请填写要说的话，并确认成年试用与AI数据说明');const a=checked.data;
 if(env.AI_ENABLED==='false')return noStore({error:'AI服务尚未启用，请使用手动记录；也可以从反馈入口联系维护者。'},503);
 const provider=resolveProvider(env,'deepseek-chat');if(!provider)return noStore({error:NO_MODEL},503);
 const db=database();const saved=await db.prepare('SELECT data FROM saves WHERE user_id=?').bind(uid).first<{data:string}>();if(!saved)throw new RequestError('请先创建角色');const state=normalizeGame(JSON.parse(saved.data) as Game);if(!state.profile)throw new RequestError('请先创建角色');
 if(state.profile.birth&&ageAt(state.profile.birth,day())<18)throw new RequestError('当前AI试用面向成年人；手动记录仍可使用',403);
 const previous=await db.prepare("SELECT user_id,result,status FROM agent_runs WHERE id=? AND goal_id='__chat__' AND created_at>=?").bind(a.requestId,cutoff()).first<{user_id:string;result:string;status:string}>();if(previous){if(previous.user_id!==uid)return noStore({error:'请求标识无效'},409);return previous.status==='complete'?noStore({run:JSON.parse(previous.result)}):noStore({error:'这次对话已经处理，请查看已有回复或发起一次新请求。'},409);}
 // 同一个 id 若已属于行动助手的草案，绝不能当聊天结果回放；过期的旧聊天行占着主键，先清掉再写入。
 const clash=await db.prepare('SELECT user_id,goal_id FROM agent_runs WHERE id=?').bind(a.requestId).first<{user_id:string;goal_id:string}>();if(clash){if(clash.user_id!==uid||clash.goal_id!=='__chat__')return noStore({error:'请求标识无效'},409);await db.prepare("DELETE FROM agent_runs WHERE id=? AND user_id=? AND goal_id='__chat__' AND created_at<?").bind(a.requestId,uid,cutoff()).run();}
 // 姿态与切换同意只能由存档证据决定：上一轮 assistant 说了什么、有没有真的问过。
 // 客户端谎报 prevPosture 或直接发 switchConsent:true 都不能提前进入咨询师。
 const lastAssistant=[...state.chat].reverse().find(t=>t.role==='assistant');
 const prevPosture=lastAssistant?.posture==='counselor'?'counselor':'companion';
 const switchConsent=a.switchConsent===true&&lastAssistant?.askSwitch===true;
 // 聊天行用 goal_id='__chat__' 标记，与 /api/agent 的真实目标行互不占额度（agent 侧反向过滤同一标记）。
 // One SQL insert reserves both per-user and site chat quotas atomically, including in-flight calls.
 const createdAt=new Date().toISOString();const reservation=await db.prepare("INSERT INTO agent_runs(id,user_id,date,goal_id,status,result,created_at) SELECT ?,?,?,'__chat__','pending','',? WHERE (SELECT COUNT(*) FROM agent_runs WHERE user_id=? AND date=? AND goal_id='__chat__')<? AND (SELECT COUNT(*) FROM agent_runs WHERE date=? AND goal_id='__chat__')<? AND NOT EXISTS(SELECT 1 FROM agent_runs WHERE user_id=? AND goal_id='__chat__' AND status='pending' AND created_at>?)").bind(a.requestId,uid,day(),createdAt,uid,day(),limit(env.AI_CHAT_USER_DAILY_LIMIT,50),day(),limit(env.AI_CHAT_SITE_DAILY_LIMIT,500),uid,new Date(Date.now()-90000).toISOString()).run();
 if(!reservation.meta.changes)return noStore({error:'已有回复正在生成，或今日聊天次数已用完。请稍后再试，手动记录仍可使用。'},429);runId=a.requestId;
 const context=buildChatContext(state,{userText:a.userText,prevPosture,switchConsent});
 // generateChat only parses the schema; sanitize is what enforces "records must quote the user" and "no counselor upgrade without a nod".
 const generated=await generateChat(provider.key,provider.model,context,provider.baseUrl);
 const sanitized=sanitizeChatResult(generated,a.userText,prevPosture,switchConsent);
 // askSwitch=false means we never asked; drop any stale "switch" button the model volunteered.
 const reply:ChatResult=sanitized.askSwitch?sanitized:{...sanitized,quickReplies:sanitized.quickReplies.filter(q=>q.kind!=='accept-switch')};
 // 怪兽提议只在「还放得下」时才交给前端。上限 3 只是产品规则，不能让用户看到
 // 一个点了必然失败的按钮——所以在这里拦，而不是等 reducer 抛错。
 // 心情信号没有活跃怪兽时直接丢掉：它只为怪兽服务，不进任何统计（见 spec 1.4）。
 const guarded:ChatResult=canSummonMonster(state)?reply:{...reply,monster:null};
 const run:ChatRun={id:a.requestId,reply:guarded,createdAt};
 await db.prepare("UPDATE agent_runs SET status='complete',result=? WHERE id=? AND user_id=?").bind(JSON.stringify(run),a.requestId,uid).run();
 // Expired rows are inaccessible; bounded lazy cleanup avoids unbounded maintenance writes.
 // 清理是尽力而为：它失败不能让已经完整保存的回复变成 failed。
 try{await db.prepare('DELETE FROM agent_runs WHERE id IN (SELECT id FROM agent_runs WHERE created_at<? LIMIT 100)').bind(cutoff()).run();}catch{}
 return noStore({run});
 }catch(e){if(runId)try{await database().prepare("UPDATE agent_runs SET status='failed' WHERE id=? AND user_id=?").bind(runId,uid).run();}catch{}
 if(e instanceof RequestError||e instanceof ModelError)return noStore({error:e.message},e.status);console.error('chat operation failed');return noStore({error:'回复暂时未能保存，本次没有改动存档。请稍后重试。'},503);}
}
