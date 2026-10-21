// Build the existing product as a static SPA plus a small independent Worker.
// Only tracked public/source files are copied; Sites runtime and data stay put.
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile,symlink,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dependencies=path.resolve(process.env.LIFE_RPG_DEPENDENCIES_DIR||path.join(root,'site'));
const source=path.join(root,'outputs/online-source'),site=path.join(root,'outputs/online-site'),worker=path.join(root,'outputs/online-worker');
await mkdir(source,{recursive:true});await mkdir(site,{recursive:true});await mkdir(worker,{recursive:true});
const files=execFileSync('git',['ls-files','-z','site'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
for(const name of files){
 if(!/^site\/(app|components|hooks|lib|db|vendor|public)\//.test(name))continue;
 const relative=name.slice(5),target=path.join(source,relative);await mkdir(path.dirname(target),{recursive:true});
 if(/\.[cm]?[jt]sx?$/.test(name)){
  let content=await readFile(path.join(root,name),'utf8');
  content=content.replaceAll('/signin-with-chatgpt?return_to=%2F','/access');
  if(name==='site/app/page.tsx')content=content.replace('<span className="private-label">私人星球</span>','<a className="private-label" href="/access">访客星球</a>');
  if(name==='site/app/demo/page.tsx')content=content.replaceAll('href="/"','href="/play"');
  if(name==='site/lib/agent-contract.ts')content=content.replace("RELEASE='submission-v0.1'","RELEASE='online-submission-v0.3'");
  if(name==='site/app/api/agent/route.ts'){
   content="import {reserveBudget} from '@/online/budget';\n"+content;
   const marker='const model=env.DEEPSEEK_MODEL';
   if(!content.includes(marker))throw Error('Review agent quota insertion: source changed');
   content=content.replace(marker,"if(!await reserveBudget(db,uid,day(),a.requestId))throw new RequestError('今日或当前分钟AI额度已用完，请稍后再试，手动记录仍可使用。',429);\n await db.prepare('DELETE FROM online_ai_budget WHERE id IN (SELECT id FROM online_ai_budget WHERE minute<? LIMIT 100)').bind(Math.floor(Date.now()/60000)-7*1440).run();\n "+marker);
   content=content.replace('SELECT COUNT(*) AS n FROM agent_runs WHERE user_id=? AND date=?','SELECT COUNT(*) AS n FROM online_ai_budget WHERE user_id=? AND date=?');
  }
  await writeFile(target,content);
 }else await copyFile(path.join(root,name),target);
}
for(const name of ['identity.ts','request-guard.ts'])await copyFile(path.join(root,'online',name),path.join(source,'lib',name));
await mkdir(path.join(source,'online'),{recursive:true});
for(const name of ['worker.ts','budget.ts','frontend.tsx','online.css'])await copyFile(path.join(root,'online',name),path.join(source,'online',name));
await writeFile(path.join(source,'index.html'),'<!doctype html><html lang="zh-CN" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="AI目标拆解、本人确认、行动记录与引用复盘。人生RPG公开H5试用。"><title>人生RPG · 成长星球</title><link rel="icon" href="/favicon.svg"></head><body><div id="root"></div><script type="module" src="/online/frontend.tsx"></script></body></html>');
const link=path.join(source,'node_modules');
try{const stat=await lstat(link);if(!stat.isSymbolicLink())throw Error('Refusing existing non-link dependency directory');}catch(error){if(error.code!=='ENOENT')throw error;await symlink(path.join(dependencies,'node_modules'),link,process.platform==='win32'?'junction':'dir');}
const require=createRequire(path.join(dependencies,'package.json'));
const {build}=await import(pathToFileURL(require.resolve('vite')).href);
const react=(await import(pathToFileURL(require.resolve('@vitejs/plugin-react')).href)).default;
const tailwind=(await import(pathToFileURL(require.resolve('@tailwindcss/postcss')).href)).default;
await build({configFile:false,root:source,publicDir:path.join(source,'public'),plugins:[react()],resolve:{alias:{'@':source}},css:{postcss:{plugins:[tailwind({base:source})]}},build:{outDir:site,emptyOutDir:true,sourcemap:false}});
const esbuild=await import(pathToFileURL(require.resolve('esbuild',{paths:[path.dirname(require.resolve('vite'))]})).href);
await esbuild.build({entryPoints:[path.join(source,'online/worker.ts')],outfile:path.join(worker,'worker.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:workers'],alias:{'@':source},minify:true,logLevel:'warning'});
console.log('Static product and independent Worker prepared; no environment, credentials or private data copied.');
