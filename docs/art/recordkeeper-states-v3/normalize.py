from pathlib import Path
from PIL import Image
import json, shutil
root=Path(r'C:\Users\Patch\life-rpg-world\docs\art\recordkeeper-states-v3')
src=Path(r'C:\Users\Patch\.codex\generated_images\01a19296-7c49-75d2-b0a8-6bbbf0c4000f')
files={'idle':'exec-e2e6dc01-f64a-47af-9b73-aca2b6d38cfb.png','speaking':'exec-cfd2e09d-eaeb-4fe3-a7c4-873826990855.png','listening':'exec-c0fb511a-53d6-426a-94cb-a3899f03784f.png','thinking':'exec-5c67bbb8-f392-44fd-8bbd-4a0dfa70ac5e.png','still':'exec-826ab518-6c3e-406a-88af-5e1f0bd37314.png'}
root.mkdir(exist_ok=True)
(root/'originals').mkdir(exist_ok=True)
(root/'preview-56').mkdir(exist_ok=True)
report={}
for state,name in files.items():
    im=Image.open(src/name).convert('RGBA')
    shutil.copy2(src/name,root/'originals'/('state-'+state+'.png'))
    # Shared scale for all states, no independent fit-to-box.
    im=im.resize((round(im.width*.65),round(im.height*.65)),Image.Resampling.LANCZOS)
    # Remove barely-visible resampling fringe so strict alpha>0 and alpha>8 agree.
    im.putalpha(im.getchannel('A').point(lambda a:0 if a<=8 else a))
    box=im.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox()
    dx=round(511.5-(box[0]+box[2]-1)/2); dy=918-(box[3]-1)
    out=Image.new('RGBA',(1024,1024),(0,0,0,0)); out.paste(im,(dx,dy))
    out.save(root/('state-'+state+'.png'))
    out.resize((56,56),Image.Resampling.LANCZOS).save(root/'preview-56'/('state-'+state+'.png'))
    b=out.getchannel('A').getbbox()
    report[state]={'source':name,'size':out.size,'bbox_any_alpha':b,'margin_px':[b[0],b[1],1024-b[2],1024-b[3]],'fully_transparent_fraction':out.getchannel('A').histogram()[0]/1024**2}
(root/'geometry.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))

