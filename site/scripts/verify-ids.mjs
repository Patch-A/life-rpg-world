// 请求 id：crypto.randomUUID 在非安全上下文（http:// + 局域网 IP、或自部署没上 TLS）不存在。
// 之前七个客户端调用点直接用它，抛出的 TypeError 又被 requestError() 当成网络错误，
// 于是用户看到「网络连接失败」，实际上一次请求都没发出去。
process.on('uncaughtException',e=>{console.error(String(e.stack||e).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'[module]'));process.exit(1);});
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const source=p=>readFileSync(new URL(p,root),'utf8');
const url=code=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');

const UUID_V4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// 1. 正常上下文：直接返回浏览器/Node 原生 UUID。
const {newId}=await import(url(source('lib/ids.ts')));
const a=newId(),b=newId();
assert.match(a,UUID_V4,'newId 必须返回 UUID v4 格式，/api/chat 用 z.string().uuid() 校验它');
assert.notEqual(a,b,'两次调用不得返回同一个 id：幂等键重复会让第二句话被当成重放吞掉');

// 1b. 有 randomUUID 时必须走它，而不是总走兜底。
//     两个分支产出的格式一样，只测格式分辨不出来——把原生实现换成哨兵，
//     返回哨兵才说明真的调用了它。这条也顺手证明下面的兜底用例确实在测兜底分支。
{
  const ok=Object.getOwnPropertyDescriptor(globalThis,'crypto');
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{
    randomUUID:()=>'00000000-0000-4000-8000-000000000000',
    getRandomValues:arr=>{throw new Error('有 randomUUID 时不该走兜底，不该摸 getRandomValues');},
  }});
  try{
    assert.equal(newId(),'00000000-0000-4000-8000-000000000000','有原生 randomUUID 时必须直接用，不走兜底');
  }finally{Object.defineProperty(globalThis,'crypto',ok);}
}

// 2. 非安全上下文：把 globalThis.crypto 换成只有 getRandomValues 的形态。
//    这正是 http://192.168.1.5:5174 上浏览器的样子（实测 randomUUID === 'undefined'）。
const real=globalThis.crypto;
const okField=Object.getOwnPropertyDescriptor(globalThis,'crypto');
Object.defineProperty(globalThis,'crypto',{
  configurable:true,
  value:{getRandomValues:arr=>real.getRandomValues(arr)},
});
try{
  assert.equal(typeof globalThis.crypto.randomUUID,'undefined','前置：这一步必须真的没有 randomUUID');
  // 单个样本不够：字母位是随机的，撞进合法区的概率有 1/4，只测一个会有四分之一的机会蒙对。
  // 200 次全中才算真写了版本位与变体位。
  const ids=Array.from({length:200},()=>newId());
  const bad=ids.filter(id=>!UUID_V4.test(id));
  assert.deepEqual(bad.slice(0,3),[],`兜底产出的 id 必须是 UUID v4，${bad.length}/200 不合规`);
  assert.equal(ids[14][14],'4','第 13 位十六进制必须是版本号 4');
  assert.ok(ids.every(id=>'89ab'.includes(id[19])),'第 17 位十六进制必须是 RFC 4122 变体位');
  assert.equal(new Set(ids).size,ids.length,'兜底路径必须每次不同，不能退化成常量');
}finally{
  Object.defineProperty(globalThis,'crypto',okField);
}
assert.equal(typeof globalThis.crypto.randomUUID,'function','测试必须把全局 crypto 还原，否则后面的用例全在测兜底分支');

// 3. 客户端不得再直接调用 crypto.randomUUID：它就是这次的故障源。
//    服务端（app/api/**）跑在 Workers/Node 上，那里一定有 randomUUID，允许保留。
const walk=dir=>{
  const out=[];
  for(const name of readdirSync(new URL(dir,root))){
    const rel=dir+name,abs=new URL(rel,root);
    if(statSync(abs).isDirectory()){if(!/^app\/api\//.test(rel)&&name!=='node_modules')out.push(...walk(rel+'/'));}
    else if(/\.(ts|tsx)$/.test(name))out.push(rel);
  }
  return out;
};
const clientFiles=[...walk('app/'),...walk('components/'),...walk('lib/')].filter(p=>!/^app\/api\//.test(p));
assert.ok(clientFiles.length>20,`客户端文件扫描结果太少（${clientFiles.length}），walk 可能没真的遍历`);
// lib/game.ts 是唯一的例外：reduceGame 只在服务端跑（见下面第 5 条对这条前提的检查）。
const SERVER_ONLY=new Set(['lib/ids.ts','lib/game.ts']);
const offenders=clientFiles.filter(p=>!SERVER_ONLY.has(p)&&/crypto\.randomUUID\s*\(/.test(source(p)));
assert.deepEqual(offenders,[],`这些文件直接用了 crypto.randomUUID，在 http:// 局域网地址上会抛 TypeError 并被显示成「网络连接失败」：${offenders.join(', ')}`);

// 5. 上面给 lib/game.ts 的豁免是有前提的：reduceGame 不能出现在浏览器代码里。
//    前提一破，豁免就变成漏洞——所以把它也断言住。
const reduceUsers=clientFiles.filter(p=>p!=='lib/game.ts'&&/\breduceGame\b/.test(source(p))&&!/^lib\//.test(p));
assert.deepEqual(reduceUsers,[],`reduceGame 只能在服务端 API 路由里调用；它内部用的是原生 randomUUID。发现：${reduceUsers.join(', ')}`);
const gameImports=clientFiles.filter(p=>p!=='lib/game.ts'&&/from '@\/lib\/game'/.test(source(p))&&/\breduceGame\b/.test(source(p).match(/import\s*\{[^}]*\}\s*from\s*'@\/lib\/game'/)?.[0]||''));
assert.deepEqual(gameImports,[],`这些浏览器文件从 @/lib/game 导入了 reduceGame：${gameImports.join(', ')}`);

// 4. 每个原本会写数据的入口都必须走 newId。漏一个，那条路径在非安全上下文上就是死的。
for(const p of ['components/chat-room.tsx','components/action-assistant.tsx','components/feedback-panel.tsx','components/life-birthday.tsx','components/life-records.tsx']){
  const src=source(p);
  assert.ok(/from '@\/lib\/ids'/.test(src),`${p} 必须从 @/lib/ids 取 newId`);
  assert.ok(/\bnewId\(\)/.test(src),`${p} 必须实际调用 newId()`);
}
// 服务端那一处是有意的：Workers 里 randomUUID 一定存在。
assert.ok(/crypto\.randomUUID\(\)/.test(source('app/api/photos/route.ts')),'服务端照片路由保留原生 randomUUID，不应被改写');

console.log('PASS 请求 id 在非安全上下文（http 局域网 / 无 TLS 自部署）下仍然可用');
