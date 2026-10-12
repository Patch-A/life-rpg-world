'use client';
import {useState} from 'react';
import {CharacterFields} from './role-profile';
import {type Action} from '@/lib/game';
import {type Gender,type AvatarId} from '@/lib/appearance';
export function QuickSetup({mutate,busy,error,onSaved}:{mutate:(a:Action)=>Promise<boolean>;busy:boolean;error:string;onSaved:()=>void}){
 const [name,setName]=useState(''),[gender,setGender]=useState<Gender|''>(''),[avatarId,setAvatar]=useState<AvatarId|''>(''),[adult,setAdult]=useState(false),[localError,setLocalError]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();if(!adult||!name.trim()||!gender){setLocalError('请填写昵称、选择角色，并确认成年试用。');return;}if(await mutate({type:'onboard',name,gender,avatarId:gender,focus:'career',goalTitle:'推进一个个人项目',goalTarget:120,goalUnit:'分钟',taskTitle:'为项目写下一个可执行的小步骤',taskTarget:10})){onSaved();}}
 return <form className="form-stack" onSubmit={submit}><h2>先创建角色，再从一小步开始</h2><p className="note">首版面向成年用户试用。生日和照片可以以后从“我的”补充。</p><CharacterFields value={{name,gender,avatarId}} onChange={v=>{if(v.name!==undefined)setName(v.name);if(v.gender!==undefined)setGender(v.gender);if(v.avatarId!==undefined)setAvatar(v.avatarId);}}/><label className="checkbox-row"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/>我已满18岁，并已阅读<a href="/about">试用与数据说明</a>。</label><p className="note">创建后先提供一个可编辑的个人项目目标；真实记录从0开始。你可以直接用AI拆解自己的目标。</p>{(error||localError)&&<p className="error" role="alert">{error||localError}</p>}<button className="primary full" disabled={busy||!adult}>{busy?'正在建档…':'创建我的星球'}</button><a className="text-button" href="/demo">先看虚构演示，不创建存档</a></form>;
}
