import { z } from 'zod';
export const candidateSchema=z.object({title:z.string().trim().min(1).max(80),steps:z.array(z.string().trim().min(1).max(200)).min(1).max(4),completionCriteria:z.string().trim().min(1).max(300),minutes:z.number().int().min(1).max(120),reason:z.string().trim().min(1).max(300)});
export const agentResultSchema=z.object({summary:z.string().trim().min(1).max(600),adjustment:z.string().trim().min(1).max(300),sourceLogIds:z.array(z.string()).max(12),candidates:z.array(candidateSchema).min(1).max(3)});
export type AgentResult=z.infer<typeof agentResultSchema>;
export type Candidate=z.infer<typeof candidateSchema>;
export type AgentRun={id:string;mode:'plan'|'review';goalId:string;newGoal?:{title:string;domain:'mind'|'career';successCriteria:string;target:number;unit:'分钟'};result:AgentResult;createdAt:string;model:string};
export const RELEASE='qmuse-submission-v0.4';
