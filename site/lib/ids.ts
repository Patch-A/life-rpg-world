// 所有写入路径都要一个请求 id，`/api/chat` 用 z.string().uuid() 校验它。
//
// 但 crypto.randomUUID 只在**安全上下文**（HTTPS 或 localhost）存在。
// 用 http://<局域网IP> 打开、或自部署没上 TLS 时它是 undefined，
// 而这七个调用点大多在 try 里，抛出来的 TypeError 会被 requestError() 当成网络错误，
// 于是用户看到「网络连接失败，请检查网络后重试」——实际上一次请求都没发出去。
//
// 兜底仍走 CSPRNG（getRandomValues 在任何上下文都可用），并保持 UUID v4 格式，
// 不改变任何调用方和服务端校验的假设。
export function newId():string{
  const c=globalThis.crypto;
  if(typeof c?.randomUUID==='function')return c.randomUUID();
  const b=new Uint8Array(16);
  c.getRandomValues(b);
  b[6]=b[6]&0x0f|0x40; // version 4
  b[8]=b[8]&0x3f|0x80; // variant RFC 4122
  const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
