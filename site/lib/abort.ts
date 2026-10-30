// AbortSignal.timeout 是 Safari 16 / Chrome 103 才有的静态方法。
// iOS 15 及更旧的 WebView、以及部分定制内核上是 undefined，直接调用抛 TypeError。
//
// 这与 ids.ts 里的 crypto.randomUUID 是同一类问题，后果也一模一样：
// 调用点几乎都在 try 里，抛出来的 TypeError 会被 requestError() 当成网络故障，
// 用户看到「网络连接失败，请检查网络后重试」——实际上一次请求都没发出去。
// 修好 randomUUID 之后，下一个撞上的就是它。
//
// 兜底用 AbortController + setTimeout，语义对齐原生实现：到点 abort，
// reason 是 TimeoutError 的 DOMException，requestError() 仍然能识别成「连接超时」。
export function timeoutSignal(ms:number):AbortSignal|undefined{
  const api=globalThis.AbortSignal as typeof AbortSignal&{timeout?:(ms:number)=>AbortSignal};
  if(typeof api?.timeout==='function'){try{return api.timeout(ms);}catch{}}
  if(typeof globalThis.AbortController!=='function')return undefined;
  const controller=new AbortController();
  setTimeout(()=>{
    if(controller.signal.aborted)return;
    try{controller.abort(new DOMException('信号已超时','TimeoutError'));}catch{controller.abort();}
  },ms);
  return controller.signal;
}
