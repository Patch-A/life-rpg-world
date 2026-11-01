// Freeze the existing deterministic domain/model code for Node cloud execution.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const deps=createRequire(path.join(process.env.LIFE_RPG_DEPENDENCIES_DIR||path.join(root,'site'),'package.json'));
const esbuild=deps(deps.resolve('esbuild',{paths:[path.dirname(deps.resolve('vite'))]}));
const out=path.join(root,'qmuse/functions/rpg-service/src/lib');await mkdir(out,{recursive:true});
for(const name of ['game','agent-contract','deepseek']){
 const entry=path.join(root,'site/lib',name==='deepseek'?'ai/deepseek.ts':name+'.ts');
 let source=await readFile(entry,'utf8');
 if(name==='game')source+="\nexport {ageAt} from './birthday';\n";
 if(name==='deepseek')source=source.replace("{method:'POST',headers:","{method:'POST',redirect:'error',headers:");
 if(name==='agent-contract')source=source.replace("RELEASE='submission-v0.1'","RELEASE='qmuse-submission-v0.4'");
 await esbuild.build({stdin:{contents:source,resolveDir:path.dirname(entry),loader:'ts'},outfile:path.join(out,name+'.mjs'),bundle:true,format:'esm',platform:'node',target:'node22',external:['zod'],banner:{js:'// Generated from existing site/lib domain code; regenerate with qmuse/scripts/build-domain.mjs.'},minify:false});
}
console.log('Frozen existing growth, appearance, birthday and AI validation rules for QMuse cloud execution.');
