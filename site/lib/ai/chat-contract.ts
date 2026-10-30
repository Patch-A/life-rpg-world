import { z } from 'zod';
import type { Domain } from '@/lib/game';
const postures = ['companion', 'counselor'] as const;
const domainIds = ['mind', 'health', 'career', 'wealth', 'social'] as const satisfies readonly Domain[];
const recordSchema = z.object({ summary: z.string().trim().min(1).max(200), text: z.string().trim().min(1).max(400), domain: z.enum(domainIds).optional(), tags: z.array(z.string().trim().min(1).max(20)).max(20).default([]) });
const memoryCandidateSchema = z.object({ text: z.string().trim().min(1).max(200), kind: z.enum(['fact', 'preference', 'situation']) });
const quickReplySchema = z.object({ label: z.string().trim().min(1).max(20), kind: z.enum(['say', 'accept-switch']) });
export const chatResultSchema = z.object({ reply: z.string().trim().min(1).max(2000), posture: z.enum(postures), askSwitch: z.boolean(), records: z.array(recordSchema).max(3).default([]), memoryCandidates: z.array(memoryCandidateSchema).max(5).default([]), quickReplies: z.array(quickReplySchema).max(3).default([]) });
export type ChatResult = z.infer<typeof chatResultSchema>;
export type Posture = typeof postures[number];
// 纯函数，无 IO：只依据模型输出、用户原话、上一轮姿态与切换同意做收敛。
export function sanitizeChatResult(r: ChatResult, userText: string, prevPosture: Posture, switchConsent: boolean): ChatResult {
 const text = userText.trim();
 const seen = new Set<string>();
 const records: ChatResult['records'] = [];
 for (const x of r.records) { if (!text.includes(x.text) || seen.has(x.text)) continue; seen.add(x.text); records.push(x); if (records.length === 3) break; }
 if (r.posture === 'counselor' && prevPosture === 'companion' && !switchConsent) return { ...r, records, posture: 'companion', askSwitch: true };
 if (r.posture === 'companion') return { ...r, records, askSwitch: false };
 return { ...r, records };
}
