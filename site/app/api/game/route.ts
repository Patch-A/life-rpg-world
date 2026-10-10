import { database } from '@/db';
import { blank, reduceGame, normalizeGame } from '@/lib/game';
import { authenticatedUser as user } from '@/lib/identity';
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
  if((row?.revision??0)!==body.revision)return json({error:'另一个页面已更新进度，请重新加载后再试'},409);
  if(body.action.photos!==undefined){const ids=body.action.photos;if(!Array.isArray(ids)||ids.length>3||ids.some((v:unknown)=>typeof v!=='string'))return json({error:'照片信息无效'},400);for(const id of ids){const own=await db.prepare('SELECT id FROM photos WHERE id=? AND user_id=? AND deleted_at IS NULL').bind(id,uid).first();if(!own)return json({error:'照片不存在或无权访问，请重新上传'},400);}}
  let state;try{state=reduceGame(row?normalizeGame(JSON.parse(row.data)):blank(),body.action);}catch(e){return json({error:e instanceof Error?e.message:'操作无效'},400);}
  const revision=body.revision+1;
  const result=row?await db.prepare('UPDATE saves SET data=?,revision=? WHERE user_id=? AND revision=?').bind(JSON.stringify(state),revision,uid,body.revision).run():await db.prepare('INSERT INTO saves(user_id,data,revision) VALUES(?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(uid,JSON.stringify(state),revision).run();
  if(!result.meta.changes)return json({error:'进度已更新，请重新加载'},409);
  return json({state,revision});
 }catch(e){console.error('save game',e);return json({error:'保存未成功，你的输入已保留，请重试'},503);}
}
