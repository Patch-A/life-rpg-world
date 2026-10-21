// The router verifies a private HttpOnly cookie, then grants this exact Request.
// No public header can supply identity and no Sites identities are accepted.
const identities = new WeakMap<Request,string>();
export const authenticatedUser = (request:Request)=>identities.get(request)||null;
export async function withIdentity(request:Request,user:string,handler:(r:Request)=>Promise<Response>){
 identities.set(request,user);
 try{return await handler(request);}finally{identities.delete(request);}
}
