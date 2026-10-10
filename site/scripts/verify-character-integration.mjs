import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const moduleURL = path => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const artSource=fs.readFileSync('lib/character-art.ts','utf8').replace("from './appearance'", `from '${moduleURL('lib/appearance.ts')}'`);
const {characterArt}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(artSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const {characterGender} = await import(moduleURL('lib/appearance.ts'));
const manifest = JSON.parse(fs.readFileSync('public/character-lab/asset-manifest.json', 'utf8'));
const expected = {
  male: {explorer: 'male-explorer', suit: 'male-formal'},
  female: {explorer: 'female-explorer', dress: 'female-formal'},
};
for (const [avatar, outfits] of Object.entries(expected)) {
  const paths = new Set();
  for (const [outfit, key] of Object.entries(outfits)) {
    const src = characterArt(avatar, outfit);
    assert.equal(src, `/character-lab/${key}.webp`);
    paths.add(src);
    const asset = manifest[key];
    assert.equal(asset.width, 768); assert.equal(asset.height, 1152); assert.ok(asset.hasAlpha);
    assert.equal(fs.statSync(`public${src}`).size, asset.bytes); assert.ok(asset.bytes < 250000);
    assert.ok(fs.statSync(`public${characterArt(avatar, outfit, true)}`).size < 30000);
  }
  assert.equal(paths.size, 2, 'Each role has exploration clothing and its own formal clothing');
}
assert.equal(characterArt(characterGender({gender: 'male', avatarId: 'female'}), 'suit'), '/character-lab/male-formal.webp');
assert.equal(characterArt(characterGender({gender: 'female', avatarId: 'male'}), 'dress'), '/character-lab/female-formal.webp');
assert.equal(characterArt(characterGender(null), 'legacy-unknown'), '/character-lab/male-explorer.webp');
assert.equal(characterArt('male','dress'),'/character-lab/male-explorer.webp');
assert.equal(characterArt('female','suit'),'/character-lab/female-explorer.webp');
assert.equal(manifest['male-dress'],undefined);assert.equal(manifest['female-suit'],undefined);
console.log('PASS Compatible wardrobe artwork, invalid outfit fallback, role priority, portrait assets and image budgets.');
