// Generated from existing site/lib domain code; regenerate with qmuse/scripts/build-domain.mjs.

// <stdin>
import { z } from "zod";
var candidateSchema = z.object({ title: z.string().trim().min(1).max(80), steps: z.array(z.string().trim().min(1).max(200)).min(1).max(4), completionCriteria: z.string().trim().min(1).max(300), minutes: z.number().int().min(1).max(120), reason: z.string().trim().min(1).max(300) });
var agentResultSchema = z.object({ summary: z.string().trim().min(1).max(600), adjustment: z.string().trim().min(1).max(300), sourceLogIds: z.array(z.string()).max(12), candidates: z.array(candidateSchema).min(1).max(3) });
var RELEASE = "qmuse-submission-v0.4";
export {
  RELEASE,
  agentResultSchema,
  candidateSchema
};
