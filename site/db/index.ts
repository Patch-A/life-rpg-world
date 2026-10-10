import { env } from 'cloudflare:workers';
export function database() { if (!env.DB) throw new Error('存档服务暂不可用'); return env.DB; }
