'use client';

import {Fragment,useCallback,useEffect,useRef,useState,useSyncExternalStore,type FormEvent} from 'react';
import {Download,Mic,Send,Trash2,Undo2} from 'lucide-react';
import {toast} from 'sonner';
import {ApiError,readJSON,requestError} from '@/lib/api-client';
import {type Action,type Game,type JournalEntry,availableXP,day,domains} from '@/lib/game';
import {MONSTER_KINDS,MONSTER_WEIGHT_HP} from '@/lib/monsters';
import {TIRED_LINE} from '@/lib/assistant-line';
import {exportJournal} from '@/lib/export-journal';
import {newId} from '@/lib/ids';
import {timeoutSignal} from '@/lib/abort';
import {fitChatTurn} from '@/lib/chat-payload';
import {VOICE_REASON,SERVER_VOICE_STATUS,startListening,subscribeVoice,voiceStatus,type VoiceSession} from '@/lib/voice';
import type {ChatResult} from '@/lib/ai/chat-contract';
import './chat-room.css';

type Posture='companion'|'counselor';
type Act=(action:Action)=>Promise<boolean>;
type Run={id:string;reply:ChatResult;createdAt:string};

// 与导出保持同一时刻口径：上海时区、24 小时制；at 异常时不显示时刻而不是显示假时刻。
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function timeOf(at:string){if(typeof at!=='string'||!at)return '';const d=new Date(at);if(Number.isNaN(d.getTime()))return '';return clock.format(d);}
// 记录的 domain 缺失时与 claim-record 的兜底一致，按认知展示。
function domainMeta(id:string|undefined){return domains.find(d=>d.id===id)??domains[0];}

function RecordCard({entry,state,busy,sending,act,confirming,onAskDelete,onCancelDelete}:{entry:JournalEntry;state:Game;busy:boolean;sending:boolean;act:Act;confirming:boolean;onAskDelete:()=>void;onCancelDelete:()=>void}){
  const meta=domainMeta(entry.domain),locked=busy||sending;
  // 摘要可以改，但已转为行动的记录不再给入口：它已经进了行动与记录，改摘要会让两边说法不一致。
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState(entry.summary);
  // 经验受「当日同领域上限 30」约束：如实显示会得到的值，避免点下去发现是 0。
  const left=availableXP(state,meta.id);
  const claimLabel=left>0?`算，记进${meta.name} · +${left} EXP`:`算，记进${meta.name} · 今日已满`;
  const time=timeOf(entry.at);
  async function saveSummary(){
    if(locked||!draft.trim())return;
    const ok=await act({type:'edit-journal',id:entry.id,summary:draft});
    if(ok)setEditing(false);
  }
  // 点卡片其他位置、或点了别的记录，都退回初始态，免得「确定删除」一直挂在那儿。
  return <article className="chat-room__record" data-status={entry.status} onClick={onCancelDelete}>
    <div className="chat-room__record-head">
      <span className="chat-room__dot" style={{background:meta.color}} aria-hidden="true"/>
      <span className="chat-room__record-meta">{meta.name}{time?` · ${time}`:''}</span>
      {entry.status==='claimed'&&<span className="chat-room__badge chat-room__badge--claimed">已转为行动</span>}
      {entry.status==='kept'&&<span className="chat-room__badge">只留着</span>}
    </div>
    {editing
      ? <div className="chat-room__edit" onClick={e=>e.stopPropagation()}>
          <input className="chat-room__edit-input" value={draft} maxLength={200} disabled={locked} onChange={e=>setDraft(e.target.value)} aria-label="修改这条记录的摘要"/>
          <button type="button" className="chat-room__edit-save" disabled={locked||!draft.trim()} onClick={saveSummary}>保存</button>
          <button type="button" className="chat-room__edit-cancel" disabled={locked} onClick={()=>{setDraft(entry.summary);setEditing(false);}}>取消</button>
        </div>
      : <div className="chat-room__record-summary">
          <span>{entry.summary}</span>
          {entry.status!=='claimed'&&<button type="button" className="chat-room__edit-open" disabled={locked} aria-label={`修改这条记录的摘要：${entry.summary}`} onClick={e=>{e.stopPropagation();setDraft(entry.summary);setEditing(true);}}>修改</button>}
        </div>}
    <div className="chat-room__actions">
      {(entry.status==='pending'||entry.status==='kept')&&<button type="button" className="chat-room__claim" disabled={locked} onClick={()=>act({type:'claim-record',id:entry.id})}>{claimLabel}</button>}
      {entry.status==='pending'&&<button type="button" className="chat-room__keep" disabled={locked} onClick={()=>act({type:'keep-record',id:entry.id})}>就记着</button>}
      {/* 撤销认领只回收行动与经验；记录本身留在今天的记录和导出里。 */}
      {entry.status==='claimed'&&<button type="button" className="chat-room__undo" disabled={locked} onClick={()=>act({type:'unclaim-record',id:entry.id})}><Undo2 size={14} aria-hidden="true"/>撤销认领</button>}
      {/* 删除不可恢复，所以走两步：先问一句，确认才真的删。 */}
      {confirming
        ? <span className="chat-room__delete-confirm-box" onClick={e=>e.stopPropagation()}>
            <span className="chat-room__delete-prompt">确定删除？删除后这条记录就不能恢复了</span>
            <button type="button" className="chat-room__delete-confirm" disabled={locked} onClick={()=>act({type:'delete-journal',id:entry.id})}>确定删除</button>
            <button type="button" className="chat-room__delete-cancel" disabled={locked} onClick={onCancelDelete}>取消</button>
          </span>
        : <button type="button" className="chat-room__delete" disabled={locked} aria-label={`删除这条记录：${entry.summary}`} onClick={e=>{e.stopPropagation();onAskDelete();}}><Trash2 size={14} aria-hidden="true"/>删除</button>}
    </div>
  </article>;
}

export interface ChatRoomProps{
  state:Game;
  act:Act;
  /** 页面级保存锁：任何 POST /api/game 进行中都为真。 */
  busy:boolean;
  onPosture:(posture:Posture)=>void;
  /** 只在落库成功后通知，供上层朗读；上层不要在这里换个说法。 */
  onLine:(line:string)=>void;
  /** 麦克风是不是正开着。树人靠这个切到 listening，别自己再猜状态。 */
  onListening?:(on:boolean)=>void;
  /**
   * 正在等模型回话（对话轮次在飞）。树人靠这个切到 thinking。
   *
   * 注意别拿页面的 `busy` 顶替：那个是「存档保存中」，按发送键不会让它变真，
   * 结果就是界面写着「正在想…」而树人一动没动——真机上验出来过。
   */
  onWaiting?:(waiting:boolean)=>void;
}

export function ChatRoom({state,act,busy,onPosture,onLine,onListening,onWaiting}:ChatRoomProps){
  const [draft,setDraft]=useState('');
  const [sending,setSendingState]=useState(false);
  // 树人要在「等模型回话」时切 thinking。这个信号只有这里知道（保存存档是另一个 busy），
  // 所以统一经这一个函数往外报，别让父级去猜。
  const markSending=useCallback((v:boolean)=>{setSendingState(v);onWaiting?.(v);},[onWaiting]);
  const [quickReplies,setQuickReplies]=useState<ChatResult['quickReplies']>([]);
  const [saveWarning,setSaveWarning]=useState(false);
  const [adultOk,setAdultOk]=useState(false);
  const [consentOk,setConsentOk]=useState(false);
  const [consentGranted,setConsentGranted]=useState(false);
  // 删除确认态：记住哪一条正在确认；点别的记录的删除会自然把上一条复位。
  const [confirmDelete,setConfirmDelete]=useState<string|null>(null);
  // 手机上「今天的记录」默认收起，只占一行；桌面版不看这个状态，列表始终展开。
  const [showRecords,setShowRecords]=useState(false);
  // 模型提了一只怪，等用户点头。**只在这一次会话里有效**：它不是存档数据，
  // 刷新之后消失是对的——用户没接话就等于没要。
  const [monsterOffer,setMonsterOffer]=useState<{runId:string;sourceText:string;name:string;kind:'life'|'setback'|'emotion';weight:1|2|3;note:string}|null>(null);
  const flight=useRef(false);
  // 切咨询师的同意只对紧跟的那一次请求有效，发送时立刻清零。
  const consentOnce=useRef(false);
  // 回复已经生成、但还没落库的那一轮：重发时复用它，既不重复请求（白烧额度），也不丢原文。
  const unsaved=useRef<{runId:string;userText:string;reply:ChatResult}|null>(null);
  const inputRef=useRef<HTMLInputElement|null>(null);
  const streamRef=useRef<HTMLDivElement|null>(null);
  // 语音输入：按住说话 → 文字填进输入框 → **用户自己按发送**。任何情况下都不自动发。
  // 能力判断走 useSyncExternalStore：服务端没有 window，用 server 快照保住 hydration 一致。
  const voice=useSyncExternalStore(subscribeVoice,voiceStatus,()=>SERVER_VOICE_STATUS);
  const [micOn,setMicOn]=useState(false);
  const [voiceNote,setVoiceNote]=useState('');
  const session=useRef<VoiceSession|null>(null);
  // 开录那一刻输入框里已有的字。识别结果接在它后面，不覆盖用户打了一半的话。
  const spokenBase=useRef('');
  const today=day();
  const todayRecords=[...state.journal].filter(e=>e.date===today).sort((a,b)=>String(a.at||'').localeCompare(String(b.at||'')));
  // 同意只问一次：存档里记过、或这次会话里已经同意过，就不再显示。
  const consentDone=consentGranted||state.settings.chatConsent===true;
  const canSend=consentDone||(adultOk&&consentOk);

  useEffect(()=>{const el=streamRef.current;if(el)el.scrollTop=el.scrollHeight;},[state.chat.length]);

  useEffect(()=>{
    // 离开页面时别让麦克风还开着。cancel 不回调，所以这里不用复位 UI。
    return ()=>session.current?.cancel();
  },[]);

  // 松手后浏览器通常会补一次 onend 来收尾。荣耀那台百度内核**实测从不触发 onend**
  // （真机上确认过：松手后一直悬着，直到看门狗强收）。所以这个看门狗不是兜底，是主路径。
  // 时间压到 900ms：真的补 onend 的浏览器会先在几百毫秒内清掉它；不补的也不至于
  // 让按钮橙色地杵在那儿——用户会以为还在录。
  const stopTimer=useRef<number|null>(null);
  const clearStopTimer=useCallback(()=>{
    if(stopTimer.current!==null){clearTimeout(stopTimer.current);stopTimer.current=null;}
  },[]);
  const endVoice=useCallback(()=>{
    clearStopTimer();
    session.current=null;
    setMicOn(false);
    onListening?.(false);
  },[clearStopTimer,onListening]);

  const stopVoice=useCallback(()=>{
    const s=session.current;
    if(!s)return;
    s.stop();
    if(stopTimer.current===null)stopTimer.current=window.setTimeout(()=>{
      stopTimer.current=null;
      // 还在同一次会话上，说明 onend 根本没来：强制收掉它，别让麦克风悬着。
      if(session.current===s){s.cancel();endVoice();}
    },900);
  },[endVoice]);

  const startVoice=useCallback(()=>{
    if(session.current)return;
    if(!voice.ok){setVoiceNote(VOICE_REASON[voice.reason]);return;}
    spokenBase.current=draft;
    setVoiceNote('');
    const s=startListening({
      // 还在变的半句话也先填进去：手机上看得到自己说到哪了，比等最后一次性跳出来踏实。
      onTranscript:text=>setDraft(spokenBase.current+text),
      onError:message=>{if(message)setVoiceNote(message);},
      onEnd:endVoice,
    });
    if(!s){setVoiceNote('语音没能启动，先用打字吧。');return;}
    session.current=s;setMicOn(true);onListening?.(true);
  },[voice,draft,endVoice,onListening]);

  // 窗口层面再兜一层「松手」：真机上按下麦克风会先弹系统权限框，页面拿不到那次抬手，
  // 按钮上的 onPointerUp 就永远等不到，麦克风一直亮着。
  // 所以只要麦克风开着，页面上任何地方的抬手 / 取消、切到后台、页面离开，都当作松手。
  //
  // 特意**不听 window 的 blur**：第一次按麦克风时系统权限框一弹出来，页面就失焦，
  // 那一下会把刚开始的识别立刻掐死——用户还没说完就被关了。切后台用
  // visibilitychange 判断（真的隐藏才算），不会误伤权限框。
  useEffect(()=>{
    if(!micOn)return;
    const off=()=>stopVoice();
    const onHide=()=>{if(document.visibilityState==='hidden')off();};
    window.addEventListener('pointerup',off);
    window.addEventListener('pointercancel',off);
    window.addEventListener('pagehide',off);
    document.addEventListener('visibilitychange',onHide);
    return ()=>{
      window.removeEventListener('pointerup',off);
      window.removeEventListener('pointercancel',off);
      window.removeEventListener('pagehide',off);
      document.removeEventListener('visibilitychange',onHide);
    };
  },[micOn,stopVoice]);

  async function send(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const text=draft.trim();
    if(flight.current||busy||!text)return;
    // 换了另一句话就不是待重试的那一轮，旧结果作废。
    if(unsaved.current&&unsaved.current.userText!==text)unsaved.current=null;
    const retry=unsaved.current;
    // 重试说明同意早就给过了，不再被勾选框拦住。
    if(!retry&&!canSend)return;
    flight.current=true;
    const switchConsent=retry?false:consentOnce.current;
    consentOnce.current=false;
    markSending(true);setSaveWarning(false);setDraft('');setQuickReplies([]);
    let done:Run|null=null;
    try{
      let run:Run;
      if(retry){
        // 上一轮只是没落库：同一个 runId 重放 chat-turn，reducer 幂等，且不再消耗聊天额度。
        run={id:retry.runId,reply:retry.reply,createdAt:new Date().toISOString()};
      }else{
        const lastAssistant=[...state.chat].reverse().find(t=>t.role==='assistant');
        const prevPosture:Posture=lastAssistant?.posture==='counselor'?'counselor':'companion';
        const response=await fetch('/api/chat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},signal:timeoutSignal(60000),body:JSON.stringify({requestId:newId(),userText:text,prevPosture,switchConsent,consent:true,adult:true})});
        const {run:next}=await readJSON<{run:Run}>(response);
        if(!next||typeof next.id!=='string'||typeof next.reply?.reply!=='string')throw new Error('返回的数据不完整，本次对话未保存，请重试。');
        run=next;
      }
      // 先落库、再更新界面：刷新后不会出现「界面上有、存档里没有」。
      // run.id 就是 requestId，chat-turn 用它做 clientId，重复提交天然幂等。
      let saved=false;
      try{
        // monster 和 mood 必须一起进这一条：reducer 靠它们决定怪兽挨多少、哪种来源。
        // 漏传的话模型说了 lighter 也没人听，规则二会静默失效一半。
        const action={type:'chat-turn' as const,clientId:run.id,userText:text,reply:run.reply.reply,posture:run.reply.posture,askSwitch:run.reply.askSwitch,records:run.reply.records,memoryCandidates:run.reply.memoryCandidates,monster:run.reply.monster??undefined,mood:run.reply.mood};
        // 直接发会被 /api/game 的 10KB 上限挡成 413，而重试复用的是同一份 payload，
        // 于是这条对话永远存不上、额度却已经扣过一次。先按 reducer 的同一套位数压进上限。
        const fitted=fitChatTurn(action);
        if(!fitted)throw new Error('这段话太长了，没能整理成记录。缩短一些再发一次。');
        saved=await act(fitted);
      }catch(err){saved=false;if(err instanceof Error&&!('status' in err))toast.error(err.message);}
      if(!saved){
        // 冲突/登录失效时 act 根本没发请求就返回 false：原文必须回到输入框，回复留着下次重试。
        // act 自己已经 toast 过，这里只在记录区补一句说明。
        unsaved.current={runId:run.id,userText:text,reply:run.reply};
        setDraft(text);setSaveWarning(true);
        return;
      }
      unsaved.current=null;done=run;
    }catch(err){
      // 请求没成功：原文放回输入框，用户可以直接再发一次。
      setDraft(text);
      // 模型不可用（503）不是用户的错：让助手自己在气泡里说一句累，不弹红条、不提示「没存上」。
      if(err instanceof ApiError&&err.status===503){onLine(TIRED_LINE);return;}
      toast.error(requestError(err));
      return;
    }finally{
      flight.current=false;
      markSending(false);
    }
    // 落库成功后的通知放在 try 外：父级回调抛错不能回填原文，那时对话已经存上了。
    if(!done)return;
    setQuickReplies(done.reply.quickReplies);
    onLine(done.reply.reply);
    onPosture(done.reply.posture);
    // 怪兽提议：只在落库成功之后才问。存都没存上就提一只怪，会让人以为它已经在那儿了。
    const offer=done.reply.monster;
    if(offer&&offer.event==='appear')setMonsterOffer({runId:done.id,sourceText:text,name:offer.name,kind:offer.kind,weight:offer.weight,note:offer.note});
    else setMonsterOffer(null);
    if(!consentDone){
      // 同意标记由 chat-turn 自己落库（见 lib/game.ts），这里只更新本次会话的界面状态。
      setConsentGranted(true);
    }
  }

  function pickQuick(reply:ChatResult['quickReplies'][number]){
    // 同意切咨询师只属于这一次点选；改选别的快捷回复就撤销同意，避免永久带着 true。
    consentOnce.current=reply.kind==='accept-switch';
    setDraft(reply.label.slice(0,1000));
    inputRef.current?.focus();
  }

  // 放进去 = 用户点头。模型提议的东西到这一步才真的落库。
  async function summonMonster(){
    if(!monsterOffer)return;
    const ok=await act({type:'monster-summon',clientId:monsterOffer.runId,kind:monsterOffer.kind,name:monsterOffer.name,weight:monsterOffer.weight,sourceText:monsterOffer.sourceText});
    if(ok)setMonsterOffer(null);
  }
  // 已经在星球上的那只不该再问一遍：用户可能点了按钮但界面还没刷新。
  const offerLive=monsterOffer&&!state.monsters.some(m=>m.sourceRunId===monsterOffer.runId)?monsterOffer:null;
  const offerKind=offerLive?MONSTER_KINDS.find(k=>k.id===offerLive.kind):undefined;

  return <section className="chat-room" aria-label="记录官对话">
    <div className="chat-room__stream" ref={streamRef} role="log" aria-live="polite">
      {state.chat.length===0
        ? <p className="chat-room__empty">说一句今天的感受吧，我会把值得留下的记下来。</p>
        : <ul className="chat-room__turns">
          {state.chat.map((turn,i)=>{
            const previous=state.chat[i-1];
            const newDay=!previous||previous.date!==turn.date;
            // assistant 轮的 id 是「用户轮 id + '-a'」，记录用 runId（即用户轮 id）关联。
            const noted=turn.role==='assistant'&&previous&&previous.role==='user'?state.journal.filter(j=>j.runId===previous.id):[];
            return <Fragment key={turn.id}>
              {newDay&&<li className="chat-room__day-sep">{turn.date===today?'今天':turn.date}</li>}
              <li className={`chat-room__turn chat-room__turn--${turn.role}`}>
                <span className="chat-room__who">{turn.role==='user'?'我':'它'}</span>
                <div className="chat-room__bubble">{turn.text}</div>
                {noted.length>0&&<div className="chat-room__noted">
                  <span className="chat-room__noted-title">我记下了这些</span>
                  <ul>{noted.map(record=><li key={record.id}>{record.summary}</li>)}</ul>
                </div>}
              </li>
            </Fragment>;
          })}
        </ul>}
    </div>

    {quickReplies.length>0&&!sending&&<div className="chat-room__quick" role="group" aria-label="快捷回复">
      {quickReplies.map((reply,i)=><button type="button" key={`${reply.kind}-${i}`} className="chat-room__quick-reply" onClick={()=>pickQuick(reply)}>{reply.label}</button>)}
    </div>}

    {/* 环境同意只出现一次：不是弹窗、不遮挡助手，也不挡输入，只挡发送按钮。 */}
    {!consentDone&&<div className="chat-room__consent">
      <label className="chat-room__consent-item"><input type="checkbox" checked={adultOk} onChange={e=>setAdultOk(e.target.checked)}/>我已满 18 岁</label>
      <label className="chat-room__consent-item"><input type="checkbox" checked={consentOk} onChange={e=>setConsentOk(e.target.checked)}/>同意把对话和记录发给模型生成回复</label>
      {/* 清单默认收起：首屏只交代「对话和记录会发出去」，细节留给愿意细看的人。summary 自带键盘与读屏支持。 */}
      <details className="chat-room__consent-details">
        <summary>具体发送什么</summary>
        <p>对话原文（最近 40 条）、长期记忆（最多 40 条）、目标与近期行动记录、储蓄进度、等级与今日经验。照片、生日、人生纪念不会发送。</p>
      </details>
      {!canSend&&<p className="chat-room__hint">勾选以上两项后就能开始对话；手动记录一直可用。</p>}
    </div>}

    {/* 怪兽提议：不弹窗、不打断，只在输入框上面多一行。
        要不要把这件事变成一个「形状」，权力留给你——有时候人只是想说说。 */}
    {offerLive&&<div className="chat-room__monster" role="group" aria-label="要不要把它放进星球">
      <div className="chat-room__monster-copy">
        <span className="chat-room__monster-kicker">要不要把它放进星球？</span>
        <input
          className="chat-room__monster-name"
          value={offerLive.name}
          maxLength={20}
          disabled={busy||sending}
          placeholder="给它起个名字（可以不起）"
          aria-label="这只怪的名字"
          onChange={e=>setMonsterOffer({...offerLive,name:e.target.value})}
        />
        <p className="chat-room__monster-note">{offerLive.note||`它落在${offerKind?.where??'星球上'}。`}</p>
        <span className="chat-room__monster-meta">{offerKind?.label??'正在扛的事'} · {MONSTER_WEIGHT_HP[offerLive.weight]} 点厚</span>
      </div>
      <div className="chat-room__monster-actions">
        <button type="button" className="chat-room__monster-yes" disabled={busy||sending} onClick={summonMonster}>放进去</button>
        <button type="button" className="chat-room__monster-no" disabled={busy||sending} onClick={()=>setMonsterOffer(null)}>不用，只是聊聊</button>
      </div>
    </div>}

    <form className="chat-room__compose" onSubmit={send}>
      <input
        ref={inputRef}
        className="chat-room__input"
        value={draft}
        onChange={e=>{consentOnce.current=false;setDraft(e.target.value);}}
        maxLength={1000}
        disabled={sending}
        placeholder={sending?'正在想…':'今天想聊点什么？'}
        aria-label="对记录官说一句话"
        enterKeyHint="send"
        autoComplete="off"
      />
      {/*
        按住说话。用 pointer 事件而不是 click：click 分不出「按住」和「点一下」，
        而按住说话必须知道什么时候松手。
        不支持语音时按钮**照样显示**、按下去给一句原因——在用户那台手机上，
        「按钮是灰的」本身就是我们要从真机拿到的一条信息，静默隐藏反而让人以为是没做。
      */}
      <button
        type="button"
        className={`chat-room__mic${micOn?' is-listening':''}${voice.ok?'':' is-unavailable'}`}
        disabled={sending||busy}
        aria-label={voice.ok?'按住说话':'语音输入不可用，按一下看原因'}
        aria-pressed={micOn}
        aria-describedby={voiceNote?'chat-room-voice-note':undefined}
        onPointerDown={e=>{
          // 安卓长按会弹系统菜单，按住说话得把它压掉，否则一按就跳上下文菜单。
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          startVoice();
        }}
        onPointerUp={stopVoice}
        onPointerCancel={stopVoice}
        onContextMenu={e=>e.preventDefault()}
        onKeyDown={e=>{
          if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();startVoice();}
        }}
        onKeyUp={e=>{
          if(e.key===' '||e.key==='Enter'){e.preventDefault();stopVoice();}
        }}
      >
        <Mic size={18} aria-hidden="true"/>
      </button>
      <button type="submit" className="chat-room__send" disabled={sending||busy||!draft.trim()||!canSend}>
        {sending?'正在想…':<><Send size={16} aria-hidden="true"/>发送</>}
      </button>
    </form>

    {voiceNote&&<p className="chat-room__voice-note" id="chat-room-voice-note" role="status">{voiceNote}</p>}

    {showRecords&&todayRecords.length>0&&<button type="button" className="chat-room__records-backdrop" aria-label="收起今天的记录" onClick={()=>setShowRecords(false)}/>}
    <section className={`chat-room__records${showRecords?' is-open':''}${todayRecords.length===0?' is-empty':''}`} aria-labelledby="chat-room-records-title">
      <div className="chat-room__records-head">
        <h3 id="chat-room-records-title">今天的记录</h3>
        <span className="chat-room__record-count" aria-label={`${todayRecords.length} 条`}>{todayRecords.length}</span>
        <button type="button" className="chat-room__records-toggle" aria-expanded={showRecords} aria-controls="chat-room-record-list" onClick={()=>setShowRecords(v=>!v)}>{showRecords?'收起':'展开'}</button>
        <button type="button" className="chat-room__export" aria-label="导出今天的记录" onClick={()=>exportJournal(state,today)}><Download size={15} aria-hidden="true"/><span className="chat-room__export-label">导出今天的记录</span></button>
      </div>
      {saveWarning&&<p className="chat-room__warning" role="alert">这次的记录没存上。原文已放回输入框：直接再发会用同一条回复重试，改了字就会重新问一次。</p>}
      {todayRecords.length===0
        ? <p className="chat-room__empty" id="chat-room-record-list">今天还没有记录。</p>
        : <ul className="chat-room__record-list" id="chat-room-record-list">
          {todayRecords.map(entry=><li key={entry.id}><RecordCard entry={entry} state={state} busy={busy} sending={sending} act={act} confirming={confirmDelete===entry.id} onAskDelete={()=>setConfirmDelete(entry.id)} onCancelDelete={()=>setConfirmDelete(null)}/></li>)}
        </ul>}
    </section>
  </section>;
}
