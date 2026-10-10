process.on('uncaughtException',e=>{console.error(String(e.stack||e).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'[module]'));process.exit(1);});
// Render the actual components and offline export without a browser or production writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=resolve(new URL('..',import.meta.url).pathname),cache=new Map();
function moduleURL(file){if(cache.has(file))return cache.get(file);const source=readFileSync(file,'utf8');let code=ts.transpileModule(source.replace(/import ['"][^'"]+\.css['"];?/g,''),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;code=code.replace(/from ['"]([^'"]+)['"]/g,(full,name)=>{if(name.startsWith('@/'))return `from '${moduleURL(resolve(root,name.slice(2)+(/\.tsx?$/.test(name)?'':name.includes('components/')?'.tsx':'.ts')))}'`;if(name.startsWith('.')){const path=resolve(dirname(file),name);let target;for(const ext of ['.ts','.tsx'])try{readFileSync(path+ext);target=path+ext;break;}catch{}return `from '${moduleURL(target)}'`;}return `from '${import.meta.resolve(name)}'`;});const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');cache.set(file,url);return url;}
const {blank,reduceGame}=await import(moduleURL(resolve(root,'lib/game.ts')));
const birthday=await import(moduleURL(resolve(root,'components/life-birthday.tsx'))),records=await import(moduleURL(resolve(root,'components/life-records.tsx')));
const now=new Date('2026-10-09T04:00Z');let state=reduceGame(blank(),{type:'onboard',gender:'male',name:'UI验证',focus:'health',birth:{calendar:'solar',year:1990,month:1,day:1}},now);const mutate=async()=>true;
let html=renderToStaticMarkup(React.createElement(birthday.BirthdaySettingsForm,{state,mutate,busy:false,onSaved(){},editBirth(){}}));assert(html.includes('公历生日'));assert(html.includes('农历生日'));assert(html.includes('公历出生日期'));assert(!html.includes('闰月生日如何庆祝'));
state=reduceGame(state,{type:'birth-profile',birth:{calendar:'lunar',year:2025,month:6,day:1,leapMonth:true},celebrationCalendar:'lunar'},now);html=renderToStaticMarkup(React.createElement(birthday.BirthdaySettingsForm,{state,mutate,busy:false,onSaved(){},editBirth(){}}));assert(html.includes('闰月生日如何庆祝'));state=reduceGame(state,{type:'birth-profile',birth:{calendar:'lunar',year:2025,month:6,day:30},celebrationCalendar:'lunar'},now);html=renderToStaticMarkup(React.createElement(birthday.BirthdaySettingsForm,{state,mutate,busy:false,onSaved(){},editBirth(){}}));assert(html.includes('在本月廿九庆祝'));assert(html.includes('在次月初一庆祝'));
state=reduceGame(state,{type:'birth-profile',birth:{calendar:'solar',year:1990,month:1,day:1},celebrationCalendar:'solar'},now);state=reduceGame(state,{type:'milestone',kind:'adult',datePrecision:'unknown'},now);html=renderToStaticMarkup(React.createElement(records.MilestoneForm,{state,edit:state.milestones[0],mutate,busy:false,onSaved(){},editBirth(){}}));assert(html.includes('记不清日期'));assert(!html.includes('type="date"'));assert(html.includes('安静收下纪念')||html.includes('珍藏并庆祝'));
state=reduceGame(state,{type:'birthday-settings',calendar:'solar',month:1,day:1},now);state=reduceGame(state,{type:'birthday',year:2026,note:'<script>alert(1)</script>',wish:'下一岁继续生长'},now);html=renderToStaticMarkup(React.createElement(birthday.BirthdayForm,{state,occurrence:state.birthdays[0],mutate,busy:false,onSaved(){},quiet:true}));assert(html.includes('保存生日纪念'));assert(html.includes('给下一岁的自己'));assert(!html.includes('<script>alert(1)</script>'));assert(html.includes('&lt;script&gt;'));
console.log('PASS 实际组件渲染：公历默认、农历选项、闰月小月设置、模糊日期、生日编辑与文字转义');
const {exportAlbum}=await import(moduleURL(resolve(root,'lib/export-album.ts')));
let outputBlob;const previousURL=URL.createObjectURL,previousRevoke=URL.revokeObjectURL,previousDocument=globalThis.document;
URL.createObjectURL=blob=>{outputBlob=blob;return 'blob:test';};URL.revokeObjectURL=()=>{};globalThis.document={createElement(){return{click(){}};}};
await exportAlbum(state);html=await outputBlob.text();assert(html.includes('生日纪念'));assert(html.includes('日期不详'));assert(html.includes('下一岁继续生长'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>alert(1)</script>'));
URL.createObjectURL=previousURL;URL.revokeObjectURL=previousRevoke;globalThis.document=previousDocument;
console.log('PASS 完整离线导出包含生日、模糊日期与留言，并转义用户内容');

const {LifeSetup}=await import(moduleURL(resolve(root,'components/life-setup.tsx')));const {LifeTimeline}=await import(moduleURL(resolve(root,'components/life-timeline.tsx')));
html=renderToStaticMarkup(React.createElement(LifeSetup,{state:blank(),mutate,busy:false,error:'',onSaved(){}}));assert(html.includes('探索者昵称'));assert(html.includes('男生探索者'));assert(html.includes('女生探索者'));assert(html.includes('required'));assert(!html.includes('出生年份'));const {BirthFields}=await import(moduleURL(resolve(root,'components/life-setup.tsx')));html=renderToStaticMarkup(React.createElement(BirthFields,{value:{calendar:'solar',year:'1990',month:1,day:1,leapMonth:false},onChange(){}}));assert(html.includes('出生年份'));
const child=reduceGame(blank(),{type:'onboard',gender:'male',name:'少年',focus:'health',birth:{calendar:'solar',year:2015,month:1,day:1}},now);html=renderToStaticMarkup(React.createElement(birthday.MemoryReview,{state:child,open(){},mutate,busy:false}));assert(/disabled[^>]*>.*?18 岁成人礼/s.test(html));assert(html.includes('满18岁后开放'));
html=renderToStaticMarkup(React.createElement(birthday.BirthdayPanel,{state:{...state,birthdays:[]},settings(){},open(){},mutate,busy:false,remove(){}}));assert(html.includes('补写纪念'));
html=renderToStaticMarkup(React.createElement(LifeTimeline,{state,busy:false,edit(){},undo(){},milestone(){},birthday(){},create(){},reward(){}}));assert(html.includes('人生时间线'));assert(html.includes('人生节点'));assert(html.includes('生日纪念'));assert(html.includes('18 岁成人礼'));assert(!html.includes('<script>alert(1)</script>'));
console.log('PASS 建档出生字段、未成年入口锁定、已领奖生日补写入口和统一时间线');
