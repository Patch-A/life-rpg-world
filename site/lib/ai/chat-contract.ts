import { z } from 'zod';
import type { Domain } from '@/lib/game';
const postures = ['companion', 'counselor'] as const;
const domainIds = ['mind', 'health', 'career', 'wealth', 'social'] as const satisfies readonly Domain[];
// 元素级一律宽松：单条脏数据就地修正或丢弃，只有 records/quickReplies 数组超量才让整轮失败。
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
 kind: z.enum(['fact', 'preference', 'situation']).catch('fact'),
}).transform(m => m.text ? m : null));
const quickReplySchema = z.preprocess(shape, z.object({
 label: z.any().transform(v => cut(v, 20)),
 kind: z.enum(['say', 'accept-switch']).catch('say'),
}).transform(q => q.label ? q : null));
export const chatResultSchema = z.object({
 reply: z.string().trim().min(1).max(2000),
 posture: z.enum(postures),
 askSwitch: z.boolean(),
 records: z.preprocess(v => Array.isArray(v) ? v : [], z.array(recordSchema).max(3)).transform(a => a.flatMap(x => x ? [x] : [])),
 memoryCandidates: z.preprocess(v => Array.isArray(v) ? v : [], z.array(memoryCandidateSchema)).transform(a => a.flatMap(x => x ? [x] : [])),
 quickReplies: z.preprocess(v => Array.isArray(v) ? v : [], z.array(quickReplySchema).max(3)).transform(a => a.flatMap(x => x ? [x] : [])),
});
export type ChatResult = z.infer<typeof chatResultSchema>;
export type Posture = typeof postures[number];
// 纯函数，无 IO：只依据模型输出、用户原话、上一轮姿态与切换同意做收敛。
export function sanitizeChatResult(r: ChatResult, userText: string, prevPosture: Posture, switchConsent: boolean): ChatResult {
 const text = userText.trim();
 const seen = new Set<string>();
 const records: ChatResult['records'] = [];
 for (const x of r.records) { if (!x.text.trim() || !text.includes(x.text) || seen.has(x.text)) continue; seen.add(x.text); records.push(x); if (records.length === 3) break; }
 const base = { ...r, records, memoryCandidates: r.memoryCandidates.slice(0, 5) };
 if (r.posture === 'counselor' && prevPosture === 'companion' && !switchConsent) return { ...base, posture: 'companion', askSwitch: true };
 if (r.posture === 'companion') return { ...base, askSwitch: false };
 return base;
}
