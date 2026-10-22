import {useMemo} from 'react';
import {Gift} from 'lucide-react';
import {day,pendingBirthdays,adultEligible,type Game} from '@/lib/game';
import {characterGender,adultOutfitName} from '@/lib/appearance';
import {adultDate,type BirthdayOccurrence} from '@/lib/birthday';
import type {Mutate} from './life-records';
const birthdayYear=(o:BirthdayOccurrence)=>(o.calendar==='lunar'?'农历':'')+o.year+'年';
function schedule(state:Game){return {items:state.birthdayQueue,error:''};}
export function MemoryPrompt({state,review,mutate,busy}:{state:Game;review:()=>void;mutate:Mutate;busy:boolean}){return !state.settings.memoryPromptSeen?<section className="memory-prompt panel"><div><span className="eyebrow">把走过的路，带进你的星球</span><h2>过去的经历，也值得被看见</h2><p>成年、毕业或第一份工作，可以补记，也能领取相同奖励。</p></div><div className="row"><button className="secondary" disabled={busy} onClick={review}>回顾我的人生</button><button className="text-button" disabled={busy} onClick={()=>mutate({type:'settings',memoryPromptSeen:true})}>以后再说</button></div></section>:null;}
export function BirthdayToday({state,open}:{state:Game;open:(o:BirthdayOccurrence)=>void}){
 const result=useMemo(()=>schedule(state),[state.birthdayQueue]);if(!state.birthday?.reminders||result.error)return null;
 const due=pendingBirthdays(state).at(-1);if(!due)return null;
 return <section className="birthday-today panel"><Gift size={30}/><div><span className="eyebrow">{due.date===day()?'今天，星球为你亮灯':'这一年的生日，还可以补过'}</span><h2>{due.date===day()?'生日快乐，'+state.profile?.name:birthdayYear(due)+'的生日，留一份纪念吧'}</h2><p>{due.label} · {due.date}，公历日期按北京时间计算。</p></div><button className="primary" onClick={()=>open(due)}>{due.date===day()?'开启生日庆祝':'补过这次生日'}</button></section>;
}
export function AdultToday({state,open}:{state:Game;open:()=>void}){
 if(!adultEligible(state)||state.milestones.some(m=>m.kind==='adult'))return null;
 const date=adultDate(state.profile!.birth!);return <section className="birthday-today panel"><Gift size={28}/><div><span className="eyebrow">{date===day()?'今天，你满18岁了':'走过的节点，也能补记'}</span><h2>你的18岁成人礼</h2><p>成人礼日期：{date}。{state.claims.includes('adult')?'礼装已领取，你可以重新补写这份纪念。':'珍藏这一刻，领取'+adultOutfitName(characterGender(state.profile))+'。'}</p></div><button className="primary" onClick={open}>记录成人礼</button></section>;
}
