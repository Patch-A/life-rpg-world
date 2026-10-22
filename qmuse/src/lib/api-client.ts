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
export function requestError(error:unknown){return error instanceof DOMException&&['TimeoutError','AbortError'].includes(error.name)?'连接超时，本次操作未确认成功。请重试；原有输入会保留。':error instanceof TypeError?'网络连接失败，请检查网络后重试。':error instanceof Error?error.message:'操作未成功，请重试。';}
