"""Read-only scan of every reachable Git tree before making this repository public.
Reports paths and rule names, never matching values. Not a complete security audit.
"""
from pathlib import Path
import argparse,json,re,subprocess

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--known-secret-file',type=Path)
args=parser.parse_args()
def git(*parameters):return subprocess.check_output(['git',*parameters],cwd=root)
rules={
 'provider_key':re.compile(rb'\bsk-[A-Za-z0-9_-]{20,}\b'),
 'github_token':re.compile(rb'\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})\b'),
 'private_key':re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
 'real_invitation':re.compile(rb'\brpg_[a-f0-9]{48}\b'),
 'real_session':re.compile(rb'\bh5_[a-f0-9]{64}\b'),
 'credential_assignment':re.compile(rb'''(?i)(?:DEEPSEEK_API_KEY|OPENAI_API_KEY|access_token|bypass_token)\s*[:=]\s*["'][A-Za-z0-9_./+=-]{20,}["']'''),
 'credential_url':re.compile(rb'(?i)[?&](?:api_key|access_token|bypass_token)=[A-Za-z0-9_+=.%/-]{20,}'),
}
known=[]
if args.known_secret_file:
 content=args.known_secret_file.read_bytes()
 match=re.search(rb'''(?m)^\s*DEEPSEEK_API_KEY\s*=\s*(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^\s#]+))\s*$''',content)
 if match:known=[next(value for value in match.groups() if value)]
commits=git('rev-list','--all').decode().splitlines()
entries={}
for commit in commits:
 for item in git('ls-tree','-r','-z',commit).split(b'\0'):
  if not item:continue
  header,name=item.split(b'\t',1);mode,kind,sha=header.split()
  if kind==b'blob':entries.setdefault(sha.decode(),set()).add(name.decode('utf-8'))
findings=[];text_blobs=0
for sha,paths in entries.items():
 for name in paths:
  base=Path(name).name.lower()
  if (base.startswith(('.env','.dev.vars')) and not base.endswith('.example')) or re.search(r'\.(sqlite(?:-wal|-shm)?|db|pem|key)$',base) or base=='local-preview-invitation.json':
   findings.append({'path':name,'rule':'runtime_or_credential_file'})
 blob=git('cat-file','blob',sha)
 for value in known:
  if value in blob:findings.append({'paths':sorted(paths),'rule':'known_test_secret'})
 if b'\0' in blob:continue
 text_blobs+=1
 for label,pattern in rules.items():
  if pattern.search(blob):findings.append({'paths':sorted(paths),'rule':label})
print(json.dumps({'reachable_commits':len(commits),'unique_blobs':len(entries),'text_blobs':text_blobs,'known_secret_loaded':bool(known),'findings':findings,'scope':'reachable local Git refs only; not remote logs, dependency vulnerabilities or asset rights'},ensure_ascii=False,indent=2))
raise SystemExit(1 if findings else 0)
