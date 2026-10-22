export type BirthdaySettings={calendar:'solar'|'lunar';month:number;day:number;birthYear?:number;showAge:boolean;reminders:boolean;leapMonth:boolean;leapPolicy:'regular'|'leap';shortMonth:'last'|'next';solarLeap:'feb28'|'mar1'};
export type BirthdayOccurrence={year:number;date:string;label:string;calendar:'solar'|'lunar';adjustment:string;age?:number};
export type BirthdayRecord=BirthdayOccurrence & {id:string;note:string;wish:string;photos:string[];at:string;updatedAt:string;archived:boolean;history?:{note:string;wish:string;at:string}[]};
export type BirthInfo={date:string;calendar:'solar'|'lunar';year:number;month:number;day:number;leapMonth:boolean};
const iso=(d:Date)=>d.toISOString().slice(0,10);
let formatter:Intl.DateTimeFormat|undefined;
export function lunarDate(date:string){
 formatter??=new Intl.DateTimeFormat('en-u-ca-chinese',{year:'numeric',month:'numeric',day:'numeric',timeZone:'Asia/Shanghai'});
 if(formatter.resolvedOptions().calendar!=='chinese')throw Error('当前设备暂不支持农历，请使用公历或换一台设备');
 const parts=formatter.formatToParts(new Date(date+'T04:00:00Z'));const get=(type:string)=>parts.find(p=>p.type===type)?.value||'';
 const raw=get('month'),year=Number(get('relatedYear')),month=parseInt(raw),day=Number(get('day'));
 if(!year||!month||!day)throw Error('农历换算暂不可用');return {year,month,day,leap:raw.includes('bis')};
}
const years=new Map<number,{date:string;month:number;day:number;leap:boolean}[]>();
function lunarYear(year:number){
 const old=years.get(year);if(old)return old;
 const rows=[];for(let ms=Date.UTC(year,0,1);ms<Date.UTC(year+1,2,1);ms+=86400000){const date=iso(new Date(ms)),v=lunarDate(date);if(v.year===year)rows.push({date,...v});}
 if(years.size>=8)years.delete(years.keys().next().value!);years.set(year,rows);return rows;
}
export function birthdayLabel(b:BirthdaySettings){return b.calendar==='solar'?`公历 ${b.month}月${b.day}日`:`农历 ${b.leapMonth?'闰':''}${b.month}月${b.day}日`;}
export function birthdayOccurrence(b:BirthdaySettings,year:number):BirthdayOccurrence|null{
 let date='',adjustment='';
 if(b.calendar==='solar'){
  const candidate=new Date(Date.UTC(year,b.month-1,b.day));
  if(b.month===2&&b.day===29&&candidate.getUTCMonth()!==1){date=`${year}-${b.solarLeap==='mar1'?'03-01':'02-28'}`;adjustment=`非闰年，按你的选择在${b.solarLeap==='mar1'?'3月1日':'2月28日'}庆祝`;}else date=iso(candidate);
 }else{
  const rows=lunarYear(year);const hasLeap=rows.some(r=>r.month===b.month&&r.leap);
  if(b.leapMonth&&b.leapPolicy==='leap'&&!hasLeap)return null;
  const leap=b.leapMonth&&b.leapPolicy==='leap';const month=rows.filter(r=>r.month===b.month&&r.leap===leap);if(!month.length)return null;
  const match=month.find(r=>r.day===b.day);if(match)date=match.date;
  else if(b.day===30){const last=month.at(-1)!;date=b.shortMonth==='next'?iso(new Date(Date.parse(last.date+'T04:00Z')+86400000)):last.date;adjustment=`该月只有29天，按你的选择在${b.shortMonth==='next'?'次月初一':'本月廿九'}庆祝`;}else return null;
  if(b.leapMonth&&b.leapPolicy==='regular')adjustment=[adjustment,'闰月生日按普通月份庆祝'].filter(Boolean).join('；');
 }
 return {year,date,label:birthdayLabel(b),calendar:b.calendar,adjustment,...(b.showAge&&b.birthYear&&year>=b.birthYear?{age:year-b.birthYear}:{})};
}
export function validateBirthday(a:Record<string,unknown>,today:string):BirthdaySettings{
 if(a.calendar!=='solar'&&a.calendar!=='lunar')throw Error('请选择公历或农历');const month=Number(a.month),day=Number(a.day),birthYear=a.birthYear===undefined||a.birthYear===null||a.birthYear===''?undefined:Number(a.birthYear),current=Number(today.slice(0,4));
 if(!Number.isInteger(month)||month<1||month>12||!Number.isInteger(day)||day<1||day>(a.calendar==='lunar'?30:new Date(Date.UTC(2000,month,0)).getUTCDate()))throw Error('生日月份或日期无效');
 if(birthYear!==undefined&&(!Number.isInteger(birthYear)||birthYear<1900||birthYear>current))throw Error('出生年份无效');
 const b:BirthdaySettings={calendar:a.calendar,month,day,birthYear,showAge:!!a.showAge,reminders:a.reminders!==false,leapMonth:a.calendar==='lunar'&&!!a.leapMonth,leapPolicy:a.leapPolicy==='leap'?'leap':'regular',shortMonth:a.shortMonth==='next'?'next':'last',solarLeap:a.solarLeap==='mar1'?'mar1':'feb28'};
 if(birthYear){const actual=b.calendar==='lunar'?lunarYear(birthYear).find(r=>r.month===month&&r.day===day&&r.leap===b.leapMonth)?.date:`${birthYear}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;if(!actual||new Date(actual+'T04:00Z').toISOString().slice(0,10)!==actual||actual>today)throw Error('出生日期不存在或在未来，请检查年份与闰月');}
 birthdayOccurrence(b,current);return b;
}
export function birthdaySchedule(b:BirthdaySettings,joined:string,today:string){
 const current=b.calendar==='lunar'?lunarDate(today).year:Number(today.slice(0,4));const start=Math.max(1900,Number(joined.slice(0,4))-1,b.birthYear||1900);const result:BirthdayOccurrence[]=[];
 for(let y=start;y<=current+12;y++){const o=birthdayOccurrence(b,y);if(o&&(o.date>=joined||o.date.slice(0,4)===joined.slice(0,4)))result.push(o);if(o&&o.date>today)break;}
 return result.sort((a,b)=>a.date.localeCompare(b.date));
}
export function validateBirth(a:Record<string,unknown>,today:string):BirthInfo{
 const year=Number(a.year);if(!Number.isInteger(year)||year<1900||year>Number(today.slice(0,4)))throw Error('请填写有效的出生年份');
 const b=validateBirthday({...a,birthYear:year},today);
 const date=b.calendar==='lunar'?lunarYear(year).find(r=>r.month===b.month&&r.day===b.day&&r.leap===b.leapMonth)?.date:`${year}-${String(b.month).padStart(2,'0')}-${String(b.day).padStart(2,'0')}`;
 if(!date||date>today)throw Error('请检查出生日期');
 return {date,calendar:b.calendar,year,month:b.month,day:b.day,leapMonth:b.leapMonth};
}
export function celebrationSettings(birth:BirthInfo,calendar:'solar'|'lunar',preferences:Partial<BirthdaySettings>={}):BirthdaySettings{
 const v=calendar==='lunar'?lunarDate(birth.date):{year:Number(birth.date.slice(0,4)),month:Number(birth.date.slice(5,7)),day:Number(birth.date.slice(8,10)),leap:false};
 return {...preferences,calendar,month:v.month,day:v.day,birthYear:v.year,leapMonth:v.leap,showAge:preferences.showAge??false,reminders:preferences.reminders??true,leapPolicy:preferences.leapPolicy||'regular',shortMonth:preferences.shortMonth||'last',solarLeap:preferences.solarLeap||'feb28'};
}
export function ageAt(birth:BirthInfo,date:string){const years=Number(date.slice(0,4))-Number(birth.date.slice(0,4));const anniversary=new Date(birth.date+'T04:00Z');anniversary.setUTCFullYear(Number(date.slice(0,4)));return years-(date<iso(anniversary)?1:0);}
export function adultDate(birth:BirthInfo){const d=new Date(birth.date+'T04:00Z');d.setUTCFullYear(d.getUTCFullYear()+18);return iso(d);}
