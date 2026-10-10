'use client';
import {useState} from 'react';
import {Check,UserRound} from 'lucide-react';
import {type Game,type Action} from '@/lib/game';
import {resolveEquipped,type Gender,type AvatarId} from '@/lib/appearance';
import {Character2D,CharacterPreview} from './character-2d';
import {useDraft} from './use-draft';

type RoleFields={name:string;gender:Gender|'';avatarId:AvatarId|''};
export function CharacterFields({value,onChange,quiet=false,outfit='explorer',claims=[]}:{outfit?:string;claims?:readonly string[];value:RoleFields;onChange:(p:Partial<RoleFields>)=>void;quiet?:boolean}){
 return <><label>探索者昵称<input required maxLength={20} autoComplete="nickname" placeholder="给自己一个冒险的名字" value={value.name} onChange={e=>onChange({name:e.target.value})}/></label><fieldset className="role-choice"><legend>性别与初始形象</legend><div className="role-options">{(['male','female'] as const).map(g=><button type="button" key={g} className={value.gender===g?'role-option active':'role-option'} aria-pressed={value.gender===g} onClick={()=>onChange({gender:g,avatarId:g})}><CharacterPreview gender={g} outfit="explorer" portrait/><span>{g==='male'?'男生探索者':'女生探索者'}{value.gender===g&&<Check size={17}/>}</span></button>)}</div></fieldset>{value.gender&&<Character2D gender={value.gender} outfit={resolveEquipped(value.gender,outfit,claims)} quiet={quiet} compact/>}<p className="note">点击角色打招呼，也可以切换全身与近景。男角色使用男装，女角色使用女装；通用道具和成长奖励不受影响。</p></>;
}
export function RoleProfile({state,mutate,busy,error,onSaved,quiet=false,upgrade=false}:{state:Game;mutate:(a:Action)=>Promise<boolean>;busy:boolean;error:string;onSaved:()=>void;quiet?:boolean;upgrade?:boolean}){
 const draft=useDraft<RoleFields>('life-rpg-role-'+state.profile?.createdAt,{name:state.profile?.name||'',gender:state.profile?.gender||'',avatarId:state.profile?.avatarId||state.profile?.gender||''});
 const f={...draft.value,avatarId:draft.value.gender||draft.value.avatarId},[localError,setLocalError]=useState('');
 return <form className="form-stack" onSubmit={async e=>{e.preventDefault();setLocalError('');if(!f.gender||!f.avatarId){setLocalError('先选择性别和初始形象');return;}if(await mutate({type:'profile',...f})){draft.clear();onSaved();}}}>{upgrade&&<><span className="eyebrow"><UserRound size={16}/> 完善你的角色</span><h2>让星球上的探索者，成为你</h2><p className="muted">选好形象就可以继续，已有经历与奖励会保留，服装会匹配所选角色。</p></>}{draft.restored&&<p className="draft-note">已恢复未提交的角色草稿。</p>}<CharacterFields value={f} onChange={p=>draft.setValue({...f,...p})} quiet={quiet} outfit={state.equipped} claims={state.claims}/>{(error||localError)&&<p className="error" role="alert">{localError||error}</p>}<button className="primary full" disabled={busy}>{busy?'保存中…':upgrade?'确认形象，继续旅程':'保存角色设置'}</button></form>;
}
