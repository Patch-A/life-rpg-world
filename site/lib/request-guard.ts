export const noStore=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function boundedBody(req:Request,max=6000){
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new RequestError('请求来源无效',403);
 if(Number(req.headers.get('content-length'))>max)throw new RequestError('提交内容过大',413);
 const raw=await req.text();if(raw.length>max)throw new RequestError('提交内容过大',413);
 try{return JSON.parse(raw);}catch{throw new RequestError('提交格式无效',400);}
}
export class RequestError extends Error{constructor(message:string,public status=400){super(message);}}
