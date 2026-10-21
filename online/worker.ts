import {env} from 'cloudflare:workers';
import {withIdentity} from '@/lib/identity';
import {noStore,boundedBody,RequestError} from '@/lib/request-guard';
import * as game from '@/app/api/game/route';
import * as agent from '@/app/api/agent/route';
import * as feedback from '@/app/api/feedback/route';
const cookieName='life_rpg_visitor';
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const cookie=(value:string,seconds:number,secure:boolean)=>`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure?'; Secure':''}`;
function token(req:Request){return req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';}
async function visitor(req:Request){
 const value=token(req);if(!/^[a-f0-9]{64}$/.test(value))return null;
 const row=await env.DB.prepare('SELECT user_id FROM online_visitors WHERE token_hash=? AND expires_at>?').bind(await hash(value),Date.now()).first<{user_id:string}>();
 return row?.user_id||null;
}
async function access(req:Request){
 const uid=await visitor(req),secure=new URL(req.url).protocol==='https:';
 if(req.method==='GET')return noStore({authenticated:!!uid,aiEnabled:env.AI_ENABLED==='true'&&!!env.DEEPSEEK_API_KEY,photosEnabled:false,dailyLimit:3,siteDailyLimit:20});
 const body=await boundedBody(req,1000);
 if(req.method==='POST'){
  if(uid)return noStore({authenticated:true});
  if(body?.consent!==true)throw new RequestError('请先阅读并同意本次访客试用说明');
  const hour=Math.floor(Date.now()/3600000);
  const id='visitor_'+crypto.randomUUID(),raw=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const result=await env.DB.prepare('INSERT INTO online_visitors(token_hash,user_id,expires_at,created_hour) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM online_visitors WHERE created_hour=?)<60 AND (SELECT COUNT(*) FROM online_visitors)<3000').bind(await hash(raw),id,Date.now()+30*86400000,hour,hour).run();
  if(!result.meta.changes)return noStore({error:'当前访客人数已达试用上限，请稍后再来。'},429);
  return Response.json({authenticated:true},{headers:{'Cache-Control':'no-store','Set-Cookie':cookie(raw,30*86400,secure)}});
 }
 if(req.method==='DELETE'){
  if(body?.confirm!==true)throw new RequestError('请明确确认操作');
  if(uid){
   if(body.erase===true)await env.DB.batch([
    env.DB.prepare('DELETE FROM saves WHERE user_id=?').bind(uid),
    env.DB.prepare('DELETE FROM agent_runs WHERE user_id=?').bind(uid),
    env.DB.prepare('DELETE FROM feedback WHERE user_id=?').bind(uid),
    // Keep only the random internal ID in today's non-refundable budget ledger.
    env.DB.prepare('DELETE FROM online_visitors WHERE user_id=?').bind(uid)
   ]);
   else await env.DB.prepare('DELETE FROM online_visitors WHERE user_id=?').bind(uid).run();
  }
  return Response.json({authenticated:false},{headers:{'Cache-Control':'no-store','Set-Cookie':cookie('',0,secure)}});
 }
 return noStore({error:'不支持此操作'},405);
}
const routes:Record<string,Record<string,(r:Request)=>Promise<Response>>>={'/api/game':game,'/api/agent':agent,'/api/feedback':feedback};
export default {async fetch(request:Request){
 const url=new URL(request.url);
 try{
  if(url.pathname.startsWith('/api/')){
   if(!['GET','POST','DELETE'].includes(request.method))return noStore({error:'不支持此操作'},405);
   if(request.method!=='GET'&&request.headers.get('origin')!==url.origin)return noStore({error:'请求来源无效'},403);
   if(url.pathname==='/api/access')return await access(request);
   const uid=await visitor(request);if(!uid)return noStore({error:'请先开启自己的访客星球'},401);
   if(url.pathname==='/api/photos')return request.method==='GET'?noStore({photos:[]}):noStore({error:'免费投稿版暂不提供照片上传，请先使用文字记录。原站点照片保留。'},403);
   const handler=routes[url.pathname]?.[request.method];if(!handler)return noStore({error:'接口不存在'},404);
   // Bound bytes before the legacy game route reads text; do not trust length headers.
   let req=request;
   if(url.pathname==='/api/game'&&request.method==='POST'){
    const body=await boundedBody(request,10000);
    req=new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(body)});
   }
   return await withIdentity(req,uid,handler);
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return noStore({error:'不支持此操作'},405);
  const asset=await env.ASSETS.fetch(request);
  const headers=new Headers(asset.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');headers.set('X-Frame-Options','DENY');
  if(asset.headers.get('content-type')?.includes('text/html'))headers.set('Cache-Control','no-cache');
  return new Response(asset.body,{status:asset.status,headers});
 }catch(error){return noStore({error:error instanceof RequestError?error.message:'服务暂不可用，请稍后重试。'},error instanceof RequestError?error.status:503);}
}};
