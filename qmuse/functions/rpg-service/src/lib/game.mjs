// Generated from existing site/lib domain code; regenerate with qmuse/scripts/build-domain.mjs.

// site/lib/appearance.ts
function validGender(value) {
  if (value !== "male" && value !== "female") throw Error("\u8BF7\u9009\u62E9\u6027\u522B");
  return value;
}
function validAvatar(value, fallback) {
  if (value === void 0) return fallback;
  if (value !== "male" && value !== "female") throw Error("\u8BF7\u9009\u62E9\u89D2\u8272\u5F62\u8C61");
  if (value !== fallback) throw Error("\u89D2\u8272\u5F62\u8C61\u9700\u8981\u4E0E\u9009\u62E9\u7684\u6027\u522B\u4E00\u81F4");
  return value;
}
function characterGender(profile) {
  return profile?.gender || profile?.avatarId || "male";
}
var clothingGender = { explorer: "all", suit: "male", dress: "female" };
function canWear(gender, outfit) {
  const target = clothingGender[outfit];
  return target === "all" || target === gender;
}
function adultOutfit(gender) {
  return gender === "male" ? "suit" : "dress";
}
function resolveEquipped(gender, outfit, claims) {
  if (outfit === "explorer") return outfit;
  if (!claims.includes("adult")) return "explorer";
  if (outfit === "suit" || outfit === "dress") return canWear(gender, outfit) ? outfit : adultOutfit(gender);
  return "explorer";
}

// site/lib/birthday.ts
var iso = (d) => d.toISOString().slice(0, 10);
var formatter;
function lunarDate(date) {
  formatter ??= new Intl.DateTimeFormat("en-u-ca-chinese", { year: "numeric", month: "numeric", day: "numeric", timeZone: "Asia/Shanghai" });
  if (formatter.resolvedOptions().calendar !== "chinese") throw Error("\u5F53\u524D\u8BBE\u5907\u6682\u4E0D\u652F\u6301\u519C\u5386\uFF0C\u8BF7\u4F7F\u7528\u516C\u5386\u6216\u6362\u4E00\u53F0\u8BBE\u5907");
  const parts = formatter.formatToParts(/* @__PURE__ */ new Date(date + "T04:00:00Z"));
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  const raw = get("month"), year = Number(get("relatedYear")), month = parseInt(raw), day2 = Number(get("day"));
  if (!year || !month || !day2) throw Error("\u519C\u5386\u6362\u7B97\u6682\u4E0D\u53EF\u7528");
  return { year, month, day: day2, leap: raw.includes("bis") };
}
var years = /* @__PURE__ */ new Map();
function lunarYear(year) {
  const old = years.get(year);
  if (old) return old;
  const rows = [];
  for (let ms = Date.UTC(year, 0, 1); ms < Date.UTC(year + 1, 2, 1); ms += 864e5) {
    const date = iso(new Date(ms)), v = lunarDate(date);
    if (v.year === year) rows.push({ date, ...v });
  }
  if (years.size >= 8) years.delete(years.keys().next().value);
  years.set(year, rows);
  return rows;
}
function birthdayLabel(b) {
  return b.calendar === "solar" ? `\u516C\u5386 ${b.month}\u6708${b.day}\u65E5` : `\u519C\u5386 ${b.leapMonth ? "\u95F0" : ""}${b.month}\u6708${b.day}\u65E5`;
}
function birthdayOccurrence(b, year) {
  let date = "", adjustment = "";
  if (b.calendar === "solar") {
    const candidate = new Date(Date.UTC(year, b.month - 1, b.day));
    if (b.month === 2 && b.day === 29 && candidate.getUTCMonth() !== 1) {
      date = `${year}-${b.solarLeap === "mar1" ? "03-01" : "02-28"}`;
      adjustment = `\u975E\u95F0\u5E74\uFF0C\u6309\u4F60\u7684\u9009\u62E9\u5728${b.solarLeap === "mar1" ? "3\u67081\u65E5" : "2\u670828\u65E5"}\u5E86\u795D`;
    } else date = iso(candidate);
  } else {
    const rows = lunarYear(year);
    const hasLeap = rows.some((r) => r.month === b.month && r.leap);
    if (b.leapMonth && b.leapPolicy === "leap" && !hasLeap) return null;
    const leap = b.leapMonth && b.leapPolicy === "leap";
    const month = rows.filter((r) => r.month === b.month && r.leap === leap);
    if (!month.length) return null;
    const match = month.find((r) => r.day === b.day);
    if (match) date = match.date;
    else if (b.day === 30) {
      const last = month.at(-1);
      date = b.shortMonth === "next" ? iso(new Date(Date.parse(last.date + "T04:00Z") + 864e5)) : last.date;
      adjustment = `\u8BE5\u6708\u53EA\u670929\u5929\uFF0C\u6309\u4F60\u7684\u9009\u62E9\u5728${b.shortMonth === "next" ? "\u6B21\u6708\u521D\u4E00" : "\u672C\u6708\u5EFF\u4E5D"}\u5E86\u795D`;
    } else return null;
    if (b.leapMonth && b.leapPolicy === "regular") adjustment = [adjustment, "\u95F0\u6708\u751F\u65E5\u6309\u666E\u901A\u6708\u4EFD\u5E86\u795D"].filter(Boolean).join("\uFF1B");
  }
  return { year, date, label: birthdayLabel(b), calendar: b.calendar, adjustment, ...b.showAge && b.birthYear && year >= b.birthYear ? { age: year - b.birthYear } : {} };
}
function validateBirthday(a, today) {
  if (a.calendar !== "solar" && a.calendar !== "lunar") throw Error("\u8BF7\u9009\u62E9\u516C\u5386\u6216\u519C\u5386");
  const month = Number(a.month), day2 = Number(a.day), birthYear = a.birthYear === void 0 || a.birthYear === null || a.birthYear === "" ? void 0 : Number(a.birthYear), current = Number(today.slice(0, 4));
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day2) || day2 < 1 || day2 > (a.calendar === "lunar" ? 30 : new Date(Date.UTC(2e3, month, 0)).getUTCDate())) throw Error("\u751F\u65E5\u6708\u4EFD\u6216\u65E5\u671F\u65E0\u6548");
  if (birthYear !== void 0 && (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > current)) throw Error("\u51FA\u751F\u5E74\u4EFD\u65E0\u6548");
  const b = { calendar: a.calendar, month, day: day2, birthYear, showAge: !!a.showAge, reminders: a.reminders !== false, leapMonth: a.calendar === "lunar" && !!a.leapMonth, leapPolicy: a.leapPolicy === "leap" ? "leap" : "regular", shortMonth: a.shortMonth === "next" ? "next" : "last", solarLeap: a.solarLeap === "mar1" ? "mar1" : "feb28" };
  if (birthYear) {
    const actual = b.calendar === "lunar" ? lunarYear(birthYear).find((r) => r.month === month && r.day === day2 && r.leap === b.leapMonth)?.date : `${birthYear}-${String(month).padStart(2, "0")}-${String(day2).padStart(2, "0")}`;
    if (!actual || (/* @__PURE__ */ new Date(actual + "T04:00Z")).toISOString().slice(0, 10) !== actual || actual > today) throw Error("\u51FA\u751F\u65E5\u671F\u4E0D\u5B58\u5728\u6216\u5728\u672A\u6765\uFF0C\u8BF7\u68C0\u67E5\u5E74\u4EFD\u4E0E\u95F0\u6708");
  }
  birthdayOccurrence(b, current);
  return b;
}
function birthdaySchedule(b, joined, today) {
  const current = b.calendar === "lunar" ? lunarDate(today).year : Number(today.slice(0, 4));
  const start = Math.max(1900, Number(joined.slice(0, 4)) - 1, b.birthYear || 1900);
  const result = [];
  for (let y = start; y <= current + 12; y++) {
    const o = birthdayOccurrence(b, y);
    if (o && (o.date >= joined || o.date.slice(0, 4) === joined.slice(0, 4))) result.push(o);
    if (o && o.date > today) break;
  }
  return result.sort((a, b2) => a.date.localeCompare(b2.date));
}
function validateBirth(a, today) {
  const year = Number(a.year);
  if (!Number.isInteger(year) || year < 1900 || year > Number(today.slice(0, 4))) throw Error("\u8BF7\u586B\u5199\u6709\u6548\u7684\u51FA\u751F\u5E74\u4EFD");
  const b = validateBirthday({ ...a, birthYear: year }, today);
  const date = b.calendar === "lunar" ? lunarYear(year).find((r) => r.month === b.month && r.day === b.day && r.leap === b.leapMonth)?.date : `${year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`;
  if (!date || date > today) throw Error("\u8BF7\u68C0\u67E5\u51FA\u751F\u65E5\u671F");
  return { date, calendar: b.calendar, year, month: b.month, day: b.day, leapMonth: b.leapMonth };
}
function celebrationSettings(birth, calendar, preferences = {}) {
  const v = calendar === "lunar" ? lunarDate(birth.date) : { year: Number(birth.date.slice(0, 4)), month: Number(birth.date.slice(5, 7)), day: Number(birth.date.slice(8, 10)), leap: false };
  return { ...preferences, calendar, month: v.month, day: v.day, birthYear: v.year, leapMonth: v.leap, showAge: preferences.showAge ?? false, reminders: preferences.reminders ?? true, leapPolicy: preferences.leapPolicy || "regular", shortMonth: preferences.shortMonth || "last", solarLeap: preferences.solarLeap || "feb28" };
}
function ageAt(birth, date) {
  const years2 = Number(date.slice(0, 4)) - Number(birth.date.slice(0, 4));
  const anniversary = /* @__PURE__ */ new Date(birth.date + "T04:00Z");
  anniversary.setUTCFullYear(Number(date.slice(0, 4)));
  return years2 - (date < iso(anniversary) ? 1 : 0);
}
function adultDate(birth) {
  const d = /* @__PURE__ */ new Date(birth.date + "T04:00Z");
  d.setUTCFullYear(d.getUTCFullYear() + 18);
  return iso(d);
}

// <stdin>
var domains = [
  { id: "mind", name: "\u8BA4\u77E5", region: "\u77E5\u6653\u4E4B\u5883", color: "#ad9cff", description: "\u628A\u597D\u5947\u5FC3\uFF0C\u53D8\u6210\u4F60\u7684\u80FD\u529B\u3002", skill: "\u77E5\u8BC6\u63A2\u7D22" },
  { id: "health", name: "\u5065\u5EB7", region: "\u751F\u547D\u68EE\u6797", color: "#67dfb5", description: "\u7167\u987E\u8EAB\u4F53\uFF0C\u4E5F\u4E3A\u5192\u9669\u79EF\u84C4\u529B\u91CF\u3002", skill: "\u6D3B\u529B\u517B\u6210" },
  { id: "career", name: "\u804C\u4E1A", region: "\u521B\u9020\u4E4B\u57CE", color: "#75c8ff", description: "\u6BCF\u4E00\u6B21\u8BA4\u771F\u6295\u5165\uFF0C\u90FD\u6709\u56DE\u54CD\u3002", skill: "\u5B9E\u8DF5\u521B\u9020" },
  { id: "wealth", name: "\u8D22\u5BCC", region: "\u4E30\u76C8\u6D77\u6E7E", color: "#ffd187", description: "\u79EF\u7D2F\u7684\u662F\u9009\u62E9\u751F\u6D3B\u7684\u81EA\u7531\u3002", skill: "\u957F\u671F\u89C4\u5212" },
  { id: "social", name: "\u5173\u7CFB", region: "\u5171\u9E23\u7FA4\u5C9B", color: "#f69cc8", description: "\u4E0E\u91CD\u8981\u7684\u4EBA\uFF0C\u5EFA\u7ACB\u771F\u5B9E\u7684\u8FDE\u63A5\u3002", skill: "\u5173\u7CFB\u7ECF\u8425" }
];
var milestoneKinds = [{ id: "adult", title: "18 \u5C81\u6210\u4EBA\u793C", category: "\u4EBA\u751F\u8F6C\u6298", reward: "\u6210\u5E74\u793C\u88C5", description: "\u628A\u5C5E\u4E8E\u4F60\u7684\u6210\u4EBA\u793C\uFF0C\u73CD\u85CF\u5728\u8FD9\u91CC\u3002" }, { id: "first-job", title: "\u7B2C\u4E00\u4EFD\u5DE5\u4F5C", category: "\u4EBA\u751F\u8F6C\u6298", reward: "\u521D\u5165\u804C\u573A\u5FBD\u7AE0", description: "\u8BB0\u5F55\u7B2C\u4E00\u6B21\u8D70\u8FDB\u804C\u573A\u7684\u65E5\u5B50\u3002" }, { id: "first-salary", title: "\u7B2C\u4E00\u6B21\u9886\u5DE5\u8D44", category: "\u503C\u5F97\u7EAA\u5FF5", reward: "\u7B2C\u4E00\u4EFD\u6536\u83B7\u5FBD\u7AE0", description: "\u8FD9\u4E00\u4EFD\u56DE\u62A5\uFF0C\u5C5E\u4E8E\u8BA4\u771F\u8FC8\u6B65\u7684\u4F60\u3002" }, { id: "graduation", title: "\u6BD5\u4E1A", category: "\u4EBA\u751F\u8F6C\u6298", reward: "\u65B0\u7684\u8D77\u70B9\u5FBD\u7AE0", description: "\u544A\u522B\u4E00\u4E2A\u9636\u6BB5\uFF0C\u4E5F\u5F00\u542F\u4E00\u6BB5\u65B0\u65C5\u7A0B\u3002" }, { id: "custom", title: "\u6211\u7684\u91CD\u8981\u65F6\u523B", category: "\u81EA\u5B9A\u4E49\u7EAA\u5FF5", reward: "\u4EBA\u751F\u7EAA\u5FF5", description: "\u91CD\u8981\u4E0E\u5426\uFF0C\u7531\u4F60\u81EA\u5DF1\u5B9A\u4E49\u3002" }];
var outfits = [{ id: "explorer", name: "\u542F\u7A0B\u63A2\u7D22\u88C5", image: "/explorer.png", requirement: "" }, { id: "suit", name: "\u661F\u5149\u897F\u88C5", image: "/outfit-suit.png", requirement: "adult" }, { id: "dress", name: "\u6708\u5149\u793C\u88D9", image: "/outfit-dress.png", requirement: "adult" }];
function normalizeGame(value, today = day()) {
  const s = { ...blank(), ...value, reviews: value.reviews || [], agentAccepts: value.agentAccepts || [], milestones: value.milestones || [], claims: value.claims || [], equipped: value.equipped || "explorer", birthday: value.birthday || null, birthdays: value.birthdays || [], birthdayQueue: value.birthdayQueue || [], settings: { celebrations: value.settings?.celebrations ?? true, memoryPromptSeen: value.settings?.memoryPromptSeen ?? false } };
  if (s.profile?.gender) s.profile = { ...s.profile, avatarId: s.profile.gender };
  s.equipped = resolveEquipped(characterGender(s.profile), s.equipped, s.claims);
  return syncBirthdayQueue(s, today);
}
function syncBirthdayQueue(s, today = day()) {
  if (!s.profile || !s.birthday) return s;
  const past = new Map(s.birthdayQueue.filter((o) => o.date <= today).map((o) => [o.year, o]));
  for (const b of s.birthdays) past.set(b.year, { year: b.year, date: b.date, label: b.label, calendar: b.calendar, adjustment: b.adjustment, age: b.age });
  const future = [];
  for (const o of birthdaySchedule(s.birthday, day(new Date(s.profile.createdAt)), today)) {
    const item = { ...o, ...s.profile.birth && s.birthday.showAge ? { age: ageAt(s.profile.birth, o.date) } : {} };
    if (o.date <= today) {
      if (!past.has(o.year)) past.set(o.year, item);
    } else if (!past.has(o.year)) future.push(item);
  }
  s.birthdayQueue = [...past.values(), ...future].sort((a, b) => a.date.localeCompare(b.date));
  return s;
}
function pendingBirthdays(s, today = day()) {
  return s.birthdayQueue.filter((o) => o.date <= today && !s.birthdays.some((b) => b.year === o.year));
}
function completedActions(s, filter = {}) {
  const totals = /* @__PURE__ */ new Map(), finished = /* @__PURE__ */ new Set(), tasks = new Map(s.tasks.map((t) => [t.id, t]));
  let count = 0;
  const deposits = /* @__PURE__ */ new Set();
  for (const l of s.logs) {
    if (l.undone || l.direction !== "deposit" || filter.date && l.date !== filter.date || filter.domain && l.domain !== filter.domain) continue;
    deposits.add(l.goalId + ":" + l.date);
  }
  count += deposits.size;
  for (const l of [...s.logs].filter((l2) => !l2.undone && !l2.direction).sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at))) {
    const t = tasks.get(l.taskId);
    if (!t) continue;
    const key = t.id + ":" + (t.repeat ? l.date : "once");
    const n = (totals.get(key) || 0) + l.value;
    totals.set(key, n);
    if (n >= t.target && !finished.has(key)) {
      finished.add(key);
      if ((!filter.date || l.date === filter.date) && (!filter.domain || t.domain === filter.domain)) count++;
    }
  }
  return count;
}
function availableXP(s, domain2, today = day()) {
  return Math.max(0, 30 - s.logs.filter((l) => !l.undone && l.domain === domain2 && l.date === today).reduce((n, l) => n + l.xp, 0));
}
function adultEligible(s, today = day()) {
  return !!s.profile?.birth && adultDate(s.profile.birth) <= today;
}
var blank = () => ({ profile: null, goals: [], tasks: [], logs: [], events: [], milestones: [], claims: [], equipped: "explorer", birthday: null, birthdays: [], birthdayQueue: [], reviews: [], agentAccepts: [], settings: { celebrations: true, memoryPromptSeen: false } });
var dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });
function day(date = /* @__PURE__ */ new Date()) {
  return dayFormatter.format(date);
}
function xp(s) {
  return s.logs.filter((x) => !x.undone).reduce((v, x) => v + x.xp, 0);
}
function level(s) {
  return Math.floor(xp(s) / 200) + 1;
}
function progress(s, g) {
  return s.logs.filter((l) => !l.undone && l.goalId === g.id && l.unit === g.unit).reduce((v, l) => Math.round((v + (l.direction === "withdraw" ? -l.value : l.value)) * 100) / 100, g.initial || 0);
}
function goalReached(s, g) {
  return g.successCriteria ? !!g.confirmedAt : progress(s, g) >= g.target;
}
function done(s, t, today = day()) {
  return s.logs.filter((l) => !l.undone && l.taskId === t.id && (!t.repeat || l.date === today)).reduce((v, l) => v + l.value, 0);
}
var events = [
  { id: "arrival", level: 1, title: "\u4E00\u5C01\u6765\u81EA\u672A\u6765\u7684\u4FE1", tag: "\u5E8F\u7AE0 \xB7 \u661F\u7403\u521D\u89C1", body: "\u4F60\u5728\u8425\u5730\u53D1\u73B0\u4E86\u4E00\u5C01\u4FE1\u3002\u4FE1\u91CC\u53EA\u6709\u4E00\u53E5\u8BDD\uFF1A\u201C\u672A\u6765\u7684\u4F60\uFF0C\u6B63\u5728\u611F\u8C22\u4ECA\u5929\u8FC8\u51FA\u7684\u7B2C\u4E00\u6B65\u3002\u201D\u4F60\u60F3\u5E26\u4E0A\u4EC0\u4E48\u51FA\u53D1\uFF1F", choices: ["\u4E00\u4EFD\u597D\u5947\u5FC3", "\u4E00\u70B9\u52C7\u6C14"], reward: "\u542F\u7A0B\u7EAA\u5FF5" },
  { id: "forest", level: 2, title: "\u68EE\u6797\u4E2D\u7684\u5206\u5C94\u8DEF", tag: "\u7B2C\u4E00\u7AE0 \xB7 \u751F\u957F", body: "\u4E00\u6761\u8DEF\u901A\u5411\u5B89\u9759\u7684\u6E56\u7554\uFF0C\u53E6\u4E00\u6761\u901A\u5411\u5C71\u9876\u7684\u6668\u5149\u3002\u63A2\u7D22\u6CA1\u6709\u6807\u51C6\u7B54\u6848\uFF0C\u4F60\u4ECA\u5929\u66F4\u9700\u8981\u4EC0\u4E48\uFF1F", choices: ["\u53BB\u6E56\u8FB9\u4F11\u606F", "\u53BB\u5C71\u9876\u8FDC\u671B"], reward: "\u68EE\u6797\u6765\u4FE1" },
  { id: "beacon", level: 3, title: "\u5C5E\u4E8E\u4F60\u7684\u706F\u5854", tag: "\u7B2C\u4E8C\u7AE0 \xB7 \u56DE\u54CD", body: "\u6D77\u6E7E\u91CC\u7684\u706F\u5854\u4EAE\u4E86\u3002\u4F60\u7559\u4E0B\u7684\u884C\u52A8\u8BB0\u5F55\uFF0C\u5DF2\u7ECF\u6210\u4E3A\u6307\u5F15\u4E0B\u4E00\u6BB5\u65C5\u7A0B\u7684\u5149\u3002\u4F60\u60F3\u628A\u8FD9\u675F\u5149\u732E\u7ED9\u8C01\uFF1F", choices: ["\u8FC7\u53BB\u7684\u81EA\u5DF1", "\u672A\u6765\u7684\u81EA\u5DF1"], reward: "\u706F\u5854\u5B88\u671B\u8005" }
];
var str = (v, max = 80) => {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max) throw new Error("\u8BF7\u586B\u5199\u6709\u6548\u5185\u5BB9");
  return v.trim();
};
var text = (v, max = 1e3) => {
  if (v === void 0) return "";
  if (typeof v !== "string" || v.length > max) throw new Error("\u6587\u5B57\u8FC7\u957F");
  return v.trim();
};
var num = (v) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 1e8) throw new Error("\u8BF7\u8F93\u5165\u5927\u4E8E0\u7684\u6709\u6548\u6570\u503C");
  const n = Math.round(v * 100) / 100;
  if (n <= 0) throw new Error("\u6700\u5C0F\u8BB0\u5F55\u503C\u4E3A0.01");
  return n;
};
var domain = (v) => {
  if (!domains.some((d) => d.id === v)) throw new Error("\u8BF7\u9009\u62E9\u6210\u957F\u65B9\u5411");
  return v;
};
var unit = (v) => {
  const u = str(v, 8);
  if (!["\u6B21", "\u5206\u949F", "\u6B65", "\u5143", "\u9875"].includes(u)) throw new Error("\u8BF7\u9009\u62E9\u8BB0\u5F55\u5355\u4F4D");
  return u;
};
var photos = (v) => {
  if (v === void 0) return [];
  if (!Array.isArray(v) || v.length > 3 || v.some((x) => typeof x !== "string" || !/^photo_[a-f0-9-]{36}$/.test(x))) throw new Error("\u7167\u7247\u4FE1\u606F\u65E0\u6548");
  return [...new Set(v)];
};
function validDate(v, today, future = false) {
  const d = str(v, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < "1900-01-01" || Number.isNaN(Date.parse(d + "T12:00:00Z")) || (/* @__PURE__ */ new Date(d + "T12:00:00Z")).toISOString().slice(0, 10) !== d || !future && d > today) throw new Error("\u8BF7\u9009\u62E9\u6709\u6548\u65E5\u671F\uFF0C\u4E0D\u80FD\u63D0\u524D\u8BB0\u5F55\u672A\u6765\u7684\u5B8C\u6210");
  return d;
}
function metadata(a, today) {
  return { date: validDate(a.date || today, today), note: text(a.note), photos: photos(a.photos), source: a.source === "timer" ? "timer" : "manual" };
}
function recalculate(s) {
  const awarded = /* @__PURE__ */ new Set();
  const totals = /* @__PURE__ */ new Map();
  for (const l of [...s.logs].sort((a, b) => a.at.localeCompare(b.at))) {
    l.xp = 0;
    if (l.undone) continue;
    const task = s.tasks.find((t) => t.id === l.taskId);
    const group = task ? task.id + (task.repeat ? l.date : "once") : "";
    const before = totals.get(group) || 0;
    if (task) totals.set(group, before + l.value);
    const eligible = l.direction ? l.direction === "deposit" : !!task && before < task.target && before + l.value >= task.target;
    const cap = l.date + ":" + l.domain;
    if (eligible && !awarded.has(cap)) {
      l.xp = 30;
      awarded.add(cap);
    }
  }
}
function financialCheck(s, g) {
  if (progress(s, g) < 0) throw new Error("\u53D6\u51FA\u91D1\u989D\u4E0D\u80FD\u8D85\u8FC7\u8FD9\u4E2A\u76EE\u6807\u7684\u5DF2\u6709\u51C0\u5B58\u6B3E");
}
function reduceGame(current, a, now = /* @__PURE__ */ new Date()) {
  const s = structuredClone(normalizeGame(current, day(now))), at = now.toISOString(), today = day(now), id = () => crypto.randomUUID();
  if (a.type === "onboard") {
    if (s.profile) throw new Error("\u89D2\u8272\u5DF2\u521B\u5EFA");
    const focus = domain(a.focus);
    const birth = a.birth ? validateBirth(a.birth, today) : void 0;
    const gender = validGender(a.gender), avatarId = validAvatar(a.avatarId, gender);
    s.profile = { name: str(a.name, 20), focus, createdAt: at, ...birth ? { birth } : {}, gender, avatarId };
    s.settings.memoryPromptSeen = true;
    s.birthday = birth ? celebrationSettings(birth, a.celebrationCalendar === "lunar" ? "lunar" : "solar") : null;
    const plans = { mind: ["\u5EFA\u7ACB\u9605\u8BFB\u4E60\u60EF", "\u9605\u8BFB\u5E76\u8BB0\u5F55\u4E00\u4E2A\u6536\u83B7", "\u5206\u949F", 300, 20], health: ["\u5F00\u542F\u89C4\u5F8B\u8FD0\u52A8", "\u5B8C\u6210\u4E00\u6B21\u8FD0\u52A8", "\u5206\u949F", 300, 10], career: ["\u63A8\u8FDB\u4E00\u4E2A\u4E2A\u4EBA\u9879\u76EE", "\u4E13\u6CE8\u63A8\u8FDB\u9879\u76EE", "\u5206\u949F", 600, 30], wealth: ["\u5EFA\u7ACB\u7B2C\u4E00\u7B14\u50A8\u84C4", "\u8BB0\u5F55\u5B9E\u9645\u5B58\u5165\u91D1\u989D", "\u5143", 1e3, 100], social: ["\u4E0E\u91CD\u8981\u7684\u4EBA\u4FDD\u6301\u8054\u7CFB", "\u4E00\u6B21\u8BA4\u771F\u4EA4\u6D41", "\u6B21", 10, 1] };
    const p = plans[focus], gid = id();
    s.goals.push({ id: gid, title: typeof a.goalTitle === "string" && a.goalTitle.trim() ? str(a.goalTitle) : p[0], domain: focus, target: a.goalTarget === void 0 ? p[3] : num(a.goalTarget), unit: a.goalUnit === void 0 ? p[2] : unit(a.goalUnit), deadline: "", paused: false, createdAt: at, initial: 0, recordMode: "entries" });
    const goal = s.goals.at(-1);
    if (goal.unit !== "\u5143") s.tasks.push({ id: id(), title: typeof a.taskTitle === "string" ? str(a.taskTitle) : p[1], domain: focus, target: a.taskTarget === void 0 ? p[4] : num(a.taskTarget), unit: goal.unit, repeat: true, goalId: gid, archived: false, evidence: "optional" });
    return syncBirthdayQueue(s, today);
  }
  if (!s.profile) throw new Error("\u8BF7\u5148\u521B\u5EFA\u89D2\u8272");
  if (a.type === "birth-profile") {
    const birth = validateBirth(a.birth || {}, today);
    s.profile.birth = birth;
    s.settings.memoryPromptSeen = true;
    s.birthday = celebrationSettings(birth, a.celebrationCalendar === "lunar" ? "lunar" : "solar", s.birthday || {});
    return syncBirthdayQueue(s, today);
  }
  if (a.type === "profile") {
    const name = str(a.name, 20), gender = validGender(a.gender ?? s.profile.gender), avatarId = validAvatar(a.avatarId, gender);
    Object.assign(s.profile, { name, gender, avatarId });
    s.equipped = resolveEquipped(gender, s.equipped, s.claims);
    return s;
  }
  if (a.type === "settings") {
    if (a.celebrations !== void 0) s.settings.celebrations = !!a.celebrations;
    if (a.memoryPromptSeen !== void 0) s.settings.memoryPromptSeen = !!a.memoryPromptSeen;
    return s;
  }
  if (a.type === "goal") {
    if (!a.id && s.goals.length >= 100) throw new Error("\u6700\u591A\u521B\u5EFA100\u4E2A\u76EE\u6807");
    const existing = s.goals.find((g2) => g2.id === a.id);
    if (a.id && !existing) throw new Error("\u76EE\u6807\u4E0D\u5B58\u5728");
    const deadline = a.deadline ? validDate(a.deadline, today, true) : "";
    const u = existing?.unit || unit(a.unit);
    const initial = u === "\u5143" ? Number(a.initial || 0) : 0;
    if (!Number.isFinite(initial) || initial < 0 || initial > 1e8) throw new Error("\u5DF2\u6709\u5B58\u6B3E\u91D1\u989D\u65E0\u6548");
    const mode = a.recordMode === "monthly" ? "monthly" : "entries";
    if (existing && s.logs.some((l) => l.goalId === existing.id) && (mode !== (existing.recordMode || "entries") || initial !== (existing.initial || 0))) throw new Error("\u5DF2\u6709\u8BB0\u5F55\u540E\uFF0C\u8BB0\u8D26\u65B9\u5F0F\u548C\u8D77\u59CB\u5B58\u6B3E\u4E0D\u80FD\u53D8\u66F4\uFF0C\u8BF7\u65B0\u5EFA\u76EE\u6807");
    const g = { id: existing?.id || id(), title: str(a.title), domain: existing?.domain || domain(a.domain), target: num(a.target), unit: u, deadline, paused: existing?.paused || false, createdAt: existing?.createdAt || at, recordMode: mode, initial: Math.round(initial * 100) / 100, completionChoice: existing?.completionChoice, successCriteria: existing?.successCriteria, confirmedAt: existing?.confirmedAt };
    if (existing) s.goals = s.goals.map((x) => x.id === g.id ? g : x);
    else s.goals.push(g);
    return s;
  }
  if (a.type === "finish-goal") {
    const g = s.goals.find((g2) => g2.id === a.id);
    if (!g) throw Error("\u76EE\u6807\u4E0D\u5B58\u5728");
    if (!goalReached(s, g)) throw Error("\u76EE\u6807\u8FD8\u672A\u8FBE\u6210");
    if (g.completionChoice) throw Error("\u8FD9\u4E2A\u76EE\u6807\u5DF2\u6574\u7406\u5B8C\u6210");
    if (a.choice !== "habit" && a.choice !== "archived") throw Error("\u8BF7\u9009\u62E9\u76EE\u6807\u5B8C\u6210\u540E\u7684\u5B89\u6392");
    g.completionChoice = a.choice;
    g.paused = true;
    for (const t of s.tasks.filter((t2) => t2.goalId === g.id)) {
      if (a.choice === "habit" && !t.archived) t.goalId = "";
      else t.archived = true;
    }
    return s;
  }
  if (a.type === "pause") {
    const g = s.goals.find((g2) => g2.id === a.id);
    if (!g) throw new Error("\u76EE\u6807\u4E0D\u5B58\u5728");
    g.paused = !g.paused;
    return s;
  }
  if (a.type === "confirm-goal") {
    const g = s.goals.find((g2) => g2.id === a.id);
    if (!g || !g.successCriteria) throw Error("\u8FD9\u4E2A\u76EE\u6807\u6CA1\u6709\u72EC\u7ACB\u6210\u529F\u6807\u51C6");
    if (g.paused || g.completionChoice) throw Error("\u8BF7\u5148\u6062\u590D\u76EE\u6807");
    g.confirmedAt = g.confirmedAt || at;
    return s;
  }
  if (a.type === "delete-review") {
    if (!s.reviews.some((r) => r.id === a.id)) throw Error("\u590D\u76D8\u4E0D\u5B58\u5728");
    s.reviews = s.reviews.filter((r) => r.id !== a.id);
    return s;
  }
  if (a.type === "agent-confirm") {
    const rid = str(a.clientId, 80);
    if (s.agentAccepts.includes(rid)) return s;
    if (s.agentAccepts.length >= 1e3) throw Error("AI\u786E\u8BA4\u8BB0\u5F55\u5DF2\u8FBE\u5BB9\u91CF\u4E0A\u9650\uFF0C\u8BF7\u53CD\u9988\u7ED9\u7EF4\u62A4\u8005");
    let g = s.goals.find((g2) => g2.id === a.goalId);
    if (a.goalId && !g) throw Error("\u4E3B\u7EBF\u76EE\u6807\u4E0D\u5B58\u5728");
    if (!g) {
      if (s.goals.length >= 100) throw Error("\u6700\u591A\u521B\u5EFA100\u4E2A\u76EE\u6807");
      const ng = a.newGoal;
      if (!ng) throw Error("\u76EE\u6807\u4FE1\u606F\u7F3A\u5931");
      g = { id: id(), title: str(ng.title), domain: domain(ng.domain), target: num(ng.target), unit: "\u5206\u949F", successCriteria: str(ng.successCriteria, 300), deadline: "", paused: false, createdAt: at };
      s.goals.push(g);
    }
    if (g.paused || g.completionChoice || g.confirmedAt) throw Error("\u76EE\u6807\u5DF2\u6682\u505C\u6216\u8FBE\u6210\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9");
    let taskId;
    if (a.candidate) {
      if (s.tasks.filter((t) => !t.archived).length >= 100) throw Error("\u8BF7\u5148\u5F52\u6863\u4E0D\u518D\u9700\u8981\u7684\u884C\u52A8");
      const c = a.candidate;
      const minutes = num(c.minutes);
      if (minutes > 120 || !Number.isInteger(minutes)) throw Error("\u884C\u52A8\u65F6\u95F4\u65E0\u6548");
      if (!Array.isArray(c.steps) || c.steps.length < 1 || c.steps.length > 4) throw Error("\u884C\u52A8\u6B65\u9AA4\u65E0\u6548");
      taskId = id();
      s.tasks.push({ id: taskId, title: str(c.title), completionCriteria: str(c.completionCriteria, 300), steps: c.steps.map((v) => str(v, 200)), domain: g.domain, target: g.unit === "\u5206\u949F" ? minutes : 1, unit: g.unit, repeat: false, goalId: g.id, archived: false, evidence: "optional", originRunId: rid });
    }
    if (a.review) {
      if (s.reviews.length >= 200) throw Error("\u590D\u76D8\u8BB0\u5F55\u5DF2\u8FBE\u5BB9\u91CF\u4E0A\u9650\uFF0C\u8BF7\u5BFC\u51FA\u5E76\u6574\u7406");
      const r = a.review;
      if (!Array.isArray(r.sourceLogIds) || !r.sourceLogIds.length || r.sourceLogIds.length > 12 || r.sourceLogIds.some((v) => !s.logs.some((l) => l.id === v && l.goalId === g.id && !l.undone))) throw Error("\u590D\u76D8\u5F15\u7528\u5DF2\u6539\u53D8\uFF0C\u8BF7\u91CD\u65B0\u751F\u6210");
      s.reviews.push({ id: rid, goalId: g.id, summary: str(r.summary, 600), adjustment: str(r.adjustment, 300), sourceLogIds: r.sourceLogIds, at, taskId });
    }
    if (!a.candidate && !a.review) throw Error("\u6CA1\u6709\u53EF\u786E\u8BA4\u7684\u5185\u5BB9");
    s.agentAccepts.push(rid);
    return s;
  }
  if (a.type === "task") {
    const existing = s.tasks.find((t2) => t2.id === a.id);
    if (a.id && !existing) throw new Error("\u884C\u52A8\u4E0D\u5B58\u5728");
    if (!a.id && s.tasks.filter((t2) => !t2.archived).length >= 100) throw new Error("\u8BF7\u5148\u5F52\u6863\u4E0D\u518D\u9700\u8981\u7684\u884C\u52A8");
    const gid = typeof a.goalId === "string" ? a.goalId : "";
    const g = s.goals.find((g2) => g2.id === gid);
    if (gid && !g) throw new Error("\u4E3B\u7EBF\u76EE\u6807\u4E0D\u5B58\u5728");
    if (g?.unit === "\u5143") throw new Error("\u5B58\u94B1\u76EE\u6807\u8BF7\u76F4\u63A5\u8BB0\u8D26\uFF0C\u4E0D\u901A\u8FC7\u884C\u52A8\u91CD\u590D\u7D2F\u8BA1");
    const t = { id: existing?.id || id(), title: str(a.title), domain: g?.domain || domain(a.domain), target: num(a.target), unit: g?.unit || unit(a.unit), repeat: !!a.repeat, goalId: gid, archived: false, evidence: a.evidence === "photo" ? "photo" : "optional" };
    if (t.unit === "\u5143") throw new Error("\u8BF7\u521B\u5EFA\u4EE5\u5143\u4E3A\u5355\u4F4D\u7684\u5B58\u94B1\u76EE\u6807\uFF0C\u518D\u8FDB\u5165\u76EE\u6807\u8BB0\u8D26");
    if (existing && s.logs.some((l) => l.taskId === existing.id)) throw new Error("\u5DF2\u6709\u8BB0\u5F55\u7684\u884C\u52A8\u8BF7\u5F52\u6863\u540E\u65B0\u5EFA\uFF0C\u907F\u514D\u6539\u53D8\u5386\u53F2\u7EDF\u8BA1");
    if (existing) s.tasks = s.tasks.map((x) => x.id === t.id ? t : x);
    else s.tasks.push(t);
    return s;
  }
  if (a.type === "archive") {
    const t = s.tasks.find((t2) => t2.id === a.id);
    if (!t) throw new Error("\u884C\u52A8\u4E0D\u5B58\u5728");
    t.archived = !t.archived;
    return s;
  }
  if (a.type === "log" || a.type === "ledger") {
    if (s.logs.length >= 1e4) throw new Error("\u8BB0\u5F55\u5DF2\u8FBE\u5BB9\u91CF\u4E0A\u9650\uFF0C\u8BF7\u5148\u5BFC\u51FA\u5B58\u6863");
    const clientId = typeof a.clientId === "string" && /^[a-f0-9-]{36}$/.test(a.clientId) ? a.clientId : id();
    if (s.logs.some((l) => l.id === clientId)) return s;
    const m = metadata(a, today);
    const value = num(a.value);
    if (a.type === "ledger") {
      const g = s.goals.find((g2) => g2.id === a.id && g2.unit === "\u5143");
      if (!g || g.paused) throw new Error("\u5B58\u94B1\u76EE\u6807\u4E0D\u5B58\u5728\u6216\u5DF2\u6682\u505C");
      if (a.direction !== "deposit" && a.direction !== "withdraw") throw new Error("\u8BF7\u9009\u62E9\u5B58\u5165\u6216\u53D6\u51FA");
      if ((g.recordMode || "entries") === "monthly") {
        m.date = m.date.slice(0, 7) + "-01";
        if (a.direction === "withdraw") throw new Error("\u6708\u5EA6\u6C47\u603B\u8BF7\u586B\u5199\u8BE5\u6708\u51C0\u589E\u52A0\u6216\u51C0\u51CF\u5C11");
        const direction = a.monthlyDirection === "decrease" ? "withdraw" : "deposit";
        const existing = s.logs.find((l) => !l.undone && l.goalId === g.id && l.date.slice(0, 7) === m.date.slice(0, 7));
        if (existing) {
          existing.history = [...existing.history || [], { value: existing.value, date: existing.date, note: existing.note || "", at }];
          Object.assign(existing, m, { value, direction, updatedAt: at });
        } else s.logs.push({ id: clientId, taskId: "", title: g.title + " \xB7 \u6708\u5EA6\u6C47\u603B", domain: g.domain, value, unit: "\u5143", goalId: g.id, xp: 0, at, undone: false, ...m, direction });
      } else s.logs.push({ id: clientId, taskId: "", title: g.title, domain: g.domain, value, unit: "\u5143", goalId: g.id, xp: 0, at, undone: false, ...m, direction: a.direction });
      financialCheck(s, g);
    } else {
      const t = s.tasks.find((t2) => t2.id === a.id && !t2.archived);
      if (!t) throw new Error("\u884C\u52A8\u4E0D\u5B58\u5728\u6216\u5DF2\u5F52\u6863");
      const g = s.goals.find((g2) => g2.id === t.goalId);
      if (g?.paused) throw new Error("\u8BF7\u5148\u6062\u590D\u8FD9\u6761\u4E3B\u7EBF");
      if (g?.unit === "\u5143") throw new Error("\u5B58\u94B1\u76EE\u6807\u8BF7\u76F4\u63A5\u8BB0\u8D26\uFF0C\u65E7\u884C\u52A8\u53EF\u5F52\u6863");
      if (t.evidence === "photo" && !m.photos.length) throw new Error("\u8FD9\u9879\u884C\u52A8\u9700\u8981\u81F3\u5C11\u4E00\u5F20\u7167\u7247");
      if (["\u6B65", "\u6B21", "\u9875"].includes(t.unit) && !Number.isInteger(value)) throw new Error("\u8FD9\u4E2A\u5355\u4F4D\u9700\u8981\u6574\u6570");
      s.logs.push({ id: clientId, taskId: t.id, title: t.title, domain: t.domain, value, unit: t.unit, goalId: t.goalId, xp: 0, at, undone: false, ...m });
    }
    recalculate(s);
    return s;
  }
  if (a.type === "edit-log" || a.type === "undo") {
    const l = s.logs.find((l2) => l2.id === a.id && !l2.undone);
    if (!l) throw new Error("\u8BB0\u5F55\u4E0D\u5B58\u5728\u6216\u5DF2\u7ECF\u64A4\u9500");
    if (a.type === "undo") {
      l.undone = true;
      l.updatedAt = at;
    } else {
      const m = metadata(a, today), value = num(a.value);
      const t = s.tasks.find((t2) => t2.id === l.taskId);
      if (t?.evidence === "photo" && !m.photos.length) throw new Error("\u8FD9\u9879\u884C\u52A8\u9700\u8981\u81F3\u5C11\u4E00\u5F20\u7167\u7247");
      if (["\u6B65", "\u6B21", "\u9875"].includes(l.unit) && !Number.isInteger(value)) throw new Error("\u8FD9\u4E2A\u5355\u4F4D\u9700\u8981\u6574\u6570");
      const g2 = s.goals.find((g3) => g3.id === l.goalId);
      if (g2?.recordMode === "monthly") {
        m.date = m.date.slice(0, 7) + "-01";
        if (s.logs.some((x) => x.id !== l.id && !x.undone && x.goalId === g2.id && x.date === m.date)) throw new Error("\u8BE5\u6708\u5DF2\u6709\u6C47\u603B\uFF0C\u8BF7\u7F16\u8F91\u5BF9\u5E94\u7684\u8BB0\u5F55");
      }
      l.history = [...l.history || [], { value: l.value, date: l.date, note: l.note || "", at }];
      Object.assign(l, m, { value, updatedAt: at });
    }
    const g = s.goals.find((g2) => g2.id === l.goalId);
    if (g?.unit === "\u5143") financialCheck(s, g);
    recalculate(s);
    return s;
  }
  if (a.type === "milestone") {
    if (!a.id && typeof a.clientId === "string" && s.milestones.some((m) => m.id === a.clientId)) return s;
    const existing = s.milestones.find((m) => m.id === a.id);
    if (a.id && !existing) throw new Error("\u7EAA\u5FF5\u4E0D\u5B58\u5728");
    const kind = existing?.kind || str(a.kind, 30);
    const spec = milestoneKinds.find((k) => k.id === kind);
    if (!spec) throw new Error("\u8BF7\u9009\u62E9\u91CC\u7A0B\u7891\u7C7B\u578B");
    if (kind === "adult" && !existing && !adultEligible(s, today)) throw Error(s.profile.birth ? "\u6EE118\u5C81\u540E\u624D\u80FD\u8BB0\u5F55\u6210\u4EBA\u793C" : "\u8BF7\u5148\u8865\u5168\u51FA\u751F\u65E5\u671F\uFF0C\u518D\u5224\u65AD\u6210\u4EBA\u793C");
    const datePrecision = a.datePrecision === "year" ? "year" : a.datePrecision === "unknown" ? "unknown" : "day";
    const date = datePrecision === "unknown" ? "" : datePrecision === "year" ? str(a.date, 4) : validDate(a.date, today);
    if (datePrecision === "year" && (!/^\d{4}$/.test(date) || date < "1900" || date > today.slice(0, 4))) throw Error("\u8BF7\u9009\u62E9\u6709\u6548\u5E74\u4EFD");
    if (s.profile.birth && datePrecision !== "unknown") {
      const earliest = kind === "adult" ? adultDate(s.profile.birth) : s.profile.birth.date;
      if (datePrecision === "day" && date < earliest || datePrecision === "year" && date < earliest.slice(0, 4)) throw Error(kind === "adult" ? "\u6210\u4EBA\u793C\u65E5\u671F\u4E0D\u80FD\u65E9\u4E8E18\u5C81\u751F\u65E5" : "\u7ECF\u5386\u65E5\u671F\u4E0D\u80FD\u65E9\u4E8E\u51FA\u751F\u65E5\u671F");
    }
    const note = text(a.note), imageIds = photos(a.photos);
    if (existing) {
      const title = ["custom", "graduation"].includes(kind) && a.title !== void 0 ? str(a.title) : existing.title;
      existing.history = [...existing.history || [], { date: existing.date, datePrecision: existing.datePrecision || "day", note: existing.note, title: existing.title, at }];
      Object.assign(existing, { date, datePrecision, note, title, photos: imageIds, updatedAt: at, archived: false });
      return s;
    }
    if (s.milestones.length >= 200) throw new Error("\u6700\u591A\u8BB0\u5F55200\u4E2A\u4EBA\u751F\u7EAA\u5FF5");
    const previous = !["custom", "graduation"].includes(kind) ? s.milestones.find((m) => m.kind === kind) : void 0;
    if (previous) {
      if (previous.archived) {
        Object.assign(previous, { date, datePrecision, note, photos: imageIds, updatedAt: at, archived: false });
        return s;
      }
      throw new Error("\u8FD9\u4E2A\u9996\u6B21\u91CC\u7A0B\u7891\u5DF2\u8BB0\u5F55\uFF0C\u8BF7\u7F16\u8F91\u5DF2\u6709\u7EAA\u5FF5");
    }
    s.milestones.push({ id: typeof a.clientId === "string" && /^[a-f0-9-]{36}$/.test(a.clientId) ? a.clientId : id(), kind, title: ["custom", "graduation"].includes(kind) ? kind === "graduation" && !a.title ? spec.title : str(a.title) : spec.title, date, datePrecision, note, photos: imageIds, at, updatedAt: at, archived: false });
    if (kind !== "custom" && !s.claims.includes(kind)) s.claims.push(kind);
    return s;
  }
  if (a.type === "birthday-settings") {
    if (!s.profile.birth) throw Error("\u8BF7\u5148\u8865\u5168\u51FA\u751F\u65E5\u671F");
    s.birthday = celebrationSettings(s.profile.birth, a.calendar === "lunar" ? "lunar" : "solar", { ...s.birthday, showAge: !!a.showAge, reminders: a.reminders !== false, leapPolicy: a.leapPolicy === "leap" ? "leap" : "regular", shortMonth: a.shortMonth === "next" ? "next" : "last", solarLeap: a.solarLeap === "mar1" ? "mar1" : "feb28" });
    return syncBirthdayQueue(s, today);
  }
  if (a.type === "birthday") {
    if (!a.id && typeof a.clientId === "string" && s.birthdays.some((b) => b.id === a.clientId)) return s;
    const existing = s.birthdays.find((b) => b.id === a.id);
    if (a.id && !existing) throw Error("\u751F\u65E5\u7EAA\u5FF5\u4E0D\u5B58\u5728");
    const note = text(a.note), wish = text(a.wish), imageIds = photos(a.photos);
    if (existing) {
      existing.history = [...existing.history || [], { note: existing.note, wish: existing.wish, at }];
      Object.assign(existing, { note, wish, photos: imageIds, updatedAt: at, archived: false });
      return s;
    }
    if (!s.birthday) throw Error("\u8BF7\u5148\u8BBE\u7F6E\u751F\u65E5");
    const occurrence = s.birthdayQueue.find((o) => o.year === a.year && (!a.date || o.date === a.date) && o.date <= today);
    if (!occurrence) throw Error("\u751F\u65E5\u5C1A\u672A\u5230\u6765\u6216\u4E0D\u5C5E\u4E8E\u53EF\u8865\u8FC7\u7684\u5E74\u4EFD");
    const previous = s.birthdays.find((b) => b.year === occurrence.year);
    if (previous) throw Error("\u8FD9\u6B21\u751F\u65E5\u5DF2\u6709\u7EAA\u5FF5\uFF0C\u8BF7\u7F16\u8F91\u6216\u6062\u590D\u5DF2\u6709\u8BB0\u5F55");
    s.birthdays.push({ ...occurrence, id: typeof a.clientId === "string" && /^[a-f0-9-]{36}$/.test(a.clientId) ? a.clientId : id(), note, wish, photos: imageIds, at, updatedAt: at, archived: false });
    const claim = "birthday:" + occurrence.date.slice(0, 4);
    if (!s.claims.includes(claim)) s.claims.push(claim);
    return s;
  }
  if (a.type === "archive-birthday") {
    const b = s.birthdays.find((b2) => b2.id === a.id);
    if (!b) throw Error("\u751F\u65E5\u7EAA\u5FF5\u4E0D\u5B58\u5728");
    b.archived = !b.archived;
    return s;
  }
  if (a.type === "forget-photo") {
    const pid = str(a.id, 50);
    for (const l of s.logs) l.photos = (l.photos || []).filter((x) => x !== pid);
    for (const m of s.milestones) m.photos = m.photos.filter((x) => x !== pid);
    for (const b of s.birthdays) b.photos = b.photos.filter((x) => x !== pid);
    return s;
  }
  if (a.type === "delete-memory") {
    if (a.kind === "birthday") {
      if (!s.birthdays.some((b) => b.id === a.id)) throw Error("\u7EAA\u5FF5\u4E0D\u5B58\u5728");
      s.birthdays = s.birthdays.filter((b) => b.id !== a.id);
    } else {
      if (!s.milestones.some((m) => m.id === a.id)) throw Error("\u7EAA\u5FF5\u4E0D\u5B58\u5728");
      s.milestones = s.milestones.filter((m) => m.id !== a.id);
    }
    return s;
  }
  if (a.type === "archive-milestone") {
    const m = s.milestones.find((m2) => m2.id === a.id);
    if (!m) throw new Error("\u7EAA\u5FF5\u4E0D\u5B58\u5728");
    m.archived = !m.archived;
    return s;
  }
  if (a.type === "equip") {
    const o = outfits.find((o2) => o2.id === a.id);
    if (!o) throw new Error("\u8FD9\u5957\u65F6\u88C5\u4E0D\u5B58\u5728");
    if (!canWear(characterGender(s.profile), o.id)) throw new Error("\u8FD9\u5957\u65F6\u88C5\u4E0D\u9002\u7528\u4E8E\u5F53\u524D\u89D2\u8272");
    if (o.requirement && !s.claims.includes(o.requirement)) throw new Error("\u8FD9\u5957\u65F6\u88C5\u5C1A\u672A\u83B7\u5F97");
    s.equipped = o.id;
    return s;
  }
  if (a.type === "event") {
    const e = events.find((e2) => e2.id === a.id);
    if (!e || level(s) < e.level) throw new Error("\u63A2\u7D22\u5C1A\u672A\u89E3\u9501");
    if (s.events.some((x) => x.id === e.id)) throw new Error("\u4F60\u5DF2\u5B8C\u6210\u8FD9\u6BB5\u63A2\u7D22");
    const choice = str(a.choice);
    if (!e.choices.includes(choice)) throw new Error("\u8BF7\u9009\u62E9\u6709\u6548\u9009\u9879");
    s.events.push({ id: e.id, choice, at });
    return s;
  }
  throw new Error("\u672A\u77E5\u64CD\u4F5C");
}
export {
  adultEligible,
  ageAt,
  availableXP,
  blank,
  completedActions,
  day,
  domains,
  done,
  events,
  goalReached,
  level,
  milestoneKinds,
  normalizeGame,
  outfits,
  pendingBirthdays,
  progress,
  reduceGame,
  syncBirthdayQueue,
  xp
};
