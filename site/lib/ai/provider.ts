// 模型服务解析：任何人都能填自己的 Key、换自己的 OpenAI 兼容端点。
// 环境变量优先级：AI_* 优先，DEEPSEEK_* 仅用于兼容旧部署。
export type Provider={key:string;model:string;baseUrl:string;isDeepSeek:boolean};
export type ProviderEnv={AI_API_KEY?:string;DEEPSEEK_API_KEY?:string;AI_MODEL?:string;DEEPSEEK_MODEL?:string;AI_BASE_URL?:string};
export type ChatRequestBody=Record<string,unknown>;
export type ChatRequest={url:string;body:ChatRequestBody};
type FetchLike=(input:string,init:RequestInit)=>Promise<Response>;
export const DEFAULT_BASE_URL='https://api.deepseek.com';
export const DEFAULT_MODEL='deepseek-chat';
const clean=(value?:string)=>(value||'').trim();
const trimTrailingSlash=(value:string)=>value.replace(/\/+$/,'');
// 请求默认走全局 fetch，但每次调用时才读取，便于测试替换且不绑定 this。
const defaultFetch:FetchLike=(input,init)=>globalThis.fetch(input,init);
export function createProvider(key:string,model?:string,baseUrl?:string):Provider{
 const base=trimTrailingSlash(clean(baseUrl))||DEFAULT_BASE_URL;
 return{key,model:clean(model)||DEFAULT_MODEL,baseUrl:base,isDeepSeek:/deepseek/i.test(base)};
}
// 没有 Key 就返回 null：路由据此返回「还没有配置模型」，不抛异常。
export function resolveProvider(env:ProviderEnv):Provider|null{
 const key=clean(env.AI_API_KEY)||clean(env.DEEPSEEK_API_KEY);
 if(!key)return null;
 return createProvider(key,clean(env.AI_MODEL)||clean(env.DEEPSEEK_MODEL),clean(env.AI_BASE_URL));
}
// 只有 DeepSeek 端点认 thinking 字段；其他端点（Ollama、vLLM 等）一律不发，否则直接 400。
export function buildChatRequest(p:Provider,system:string,user:unknown,options:{maxTokens?:number;temperature?:number}={}):ChatRequest{
 const body:ChatRequestBody={
  model:p.model,
  messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(user)}],
  response_format:{type:'json_object'},
  max_tokens:options.maxTokens??1800,
  temperature:options.temperature??0.5,
  stream:false,
 };
 if(p.isDeepSeek)body.thinking={type:'disabled'};
 return{url:`${p.baseUrl}/chat/completions`,body};
}
// 本地模型常常不认 response_format；400 且报文点名它时去掉重试一次，其余错误原样返回。
export async function postWithFallback(p:Provider,req:ChatRequest,fetchImpl:FetchLike=defaultFetch,signal?:AbortSignal):Promise<Response>{
 const send=(body:ChatRequestBody)=>fetchImpl(req.url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${p.key}`},signal,body:JSON.stringify(body)});
 const response=await send(req.body);
 if(response.status!==400||!('response_format' in req.body))return response;
 let detail='';
 try{detail=await response.clone().text();}catch{return response;}
 if(!/response_format/i.test(detail))return response;
 const{response_format:_dropped,...rest}=req.body;
 return send(rest);
}
// 模型偶尔仍会套一层 ```json 围栏，解析前先剥掉。
export function stripJsonFences(s:string):string{
 const text=(s||'').trim();
 const fenced=/^```[a-zA-Z0-9_-]*[ \t]*\r?\n?([\s\S]*?)\r?\n?```$/.exec(text);
 return fenced?fenced[1].trim():text;
}
