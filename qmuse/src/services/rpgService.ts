import {executeQmuseFunction} from './appwrite';

export async function rpgRequest(input:RequestInfo|URL,options:RequestInit={}):Promise<Response>{
 if(options.signal?.aborted)throw new DOMException('已取消','AbortError');
 const path=String(input),url=new URL(path,'https://local.invalid');
 if(!url.pathname.startsWith('/api/'))throw new Error('不支持的业务请求');
 let body:unknown;
 if(options.body){if(typeof options.body!=='string')return Response.json({error:'妙思投稿版暂不上传照片，请先用文字记录。'},{status:403});body=JSON.parse(options.body);}
 const execution=await executeQmuseFunction({functionId:'rpg-service',body:JSON.stringify({path:url.pathname,method:options.method||'GET',query:Object.fromEntries(url.searchParams),body})});
 if(options.signal?.aborted)throw new DOMException('已取消','AbortError');
 // The platform also labels a finished HTTP 4xx/5xx response as "failed".
 // Preserve its safe business message instead of replacing it with a pending-state error.
 if(!['completed','failed'].includes(execution.status))throw new Error('QMuse云服务暂未完成，请稍后重试；未提交输入仍保留。');
 let result:unknown;
 try{result=JSON.parse(execution.responseBody);}catch{throw new Error('QMuse云服务返回暂不可用，请重试。');}
 return Response.json(result,{status:execution.responseStatusCode||503,headers:{'Cache-Control':'no-store'}});
}
