export class ApiError extends Error {
 constructor(message:string,public status:number,public login=false){super(message);this.name='ApiError';}
}
export async function readJSON<T>(response:Response):Promise<T>{
 const login=response.status===401||response.status===403&&response.redirected||response.redirected&&/signin|login|authapi/.test(response.url);
 if(login)throw new ApiError('登录已失效，请重新登录后继续。未提交的内容会保留在这台设备。',response.status,true);
 const type=response.headers.get('content-type')||'';
 if(!type.includes('application/json'))throw new ApiError(response.status>=500?'服务暂时不可用，本次操作未确认成功。请稍后重试。':'服务返回了异常页面，本次操作未确认成功。请重新加载或登录后重试。',response.status);
 let data:any;try{data=await response.json();}catch{throw new ApiError('返回的数据不完整，本次操作未确认成功，请重试。',response.status);}
 if(!response.ok)throw new ApiError(typeof data?.error==='string'?data.error:'操作未成功，请重试。',response.status);
 if(!data||typeof data!=='object')throw new ApiError('返回的数据格式异常，请重新加载。',response.status);
 return data as T;
}
// TypeError 有两个截然不同的来源，不能合并成一句话：
//   1. fetch 自己失败（断网、DNS、CORS）——消息形如 "Failed to fetch" / "Load failed"；
//   2. 某个新 API 在这台设备上不存在（"x is not a function"）。
// 第 2 种报成「网络连接失败」会把人引到错误方向：crypto.randomUUID 和 AbortSignal.timeout
// 都因为这一句，被当成断网排查了好几天。现在把它们分开报，缺什么就说缺什么。
const fetchFailure=/failed to fetch|load failed|networkerror|network request failed|fetch failed/i;
export function requestError(error:unknown){
 if(error instanceof DOMException&&['TimeoutError','AbortError'].includes(error.name))return '连接超时，本次操作未确认成功。请重试；原有输入会保留。';
 if(error instanceof TypeError){
  const message=(error.message||'').trim();
  if(!message||fetchFailure.test(message))return '网络连接失败，请检查网络后重试。';
  return `请求没能发出去：${message}。请刷新页面后再试一次。`;
 }
 return error instanceof Error?error.message:'操作未成功，请重试。';
}
