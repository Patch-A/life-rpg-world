// 请求超时信号：AbortSignal.timeout 是 Safari 16 / Chrome 103 才有的静态方法。
// 它和 crypto.randomUUID 是同一类问题——在旧 iOS 上不存在，调用直接抛 TypeError，
// 而 requestError() 会把任何 TypeError 说成「网络连接失败，请检查网络后重试」。
// 上一轮修好 randomUUID 后，下一个撞上的就是它：send() 在 try 的第一行同步求值，
// 一次请求都没发出去，界面却报网络错误。
process.on('uncaughtException',e=>{console.error(String(e.stack||e).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'[module]'));process.exit(1);});
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const source=p=>readFileSync(new URL(p,root),'utf8');
const url=code=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
// 同一个具名模块被 import 两次会命中缓存，第二次拿到的还是首次求值时的分支。
// 每次加一段唯一的注释，让它成为不同的模块说明符。
const urlFresh=()=>url(source('lib/abort.ts')+'\n// '+Math.random());

// 1. 有原生 timeout 时必须原样用它，不要总是走兜底。
//    两个分支的结果看不出差别（都是 AbortSignal），所以把原生换成哨兵，
//    返回哨兵才说明真的调用了它——也顺手证明下面那条用例确实在测兜底分支。
{
  const desc=Object.getOwnPropertyDescriptor(AbortSignal,'timeout');
  const sentinel=Symbol('native');
  Object.defineProperty(AbortSignal,'timeout',{configurable:true,writable:true,value:()=>sentinel});
  try{
    const {timeoutSignal}=await import(urlFresh());
    assert.equal(timeoutSignal(1000),sentinel,'有原生 AbortSignal.timeout 时必须直接用');
  }finally{
    if(desc)Object.defineProperty(AbortSignal,'timeout',desc);else delete AbortSignal.timeout;
  }
}

// 2. 旧 iOS：没有原生 timeout。必须仍然拿到一个可用的 signal，并且到点真的 abort。
{
  const desc=Object.getOwnPropertyDescriptor(AbortSignal,'timeout');
  Object.defineProperty(AbortSignal,'timeout',{configurable:true,writable:true,value:undefined});
  try{
    assert.equal(typeof AbortSignal.timeout,'undefined','前置：这一步必须真的没有原生 timeout');
    const {timeoutSignal}=await import(urlFresh());
    const signal=timeoutSignal(30);
    assert.ok(signal,'没有原生 timeout 时也必须返回一个 signal，否则 fetch 会同步抛 TypeError');
    assert.equal(signal.aborted,false,'刚创建时不该已经中止');
    await new Promise(r=>setTimeout(r,90));
    assert.equal(signal.aborted,true,'到点必须真的 abort，否则请求永远挂着');
    // requestError() 靠 name 分辨超时，reason 必须是 TimeoutError 的 DOMException。
    assert.equal(signal.reason?.name,'TimeoutError',`超时原因必须是 TimeoutError，实际 ${signal.reason?.name}`);
  }finally{
    if(desc)Object.defineProperty(AbortSignal,'timeout',desc);else delete AbortSignal.timeout;
  }
}

// 3. 浏览器里不得再直接调用 AbortSignal.timeout：它就是这条故障链的入口。
//    lib/ai/** 跑在 workerd 上（一定有这个 API），不在扫描范围。
const walk=dir=>{
  const out=[];
  for(const name of readdirSync(new URL(dir,root))){
    const rel=dir+name,abs=new URL(rel,root);
    if(statSync(abs).isDirectory()){if(!/^app\/api\//.test(rel)&&name!=='node_modules'&&name!=='ai')out.push(...walk(rel+'/'));}
    else if(/\.(ts|tsx)$/.test(name))out.push(rel);
  }
  return out;
};
const clientFiles=[...walk('app/'),...walk('components/'),...walk('lib/')].filter(p=>!/^app\/api\//.test(p));
assert.ok(clientFiles.length>20,`客户端文件扫描结果太少（${clientFiles.length}），walk 可能没真的遍历`);
const offenders=clientFiles.filter(p=>p!=='lib/abort.ts'&&/AbortSignal\.timeout\s*\(/.test(source(p)));
assert.deepEqual(offenders,[],`这些浏览器文件直接用了 AbortSignal.timeout，在旧 iOS 上会抛 TypeError 并被显示成「网络连接失败」：${offenders.join(', ')}`);

// 4. 每个会发请求的客户端入口都必须用 timeoutSignal。漏一个，那条路径在旧设备上就是死的。
for(const p of ['app/page.tsx','components/chat-room.tsx','components/action-assistant.tsx','components/life-photos.tsx','components/life-records.tsx','lib/export-album.ts']){
  const src=source(p);
  assert.ok(/from '@\/lib\/abort'/.test(src)||/from '\.\/abort'/.test(src),`${p} 必须从 lib/abort 取 timeoutSignal`);
  assert.ok(/\btimeoutSignal\(\d+\)/.test(src),`${p} 必须实际调用 timeoutSignal(ms)`);
}

// 5. 服务端保留原生调用：Workers 里一定有它。
assert.ok(/AbortSignal\.timeout\(/.test(source('lib/ai/deepseek.ts')),'模型调用跑在服务端，保留原生 AbortSignal.timeout');

console.log('PASS 请求超时信号在旧 iOS（无 AbortSignal.timeout）下仍然可用');
