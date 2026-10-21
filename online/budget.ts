// Separate non-refundable ledger: deleting a proposal must never refund calls.
export async function reserveBudget(db:any,user:string,date:string,id:string){
 const minute=Math.floor(Date.now()/60000);
 const result=await db.prepare(`INSERT INTO online_ai_budget(id,user_id,date,minute)
 SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM online_ai_budget WHERE date=?)<20
 AND (SELECT COUNT(*) FROM online_ai_budget WHERE user_id=? AND date=?)<3
 AND (SELECT COUNT(*) FROM online_ai_budget WHERE minute=?)<5
 AND (SELECT COUNT(*) FROM online_ai_budget WHERE user_id=? AND minute=?)<2`)
 .bind(id,user,date,minute,date,user,date,minute,user,minute).run();
 return !!result.meta.changes;
}
