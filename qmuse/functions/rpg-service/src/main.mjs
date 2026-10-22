import {Client,TablesDB,Query} from 'node-appwrite';
import {z} from 'zod';
import {createStore,hash} from './store.mjs';
import {blank,normalizeGame,reduceGame,day,progress,ageAt} from './lib/game.mjs';
import {candidateSchema} from './lib/agent-contract.mjs';
import {generateActions,ModelError} from './lib/deepseek.mjs';
const reject=(message,status=400)=>Object.assign(Error(message),{status});
const input=z.object({requestId:z.string().uuid(),mode:z.enum(['plan','review']),goalId:z.string().max(80).default(''),newGoal:z.object({title:z.string().trim().min(1).max(80),domain:z.enum(['mind','career']),successCriteria:z.string().trim().min(1).max(300),target:z.number().int().min(1).max(100000)}).optional(),minutes:z.number().int().min(1).max(120),obstacle:z.string().trim().max(400),consent:z.literal(true),adult:z.literal(true)});
async function reserve(store,ownerKey,now){
 const date=day(new Date(now)),minute=Math.floor(now/60000),expiry=now+3*86400000;
 for(const [scope,limit] of [[`g:${date}`,20],[`gm:${minute}`,5],[`u:${date}:${ownerKey}`,3],[`um:${minute}:${ownerKey}`,2]]){
  const count=await store.count(scope);let taken=false;
  if(!Number.isSafeInteger(count)||count<0)throw Error('Quota unavailable');
  for(let slot=count+1;slot<=limit;slot++){if(await store.slot(scope,slot,expiry)){taken=true;break;}}
  if(!taken)return false;
 }
 return true;
}
export default async({req,res})=>{
 let proposalId='',store,ownerKey='';
 try{
  const userId=req.headers?.['x-appwrite-user-id'];
  if(typeof userId!=='string'||!userId||userId.length>128)throw reject('请在妙思作品页面建立访客会话后重试。',401);
  if(typeof req.bodyText==='string'&&Buffer.byteLength(req.bodyText)>14000)throw reject('提交内容过大，请缩短后重试。',413);
  const envelope=req.bodyJson;if(!envelope||typeof envelope!=='object'||Array.isArray(envelope))throw reject('提交格式无效');
  const {path,method='GET',body={},query={}}=envelope;
  if(!['GET','POST','DELETE'].includes(method))throw reject('不支持此操作',405);
  const databaseId=process.env.QMUSE_APPWRITE_DATABASE_ID;
  if(!databaseId||!process.env.APPWRITE_FUNCTION_API_ENDPOINT||!process.env.APPWRITE_FUNCTION_PROJECT_ID||!req.headers['x-appwrite-key'])throw Error('Cloud unavailable');
  const client=new Client().setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT).setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID).setKey(req.headers['x-appwrite-key']);
  store=createStore(new TablesDB(client),databaseId,Query);ownerKey=hash('life-rpg:'+userId);
  const apiKey=process.env.DEEPSEEK_API_KEY;
  if(path==='/api/access'){
   if(method==='DELETE'){if(body.confirm!==true||body.erase!==true)throw reject('请明确确认删除当前身份的本应用数据');const finished=await store.erase(ownerKey);if(!finished)throw reject('部分数据已删除，请再次点击继续清理。',503);return res.json({authenticated:true,erased:true});}
   return res.json({authenticated:true,aiEnabled:!!apiKey,photosEnabled:false,dailyLimit:3,siteDailyLimit:20});
  }
  if(path==='/api/photos')return res.json(method==='GET'?{photos:[]}:{error:'妙思投稿版暂不上传照片，请先使用文字记录。旧版本照片保留。'},method==='GET'?200:403);
  if(path==='/api/game'){
   const saved=await store.snapshot(ownerKey),state=saved?normalizeGame(saved.state):blank(),revision=saved?.revision||0;
   if(method==='GET')return res.json({state,revision});
   if(method!=='POST'||!Number.isInteger(body.revision)||body.revision<0||!body.action||typeof body.action.type!=='string')throw reject('提交格式无效');
   let action=body.action;
   if(action.type==='agent-confirm')throw reject('请通过草案确认入口保存');
   if(action.type==='accept-agent'){
    const id=z.string().uuid().parse(action.requestId);
    if(state.agentAccepts.includes(id))return res.json({state,revision});
    const draft=await store.proposal(id,ownerKey);
    if(!draft||draft.status!=='complete'||draft.createdAt<Date.now()-30*86400000)throw reject('草案不存在或已过期，请重新生成');
    const run=JSON.parse(draft.payload);let candidate;
    if(action.index!==null){if(!Number.isInteger(action.index)||action.index<0||action.index>=run.result.candidates.length)throw reject('请选择有效候选');const original=run.result.candidates[action.index];candidate=candidateSchema.parse({...original,title:action.title??original.title,completionCriteria:action.completionCriteria??original.completionCriteria});}
    if(!candidate&&run.mode!=='review')throw reject('请选择一个行动');
    action={type:'agent-confirm',clientId:id,goalId:run.goalId,newGoal:run.newGoal,candidate,...(run.mode==='review'?{review:{summary:run.result.summary,adjustment:run.result.adjustment,sourceLogIds:run.result.sourceLogIds}}:{})};
   }
   if(body.revision!==revision)throw reject('另一个页面已更新进度，请重新加载。',409);
   if(action.photos!==undefined&&(!Array.isArray(action.photos)||action.photos.length))throw reject('妙思投稿版暂不上传照片，请先使用文字记录。');
   let next;try{next=reduceGame(state,action);}catch(error){throw reject(error.message||'操作无效');}
   return res.json(await store.save(ownerKey,revision+1,next));
  }
  if(path==='/api/agent'){
   if(method==='GET'){
    if(query.id){const id=z.string().uuid().parse(query.id),row=await store.proposal(id,ownerKey);if(!row||row.createdAt<Date.now()-30*86400000)throw reject('草案不存在、过期或无权访问',404);return res.json({status:row.status,run:row.payload?JSON.parse(row.payload):null});}
    if(apiKey)await store.purge(Date.now());
    const used=await store.count(`u:${day()}:${ownerKey}`);return res.json({available:!!apiKey,model:'deepseek-flash',dailyLimit:3,remaining:Math.max(0,3-used)});
   }
   if(method==='DELETE'){await store.removeProposal(z.string().uuid().parse(body.id),ownerKey);return res.json({deleted:true});}
   const a=input.parse(body);if(!apiKey)throw reject('作者尚未开放本妙思作品的AI，手动功能仍可使用。',503);
   const saved=await store.snapshot(ownerKey);if(!saved?.state.profile)throw reject('请先创建角色');const state=normalizeGame(saved.state);
   if(state.profile.birth&&ageAt(state.profile.birth,day())<18)throw reject('当前AI仅面向成年用户试用',403);
   const previous=await store.proposal(a.requestId,ownerKey);if(previous){if(previous.status==='complete')return res.json({run:JSON.parse(previous.payload)});throw reject('这次请求已经处理，请查看草案或发起新请求。',409);}
   const goal=a.goalId?state.goals.find(g=>g.id===a.goalId):undefined;
   if((a.goalId&&!goal)||(!goal&&!a.newGoal))throw reject('请选择或填写目标');
   if(goal&&(goal.paused||goal.completionChoice||goal.confirmedAt))throw reject('请选择仍在推进的目标');
   if(goal&&!['mind','career'].includes(goal.domain))throw reject('首版AI支持学习、创作与个人项目目标，其他方向可手动记录');
   const records=goal?state.logs.filter(l=>!l.undone&&l.goalId===goal.id).sort((x,y)=>y.date.localeCompare(x.date)||y.at.localeCompare(x.at)).slice(0,12).map(l=>({id:l.id,title:l.title,date:l.date,value:l.value,unit:l.unit,note:(l.note||'').slice(0,350)})):[];
   if(a.mode==='review'&&(!goal||!records.length))throw reject('请先选择已有目标并记录行动，再做复盘。');
   const now=Date.now(),createdAt=new Date(now).toISOString();
   if(!await store.reserveProposal(a.requestId,{ownerKey,status:'pending',payload:'',createdAt:now}))throw reject('请求标识已使用，请发起新请求。',409);
   proposalId=a.requestId;
   if(!await reserve(store,ownerKey,now))throw reject('本作品AI次数已用完或正在生成，请稍后再试，手动功能仍可用。',429);
   const context=goal?{title:goal.title,successCriteria:goal.successCriteria||'用户设置的累计目标',target:goal.target,unit:goal.unit,progress:progress(state,goal)}:{...a.newGoal,unit:'分钟',progress:0};
   const result=await generateActions(apiKey,'deepseek-flash',{mode:a.mode,goal:context,availableMinutes:a.minutes,obstacle:a.obstacle,records},a.minutes,new Set(records.map(l=>l.id)));
   if(a.mode==='review'&&!result.sourceLogIds.length)throw reject('复盘未引用实际记录，本次未保存，请重试。',503);
   const run={id:a.requestId,mode:a.mode,goalId:goal?.id||'',...(!goal?{newGoal:{...a.newGoal,unit:'分钟'}}:{}),result,createdAt,model:'deepseek-flash'};
   await store.updateProposal(a.requestId,{status:'complete',payload:JSON.stringify(run)});return res.json({run});
  }
  if(path==='/api/feedback'){
   if(method==='GET')return res.json({items:await store.feedback(ownerKey)});
   if(method==='DELETE'){await store.removeFeedback(z.string().uuid().parse(body.id),ownerKey);return res.json({deleted:true});}
   const value=z.object({id:z.string().uuid(),category:z.enum(['blocked','suggestion','other']),helpful:z.enum(['yes','no','untried']),step:z.enum(['entry','plan','record','review','other']),message:z.string().trim().min(1).max(1000)}).parse(body);
   const created=await store.addFeedback(value.id,ownerKey,{...value,version:'qmuse-submission-v0.4',created_at:new Date().toISOString()});return res.json({id:value.id},created?201:200);
  }
  throw reject('接口不存在',404);
 }catch(error){
  if(proposalId&&store)await store.updateProposal(proposalId,{status:'failed'}).catch(()=>{});
  if(error instanceof z.ZodError)return res.json({error:'输入格式无效，请检查目标、时间与确认项。'},400);
  if(error instanceof ModelError)return res.json({error:error.message},error.status);
  return res.json({error:error.status?error.message:'QMuse云服务暂不可用，请稍后重试；本次未确认内容不会写入存档。'},error.status||503);
 }
};
