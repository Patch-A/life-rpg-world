// 记录官的开场白：纯函数，无副作用、不依赖 React，也不读当前时间。
export type AssistantPosture = 'companion' | 'counselor';
export type DaySlot = 'morning' | 'noon' | 'evening' | 'late';

// 模型不可用时由对话区直接读出这句：不假装记录成功，也不逼用户重试。
export const TIRED_LINE = '今天它有点累，没能说出下一句。可以先用表单记录，写下你真实完成的那一小步。';

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 只认 YYYY-MM-DD；解析不出来就不带星期，避免编造一个不存在的日子。
function weekdayOf(date: string): string {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!matched) return '';
  const year = Number(matched[1]), month = Number(matched[2]), dayOfMonth = Number(matched[3]);
  const parsed = new Date(Date.UTC(year, month - 1, dayOfMonth));
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== dayOfMonth) return '';
  return weekdays[parsed.getUTCDay()];
}

// 早 5–10 点、午 11–17 点、晚 18–22 点、深夜 23–4 点。
export function daySlot(hour: number): DaySlot {
  if (hour >= 23 || hour <= 4) return 'late';
  if (hour <= 10) return 'morning';
  if (hour <= 17) return 'noon';
  return 'evening';
}

// 咨询师语气收敛：只说下一步，不追问情绪；陪伴者更温和。
const openings: Record<AssistantPosture, Record<DaySlot, [string, string]>> = {
  companion: {
    morning: ['早上好。', '说说今天想做什么，我帮你记着。'],
    noon: ['下午好。', '今天发生了什么值得留下的事？'],
    evening: ['晚上好。', '今天过得怎么样，愿意的话，我们一起把这一刻留下来。'],
    late: ['这么晚还醒着。', '辛苦你了，不用写得多完整，先说说现在的状态就好。'],
  },
  counselor: {
    morning: ['早上好。', '今天打算推进哪件事？先挑一件今天能做完的。'],
    noon: ['下午好。', '今天的进展或卡点，可以直接说，我们看下一步怎么走。'],
    evening: ['晚上好。', '今天完成了什么？先说事实，再看要不要调整。'],
    late: ['夜深了。', '先把明天要做的一件小事定下来，再休息。'],
  },
};

export function openingLine(posture: 'companion' | 'counselor', date: string, recordedCount: number, hour: number): string {
  const [greeting, body] = openings[posture === 'counselor' ? 'counselor' : 'companion'][daySlot(hour)];
  const weekday = weekdayOf(date);
  const lead = weekday ? `${weekday}了。` : '';
  // 没有记录时整句都不出现数字；有记录时把当天条数说清楚。
  const counted = Number.isFinite(recordedCount) && recordedCount > 0 ? `今天已经记下 ${Math.floor(recordedCount)} 件了。` : '';
  return `${greeting}${lead}${counted}${body}`;
}
