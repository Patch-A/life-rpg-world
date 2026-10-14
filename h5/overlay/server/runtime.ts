import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {d1,dataDirectory} from './store';
function objectPath(key:string){
 if(!/^[a-f0-9]{64}\/photo_[a-f0-9-]{36}$/.test(key))throw Error('Invalid photo key.');
 return path.join(dataDirectory(),'photos',...key.split('/'));
}
const bucket={
 async get(key:string){try{const bytes=await readFile(objectPath(key));return{body:new Uint8Array(bytes).buffer};}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}},
 async put(key:string,bytes:Uint8Array,_options?:unknown){const target=objectPath(key);await mkdir(path.dirname(target),{recursive:true,mode:0o700});await writeFile(target,bytes,{mode:0o600,flag:'wx'});},
 async delete(key:string){try{await unlink(objectPath(key));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
};
// Values are resolved at runtime and never exposed through NEXT_PUBLIC_*.
export const env={DB:d1,BUCKET:bucket,
 get DEEPSEEK_API_KEY(){return process.env.DEEPSEEK_API_KEY;},
 get DEEPSEEK_MODEL(){return process.env.DEEPSEEK_MODEL;},
 get AI_ENABLED(){return process.env.AI_ENABLED==='true'?'true':'false';},
 get AI_USER_DAILY_LIMIT(){return process.env.AI_USER_DAILY_LIMIT||'5';},
 get AI_SITE_DAILY_LIMIT(){return process.env.AI_SITE_DAILY_LIMIT||'30';}
};
