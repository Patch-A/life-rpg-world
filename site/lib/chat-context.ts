import { progress, day, level, type Game } from '@/lib/game';
export type ChatContext = {
 userText: string;
 prevPosture: 'companion' | 'counselor';
 recentChat: { role: 'user' | 'assistant'; text: string }[];
 memory: { text: string; kind: string }[];
 goals: { title: string; domain: string; progress: number; target: number; unit: string }[];
 recentLogs: { date: string; title: string; domain: string; value: number; unit: string }[];
 savings: { title: string; net: number }[];
 level: number;
 todayXp: number;
};
// 纯函数，无 IO：只从存档投影，读不到磁盘、环境变量与照片。
// 隐私边界：photos、出生日期、生日记录、人生纪念与 profile.name 一律不出现（/about 页的承诺）。
// 已撤销的 log 不发送，否则助手会把用户没做成的事当成事实。
export function buildChatContext(state: Game, opts: { userText: string; prevPosture: 'companion' | 'counselor'; switchConsent: boolean }): ChatContext {
 const today = day();
 // 存档存的是「条」不是「轮」，40 条约等于最近 20 轮对话；不足则全取。
 const recentChat = state.chat.slice(-40).map(t => ({ role: (t.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant', text: t.text }));
 // 最近 20 条有效记录，先按时间倒序取，再翻转成时间正序供模型顺读。
 const recentLogs = state.logs.filter(l => !l.undone).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20).reverse().map(l => ({ date: l.date, title: l.title, domain: l.domain, value: l.value, unit: l.unit }));
 return {
  userText: opts.userText,
  prevPosture: opts.prevPosture,
  recentChat,
  memory: state.memory.slice(-40).map(m => ({ text: m.text, kind: m.kind })),
  goals: state.goals.map(g => ({ title: g.title, domain: g.domain, progress: progress(state, g), target: g.target, unit: g.unit })),
  recentLogs,
  // 只有「元」目标算储蓄，净额复用 progress（已处理取出与起始存款）。
  savings: state.goals.filter(g => g.unit === '元').map(g => ({ title: g.title, net: progress(state, g) })),
  level: level(state),
  // 今日经验按当天各领域已得 xp 求和，不用额度倒推。
  todayXp: state.logs.filter(l => !l.undone && l.date === today).reduce((n, l) => n + l.xp, 0),
 };
}
