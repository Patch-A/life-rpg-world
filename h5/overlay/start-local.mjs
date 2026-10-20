// Local-only owner preview. No public exposure, purchased infrastructure or default model key.
import {spawn,execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2),value=flag=>args.includes(flag)?args[args.indexOf(flag)+1]:undefined;
const port=Number(value('--port')||3187);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Choose a local port between1024 and65535.');
if(Number(process.versions.node.split('.')[0])<24)throw Error('Node.js24 or newer is required.');
if(!existsSync(path.join(root,'.next','BUILD_ID')))throw Error('Install dependencies and run corepack pnpm build first.');
const directory=process.env.H5_DATA_DIR||path.join(root,'data');
if(!path.isAbsolute(directory))throw Error('H5_DATA_DIR must be absolute.');
const environment={...process.env,H5_DATA_DIR:directory,APP_ORIGIN:`http://127.0.0.1:${port}`,NODE_ENV:'production',AI_ENABLED:'false',DEEPSEEK_API_KEY:'',NEXT_TELEMETRY_DISABLED:'1'};
const keyFile=value('--test-key-file');
if(args.includes('--test-key-file')){
 if(!keyFile||!path.isAbsolute(keyFile))throw Error('Select an absolute path to an existing ignored test-only key file.');
 const match=readFileSync(keyFile,'utf8').match(/^\s*DEEPSEEK_API_KEY\s*=\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s#]+))\s*$/m);
 const key=match?.[1]||match?.[2]||match?.[3];if(!key)throw Error('No test credential is configured in the selected file.');
 environment.AI_ENABLED='true';environment.DEEPSEEK_API_KEY=key;
}
function manage(...parameters){execFileSync(process.execPath,['scripts/manage.mjs',...parameters],{cwd:root,env:environment,stdio:['ignore','inherit','inherit']});}
if(!existsSync(path.join(directory,'life-rpg.sqlite')))manage('init');
const credential=path.join(directory,'local-preview-invitation.json');
if(!existsSync(credential))manage('invite','--out',credential);
console.log('Local preview: '+environment.APP_ORIGIN);
console.log('Login: '+environment.APP_ORIGIN+'/access');
console.log('Private local account file (copy invitationCode, never share publicly): '+credential);
console.log('AI: '+(environment.AI_ENABLED==='true'?'local test-only use; external DeepSeek usage is billed':'disabled; no key is read'));
console.log('This address works only on this computer. Press Ctrl+C to stop.');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:environment,stdio:'inherit'});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??0;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill());
