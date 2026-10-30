'use client';

import {Fragment,useEffect,useRef,useState,type FormEvent} from 'react';
import {Download,Send,Trash2,Undo2} from 'lucide-react';
import {toast} from 'sonner';
import {ApiError,readJSON,requestError} from '@/lib/api-client';
import {type Action,type Game,type JournalEntry,availableXP,day,domains} from '@/lib/game';
import {TIRED_LINE} from '@/lib/assistant-line';
import {exportJournal} from '@/lib/export-journal';
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
}

export function ChatRoom({state,act,busy,onPosture,onLine}:ChatRoomProps){
  const [draft,setDraft]=useState('');
  const [sending,setSending]=useState(false);
  const [quickReplies,setQuickReplies]=useState<ChatResult['quickReplies']>([]);
  const [saveWarning,setSaveWarning]=useState(false);
  const [adultOk,setAdultOk]=useState(false);
  const [consentOk,setConsentOk]=useState(false);
  const [consentGranted,setConsentGranted]=useState(false);
  // 删除确认态：记住哪一条正在确认；点别的记录的删除会自然把上一条复位。
  const [confirmDelete,setConfirmDelete]=useState<string|null>(null);
  const flight=useRef(false);
  // 切咨询师的同意只对紧跟的那一次请求有效，发送时立刻清零。
  const consentOnce=useRef(false);
  // 回复已经生成、但还没落库的那一轮：重发时复用它，既不重复请求（白烧额度），也不丢原文。
  const unsaved=useRef<{runId:string;userText:string;reply:ChatResult}|null>(null);
  const inputRef=useRef<HTMLInputElement|null>(null);
  const streamRef=useRef<HTMLDivElement|null>(null);
  const today=day();
  const todayRecords=[...state.journal].filter(e=>e.date===today).sort((a,b)=>String(a.at||'').localeCompare(String(b.at||'')));
  // 同意只问一次：存档里记过、或这次会话里已经同意过，就不再显示。
  const consentDone=consentGranted||state.settings.chatConsent===true;
  const canSend=consentDone||(adultOk&&consentOk);

  useEffect(()=>{const el=streamRef.current;if(el)el.scrollTop=el.scrollHeight;},[state.chat.length]);

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
    setSending(true);setSaveWarning(false);setDraft('');setQuickReplies([]);
    let done:Run|null=null;
    try{
      let run:Run;
      if(retry){
        // 上一轮只是没落库：同一个 runId 重放 chat-turn，reducer 幂等，且不再消耗聊天额度。
        run={id:retry.runId,reply:retry.reply,createdAt:new Date().toISOString()};
      }else{
        const lastAssistant=[...state.chat].reverse().find(t=>t.role==='assistant');
        const prevPosture:Posture=lastAssistant?.posture==='counselor'?'counselor':'companion';
        const response=await fetch('/api/chat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(60000),body:JSON.stringify({requestId:crypto.randomUUID(),userText:text,prevPosture,switchConsent,consent:true,adult:true})});
        const {run:next}=await readJSON<{run:Run}>(response);
        if(!next||typeof next.id!=='string'||typeof next.reply?.reply!=='string')throw new Error('返回的数据不完整，本次对话未保存，请重试。');
        run=next;
      }
      // 先落库、再更新界面：刷新后不会出现「界面上有、存档里没有」。
      // run.id 就是 requestId，chat-turn 用它做 clientId，重复提交天然幂等。
      let saved=false;
      try{
        saved=await act({type:'chat-turn',clientId:run.id,userText:text,reply:run.reply.reply,posture:run.reply.posture,askSwitch:run.reply.askSwitch,records:run.reply.records,memoryCandidates:run.reply.memoryCandidates});
      }catch{saved=false;}
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
      setSending(false);
    }
    // 落库成功后的通知放在 try 外：父级回调抛错不能回填原文，那时对话已经存上了。
    if(!done)return;
    setQuickReplies(done.reply.quickReplies);
    onLine(done.reply.reply);
    onPosture(done.reply.posture);
    if(!consentDone){
      // 同意标记只写一次；写失败也不影响本次对话，下次会再问。
      setConsentGranted(true);
      void act({type:'settings',chatConsent:true});
    }
  }

  function pickQuick(reply:ChatResult['quickReplies'][number]){
    // 同意切咨询师只属于这一次点选；改选别的快捷回复就撤销同意，避免永久带着 true。
    consentOnce.current=reply.kind==='accept-switch';
    setDraft(reply.label.slice(0,1000));
    inputRef.current?.focus();
  }

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
      <label className="chat-room__consent-item"><input type="checkbox" checked={consentOk} onChange={e=>setConsentOk(e.target.checked)}/>同意把对话原文（最近 40 条）、长期记忆（最多 40 条）、目标与近期行动记录、储蓄进度发送给模型生成回复（照片、生日、人生纪念不会发送）</label>
      {!canSend&&<p className="chat-room__hint">勾选以上两项后就能开始对话；手动记录一直可用。</p>}
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
      <button type="submit" className="chat-room__send" disabled={sending||busy||!draft.trim()||!canSend}>
        {sending?'正在想…':<><Send size={16} aria-hidden="true"/>发送</>}
      </button>
    </form>

    <section className="chat-room__records" aria-labelledby="chat-room-records-title">
      <div className="chat-room__records-head">
        <h3 id="chat-room-records-title">今天的记录</h3>
        <button type="button" className="chat-room__export" onClick={()=>exportJournal(state,today)}><Download size={15} aria-hidden="true"/>导出今天的记录</button>
      </div>
      {saveWarning&&<p className="chat-room__warning" role="alert">这次的记录没存上。原文已放回输入框：直接再发会用同一条回复重试，改了字就会重新问一次。</p>}
      {todayRecords.length===0
        ? <p className="chat-room__empty">今天还没有记录。</p>
        : <ul className="chat-room__record-list">
          {todayRecords.map(entry=><li key={entry.id}><RecordCard entry={entry} state={state} busy={busy} sending={sending} act={act} confirming={confirmDelete===entry.id} onAskDelete={()=>setConfirmDelete(entry.id)} onCancelDelete={()=>setConfirmDelete(null)}/></li>)}
        </ul>}
    </section>
  </section>;
}
