import { z } from 'zod';
import type { Domain } from '@/lib/game';
const postures = ['companion', 'counselor'] as const;
const domainIds = ['mind', 'health', 'career', 'wealth', 'social'] as const satisfies readonly Domain[];
// 元素级一律宽松：单条脏数据就地修正或丢弃。条数上限（records/quickReplies 各 3）是产出约束，由 sanitize 清洗后截断，schema 不因此整轮失败。
const cut = (v: unknown, max: number) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const shape = (v: unknown) => (v && typeof v === 'object' ? v : {});
const recordSchema = z.preprocess(shape, z.object({
 summary: z.any().transform(v => cut(v, 200)),
 text: z.any().transform(v => cut(v, 400)),
 domain: z.any().transform(v => (domainIds as readonly string[]).includes(v as string) ? v as Domain : undefined),
 tags: z.any().transform(v => Array.isArray(v) ? [...new Set(v.filter((t): t is string => typeof t === 'string').map(t => t.trim().slice(0, 20)).filter(Boolean))].slice(0, 20) : []),
}).transform(r => r.summary && r.text ? r : null));
const memoryCandidateSchema = z.preprocess(shape, z.object({
 text: z.any().transform(v => cut(v, 200)),
 kind: z.any().transform(v => typeof v === 'string' && ['fact', 'preference', 'situation'].includes(v) ? v as 'fact' | 'preference' | 'situation' : undefined),
}).transform(m => m.text && m.kind ? { text: m.text, kind: m.kind } : null));
const quickReplySchema = z.preprocess(shape, z.object({
 label: z.any().transform(v => cut(v, 20)),
 kind: z.enum(['say', 'accept-switch']).catch('say'),
}).transform(q => q.label ? q : null));
// 顶层：reply 空/非字符串无法兜底（没话可说这轮没意义），其余字段一律归一而不整轮失败。
const list = (v: unknown) => Array.isArray(v) ? v : (v && typeof v === 'object' ? [v] : []);
const bool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';
export const chatResultSchema = z.object({
 reply: z.preprocess(v => typeof v === 'string' ? v.trim().slice(0, 2000) : v, z.string().min(1)),
 posture: z.enum(postures).catch('companion'),
 askSwitch: z.any().transform(bool),
 records: z.preprocess(list, z.array(recordSchema)).transform(a => a.flatMap(x => x ? [x] : [])),
 memoryCandidates: z.preprocess(list, z.array(memoryCandidateSchema)).transform(a => a.flatMap(x => x ? [x] : [])),
 quickReplies: z.preprocess(list, z.array(quickReplySchema)).transform(a => a.flatMap(x => x ? [x] : [])),
});
export type ChatResult = z.infer<typeof chatResultSchema>;
export type Posture = typeof postures[number];
// 纯函数，无 IO：只依据模型输出、用户原话、上一轮姿态与切换同意做收敛。
export function sanitizeChatResult(r: ChatResult, userText: string, prevPosture: Posture, switchConsent: boolean): ChatResult {
 const text = userText.trim();
 const seen = new Set<string>();
 const records: ChatResult['records'] = [];
 for (const x of r.records) { if (!x.text.trim() || !text.includes(x.text) || seen.has(x.text)) continue; seen.add(x.text); records.push(x); }
 // 记忆不做「必须是原话子串」的校验：records 存的是原话片段，记忆本来就是提炼过的说法
 // （「在读一本讲并发的书」对应原话「我最近在读一本讲并发的书」）。套上子串校验会把
 // 「它记住的事」整个静默废掉——那比偶尔记错一句更糟。风险留在 spec 6.3 的已知窄口子里。
 const base = { ...r, records: records.slice(0, 3), memoryCandidates: r.memoryCandidates.slice(0, 5), quickReplies: r.quickReplies.slice(0, 3) };
 if (r.posture === 'counselor' && prevPosture === 'companion' && !switchConsent) return { ...base, posture: 'companion', askSwitch: true };
 if (r.posture === 'companion') return { ...base, askSwitch: false };
 return base;
}
