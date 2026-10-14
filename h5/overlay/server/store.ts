import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';

export function dataDirectory(){
 const configured=process.env.H5_DATA_DIR;
 if(configured&&!path.isAbsolute(configured))throw Error('H5_DATA_DIR must be an absolute persistent directory.');
 return configured||path.resolve(process.cwd(),'data');
}
let connection:DatabaseSync|undefined;
export function openDatabase(create=false){
 if(connection)return connection;
 const directory=dataDirectory(),file=path.join(directory,'life-rpg.sqlite');
 if(!create&&!existsSync(file))throw Error('Run h5:init before starting this application.');
 mkdirSync(directory,{recursive:true,mode:0o700});
 const db=new DatabaseSync(file);db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 connection=db;return db;
}
export function databaseReady(){
 const db=openDatabase();
 if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='h5_sessions'").get())throw Error('H5 database is not initialized.');
 return db;
}
type Value=string|number|null|Uint8Array;
class Prepared {
 private sql:string;
 private values:Value[];
 constructor(sql:string,values:Value[]=[]){this.sql=sql;this.values=values;}
 bind(...values:Value[]){return new Prepared(this.sql,values);}
 execute(){const result=databaseReady().prepare(this.sql).run(...this.values);return{success:true,meta:{changes:Number(result.changes)}};}
 async run(){return this.execute();}
 async first<T=Record<string,unknown>>(){return (databaseReady().prepare(this.sql).get(...this.values)??null) as T|null;}
 async all<T=Record<string,unknown>>(){return{success:true,results:databaseReady().prepare(this.sql).all(...this.values) as T[]};}
}
export const d1={
 prepare(sql:string){return new Prepared(sql);},
 async batch(statements:Prepared[]){
  const db=databaseReady();db.exec('BEGIN IMMEDIATE');
  try{const result=statements.map(statement=>statement.execute());db.exec('COMMIT');return result;}
  catch(error){db.exec('ROLLBACK');throw error;}
 }
};
