import {randomBytes} from 'node:crypto';
import {authenticatedUser,digest,sessionCookie} from '@/lib/identity';
import {databaseReady} from '@/server/store';
import {boundedBody,noStore,RequestError} from '@/lib/request-guard';
export const dynamic='force-dynamic';
export const runtime='nodejs';
function siteOrigin(){
 const configured=process.env.APP_ORIGIN;
 if(!configured)throw new RequestError('维护者尚未配置访问地址，请联系维护者。',503);
 const url=new URL(configured);
 if(url.origin!==configured||url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new RequestError('访问地址配置无效。',503);
 return url;
}
function guard(req:Request){const origin=siteOrigin();if(new URL(req.url).origin!==origin.origin||req.headers.get('origin')!==origin.origin)throw new RequestError('请求来源无效，请从正式入口重试。',403);return origin;}
function cookie(token:string,seconds:number){return `${sessionCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${siteOrigin().protocol==='https:'?'; Secure':''}`;}
export async function GET(req:Request){return noStore({authenticated:!!authenticatedUser(req),aiEnabled:process.env.AI_ENABLED==='true'&&!!process.env.DEEPSEEK_API_KEY});}
export async function POST(req:Request){
 try{
  guard(req);const body=await boundedBody(req,1000);
  if(!body||typeof body.code!=='string'||!/^rpg_[a-f0-9]{48}$/.test(body.code.trim()))throw new RequestError('邀请码无效，请检查后重试。',401);
  const db=databaseReady(),now=Date.now(),hour=Math.floor(now/3600000);
  // Global attempts are persisted, bounded and atomic. No IP headers or raw codes are stored.
  const attempt=db.prepare('INSERT INTO h5_access_attempts(hour,n) VALUES(?,1) ON CONFLICT(hour) DO UPDATE SET n=n+1 WHERE n<300 RETURNING n').get(hour);
  if(!attempt)throw new RequestError('登录尝试较多，请稍后再试。',429);
  const account=db.prepare('SELECT id FROM h5_accounts WHERE code_hash=? AND disabled=0').get(digest(body.code.trim())) as {id:string}|undefined;
  if(!account)throw new RequestError('邀请码无效或已停用，请联系维护者。',401);
  const token='h5_'+randomBytes(32).toString('hex'),seconds=7*86400;
  db.prepare('DELETE FROM h5_sessions WHERE expires_at<=?').run(now);
  db.prepare('DELETE FROM h5_access_attempts WHERE hour<?').run(hour-24);
  db.prepare('INSERT INTO h5_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(digest(token),account.id,now+seconds*1000);
  return Response.json({authenticated:true},{headers:{'Cache-Control':'no-store','Set-Cookie':cookie(token,seconds)}});
 }catch(error){return noStore({error:error instanceof RequestError?error.message:'登录暂不可用，请联系维护者。'},error instanceof RequestError?error.status:503);}
}
export async function DELETE(req:Request){
 try{guard(req);const token=req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1);if(token)databaseReady().prepare('DELETE FROM h5_sessions WHERE token_hash=?').run(digest(token));return Response.json({authenticated:false},{headers:{'Cache-Control':'no-store','Set-Cookie':cookie('',0)}});}
 catch(error){return noStore({error:error instanceof RequestError?error.message:'退出未完成，请重试。'},error instanceof RequestError?error.status:503);}
}
