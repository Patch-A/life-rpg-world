import {createHash} from 'node:crypto';
import {databaseReady} from '@/server/store';
export const sessionCookie='life_rpg_session';
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function authenticatedUser(req:Request){
 const match=req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(sessionCookie+'='));
 const token=match?.slice(sessionCookie.length+1);
 if(!token||!/^h5_[a-f0-9]{64}$/.test(token))return null;
 try{
  const row=databaseReady().prepare('SELECT s.user_id FROM h5_sessions s JOIN h5_accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND a.disabled=0').get(digest(token),Date.now()) as {user_id:string}|undefined;
  return row?.user_id??null;
 }catch{return null;}
}
