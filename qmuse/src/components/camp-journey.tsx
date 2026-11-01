import {useState} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,Check,Compass,Feather,Flame,Footprints,Lightbulb,Mail,Search,Sparkles} from 'lucide-react';
import {assetUrl} from '@/asset-urls';
import {CharacterPreview} from './character-2d';
import {characterGender} from '@/lib/appearance';
import {campChoices,campProgress,type CampPath} from '@/lib/camp';
import {day,type Action,type Game,type Task} from '@/lib/game';
import './camp-journey.css';

const campScene=new URL('../assets/camp-scene-v1.webp',import.meta.url).href;

type Props={state:Game;busy:boolean;error?:string;quiet:boolean;mutate:(action:Action)=>Promise<boolean>;back:()=>void;record:(task:Task)=>void;goals:()=>void};

export function CampJourney({state,busy,error,quiet,mutate,back,record,goals}:Props){
 const progress=campProgress(state);
 const [preview,setPreview]=useState<CampPath>('curiosity');
 const [examined,setExamined]=useState(false);
 const [examinedText,setExaminedText]=useState('');
 const [selectedTask,setSelectedTask]=useState('');
 const [sourceOpen,setSourceOpen]=useState(false);
 const [saveMessage,setSaveMessage]=useState('');
 const path=progress.path||preview,curious=path==='curiosity';
 const task=progress.tasks.find(t=>t.id===selectedTask)||progress.tasks[0];
 const observation=state.logs.filter(l=>!l.undone&&!l.direction&&l.unit!=='元').sort((a,b)=>b.at.localeCompare(a.at))[0];
 const goal=state.goals.find(g=>!g.paused&&!g.completionChoice);
 function inspect(){setExaminedText(observation?.note||observation?.title||goal?.title||'可以从一个自选目标开始。');setExamined(true);}
 async function choose(){
  setSaveMessage('');
  const saved=await mutate({type:'event',id:'arrival',choice:campChoices[preview]});
  if(saved){setExamined(false);setSaveMessage('启程选择已保存。你的营地有了自己的方向。');}
  else setSaveMessage('这次选择尚未保存，预览仍保留。可以重试或返回星球。');
 }
 return <section className={`camp-journey camp-${path}${quiet?' camp-still':''}`} aria-labelledby="camp-title">
  <div className="camp-heading"><button className="secondary compact" onClick={back}><ArrowLeft size={16}/>返回星球</button><span>序章延展 · 一封来自未来的信</span><span className="camp-fact">虚构场景 · 记录由本人确认</span></div>
  <div className="camp-layout">
   <div className="camp-vista">
    <img className="camp-world" src={campScene} alt="沿用成长星球风格的营地露台，左侧观测桌、右侧起步台与中央落脚处" onError={e=>{if(e.currentTarget.src!==assetUrl('/world.jpg'))e.currentTarget.src=assetUrl('/world.jpg');}}/>
    <div className="camp-scene-caption"><span className="eyebrow">STARLIGHT CAMP</span><h2 id="camp-title">{!progress.path?'把第一束光，留在哪里？':curious?'先看清，再出发。':'先迈一步，再看回响。'}</h2><p>{!progress.path?'一封信，一盏灯。这里会记得你怎样开始。':curious?'观测桌已点亮，你的经历成为下一次探索的线索。':'起步台已点亮，给眼前的一件小事留一个位置。'}</p></div>
    <div className="camp-character"><CharacterPreview gender={characterGender(state.profile)} outfit={state.equipped}/></div>
    <div className="camp-trail" aria-hidden="true"/>
    <button className={`camp-station camp-observation ${curious?'is-lit':''}`} onClick={()=>{if(!progress.path){setPreview('curiosity');}else if(curious)inspect();else setSourceOpen(true);}} aria-pressed={!progress.path?curious:undefined}>
     <span className="camp-station-orb"><Search size={27}/></span><strong>观测桌</strong><small>{curious?'先发现一个线索':'安静回望'}</small>
    </button>
    <button className={`camp-station camp-workbench ${!curious?'is-lit':''}`} onClick={()=>{if(!progress.path)setPreview('courage');else document.getElementById('camp-action')?.focus();}} disabled={!!progress.path&&curious&&!examined} aria-pressed={!progress.path?!curious:undefined}>
     <span className="camp-station-orb"><Footprints size={27}/></span><strong>起步台</strong><small>{!curious?'先选一件能做的事':examined?'选择下一步':'先读观测桌的线索'}</small>
    </button>
    <button className={`camp-echo ${progress.echo?'has-echo':''}`} onClick={()=>setSourceOpen(!sourceOpen)} aria-expanded={sourceOpen}>
     {progress.echo?<Flame size={21}/>:<Lightbulb size={21}/>}<span>{progress.echo?'第一束回响 · 查看来源':'留给下一次归来的光'}</span>
    </button>
   </div>
   <div className="camp-story">
    {!progress.path?<><span className="eyebrow"><Mail size={15}/> 未来的你，留了一封信</span><h3>“未来的我，正在感谢今天迈出的第一步。”</h3><p>你想带上什么出发？先点一处，看看这束光会怎样改变营地。</p>
     <div className="camp-path-choices" role="group" aria-label="预览启程方向">
      <button className={curious?'selected':''} onClick={()=>setPreview('curiosity')} aria-pressed={curious}><Search size={19}/><span><strong>一份好奇心</strong><small>先观察经历，找到线索再选择行动</small></span>{curious&&<Check size={17}/>}</button>
      <button className={!curious?'selected':''} onClick={()=>setPreview('courage')} aria-pressed={!curious}><Footprints size={19}/><span><strong>一点勇气</strong><small>先选一件小事，再带着经历回来</small></span>{!curious&&<Check size={17}/>}</button>
     </div><div className="camp-consequence"><Sparkles size={18}/><p>{curious?'观测桌会先亮起。你需要先读一条线索，再挑选行动。':'起步台会先亮起。你可以直接挑选行动，归来后再回顾。'}<small>确认后沿用原启程纪念保存，不能重复领取；两种方向都不额外增加经验。</small></p></div>
     <button className="primary full" disabled={busy} onClick={choose}>{busy?'正在保存选择…':`把光留在${curious?'观测桌':'起步台'}`}<ArrowRight size={17}/></button>
    </>:<>
     <span className="eyebrow"><Compass size={15}/> {curious?'好奇心的路径':'勇气的路径'}</span>
     <h3>{progress.echo?'这束光有了来处':curious?'先看看，已经走过的路':'给一件小事留位置'}</h3>
     <p>{progress.echo?'营地接住了你启程后填写的一条行动记录。它是一段经历的回响，成果是否达成仍由你判断。':curious?'读一条记录，或者观察眼前的目标。从已经知道的事情里，寻找还想继续的一点。':'不用先把所有事情想清楚。从自己的行动里选一件，按你的节奏去做。'}</p>
     {curious&&!examined&&<button className="camp-clue" onClick={inspect}><BookOpen size={20}/><span><small>{observation?'已有记录 · 不是新的完成':'当前目标 · 不是已完成成果'}</small><strong>{observation?.title||goal?.title||'先想一想，你想往哪里走？'}</strong><span>{observation?.note||'点击展开这条线索，再选择要继续的小事。'}</span></span><ArrowRight size={17}/></button>}
     {curious&&examined&&<div className="camp-inspected"><Check size={16}/><p>线索已读：{examinedText}<small>这条线索只帮助你决定下一步，不自动增加进度。</small></p></div>}
     {(!curious||examined)&&<div className="camp-action-picker"><label htmlFor="camp-action">{curious?'接下来，你想继续哪一步？':'选择眼前的一件事'}</label>{task?<><select id="camp-action" value={task.id} onChange={e=>setSelectedTask(e.target.value)}>{progress.tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select><p className="camp-standard">{task.completionCriteria||`按自己的节奏推进；原行动目标为 ${task.target} ${task.unit}。`}</p><button className="primary full" onClick={()=>record(task)} disabled={busy}>我已行动，填写实际记录<Feather size={16}/></button><p className="camp-small">请先去现实中行动；打开表单、选择方向或留在场景中都不会算作完成。</p></>:<><p>眼前的行动已收好，或者还没有设置。你可以先休息，也可以去目标页选择下一步。</p><button className="secondary full" onClick={goals}>查看我的目标<ArrowRight size={16}/></button></>}</div>}
     <div className="camp-route-summary"><span className="camp-route-dot"/>你的启程选择：{progress.arrival?.choice}。离开再回来，营地仍会记住。</div>
    </>}
    {(saveMessage||error)&&<p className={error?'error':'camp-small'} role="status">{error||saveMessage}</p>}
   </div>
  </div>
  {sourceOpen&&<section className="camp-source" aria-labelledby="camp-source-title"><BookOpen size={21}/><div><h3 id="camp-source-title">{progress.echo?'回响的来源 · 本人记录':'这束光，等你带一段经历回来'}</h3>{progress.echo?<><p>{progress.echo.title}</p><p>{progress.echo.note||'这条记录没有填写感受。'}</p><small>发生日期 {progress.echo.date} · 填写日期 {day(new Date(progress.echo.at))} · {progress.echo.value} {progress.echo.unit} · {progress.echo.source==='timer'?'计时后由本人确认':'本人手动填写'}</small><p className="camp-small">回响只展示有效记录。撤销该记录后会重新计算，不额外发放游戏经验。</p></>:<p>确认启程后填写的有效行动记录会在这里留下来源。原先的记录继续保留，不冒充这次新的回响。你随时可以休息或返回星球。</p>}</div></section>}
  <p className="camp-boundary">营地与布置属于虚构探索；行动和成果仍以你确认的记录为准。AI不会替你完成这段经历。</p>
 </section>;
}
