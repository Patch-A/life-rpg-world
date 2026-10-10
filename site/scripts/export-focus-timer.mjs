import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Export exactly the same geometry used by the realtime preview.
globalThis.FileReader=class FileReader {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();});}
};
const repo=path.resolve(import.meta.dirname,'..');
const input=await fs.readFile(path.join(repo,'components/focus-timer-model.ts'),'utf8');
const compiled=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const temp=path.join(repo,'node_modules/.cache/focus-timer-model.mjs');
await fs.mkdir(path.dirname(temp),{recursive:true});await fs.writeFile(temp,compiled);
const {createFocusTimerModel}=await import(pathToFileURL(temp).href+'?v='+Date.now());
const model=createFocusTimerModel();
const bytes=await new GLTFExporter().parseAsync(model.root,{binary:true,onlyVisible:true});
const output=path.join(repo,'public/art-lab');await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'focus-timer-v1.glb'),Buffer.from(bytes));
await fs.writeFile(path.join(output,'focus-timer-manifest.json'),JSON.stringify({...model.stats,bytes:bytes.byteLength,format:'glTF 2.0 binary',textures:0,version:1},null,2)+'\n');
// Local geometry snapshot enables a software render without running a browser.
const parts=[];model.root.updateMatrixWorld(true);
model.root.traverse(o=>{if(o.isMesh){parts.push({name:o.name,positions:Array.from(o.geometry.attributes.position.array),normals:Array.from(o.geometry.attributes.normal.array),indices:o.geometry.index?Array.from(o.geometry.index.array):null,matrix:o.matrixWorld.toArray(),color:o.material.color.toArray()});}});
await fs.writeFile(path.join(repo,'node_modules/.cache/focus-timer-geometry.json'),JSON.stringify(parts));
console.log(JSON.stringify({...model.stats,bytes:bytes.byteLength,output:'public/art-lab/focus-timer-v1.glb'}));model.dispose();
