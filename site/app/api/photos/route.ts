import { env } from 'cloudflare:workers';
import { database } from '@/db';
import { authenticatedUser } from '@/lib/identity';
import {normalizeGame,reduceGame} from '@/lib/game';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers:{'Cache-Control':'no-store'}});
const LIMIT = 2 * 1024 * 1024;
export async function GET(req:Request) {
 const uid=authenticatedUser(req); if(!uid)return json({error:'请登录后查看照片'},401);
 if(new URL(req.url).searchParams.get('list')==='1'){
  try{const rows=await database().prepare('SELECT id,size,created_at,deleted_at FROM photos WHERE user_id=? ORDER BY created_at DESC').bind(uid).all();return json({photos:rows.results});}catch{return json({error:'照片列表暂不可用'},503);}
 }
 const id=new URL(req.url).searchParams.get('id');
 if(!id||!/^photo_[a-f0-9-]{36}$/.test(id))return json({error:'照片不存在'},404);
 try {
  const photo=await database().prepare('SELECT object_key,content_type FROM photos WHERE id=? AND user_id=? AND deleted_at IS NULL').bind(id,uid).first<{object_key:string;content_type:string}>();
  if(!photo)return json({error:'照片不存在'},404);
  const object=await env.BUCKET?.get(photo.object_key);if(!object)return json({error:'照片暂不可用'},404);
  return new Response(object.body,{headers:{'Content-Type':photo.content_type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch(e){console.error('read photo',e);return json({error:'照片暂不可用，请重试'},503);}
}
export async function DELETE(req:Request){
 const uid=authenticatedUser(req);if(!uid)return json({error:'请登录后操作'},401);
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'请求来源无效'},403);
 let body;try{const raw=await req.text();if(raw.length>1000)return json({error:'提交内容过大'},413);body=JSON.parse(raw);}catch{return json({error:'提交格式无效'},400);}
 if(!body||!/^photo_[a-f0-9-]{36}$/.test(body.id)||!Number.isInteger(body.revision)||body.revision<0)return json({error:'提交格式无效'},400);
 try{
  const db=database(),photo=await db.prepare('SELECT object_key,deleted_at FROM photos WHERE id=? AND user_id=?').bind(body.id,uid).first<{object_key:string;deleted_at:string|null}>();if(!photo)return json({error:'照片不存在'},404);
  const row=await db.prepare('SELECT data,revision FROM saves WHERE user_id=?').bind(uid).first<{data:string;revision:number}>();if(!row||row.revision!==body.revision)return json({error:'存档已变化，请重新加载后再删除'},409);
  const state=reduceGame(normalizeGame(JSON.parse(row.data)),{type:'forget-photo',id:body.id}),revision=row.revision+1,encoded=JSON.stringify(state);
  const results=await db.batch([
   db.prepare('UPDATE saves SET data=?,revision=? WHERE user_id=? AND revision=?').bind(encoded,revision,uid,row.revision),
   db.prepare('UPDATE photos SET deleted_at=? WHERE id=? AND user_id=? AND EXISTS(SELECT 1 FROM saves WHERE user_id=? AND revision=? AND data=?)').bind(new Date().toISOString(),body.id,uid,uid,revision,encoded)
  ]);if(!results[0].meta.changes)return json({error:'存档已变化，请重新加载后再删除'},409);
  // Hide and detach first; keep a tombstone so a failed object deletion can be retried.
  if(!env.BUCKET)return json({error:'照片已移出记录，原文件清理尚未成功，请重新加载后重试'},503);
  try{await env.BUCKET.delete(photo.object_key);}catch{return json({error:'照片已移出记录，原文件清理尚未成功，请重新加载后重试'},503);}
  await db.prepare('DELETE FROM photos WHERE id=? AND user_id=? AND deleted_at IS NOT NULL').bind(body.id,uid).run();return json({state,revision});
 }catch(e){console.error('delete photo',e);return json({error:'删除未完成，请重新加载照片列表后重试'},503);}
}
export async function POST(req:Request) {
 const uid=authenticatedUser(req);if(!uid)return json({error:'请登录后上传'},401);
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'请求来源无效'},403);
 if(Number(req.headers.get('content-length'))>LIMIT)return json({error:'照片需小于2MB'},413);
 const type=req.headers.get('content-type')||'';if(!['image/jpeg','image/png','image/webp'].includes(type))return json({error:'请选择JPEG、PNG或WebP照片'},415);
 const reader=req.body?.getReader();if(!reader)return json({error:'没有照片内容'},400);
 let size=0;const chunks:Uint8Array[]=[];
 try {for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>LIMIT){await reader.cancel();return json({error:'照片需小于2MB'},413);}chunks.push(value);}}catch{return json({error:'照片上传中断，请重试'},400);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const match=(type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)||(type==='image/png'&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))||(type==='image/webp'&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP');
 if(!match)return json({error:'照片格式无效，请重新选择'},400);
 const bucket=env.BUCKET;if(!bucket)return json({error:'照片存储暂不可用，请稍后重试'},503);
 let objectKey='';
 try {
  const db=database();const count=await db.prepare('SELECT count(*) AS n FROM photos WHERE user_id=?').bind(uid).first<{n:number}>();if((count?.n||0)>=500)return json({error:'照片空间已满，最多保存500张照片'},400);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(uid));const scope=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const id='photo_'+crypto.randomUUID();objectKey=scope+'/'+id;
  await bucket.put(objectKey,bytes,{httpMetadata:{contentType:type}});
  await db.prepare('INSERT INTO photos(id,user_id,object_key,content_type,size,created_at) VALUES(?,?,?,?,?,?)').bind(id,uid,objectKey,type,size,new Date().toISOString()).run();
  return json({id,url:'/api/photos?id='+id},201);
 }catch(e){if(objectKey)await bucket.delete(objectKey).catch(()=>{});console.error('upload photo',e);return json({error:'上传失败，你的输入已保留，请重试'},503);}
}
