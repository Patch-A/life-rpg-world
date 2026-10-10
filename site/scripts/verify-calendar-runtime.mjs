// Check the calendar in the same workerd runtime family used by the Site.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const require=createRequire(import.meta.resolve('wrangler/package.json'));
const {Miniflare}=await import(pathToFileURL(require.resolve('miniflare')).href);
const code=ts.transpileModule(readFileSync(new URL('../lib/birthday.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const script=code+`\nexport default {fetch(){const base={calendar:'lunar',month:8,day:15,showAge:false,reminders:true,leapMonth:false,leapPolicy:'regular',shortMonth:'last',solarLeap:'feb28'};return Response.json({festival:birthdayOccurrence(base,2026).date,leap:lunarDate('2025-07-25'),calendar:new Intl.DateTimeFormat('en-u-ca-chinese').resolvedOptions().calendar});}};`;
const mf=new Miniflare({modules:true,script,compatibilityDate:'2026-05-01'});
try{const response=await mf.dispatchFetch('https://calendar-test.invalid/'),data=await response.json();assert.equal(response.status,200);assert.equal(data.calendar,'chinese');assert.equal(data.festival,'2026-09-25');assert.equal(data.leap.leap,true);assert.equal(data.leap.month,6);console.log('PASS workerd运行时农历换算、闰月标识与官方历表日期');}finally{await mf.dispose();}
