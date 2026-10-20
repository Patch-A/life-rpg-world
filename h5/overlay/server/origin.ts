// Next can construct Request.url using an internal listener address. The operator's
// explicit public origin and the preserved Host header are the trust boundary.
// Forwarded headers from the public client are never an authority here.
export function publicOrigin(){
 try{
  const configured=process.env.APP_ORIGIN;if(!configured)return null;
  const url=new URL(configured);
  if(url.origin!==configured||url.username||url.password)return null;
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))return null;
  return url;
 }catch{return null;}
}
export function requestOriginAllowed(req:Request){
 const origin=publicOrigin();
 return !!origin&&req.headers.get('origin')===origin.origin&&req.headers.get('host')?.toLowerCase()===origin.host.toLowerCase();
}
