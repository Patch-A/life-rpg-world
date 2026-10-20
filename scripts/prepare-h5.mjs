// Export tracked application source plus the independent H5 adapter. Never copy runtime data.
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=path.join(root,'outputs','h5-submission');
const marker=path.join(destination,'.h5-export');
const exported=new Set();
try { await access(destination); await access(marker); }
catch(error) { if(error.code!=='ENOENT')throw error; try{await access(destination);throw Error('Existing output directory is not owned by this exporter.');}catch(e){if(e.code!=='ENOENT')throw e;} }
await mkdir(destination,{recursive:true});await writeFile(marker,'life-rpg-h5-v1\n');
const tracked=execFileSync('git',['ls-files','-z','site'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const allowed=/^site\/(app|components|hooks|lib|db|drizzle|public|vendor)\//;
for(const name of tracked){
 if(!allowed.test(name)||name==='site/app/chatgpt-auth.ts')continue;
 const relative=name.slice(5),target=path.join(destination,relative==='app/page.tsx'?'app/play/page.tsx':relative);
 exported.add(path.relative(destination,target).replaceAll('\\','/'));
 await mkdir(path.dirname(target),{recursive:true});
 if(/\.[cm]?[jt]sx?$/.test(name)){
  let content=await readFile(path.join(root,name),'utf8');
  content=content.replaceAll("from 'cloudflare:workers'","from '@/server/runtime'")
   .replaceAll('/signin-with-chatgpt?return_to=%2F','/access');
  if(name==='site/lib/agent-contract.ts')content=content.replace("RELEASE='submission-v0.1'","RELEASE='h5-submission-v0.2'");
  if(['site/app/api/game/route.ts','site/app/api/photos/route.ts'].includes(name)){
   const old="const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)";
   if(!content.includes(old))throw Error('Origin guard source changed; review the H5 adapter: '+name);
   content="import {requestOriginAllowed} from '@/server/origin';\n"+content.replaceAll(old,'if(!requestOriginAllowed(req))');
  }
  if(name==='site/app/page.tsx')content=content.replace('<span className="private-label">私人星球</span>','<a className="private-label" href="/access">试用账号</a>');
  if(name==='site/app/demo/page.tsx')content=content.replaceAll('href="/"','href="/play"');
  await writeFile(target,content);
 }else await copyFile(path.join(root,name),target);
}
const overlays=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z','h5/overlay'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
for(const name of overlays){const relative=name.slice('h5/overlay/'.length),target=path.join(destination,relative);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(root,name),target);exported.add(relative);}
const pkg=JSON.parse(await readFile(path.join(root,'site/package.json'),'utf8'));
pkg.name='life-rpg-h5-submission';pkg.engines={node:'>=24.0.0'};
pkg.scripts={dev:'next dev --webpack --hostname 127.0.0.1',build:'next build --webpack',start:'next start --hostname 127.0.0.1', 'h5:init':'node --env-file-if-exists=.env.local scripts/manage.mjs init','h5:doctor':'node --env-file-if-exists=.env.local scripts/manage.mjs doctor','h5:invite':'node --env-file-if-exists=.env.local scripts/manage.mjs invite','h5:revoke':'node --env-file-if-exists=.env.local scripts/manage.mjs revoke','h5:feedback':'node --env-file-if-exists=.env.local scripts/manage.mjs feedback'};
await writeFile(path.join(destination,'package.json'),JSON.stringify(pkg,null,2)+'\n');
exported.add('package.json');
for(const name of ['pnpm-lock.yaml','pnpm-workspace.yaml','postcss.config.mjs']){await copyFile(path.join(root,'site',name),path.join(destination,name));exported.add(name);}
await copyFile(path.join(root,'h5/README.md'),path.join(destination,'README.md'));exported.add('README.md');
for(const name of ['LICENSE','THIRD_PARTY_NOTICES.md','ASSETS.md']){await copyFile(path.join(root,name),path.join(destination,name));exported.add(name);}
const files=[];for(const relative of [...exported].sort()){files.push({path:relative,sha256:createHash('sha256').update(await readFile(path.join(destination,relative))).digest('hex')});}
const manifest={createdAt:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceHasUncommittedChanges:!!execFileSync('git',['status','--porcelain','--','site','h5','scripts/prepare-h5.mjs'],{cwd:root,encoding:'utf8'}).trim(),files,entry:'/',application:'/play',data:'excluded',secrets:'excluded',deployment:'not deployed'};
await writeFile(path.join(destination,'H5_SOURCE.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`H5 source prepared: ${destination}`);
