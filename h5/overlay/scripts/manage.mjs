import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {openDatabase} from '../server/store.ts';
const [command,...args]=process.argv.slice(2);
const hash=value=>createHash('sha256').update(value).digest('hex');
function outputFile(){const name=args[args.indexOf('--out')+1];if(!args.includes('--out')||!name||!path.isAbsolute(name))throw Error('Specify --out with an absolute private file path.');return name;}
try{
 const db=openDatabase(command==='init');
 if(command==='init'){
  const journal=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='h5_migrations'").get();
  if(!journal&&db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get())throw Error('Existing database has no H5 migration journal. Refusing to change it.');
  db.exec('CREATE TABLE IF NOT EXISTS h5_migrations(name TEXT PRIMARY KEY, sha256 TEXT NOT NULL)');
  const folder=path.resolve('drizzle');
  for(const name of (await readdir(folder)).filter(x=>/^\d{4}_.+\.sql$/.test(x)).sort()){
   const sql=await readFile(path.join(folder,name),'utf8'),checksum=hash(sql),previous=db.prepare('SELECT sha256 FROM h5_migrations WHERE name=?').get(name);
   if(previous){if(previous.sha256!==checksum)throw Error('Previously applied migration was changed: '+name);continue;}
   db.exec('BEGIN IMMEDIATE');
   try{db.exec(sql);db.prepare('INSERT INTO h5_migrations(name,sha256) VALUES(?,?)').run(name,checksum);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
  }
  db.exec(`CREATE TABLE IF NOT EXISTS h5_accounts(id TEXT PRIMARY KEY,code_hash TEXT NOT NULL UNIQUE,disabled INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS h5_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES h5_accounts(id),expires_at INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS h5_sessions_user_idx ON h5_sessions(user_id);
   CREATE TABLE IF NOT EXISTS h5_access_attempts(hour INTEGER PRIMARY KEY,n INTEGER NOT NULL);`);
  console.log('Initialized H5 database. Existing saves are preserved.');
 }else if(command==='invite'){
  const target=outputFile(),id='trial_'+randomUUID(),code='rpg_'+randomBytes(24).toString('hex');
  // Never log an invitation credential. Deliver the private file to its intended recipient separately.
  await writeFile(target,JSON.stringify({accountId:id,invitationCode:code,notice:'Each invitation is a private account credential. Do not share or commit.'},null,2)+'\n',{flag:'wx',mode:0o600});
  try{db.prepare('INSERT INTO h5_accounts(id,code_hash,created_at) VALUES(?,?,?)').run(id,hash(code),Date.now());}catch(error){throw Error('Account creation failed. The private output file must not be distributed.');}
  console.log('Created account '+id+'. Credential written to the requested private file.');
 }else if(command==='revoke'){
  const id=args[0];if(!/^trial_[a-f0-9-]{36}$/.test(id||''))throw Error('Specify a valid trial account ID.');
  db.exec('BEGIN IMMEDIATE');try{const result=db.prepare('UPDATE h5_accounts SET disabled=1 WHERE id=?').run(id);db.prepare('DELETE FROM h5_sessions WHERE user_id=?').run(id);db.exec('COMMIT');console.log('Disabled accounts: '+Number(result.changes)+'. Saves were retained.');}catch(error){db.exec('ROLLBACK');throw error;}
 }else if(command==='feedback'){
  const target=outputFile(),rows=db.prepare('SELECT id,user_id,category,helpful,step,message,version,created_at FROM feedback WHERE created_at>=? ORDER BY created_at DESC').all(new Date(Date.now()-90*86400000).toISOString());
  await writeFile(target,JSON.stringify(rows,null,2)+'\n',{flag:'wx',mode:0o600});console.log('Feedback exported to the requested private file.');
 }else throw Error('Commands: init | invite --out ABSOLUTE_PRIVATE_FILE | revoke ACCOUNT_ID | feedback --out ABSOLUTE_PRIVATE_FILE');
}catch(error){console.error(error.message);process.exitCode=1;}
