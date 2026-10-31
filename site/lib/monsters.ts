// 情绪怪兽的纯逻辑：不碰 IO，只做判定和记账。
//
// 一句话定义（来自 docs/superpowers/specs/2026-10-31-monsters-and-home-design.md）：
// 怪兽是「你正在扛的某件事」在星球上投下的一块影子。它不会攻击你，你也不用打卡去打它；
// 你过日子、说出来、缓过来，它就慢慢薄下去。
//
// 三条不能破的规则：
//   1. 出现要你点头——模型只能提议，落库必须由用户点「放进去」
//   2. 挨打是自动的，四种来源等权——「今天睡了个好觉」和「今天干完一个大项目」一样重
//   3. 它不会自己长回来——没做事时血量不变，永远不会因为「没进步」涨血
//
// 这个文件只 import 类型，不 import game.ts 的函数：game.ts 会 import 这里的函数，
// 反向再拿运行时值就绕成环了。
import type {Game,Monster,MonsterHit,MonsterKind} from './game';

/** 同时最多几只。想放第四只，必须先让一只走掉。 */
export const MAX_ACTIVE_MONSTERS = 3;

/** 出现的那一刻按处境轻重定一次上限，之后锁死，不再变。 */
export const MONSTER_WEIGHT_HP: Record<number, number> = {1: 100, 2: 200, 3: 300};

/**
 * 四种来源的扣血。
 *
 * 不设排行榜、不设暴击、不设连击——**四种来源等权是这一整条规则的重点**。
 * 「情绪变好」给 15 而不是 10，因为它是四种里唯一没有实物证据的，也是最难的一种；
 * 多给 5 点是为了让「今天心情好了一点」不至于比「今天走了十分钟」还轻。
 */
export const MONSTER_HIT_DAMAGE: Record<MonsterHit['kind'], number> = {said: 10, acted: 10, felt: 15, cared: 10};

/** 四种来源在界面上怎么念。 */
export const MONSTER_HIT_LABEL: Record<MonsterHit['kind'], string> = {
 said: '说出来了',
 acted: '做成了一件小事',
 felt: '情绪缓了一点',
 cared: '照顾了自己',
};

export const MONSTER_KINDS: {id: MonsterKind; label: string; where: string; color: string}[] = [
 // 身体和生活的事，长在这片林子里。
 {id: 'life', label: '扛着的生活', where: '生命森林', color: '#67dfb5'},
 // 你做的事受挫，裂在做事的地方。
 {id: 'setback', label: '挫折', where: '创造之城', color: '#75c8ff'},
 // 它不属于任何一块，所以不放在地上。
 {id: 'emotion', label: '说不清的情绪', where: '星球外缘', color: '#a98ecf'},
];

/**
 * 旧存档里可能还留着 `jobless` —— 这个档 2026-10-31 砍掉了（零数据，从写进类型起
 * 就没有任何东西会填它）。但**不清数据**：真遇到就按 `life` 兜底渲染，符合 AGENTS.md 第 4 条。
 */
export function monsterKind(m: Monster): MonsterKind {
 const k = m.kind;
 return k === 'setback' || k === 'emotion' || k === 'life' ? k : 'life';
}

export function monsterMeta(m: Monster) {
 return MONSTER_KINDS.find(k => k.id === monsterKind(m)) ?? MONSTER_KINDS[0];
}

/** 还在场上的。走掉的不算。 */
export const activeMonsters = (s: Game): Monster[] => s.monsters.filter(m => !m.resolvedAt);
export const departedMonsters = (s: Game): Monster[] => s.monsters.filter(m => !!m.resolvedAt);
export const canSummonMonster = (s: Game): boolean => activeMonsters(s).length < MAX_ACTIVE_MONSTERS;

/** 它已经薄了多少，0–1。界面只需要这个数，不需要自己算。 */
export function fadedRatio(m: Monster): number {
 if (!m.maxHp || m.maxHp <= 0) return 0;
 return Math.min(1, Math.max(0, 1 - m.hp / m.maxHp));
}

/**
 * 挨一下。
 *
 * **按 ref 去重**：同一轮对话、同一条 log 只会扣一次。没有这条，
 * 用户重复点保存、或者编辑一条记录，都能把同一件事反复算成伤害。
 *
 * 归零不是「击杀」，是「它薄到看不见了」：留一句它出现时你的原话作为碑文。
 */
export function hitMonsters(s: Game, hit: {kind: MonsterHit['kind']; ref: string; note: string}, at: string) {
 for (const m of s.monsters) {
  if (m.resolvedAt) continue;
  if (!Array.isArray(m.hits)) m.hits = [];
  // 同一件事只算一次：ref 就是那一轮对话、那一条 log 的 id。
  if (m.hits.some(h => h.ref === hit.ref)) continue;
  m.hits.push({at, kind: hit.kind, ref: hit.ref, note: hit.note.slice(0, 120)});
  m.hp = Math.max(0, m.hp - MONSTER_HIT_DAMAGE[hit.kind]);
  if (m.hp === 0) {
   m.resolvedAt = at;
   // 碑文用它出现时的原话，不是最后这一击——走掉的时候人想看的是「它当初是什么」。
   m.epitaph = m.epitaph || m.sourceText || hit.note.slice(0, 120);
  }
 }
}

/** 最近几次挨打，新的在前。世界页卡片上显示最近三击。 */
export function recentHits(m: Monster, n = 3): MonsterHit[] {
 return [...(m.hits || [])].sort((a, b) => b.at.localeCompare(a.at)).slice(0, n);
}
