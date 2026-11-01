# 记录官 v3 五状态交付 · 2026-11-01

## 文件
五个独立透明 PNG：state-idle.png / state-speaking.png / state-listening.png / state-thinking.png / state-still.png。
全部1024×1024。preview-56 为真实56×56预览；originals 保留生图原始输出。
制作使用内置 image_gen；normalize.py 仅统一缩放、定位与清除 alpha≤8 的近透明边缘，不绘制造型或修改RGB配色。五张共用0.65缩放比例，非逐张撑满。

## 本次核验
现有 site/scripts/check-treant-states.mjs 对本目录检查20/20通过，详见CHECK-2026-11-01.txt。
- 严格alpha>0和脚本alpha>8包围盒底边均为y=918，差0px。
- 水平内容中心差1px。
- 四角alpha均0；严格全透明面积70.7%–76.3%。
- 四边透明留白最小105px（10.25%），超过8%。
- 按brief HSV阈值，五张紫/品红像素均为0；没有借用脚本容忍值放宽。
- 现有脚本先归一化内容包围盒：thinking/idle剪影差12.0%。
- 额外直接将固定1024画布缩至56，alpha>128二值XOR占整张56画布10.46%，也超过8%；占两者剪影并集33.68%。
- 肉眼检查：移除肩高对称叶簇枝端，保留低位裸枝；thinking裸枝突出树冠，still闭眼并收暗年轮；idle/listening已补改非发光木纹。

## 边界与下一步
仅交付素材，没有修改应用、CSS台座、发布或提交Git。没有手机实测。人物身份一致性与动静切换的自然程度仍需在真实场景评审；thinking顶部裸枝造型较突出，需用户确认观感。
PNG未压到旧brief的200KB；本次按v3要求交付1024独立PNG。接入时保持整张相同画布的缩放，不再按每张非透明包围盒分别contain或裁切。
下一步：Claude Code使用本目录复跑已有检查，再移除重复CSS台座、接入五态并请用户真机评审。脚本通过不等于上线验收。

