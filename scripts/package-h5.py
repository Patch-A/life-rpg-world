"""Package only the explicit exported source manifest, never data or credentials."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
source = root / 'outputs' / 'h5-submission'
manifest_file = source / 'H5_SOURCE.json'
manifest = json.loads(manifest_file.read_text(encoding='utf-8'))
entries = manifest['files']
names = set()
for entry in entries:
    name = entry['path']
    relative = PurePosixPath(name)
    if relative.is_absolute() or '..' in relative.parts or name in names:
        raise ValueError('Unsafe or duplicate source path')
    if any(part in {'data', 'node_modules', '.next', '.sites-runtime', '.wrangler', '.openai'} for part in relative.parts) or any(part.startswith(('.env', '.dev.vars')) for part in relative.parts):
        raise ValueError('Runtime material is not permitted in the package')
    candidate = source / name
    target = candidate.resolve()
    if not target.is_relative_to(source.resolve()) or candidate.is_symlink():
        raise ValueError('Source escaped export directory')
    if hashlib.sha256(target.read_bytes()).hexdigest() != entry['sha256']:
        raise ValueError('Source changed after export: ' + name)
    names.add(name)
output = root / 'outputs' / 'life-rpg-h5-submission-v0.2.zip'
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for entry in entries:
        archive.write(source / entry['path'], 'life-rpg-h5/' + entry['path'])
    archive.write(manifest_file, 'life-rpg-h5/H5_SOURCE.json')
print(json.dumps({'archive': str(output), 'source_files': len(entries), 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}, ensure_ascii=False))
