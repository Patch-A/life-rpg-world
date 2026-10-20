"""Package a fixed public-document allowlist; never include local runtime data."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
files = {
    'submission/README.md': 'submission/README.md',
    'submission/投稿文案.md': 'submission/投稿文案.md',
    'submission/本地运行.md': 'submission/本地运行.md',
    'submission/提交清单.md': 'submission/提交清单.md',
    'docs/submission-cover.png': 'docs/submission-cover.png',
    'docs/H5_SUBMISSION_STATUS.md': 'docs/H5_SUBMISSION_STATUS.md',
    'docs/PUBLIC_RELEASE_AUDIT.md': 'docs/PUBLIC_RELEASE_AUDIT.md',
    'ASSETS.md': 'ASSETS.md',
    'LICENSE': 'LICENSE',
    'THIRD_PARTY_NOTICES.md': 'THIRD_PARTY_NOTICES.md',
}
output = root / 'outputs/life-rpg-submission-materials-v0.2.zip'
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for source, destination in files.items():
        path = root / source
        if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
            raise ValueError('Source escaped repository')
        archive.write(path, destination)
print(json.dumps({'archive': str(output), 'files': len(files), 'bytes': output.stat().st_size,
                  'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}, ensure_ascii=False))
