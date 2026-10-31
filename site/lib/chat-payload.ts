// `/api/game` 对请求体有 10KB 硬上限（app/api/game/route.ts:14-15），但那是一层传输保护，
// 早于记录官存在，没人拿它和对话契约对过账。契约（lib/ai/chat-contract.ts）允许
// reply 2000 字、records 3 条（summary 200 + text 400 + 20 个 tag）、memoryCandidates 5 条，
// 中文一字 3 字节，全部用满约 22KB —— 是上限的 2.2 倍。
//
// 撞上 413 之后 chat-room 走 !saved 分支：原文回填、提示「直接再发会用同一条回复重试」。
// 但重试复用的是同一份超大 payload，必然再次 413 —— 这条对话永远存不进存档，
// 而模型额度已经花掉一次。所以发之前就压到上限内，并优先丢最不值钱的部分：
// 回复的结尾 → 记忆候选 → 记录的正文 → 最后才动用户的原话。
//
// reducer 本来就会按同样的位数截断（lib/game.ts 的 chat-turn 分支），
// 这里少发出去的字在存档里本来也不会存在，不会造成两边不一致。
import type {ChatResult} from './ai/chat-contract';

// 与服务端的判定口径保持一致：content-length / raw.length 都拿 10000 比。
const LIMIT=10000;
const bytes=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v)).length;
const cut=(v:unknown,max:number)=>typeof v==='string'?v.slice(0,max):'';

export type ChatTurn={type:'chat-turn';clientId:string;userText:string;reply:string;posture:string;askSwitch:boolean;records:ChatResult['records'];memoryCandidates:ChatResult['memoryCandidates'];
 // 怪兽提议和心情信号。两者都缺省等于「什么都不发生」，不影响旧行为。
 monster?:ChatResult['monster'];mood?:ChatResult['mood']};
// 一条怪兽提议体积很小（名字 20 + 说明 200，中文约 700 字节），但它决定用户能不能看到
// 「要不要把它放进星球」那一行。所以压缩链上放在很后面才砍。
const dropMonster=(m:ChatTurn['monster'])=>m?{...m,note:(m.note||'').slice(0,80)}:null;

// 按顺序逐个收紧，直到整个请求体（含 revision 包装）落进上限。
// 超出长度时返回 null —— 那时该由调用方把话截短，而不是写进一条静默丢内容的记录。
//
// revision 是存档的自增版本号，量级远小于 1e9；用 999999999 当包装里的估值，
// 只会把体积量得偏大，宁可多压几个字也不会真的越线，遂不用把它从父组件一路传下来。
export function fitChatTurn(action:ChatTurn,{limit=LIMIT}:{limit?:number}={}):ChatTurn|null{
 const body=(a:ChatTurn)=>bytes({revision:999999999,action:a});
 let a:ChatTurn={...action};
 const shrink=[
  // 先砍记录的冗余：tag 是最装饰性的部分，正文和摘要各留一半仍能认出来。
  ()=>a={...a,records:a.records.map(r=>({...r,text:cut(r.text,200),summary:cut(r.summary,60),tags:(r.tags||[]).slice(0,4)}))},
  ()=>a={...a,memoryCandidates:a.memoryCandidates.slice(0,2)},
  // 怪兽的说明先压短——名字和类别保住，界面还能显示「要不要把它放进星球」。
  ()=>a={...a,monster:dropMonster(a.monster)},
  // 回复的结尾是用户真正在读的东西，排在结构化数据之后才动。
  ()=>a={...a,reply:a.reply.slice(0,1500)},
  ()=>a={...a,memoryCandidates:[]},
  ()=>a={...a,reply:a.reply.slice(0,900)},
  ()=>a={...a,records:a.records.slice(0,2)},
  ()=>a={...a,records:a.records.slice(0,1)},
  // 到这一步怪兽提议整条丢掉：那一轮照样存得上，只是没有「放进去」这一行。
  // 丢一个提议比丢半段回复轻——前者用户重新说一次还会有，后者是已经说出口的话。
  ()=>a={...a,monster:null},
  ()=>a={...a,records:[]},
  ()=>a={...a,reply:a.reply.slice(0,400)},
 ];
 if(body(a)<=limit)return a;
 for(const step of shrink){step();if(body(a)<=limit)return a;}
 // 用户的原话不在这条压缩链上：输入框 maxLength=1000，最多 3000 字节；只剩原话时
 // 3000 + 一次 400 字的回复（1200）离 10000 还很远，所以到这一步只可能是上限被调小了。
 // 这时返回 null 让调用方提示用户，而不是写进一条静默丢内容的记录。
 return null;
}
