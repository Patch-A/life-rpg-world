"""Create a new QMuse adapter from an official sanitized template and tracked UI.
Never copy platform bindings, environments, databases, credentials or dependencies.
"""
from pathlib import Path
import argparse,json,re,shutil,subprocess
p=argparse.ArgumentParser();p.add_argument('--template',type=Path,required=True);args=p.parse_args()
root=Path(__file__).resolve().parents[1];target=root/'qmuse';template=args.template.resolve()
if target.exists():raise SystemExit('Adapter exists; edit it in place instead of regenerating')
target.mkdir()
for name in ['AGENTS.md','vite.config.ts','tsconfig.json','.oxlintrc.json','src/main.tsx','src/router.tsx','src/routeTree.gen.ts','src/config/router.json','src/routes/__root.tsx','src/types/global.d.ts','src/vite-env.d.ts']:
 source=template/name
 if source.exists():dest=target/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,dest)
(target/'.gitignore').write_text('node_modules/\ndist/\n.qmuse/\n.env*\n*.log\n',encoding='utf-8')
pkg=json.loads((template/'package.json').read_text(encoding='utf-8'));old=json.loads((root/'site/package.json').read_text(encoding='utf-8'))
pkg['name']='life-rpg-qmuse';pkg['dependencies'].update({k:v for k,v in old['dependencies'].items() if k!='next'})
pkg['dependencies']['appwrite']='24.1.1';pkg['dependencies']['@qmuse/appwrite-runtime-sdk']='^1.2.0';pkg['devDependencies']['@types/three']=old['devDependencies']['@types/three']
(target/'package.json').write_text(json.dumps(pkg,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
tracked=subprocess.check_output(['git','ls-files','-z','site'],cwd=root).decode().split('\0')
assets=[n for n in tracked if n.startswith('site/public/') and re.search(r'\.(png|jpe?g|webp|svg|glb)$',n)]
for name in assets:
 rel=name[len('site/public/'):];dest=target/'src/assets'/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,dest)
registry='// Literal Vite asset references support QMuse publication subpaths.\n'
for i,name in enumerate(assets):registry+=f'const asset{i}=new URL({json.dumps("./assets/"+name[len("site/public/"):])},import.meta.url).href;\n'
registry+='const assets:Record<string,string>={'+','.join(json.dumps('/'+n[len('site/public/'):])+f':asset{i}' for i,n in enumerate(assets))+'};\nexport function assetUrl(name:string){return assets[name]||name;}\n'
(target/'src/asset-urls.ts').write_text(registry,encoding='utf-8')
seen=set();queue=['site/app/page.tsx','site/app/demo/page.tsx','site/app/globals.css','site/app/assistant.css']
def resolve(base,spec):
 name='site/'+spec[2:] if spec.startswith('@/') else str((Path(base).parent/spec).as_posix()) if spec.startswith('.') else None
 if not name:return None
 path=Path(name)
 for candidate in [path,*[Path(str(path)+ext) for ext in ['.tsx','.ts','.mts','.css']],path/'index.ts',path/'index.tsx']:
  if (root/candidate).is_file():return candidate.as_posix()
 return None
while queue:
 name=queue.pop()
 if name in seen:continue
 seen.add(name);text=(root/name).read_text(encoding='utf-8')
 for spec in re.findall(r'''(?:from\s*|import\s*\(\s*|@import\s*|import\s*)["']([^"']+)["']''',text):
  dependency=resolve(name,spec)
  if dependency and dependency not in seen:queue.append(dependency)
 dest=target/'src'/name[len('site/'):];dest.parent.mkdir(parents=True,exist_ok=True)
 if name.endswith(('.ts','.tsx','.mts')):
  text=re.sub(r'''^["']use client["'];?\s*\n''','',text,flags=re.M)
  if re.search(r"fetch\(\s*['\"]/api/",text):text="import {rpgRequest as fetch} from '@/services/rpgService';\n"+text
  text=text.replace('/signin-with-chatgpt?return_to=%2F','#/access')
  text=re.sub(r'''href=(["'])/(about|demo|access)\1''',lambda m:f'href="#/{m[2]}"',text)
  text=text.replace('href="/"','href="#/"')
  used=False
  def image(match):
   global used
   value=match[2]
   if value not in {'/'+n[len('site/public/'):] for n in assets}:return match[0]
   used=True;replacement='assetUrl('+json.dumps(value)+')'
   return '{'+replacement+'}' if text[max(0,match.start()-4):match.start()].endswith('src=') else replacement
  text=re.sub(r'''(["'])(/[^"'\n]+\.(?:png|jpe?g|webp|svg|glb))\1''',image,text)
  if name=='site/lib/character-art.ts':text=text.replace('return `/character-lab/${artwork[avatar][key]}${portrait ? \'-portrait\' : \'\'}.webp`;','return assetUrl(`/character-lab/${artwork[avatar][key]}${portrait ? \'-portrait\' : \'\'}.webp`);');used=True
  if used:text="import {assetUrl} from '@/asset-urls';\n"+text
  if name=='site/lib/agent-contract.ts':text=text.replace("RELEASE='submission-v0.1'","RELEASE='qmuse-submission-v0.4'")
  if name=='site/app/page.tsx':
   text=text.replace("location.hash=v;",'')
   text=re.sub(r"useEffect\(\(\)=>\{load\(\);const h=location.hash.*?\},\[\]\);","useEffect(()=>{load();setQuiet(localStorage.getItem('life-rpg-quiet')==='1');},[]);",text,count=1)
   text=text.replace('<span className="private-label">私人星球</span>','<a className="private-label" href="#/access">访客管理</a>')
 if name.endswith('.css'):text=re.sub(r'url\(([^)]*)\)',lambda m:m[0],text)
 dest.write_text(text,encoding='utf-8')
service=(template/'.agents/skills/qmuse-cloud/assets/appwrite.ts').read_text(encoding='utf-8')
service=service.replace('  Account,','  Account,\n  Functions,',1)
service+='''\nconst functions=new Functions(client);\nexport async function executeQmuseFunction({functionId,body}:{functionId:string;body?:string}){await initAppwrite();try{return await functions.createExecution({functionId,body});}catch(error){if(!(error&&typeof error==='object'&&'code' in error&&Number(error.code)===401))throw error;}await refreshAppwriteSession();return functions.createExecution({functionId,body});}\n'''
(target/'src/services').mkdir(exist_ok=True);(target/'src/services/appwrite.ts').write_text(service,encoding='utf-8')
(target/'src/styles.css').write_text('@import "./app/globals.css";\n@import "./app/assistant.css";\n@import "./qmuse.css";\n',encoding='utf-8')
(target/'index.html').write_text((template/'index.html').read_text(encoding='utf-8').replace('QMuse Generated Project','人生RPG · 成长星球'),encoding='utf-8')
print('Prepared independent QMuse adapter with '+str(len(seen))+' UI sources and '+str(len(assets))+' literal assets; no bindings, credentials, runtime or data copied.')
