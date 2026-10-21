export const noStore=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export class RequestError extends Error{constructor(message:string,public status=400){super(message);}}
export async function boundedBody(req:Request,max=6000){
 if(req.headers.get('origin')!==new URL(req.url).origin)throw new RequestError('请求来源无效',403);
 if(Number(req.headers.get('content-length'))>max)throw new RequestError('提交内容过大',413);
 const reader=req.body?.getReader();if(!reader)throw new RequestError('提交内容为空');
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new RequestError('提交内容过大',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new RequestError('提交格式无效');}
}
