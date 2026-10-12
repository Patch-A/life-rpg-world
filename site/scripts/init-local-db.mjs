// Fallback for Windows when Wrangler's local migration subprocess crashes.
// Stop the dev server first. This touches only this checkout's local SQLite file.
import {readdirSync,readFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const root=realpathSync(new URL('../',import.meta.url));
const folder=path.join(root,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const files=readdirSync(folder).filter(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite');
if(files.length!==1)throw Error('Start and stop the local preview once; exactly one local D1 file is required.');
const target=realpathSync(path.join(folder,files[0]));if(!target.startsWith(root+path.sep))throw Error('Local database path is outside checkout.');
const db=new DatabaseSync(target);
try{
 const existing=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
 if(existing.some(t=>t.name==='saves')&&!existing.some(t=>t.name==='_local_migration_journal'))throw Error('Existing local database has no fallback migration history; inspect it instead of reapplying migrations.');
 db.exec('CREATE TABLE IF NOT EXISTS _local_migration_journal(name TEXT PRIMARY KEY)');
 for(const file of readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort()){
  if(db.prepare('SELECT name FROM _local_migration_journal WHERE name=?').get(file))continue;
  db.exec('BEGIN');try{db.exec(readFileSync(path.join(root,'drizzle',file),'utf8'));db.prepare('INSERT INTO _local_migration_journal(name) VALUES(?)').run(file);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 }
 console.log('Local preview migrations applied. No hosted data touched.');
}finally{db.close();}
