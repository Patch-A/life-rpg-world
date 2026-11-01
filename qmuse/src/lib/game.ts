import {assetUrl} from '@/asset-urls';
import {validGender,validAvatar,characterGender,canWear,resolveEquipped,type Gender,type AvatarId} from './appearance';
import {validateBirth,celebrationSettings,ageAt,adultDate,birthdaySchedule,type BirthInfo,type BirthdayOccurrence,type BirthdaySettings,type BirthdayRecord} from './birthday';
export const domains = [
 {id:'mind', name:'认知', region:'知晓之境', color:'#ad9cff', description:'把好奇心，变成你的能力。', skill:'知识探索'},
 {id:'health', name:'健康', region:'生命森林', color:'#67dfb5', description:'照顾身体，也为冒险积蓄力量。', skill:'活力养成'},
 {id:'career', name:'职业', region:'创造之城', color:'#75c8ff', description:'每一次认真投入，都有回响。', skill:'实践创造'},
 {id:'wealth', name:'财富', region:'丰盈海湾', color:'#ffd187', description:'积累的是选择生活的自由。', skill:'长期规划'},
 {id:'social', name:'关系', region:'共鸣群岛', color:'#f69cc8', description:'与重要的人，建立真实的连接。', skill:'关系经营'},
] as const;
export type Domain = typeof domains[number]['id'];
export type Goal = {id:string; title:string; domain:Domain; target:number; unit:string; deadline:string; paused:boolean; createdAt:string; completionChoice?:'habit'|'archived'; recordMode?:'entries'|'monthly'; initial?:number;successCriteria?:string;confirmedAt?:string};
export type Task = {id:string; title:string; domain:Domain; target:number; unit:string; repeat:boolean; goalId:string; archived:boolean; evidence?:'optional'|'photo';completionCriteria?:string;steps?:string[];originRunId?:string};
export type ActionReview={id:string;goalId:string;summary:string;adjustment:string;sourceLogIds:string[];at:string;taskId?:string};
export type Log = {id:string; taskId:string; title:string; domain:Domain; value:number; unit:string; goalId:string; xp:number; date:string; at:string; undone:boolean; note?:string; photos?:string[]; source?:'manual'|'timer'; direction?:'deposit'|'withdraw'; updatedAt?:string; history?:{value:number;date:string;note:string;at:string}[]};
export type Game = {profile:null|{name:string; focus:Domain; createdAt:string;gender?:Gender;avatarId?:AvatarId;birth?:BirthInfo}; goals:Goal[]; tasks:Task[]; logs:Log[]; events:{id:string;choice:string;at:string}[]; milestones:LifeMilestone[]; claims:string[]; equipped:string; birthday:BirthdaySettings|null;birthdays:BirthdayRecord[];birthdayQueue:BirthdayOccurrence[];reviews:ActionReview[];agentAccepts:string[];settings:{celebrations:boolean;memoryPromptSeen:boolean}};
export type LifeMilestone={id:string;kind:string;title:string;date:string;note:string;photos:string[];at:string;updatedAt:string;archived:boolean;datePrecision?:'day'|'year'|'unknown';history?:{date:string;datePrecision?:'day'|'year'|'unknown';note:string;at:string;title?:string}[]};
export const milestoneKinds=[{id:'adult',title:'18 岁成人礼',category:'人生转折',reward:'成年礼装',description:'把属于你的成人礼，珍藏在这里。'},{id:'first-job',title:'第一份工作',category:'人生转折',reward:'初入职场徽章',description:'记录第一次走进职场的日子。'},{id:'first-salary',title:'第一次领工资',category:'值得纪念',reward:'第一份收获徽章',description:'这一份回报，属于认真迈步的你。'},{id:'graduation',title:'毕业',category:'人生转折',reward:'新的起点徽章',description:'告别一个阶段，也开启一段新旅程。'},{id:'custom',title:'我的重要时刻',category:'自定义纪念',reward:'人生纪念',description:'重要与否，由你自己定义。'}] as const;
export const outfits=[{id:'explorer',name:'启程探索装',image:assetUrl("/explorer.png"),requirement:''},{id:'suit',name:'星光西装',image:assetUrl("/outfit-suit.png"),requirement:'adult'},{id:'dress',name:'月光礼裙',image:assetUrl("/outfit-dress.png"),requirement:'adult'}];
export function normalizeGame(value:Game,today=day()):Game {
 const s={...blank(),...value,reviews:value.reviews||[],agentAccepts:value.agentAccepts||[],milestones:value.milestones||[],claims:value.claims||[],equipped:value.equipped||'explorer',birthday:value.birthday||null,birthdays:value.birthdays||[],birthdayQueue:value.birthdayQueue||[],settings:{celebrations:value.settings?.celebrations??true,memoryPromptSeen:value.settings?.memoryPromptSeen??false}};
 if(s.profile?.gender)s.profile={...s.profile,avatarId:s.profile.gender};
 s.equipped=resolveEquipped(characterGender(s.profile),s.equipped,s.claims);
 return syncBirthdayQueue(s,today);
}
export function syncBirthdayQueue(s:Game,today=day()):Game{
 if(!s.profile||!s.birthday)return s;
 // Past opportunities and saved memories remain stable when preferences change.
 const past=new Map(s.birthdayQueue.filter(o=>o.date<=today).map(o=>[o.year,o]));
 for(const b of s.birthdays)past.set(b.year,{year:b.year,date:b.date,label:b.label,calendar:b.calendar,adjustment:b.adjustment,age:b.age});
 const future:BirthdayOccurrence[]=[];
 for(const o of birthdaySchedule(s.birthday,day(new Date(s.profile.createdAt)),today)){
  const item={...o,...(s.profile.birth&&s.birthday.showAge?{age:ageAt(s.profile.birth,o.date)}:{})};
  if(o.date<=today){if(!past.has(o.year))past.set(o.year,item);}else if(!past.has(o.year))future.push(item);
 }
 s.birthdayQueue=[...past.values(),...future].sort((a,b)=>a.date.localeCompare(b.date));return s;
}
export function pendingBirthdays(s:Game,today=day()){return s.birthdayQueue.filter(o=>o.date<=today&&!s.birthdays.some(b=>b.year===o.year));}
export function completedActions(s:Game,filter:{date?:string;domain?:Domain}={}){
 const totals=new Map<string,number>(),finished=new Set<string>(),tasks=new Map(s.tasks.map(t=>[t.id,t]));let count=0;
 // Saving is a direct action with no Task: count each funded goal once per day.
 const deposits=new Set<string>();for(const l of s.logs){if(l.undone||l.direction!=='deposit'||filter.date&&l.date!==filter.date||filter.domain&&l.domain!==filter.domain)continue;deposits.add(l.goalId+':'+l.date);}count+=deposits.size;
 for(const l of [...s.logs].filter(l=>!l.undone&&!l.direction).sort((a,b)=>a.date.localeCompare(b.date)||a.at.localeCompare(b.at))){
  const t=tasks.get(l.taskId);if(!t)continue;const key=t.id+':'+(t.repeat?l.date:'once');const n=(totals.get(key)||0)+l.value;totals.set(key,n);
  if(n>=t.target&&!finished.has(key)){finished.add(key);if((!filter.date||l.date===filter.date)&&(!filter.domain||t.domain===filter.domain))count++;}
 }return count;
}
export function availableXP(s:Game,domain:Domain,today=day()){return Math.max(0,30-s.logs.filter(l=>!l.undone&&l.domain===domain&&l.date===today).reduce((n,l)=>n+l.xp,0));}
export function adultEligible(s:Game,today=day()){return !!s.profile?.birth&&adultDate(s.profile.birth)<=today;}
export type Action = {type:string; [key:string]:unknown};
export const blank = ():Game=>({profile:null,goals:[],tasks:[],logs:[],events:[],milestones:[],claims:[],equipped:'explorer',birthday:null,birthdays:[],birthdayQueue:[],reviews:[],agentAccepts:[],settings:{celebrations:true,memoryPromptSeen:false}});
const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
export function day(date=new Date()){return dayFormatter.format(date);}
export function xp(s:Game){return s.logs.filter(x=>!x.undone).reduce((v,x)=>v+x.xp,0);}
export function level(s:Game){return Math.floor(xp(s)/200)+1;}
export function progress(s:Game,g:Goal){return s.logs.filter(l=>!l.undone&&l.goalId===g.id&&l.unit===g.unit).reduce((v,l)=>Math.round((v+(l.direction==='withdraw'?-l.value:l.value))*100)/100,g.initial||0);}
export function goalReached(s:Game,g:Goal){return g.successCriteria?!!g.confirmedAt:progress(s,g)>=g.target;}
export function done(s:Game,t:Task,today=day()){return s.logs.filter(l=>!l.undone&&l.taskId===t.id&&(!t.repeat||l.date===today)).reduce((v,l)=>v+l.value,0);}
export const events = [
 {id:'arrival',level:1,title:'一封来自未来的信',tag:'序章 · 星球初见',body:'你在营地发现了一封信。信里只有一句话：“未来的你，正在感谢今天迈出的第一步。”你想带上什么出发？',choices:['一份好奇心','一点勇气'],reward:'启程纪念'},
 {id:'forest',level:2,title:'森林中的分岔路',tag:'第一章 · 生长',body:'一条路通向安静的湖畔，另一条通向山顶的晨光。探索没有标准答案，你今天更需要什么？',choices:['去湖边休息','去山顶远望'],reward:'森林来信'},
 {id:'beacon',level:3,title:'属于你的灯塔',tag:'第二章 · 回响',body:'海湾里的灯塔亮了。你留下的行动记录，已经成为指引下一段旅程的光。你想把这束光献给谁？',choices:['过去的自己','未来的自己'],reward:'灯塔守望者'},
];
const str=(v:unknown,max=80)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new Error('请填写有效内容');return v.trim();};
const text=(v:unknown,max=1000)=>{if(v===undefined)return '';if(typeof v!=='string'||v.length>max)throw new Error('文字过长');return v.trim();};
const num=(v:unknown)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<=0||v>100000000)throw new Error('请输入大于0的有效数值');const n=Math.round(v*100)/100;if(n<=0)throw new Error('最小记录值为0.01');return n;};
const domain=(v:unknown):Domain=>{if(!domains.some(d=>d.id===v))throw new Error('请选择成长方向');return v as Domain;};
const unit=(v:unknown)=>{const u=str(v,8);if(!['次','分钟','步','元','页'].includes(u))throw new Error('请选择记录单位');return u;};
const photos=(v:unknown):string[]=>{if(v===undefined)return [];if(!Array.isArray(v)||v.length>3||v.some(x=>typeof x!=='string'||!/^photo_[a-f0-9-]{36}$/.test(x)))throw new Error('照片信息无效');return [...new Set(v)];};
function validDate(v:unknown,today:string,future=false){const d=str(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d<'1900-01-01'||Number.isNaN(Date.parse(d+'T12:00:00Z'))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d||(!future&&d>today))throw new Error('请选择有效日期，不能提前记录未来的完成');return d;}
function metadata(a:Action,today:string){return {date:validDate(a.date||today,today),note:text(a.note),photos:photos(a.photos),source:a.source==='timer'?'timer' as const:'manual' as const};}
function recalculate(s:Game){
 const awarded=new Set<string>();const totals=new Map<string,number>();
 for(const l of [...s.logs].sort((a,b)=>a.at.localeCompare(b.at))){l.xp=0;if(l.undone)continue;
  const task=s.tasks.find(t=>t.id===l.taskId);const group=task?task.id+(task.repeat?l.date:'once'):'';
  const before=totals.get(group)||0;if(task)totals.set(group,before+l.value);
  const eligible=l.direction?l.direction==='deposit':!!task&&before<task.target&&before+l.value>=task.target;
  const cap=l.date+':'+l.domain;if(eligible&&!awarded.has(cap)){l.xp=30;awarded.add(cap);}
 }
}
function financialCheck(s:Game,g:Goal){if(progress(s,g)<0)throw new Error('取出金额不能超过这个目标的已有净存款');}
export function reduceGame(current:Game,a:Action,now=new Date()):Game {
 const s=structuredClone(normalizeGame(current,day(now))),at=now.toISOString(),today=day(now),id=()=>crypto.randomUUID();
 if(a.type==='onboard'){
  if(s.profile)throw new Error('角色已创建');const focus=domain(a.focus);const birth=a.birth?validateBirth(a.birth as Record<string,unknown>,today):undefined;const gender=validGender(a.gender),avatarId=validAvatar(a.avatarId,gender);s.profile={name:str(a.name,20),focus,createdAt:at,...(birth?{birth}:{}),gender,avatarId};s.settings.memoryPromptSeen=true;s.birthday=birth?celebrationSettings(birth,a.celebrationCalendar==='lunar'?'lunar':'solar'):null;
  const plans:Record<Domain,[string,string,string,number,number]>={mind:['建立阅读习惯','阅读并记录一个收获','分钟',300,20],health:['开启规律运动','完成一次运动','分钟',300,10],career:['推进一个个人项目','专注推进项目','分钟',600,30],wealth:['建立第一笔储蓄','记录实际存入金额','元',1000,100],social:['与重要的人保持联系','一次认真交流','次',10,1]};
  const p=plans[focus],gid=id();s.goals.push({id:gid,title:typeof a.goalTitle==='string'&&a.goalTitle.trim()?str(a.goalTitle):p[0],domain:focus,target:a.goalTarget===undefined?p[3]:num(a.goalTarget),unit:a.goalUnit===undefined?p[2]:unit(a.goalUnit),deadline:'',paused:false,createdAt:at,initial:0,recordMode:'entries'});
  const goal=s.goals.at(-1)!;if(goal.unit!=='元')s.tasks.push({id:id(),title:typeof a.taskTitle==='string'?str(a.taskTitle):p[1],domain:focus,target:a.taskTarget===undefined?p[4]:num(a.taskTarget),unit:goal.unit,repeat:true,goalId:gid,archived:false,evidence:'optional'});return syncBirthdayQueue(s,today);
 }
 if(!s.profile)throw new Error('请先创建角色');
 if(a.type==='birth-profile'){const birth=validateBirth(a.birth as Record<string,unknown>||{},today);s.profile.birth=birth;s.settings.memoryPromptSeen=true;s.birthday=celebrationSettings(birth,a.celebrationCalendar==='lunar'?'lunar':'solar',s.birthday||{});return syncBirthdayQueue(s,today);}
 if(a.type==='profile'){const name=str(a.name,20),gender=validGender(a.gender??s.profile.gender),avatarId=validAvatar(a.avatarId,gender);Object.assign(s.profile,{name,gender,avatarId});s.equipped=resolveEquipped(gender,s.equipped,s.claims);return s;}
 if(a.type==='settings'){if(a.celebrations!==undefined)s.settings.celebrations=!!a.celebrations;if(a.memoryPromptSeen!==undefined)s.settings.memoryPromptSeen=!!a.memoryPromptSeen;return s;}
 if(a.type==='goal'){
  if(!a.id&&s.goals.length>=100)throw new Error('最多创建100个目标');
  const existing=s.goals.find(g=>g.id===a.id);if(a.id&&!existing)throw new Error('目标不存在');
  const deadline=a.deadline?validDate(a.deadline,today,true):'';const u=existing?.unit||unit(a.unit);
  const initial=u==='元'?Number(a.initial||0):0;if(!Number.isFinite(initial)||initial<0||initial>100000000)throw new Error('已有存款金额无效');
  const mode=a.recordMode==='monthly'?'monthly':'entries';
  if(existing&&s.logs.some(l=>l.goalId===existing.id)&&(mode!==(existing.recordMode||'entries')||initial!==(existing.initial||0)))throw new Error('已有记录后，记账方式和起始存款不能变更，请新建目标');
  const g:Goal={id:existing?.id||id(),title:str(a.title),domain:existing?.domain||domain(a.domain),target:num(a.target),unit:u,deadline,paused:existing?.paused||false,createdAt:existing?.createdAt||at,recordMode:mode,initial:Math.round(initial*100)/100,completionChoice:existing?.completionChoice,successCriteria:existing?.successCriteria,confirmedAt:existing?.confirmedAt};
  if(existing)s.goals=s.goals.map(x=>x.id===g.id?g:x);else s.goals.push(g);return s;
 }
 if(a.type==='finish-goal'){
  const g=s.goals.find(g=>g.id===a.id);if(!g)throw Error('目标不存在');if(!goalReached(s,g))throw Error('目标还未达成');if(g.completionChoice)throw Error('这个目标已整理完成');
  if(a.choice!=='habit'&&a.choice!=='archived')throw Error('请选择目标完成后的安排');
  g.completionChoice=a.choice;g.paused=true;for(const t of s.tasks.filter(t=>t.goalId===g.id)){if(a.choice==='habit'&&!t.archived)t.goalId='';else t.archived=true;}return s;
 }
 if(a.type==='pause'){const g=s.goals.find(g=>g.id===a.id);if(!g)throw new Error('目标不存在');g.paused=!g.paused;return s;}
 if(a.type==='confirm-goal'){const g=s.goals.find(g=>g.id===a.id);if(!g||!g.successCriteria)throw Error('这个目标没有独立成功标准');if(g.paused||g.completionChoice)throw Error('请先恢复目标');g.confirmedAt=g.confirmedAt||at;return s;}
 if(a.type==='delete-review'){if(!s.reviews.some(r=>r.id===a.id))throw Error('复盘不存在');s.reviews=s.reviews.filter(r=>r.id!==a.id);return s;}
 // Internal action assembled from the current user's server-side AI proposal.
 if(a.type==='agent-confirm'){
  const rid=str(a.clientId,80);if(s.agentAccepts.includes(rid))return s;if(s.agentAccepts.length>=1000)throw Error('AI确认记录已达容量上限，请反馈给维护者');
  let g=s.goals.find(g=>g.id===a.goalId);if(a.goalId&&!g)throw Error('主线目标不存在');
  if(!g){if(s.goals.length>=100)throw Error('最多创建100个目标');const ng=a.newGoal as Record<string,unknown>;if(!ng)throw Error('目标信息缺失');g={id:id(),title:str(ng.title),domain:domain(ng.domain),target:num(ng.target),unit:'分钟',successCriteria:str(ng.successCriteria,300),deadline:'',paused:false,createdAt:at};s.goals.push(g);}
  if(g.paused||g.completionChoice||g.confirmedAt)throw Error('目标已暂停或达成，请重新选择');
  let taskId:string|undefined;
  if(a.candidate){if(s.tasks.filter(t=>!t.archived).length>=100)throw Error('请先归档不再需要的行动');const c=a.candidate as Record<string,unknown>;const minutes=num(c.minutes);if(minutes>120||!Number.isInteger(minutes))throw Error('行动时间无效');if(!Array.isArray(c.steps)||c.steps.length<1||c.steps.length>4)throw Error('行动步骤无效');taskId=id();s.tasks.push({id:taskId,title:str(c.title),completionCriteria:str(c.completionCriteria,300),steps:c.steps.map(v=>str(v,200)),domain:g.domain,target:g.unit==='分钟'?minutes:1,unit:g.unit,repeat:false,goalId:g.id,archived:false,evidence:'optional',originRunId:rid});}
  if(a.review){if(s.reviews.length>=200)throw Error('复盘记录已达容量上限，请导出并整理');const r=a.review as Record<string,unknown>;if(!Array.isArray(r.sourceLogIds)||!r.sourceLogIds.length||r.sourceLogIds.length>12||r.sourceLogIds.some(v=>!s.logs.some(l=>l.id===v&&l.goalId===g!.id&&!l.undone)))throw Error('复盘引用已改变，请重新生成');s.reviews.push({id:rid,goalId:g.id,summary:str(r.summary,600),adjustment:str(r.adjustment,300),sourceLogIds:r.sourceLogIds as string[],at,taskId});}
  if(!a.candidate&&!a.review)throw Error('没有可确认的内容');s.agentAccepts.push(rid);return s;
 }
 if(a.type==='task'){
  const existing=s.tasks.find(t=>t.id===a.id);if(a.id&&!existing)throw new Error('行动不存在');
  if(!a.id&&s.tasks.filter(t=>!t.archived).length>=100)throw new Error('请先归档不再需要的行动');
  const gid=typeof a.goalId==='string'?a.goalId:'';const g=s.goals.find(g=>g.id===gid);if(gid&&!g)throw new Error('主线目标不存在');if(g?.unit==='元')throw new Error('存钱目标请直接记账，不通过行动重复累计');
  const t:Task={id:existing?.id||id(),title:str(a.title),domain:g?.domain||domain(a.domain),target:num(a.target),unit:g?.unit||unit(a.unit),repeat:!!a.repeat,goalId:gid,archived:false,evidence:a.evidence==='photo'?'photo':'optional'};
  if(t.unit==='元')throw new Error('请创建以元为单位的存钱目标，再进入目标记账');
  if(existing&&s.logs.some(l=>l.taskId===existing.id))throw new Error('已有记录的行动请归档后新建，避免改变历史统计');
  if(existing)s.tasks=s.tasks.map(x=>x.id===t.id?t:x);else s.tasks.push(t);return s;
 }
 if(a.type==='archive'){const t=s.tasks.find(t=>t.id===a.id);if(!t)throw new Error('行动不存在');t.archived=!t.archived;return s;}
 if(a.type==='log'||a.type==='ledger'){
  if(s.logs.length>=10000)throw new Error('记录已达容量上限，请先导出存档');
  const clientId=typeof a.clientId==='string'&&/^[a-f0-9-]{36}$/.test(a.clientId)?a.clientId:id();if(s.logs.some(l=>l.id===clientId))return s;
  const m=metadata(a,today);const value=num(a.value);
  if(a.type==='ledger'){
   const g=s.goals.find(g=>g.id===a.id&&g.unit==='元');if(!g||g.paused)throw new Error('存钱目标不存在或已暂停');
   if(a.direction!=='deposit'&&a.direction!=='withdraw')throw new Error('请选择存入或取出');
   if((g.recordMode||'entries')==='monthly'){
    m.date=m.date.slice(0,7)+'-01';if(a.direction==='withdraw')throw new Error('月度汇总请填写该月净增加或净减少');
    const direction=a.monthlyDirection==='decrease'?'withdraw':'deposit';
    const existing=s.logs.find(l=>!l.undone&&l.goalId===g.id&&l.date.slice(0,7)===m.date.slice(0,7));
    if(existing){existing.history=[...(existing.history||[]),{value:existing.value,date:existing.date,note:existing.note||'',at}];Object.assign(existing,m,{value,direction,updatedAt:at});}
    else s.logs.push({id:clientId,taskId:'',title:g.title+' · 月度汇总',domain:g.domain,value,unit:'元',goalId:g.id,xp:0,at,undone:false,...m,direction});
   }else s.logs.push({id:clientId,taskId:'',title:g.title,domain:g.domain,value,unit:'元',goalId:g.id,xp:0,at,undone:false,...m,direction:a.direction});
   financialCheck(s,g);
  }else{
   const t=s.tasks.find(t=>t.id===a.id&&!t.archived);if(!t)throw new Error('行动不存在或已归档');
   const g=s.goals.find(g=>g.id===t.goalId);if(g?.paused)throw new Error('请先恢复这条主线');if(g?.unit==='元')throw new Error('存钱目标请直接记账，旧行动可归档');
   if(t.evidence==='photo'&&!m.photos.length)throw new Error('这项行动需要至少一张照片');
   if(['步','次','页'].includes(t.unit)&&!Number.isInteger(value))throw new Error('这个单位需要整数');
   s.logs.push({id:clientId,taskId:t.id,title:t.title,domain:t.domain,value,unit:t.unit,goalId:t.goalId,xp:0,at,undone:false,...m});
  }
  recalculate(s);return s;
 }
 if(a.type==='edit-log'||a.type==='undo'){
  const l=s.logs.find(l=>l.id===a.id&&!l.undone);if(!l)throw new Error('记录不存在或已经撤销');
  if(a.type==='undo'){l.undone=true;l.updatedAt=at;}
  else{
   const m=metadata(a,today),value=num(a.value);const t=s.tasks.find(t=>t.id===l.taskId);
   if(t?.evidence==='photo'&&!m.photos.length)throw new Error('这项行动需要至少一张照片');
   if(['步','次','页'].includes(l.unit)&&!Number.isInteger(value))throw new Error('这个单位需要整数');
   const g=s.goals.find(g=>g.id===l.goalId);if(g?.recordMode==='monthly'){m.date=m.date.slice(0,7)+'-01';if(s.logs.some(x=>x.id!==l.id&&!x.undone&&x.goalId===g.id&&x.date===m.date))throw new Error('该月已有汇总，请编辑对应的记录');}
   l.history=[...(l.history||[]),{value:l.value,date:l.date,note:l.note||'',at}];Object.assign(l,m,{value,updatedAt:at});
  }
  const g=s.goals.find(g=>g.id===l.goalId);if(g?.unit==='元')financialCheck(s,g);recalculate(s);return s;
 }
 if(a.type==='milestone'){
  if(!a.id&&typeof a.clientId==='string'&&s.milestones.some(m=>m.id===a.clientId))return s;
  const existing=s.milestones.find(m=>m.id===a.id);if(a.id&&!existing)throw new Error('纪念不存在');
  const kind=existing?.kind||str(a.kind,30);const spec=milestoneKinds.find(k=>k.id===kind);if(!spec)throw new Error('请选择里程碑类型');
  if(kind==='adult'&&!existing&&!adultEligible(s,today))throw Error(s.profile.birth?'满18岁后才能记录成人礼':'请先补全出生日期，再判断成人礼');
  const datePrecision=a.datePrecision==='year'?'year':a.datePrecision==='unknown'?'unknown':'day';
  const date=datePrecision==='unknown'?'':datePrecision==='year'?str(a.date,4):validDate(a.date,today);if(datePrecision==='year'&&(!/^\d{4}$/.test(date)||date<'1900'||date>today.slice(0,4)))throw Error('请选择有效年份');
  if(s.profile.birth&&datePrecision!=='unknown'){const earliest=kind==='adult'?adultDate(s.profile.birth):s.profile.birth.date;if((datePrecision==='day'&&date<earliest)||(datePrecision==='year'&&date<earliest.slice(0,4)))throw Error(kind==='adult'?'成人礼日期不能早于18岁生日':'经历日期不能早于出生日期');}
  const note=text(a.note),imageIds=photos(a.photos);
  if(existing){const title=['custom','graduation'].includes(kind)&&a.title!==undefined?str(a.title):existing.title;existing.history=[...(existing.history||[]),{date:existing.date,datePrecision:existing.datePrecision||'day',note:existing.note,title:existing.title,at}];Object.assign(existing,{date,datePrecision,note,title,photos:imageIds,updatedAt:at,archived:false});return s;}
  if(s.milestones.length>=200)throw new Error('最多记录200个人生纪念');
  const previous=!['custom','graduation'].includes(kind)?s.milestones.find(m=>m.kind===kind):undefined;
  if(previous){if(previous.archived){Object.assign(previous,{date,datePrecision,note,photos:imageIds,updatedAt:at,archived:false});return s;}throw new Error('这个首次里程碑已记录，请编辑已有纪念');}
  s.milestones.push({id:typeof a.clientId==='string'&&/^[a-f0-9-]{36}$/.test(a.clientId)?a.clientId:id(),kind,title:['custom','graduation'].includes(kind)?(kind==='graduation'&&!a.title?spec.title:str(a.title)):spec.title,date,datePrecision,note,photos:imageIds,at,updatedAt:at,archived:false});
  if(kind!=='custom'&&!s.claims.includes(kind))s.claims.push(kind);return s;
 }
 if(a.type==='birthday-settings'){if(!s.profile.birth)throw Error('请先补全出生日期');s.birthday=celebrationSettings(s.profile.birth,a.calendar==='lunar'?'lunar':'solar',{...s.birthday,showAge:!!a.showAge,reminders:a.reminders!==false,leapPolicy:a.leapPolicy==='leap'?'leap':'regular',shortMonth:a.shortMonth==='next'?'next':'last',solarLeap:a.solarLeap==='mar1'?'mar1':'feb28'});return syncBirthdayQueue(s,today);}
 if(a.type==='birthday'){
  if(!a.id&&typeof a.clientId==='string'&&s.birthdays.some(b=>b.id===a.clientId))return s;
  const existing=s.birthdays.find(b=>b.id===a.id);if(a.id&&!existing)throw Error('生日纪念不存在');
  const note=text(a.note),wish=text(a.wish),imageIds=photos(a.photos);
  if(existing){existing.history=[...(existing.history||[]),{note:existing.note,wish:existing.wish,at}];Object.assign(existing,{note,wish,photos:imageIds,updatedAt:at,archived:false});return s;}
  if(!s.birthday)throw Error('请先设置生日');
  const occurrence=s.birthdayQueue.find(o=>o.year===a.year&&(!a.date||o.date===a.date)&&o.date<=today);if(!occurrence)throw Error('生日尚未到来或不属于可补过的年份');
  const previous=s.birthdays.find(b=>b.year===occurrence.year);if(previous)throw Error('这次生日已有纪念，请编辑或恢复已有记录');
  s.birthdays.push({...occurrence,id:typeof a.clientId==='string'&&/^[a-f0-9-]{36}$/.test(a.clientId)?a.clientId:id(),note,wish,photos:imageIds,at,updatedAt:at,archived:false});const claim='birthday:'+occurrence.date.slice(0,4);if(!s.claims.includes(claim))s.claims.push(claim);return s;
 }
 if(a.type==='archive-birthday'){const b=s.birthdays.find(b=>b.id===a.id);if(!b)throw Error('生日纪念不存在');b.archived=!b.archived;return s;}
 if(a.type==='forget-photo'){
  const pid=str(a.id,50);for(const l of s.logs)l.photos=(l.photos||[]).filter(x=>x!==pid);for(const m of s.milestones)m.photos=m.photos.filter(x=>x!==pid);for(const b of s.birthdays)b.photos=b.photos.filter(x=>x!==pid);return s;
 }
 if(a.type==='delete-memory'){
  if(a.kind==='birthday'){if(!s.birthdays.some(b=>b.id===a.id))throw Error('纪念不存在');s.birthdays=s.birthdays.filter(b=>b.id!==a.id);}else{if(!s.milestones.some(m=>m.id===a.id))throw Error('纪念不存在');s.milestones=s.milestones.filter(m=>m.id!==a.id);}return s;
 }
 if(a.type==='archive-milestone'){const m=s.milestones.find(m=>m.id===a.id);if(!m)throw new Error('纪念不存在');m.archived=!m.archived;return s;}
 if(a.type==='equip'){const o=outfits.find(o=>o.id===a.id);if(!o)throw new Error('这套时装不存在');if(!canWear(characterGender(s.profile),o.id))throw new Error('这套时装不适用于当前角色');if(o.requirement&&!s.claims.includes(o.requirement))throw new Error('这套时装尚未获得');s.equipped=o.id;return s;}
 if(a.type==='event'){
  const e=events.find(e=>e.id===a.id);if(!e||level(s)<e.level)throw new Error('探索尚未解锁');if(s.events.some(x=>x.id===e.id))throw new Error('你已完成这段探索');const choice=str(a.choice);if(!e.choices.includes(choice))throw new Error('请选择有效选项');s.events.push({id:e.id,choice,at});return s;
 }
 throw new Error('未知操作');
}
