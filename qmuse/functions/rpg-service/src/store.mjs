import {createHash} from 'node:crypto';
export const hash=value=>createHash('sha256').update(value).digest('hex');
// QMuse integer range queries reject millisecond epochs; persist/query epoch seconds.
// Keep readers compatible with a historical millisecond value without rewriting any row.
const seconds=value=>Math.floor(value/1000);
const milliseconds=value=>value<100000000000?value*1000:value;
export function createStore(tables,databaseId,Query){
 const list=async(tableId,queries)=>tables.listRows({databaseId,tableId,queries});
 const get=async(tableId,rowId)=>{try{return await tables.getRow({databaseId,tableId,rowId});}catch(error){if(Number(error.code)===404)return null;throw error;}};
 const create=(tableId,rowId,data)=>tables.createRow({databaseId,tableId,rowId,data,permissions:[]});
 const remove=(tableId,rowId)=>tables.deleteRow({databaseId,tableId,rowId});
 const own=async(table,id,ownerKey)=>{const row=await get(table,id);return row?.ownerKey===ownerKey?row:null;};
 return {
  async snapshot(ownerKey){const rows=await list('rpg_snapshots',[Query.equal('ownerKey',[ownerKey]),Query.orderDesc('revision'),Query.limit(1)]);const row=rows.rows[0];return row?{state:JSON.parse(row.payload),revision:row.revision}:null;},
  async save(ownerKey,revision,state){
   const payload=JSON.stringify(state);if(Buffer.byteLength(payload)>900000)throw Object.assign(Error('存档已接近本次试用空间上限，请先导出并反馈。'),{status:413});
   try{await create('rpg_snapshots',hash(ownerKey+':'+revision).slice(0,36),{ownerKey,revision,payload});}catch(error){if(Number(error.code)===409)throw Object.assign(Error('另一个页面已更新进度，请重新加载。'),{status:409});throw error;}
   const old=await list('rpg_snapshots',[Query.equal('ownerKey',[ownerKey]),Query.lessThan('revision',Math.max(0,revision-4)),Query.limit(10)]);
   for(const row of old.rows)await remove('rpg_snapshots',row.$id).catch(()=>{});
   return {state,revision};
  },
  async proposal(id,ownerKey){const row=await own('rpg_proposals',id,ownerKey);return row?{...row,createdAt:milliseconds(row.createdAt)}:null;},
  async reserveProposal(id,data){try{await create('rpg_proposals',id,{...data,payload:data.payload||'null',createdAt:seconds(data.createdAt)});return true;}catch(error){if(Number(error.code)===409)return false;throw error;}},
  updateProposal:(id,data)=>tables.updateRow({databaseId,tableId:'rpg_proposals',rowId:id,data}),
  removeProposal:async(id,ownerKey)=>{if(await own('rpg_proposals',id,ownerKey))await remove('rpg_proposals',id);},
  async feedback(ownerKey){const cutoff=Date.now()-90*86400000;const rows=await list('rpg_feedback',[Query.equal('ownerKey',[ownerKey]),Query.greaterThanEqual('createdAt',seconds(cutoff)),Query.orderDesc('createdAt'),Query.limit(20)]);return rows.rows.filter(row=>milliseconds(row.createdAt)>=cutoff).map(row=>JSON.parse(row.payload));},
  async addFeedback(id,ownerKey,payload){if(await own('rpg_feedback',id,ownerKey))return false;const count=await list('rpg_feedback',[Query.equal('ownerKey',[ownerKey]),Query.greaterThanEqual('createdAt',seconds(Date.now()-86400000)),Query.limit(1)]);if(count.total>=10)throw Object.assign(Error('今日反馈次数已达上限，请明天再试。'),{status:429});try{await create('rpg_feedback',id,{ownerKey,payload:JSON.stringify(payload),createdAt:seconds(Date.now())});return true;}catch(error){if(Number(error.code)===409){if(await own('rpg_feedback',id,ownerKey))return false;throw Object.assign(Error('反馈标识冲突，请重新打开后重试。'),{status:409});}throw error;}},
  removeFeedback:async(id,ownerKey)=>{if(await own('rpg_feedback',id,ownerKey))await remove('rpg_feedback',id);},
  async erase(ownerKey){for(const tableId of ['rpg_snapshots','rpg_proposals','rpg_feedback']){const rows=await list(tableId,[Query.equal('ownerKey',[ownerKey]),Query.limit(100)]);for(const row of rows.rows)await remove(tableId,row.$id);if(rows.total>rows.rows.length)return false;}return true;},
  async count(scope){return (await list('rpg_quota_slots',[Query.equal('scope',[scope]),Query.limit(1)])).total;},
  async slot(scope,index,expiresAt){try{await create('rpg_quota_slots',hash(scope+':'+index).slice(0,36),{scope,expiresAt:seconds(expiresAt)});return true;}catch(error){if(Number(error.code)===409)return false;throw error;}},
  async purge(now){for(const [tableId,column,cutoff] of [['rpg_quota_slots','expiresAt',now],['rpg_proposals','createdAt',now-30*86400000],['rpg_feedback','createdAt',now-90*86400000]]){const rows=await list(tableId,[Query.lessThan(column,seconds(cutoff)),Query.limit(20)]);for(const row of rows.rows)await remove(tableId,row.$id).catch(()=>{});}},
 };
}
