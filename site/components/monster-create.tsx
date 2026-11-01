'use client';

import {useState} from 'react';
import {Plus} from 'lucide-react';
import {type Action,type Game,type MonsterKind} from '@/lib/game';
import {MAX_ACTIVE_MONSTERS,MONSTER_KINDS,activeMonsters,monsterMeta} from '@/lib/monsters';
import {newId} from '@/lib/ids';
import './monster-create.css';

type Act=(action:Action)=>Promise<boolean>;

/**
 * 自己放一只上去。
 *
 * 原来唯一的入口是模型在对话里提议（`monster.event==='appear'`），条件卡得很死：
 * 要「反复出现的、具体的、够格的事」，还明确排除「只是心情」「一次性事件」「自我评价」。
 * 这个标准本身没错，但它意味着**大多数真实对话都不会触发**，而这套功能的价值
 * 恰恰是「看见你正在扛什么」——入口栓在别人的判断上，等于大概率用不上。
 *
 * 所以补一个人工入口。它不推翻原来那条规则：模型提议仍然要用户点头才算数，
 * 自己放上去本来就是自己做主，更直接。
 *
 * 三个字段的顺序是刻意排的：先"是什么"（自由文本，用户自己的话），再"落在哪儿"，
 * 最后"有多重"。倒过来会变成先做选择题——人在说难受的事时，选择题最烦。
 */
const WEIGHT_OPTIONS:[1|2|3,string][] = [
 [1,'偶尔想起来会沉一下'],
 [2,'常常压着'],
 [3,'每天都绕不开'],
];

export function MonsterCreate({state,act,busy}:{state:Game;act:Act;busy:boolean}){
 const live=activeMonsters(state);
 const full=live.length>=MAX_ACTIVE_MONSTERS;
 const [open,setOpen]=useState(false);
 const [text,setText]=useState('');
 const [name,setName]=useState('');
 const [kind,setKind]=useState<MonsterKind>('life');
 const [weight,setWeight]=useState<1|2|3>(2);
 const [saving,setSaving]=useState(false);
 const [note,setNote]=useState('');

 const busyNow=busy||saving;

 function reset(){
  setText('');setName('');setKind('life');setWeight(2);setNote('');
 }

 async function submit(e:React.FormEvent){
  e.preventDefault();
  const body=text.trim();
  if(!body||busyNow)return;
  setSaving(true);setNote('');
  try{
   // clientId 每次都是新的：monster-summon 按 sourceRunId 去重，
   // 复用同一个 id 会让第二次点击静默无效（看起来像没反应）。
   const ok=await act({type:'monster-summon',clientId:newId(),kind,weight,name:name.trim(),sourceText:body});
   if(ok){reset();setOpen(false);}
   else setNote('这次没放上去，再试一次。');
  }finally{
   setSaving(false);
  }
 }

 return <section className="panel monster-create" aria-labelledby="monster-create-title">
  <div className="section-heading">
   <h2 id="monster-create-title">星球上扛着的</h2>
   <span className="small muted">{live.length?`${live.length} 只`:'还没有'}</span>
  </div>

  <p className="monster-create__intro">
   {live.length
    ? '它们不会自己长回来，也不会因为你没进步变重。你过日子、说出来、缓过来一点，它就薄一点。'
    : '有一件事一直压着，可以把它放上去。它会变成星球上的一块影子——不催你，只替你看住它。'}
  </p>

  {live.length>0&&<ul className="monster-create__list">
   {live.map(m=>{
    const meta=monsterMeta(m);
    const fade=Math.round((1-m.hp/m.maxHp)*100);
    return <li key={m.id}>
     <span className="monster-create__dot" style={{background:meta.color}} aria-hidden="true"/>
     <span className="monster-create__name">{m.name}</span>
     <span className="monster-create__where">{meta.where}</span>
     <span className="monster-create__fade">{fade>0?`薄了 ${fade}%`:'还没薄过'}</span>
    </li>;
   })}
  </ul>}

  {!open&&<button
   type="button"
   className="secondary full monster-create__open"
   disabled={full||busyNow}
   onClick={()=>{reset();setOpen(true);}}
  >
   <Plus size={16}/>{full?'先让一只走掉，才能放新的':'说一件我扛着的事'}
  </button>}

  {open&&<form className="monster-create__form" onSubmit={submit}>
   <label className="monster-create__field">
    <span>它是什么？</span>
    <textarea
     required
     rows={3}
     maxLength={200}
     value={text}
     disabled={busyNow}
     placeholder="用你自己的话就行。说不清也可以写「有一团说不清的东西」。"
     onChange={e=>setText(e.target.value)}
    />
   </label>

   <label className="monster-create__field">
    <span>给它起个名字<small>（可以不起，随时能改）</small></span>
    <input
     maxLength={20}
     value={name}
     disabled={busyNow}
     placeholder="不超过 20 字"
     onChange={e=>setName(e.target.value)}
    />
   </label>

   <fieldset className="monster-create__choice">
    <legend>它落在哪儿</legend>
    {MONSTER_KINDS.map(k=><label key={k.id}>
     <input type="radio" name="monster-kind" value={k.id} checked={kind===k.id} disabled={busyNow} onChange={()=>setKind(k.id)}/>
     <span><strong>{k.label}</strong><small>{k.where}</small></span>
    </label>)}
   </fieldset>

   <fieldset className="monster-create__choice">
    <legend>有多重</legend>
    {WEIGHT_OPTIONS.map(([w,label])=><label key={w}>
     <input type="radio" name="monster-weight" value={w} checked={weight===w} disabled={busyNow} onChange={()=>setWeight(w)}/>
     <span><strong>{label}</strong></span>
    </label>)}
   </fieldset>

   <p className="monster-create__hint">放上去之后不点数、不打卡。你说话、做成一点小事、心情缓过来、照顾自己，它都会自动薄一点。</p>
   {note&&<p className="error" role="alert">{note}</p>}

   <div className="monster-create__actions">
    <button type="submit" className="primary" disabled={busyNow||!text.trim()}>{saving?'正在放上去…':'放上去'}</button>
    <button type="button" className="text-button" disabled={busyNow} onClick={()=>{reset();setOpen(false);}}>先不放了</button>
   </div>
  </form>}
 </section>;
}
