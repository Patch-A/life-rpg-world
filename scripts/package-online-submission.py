"""Package an explicit public submission document allowlist, never runtime data."""
from pathlib import Path
import hashlib,json,zipfile
root=Path(__file__).resolve().parents[1]
files=['submission/README.md','submission/投稿文案.md','submission/在线体验说明.md','submission/提交清单.md','submission/本地运行.md','docs/submission-cover.png','docs/public-h5-home.png','docs/PUBLIC_H5_DEPLOYMENT.md','online/README.md','README.md','ASSETS.md','LICENSE','THIRD_PARTY_NOTICES.md']
output=root/'outputs/life-rpg-submission-materials-v0.3.zip';output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
 for name in files:
  path=root/name
  if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):raise ValueError('Source escaped repository')
  archive.write(path,name)
print(json.dumps({'archive':str(output),'files':len(files),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()},ensure_ascii=False))
