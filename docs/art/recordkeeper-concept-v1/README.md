# 记录官小树概念稿 v1

日期：2026-10-31。工具：内置 image_gen；56px 与 2048px 派生使用 Pillow Lanczos 缩放。

## 文件
- 01-recordkeeper-master.png：原生生成 1254×1254，RGBA。
- 01-recordkeeper-2048-upscaled.png：2048×2048 放大版，非原生 2K。
- 02-recordkeeper-56px.png：主图实际缩小到 56×56，RGBA。
- 03-recordkeeper-five-states.png：2146×733，RGBA；从左到右 idle / speaking / listening / thinking / sleeping。

## 已检查与限制
主图和状态图透明通道均含 0–255。概念稿未接入应用。用户本轮小土丘要求优先于原简报蜷曲树根。静态图不证明呼吸或年轮旋转动画。视觉判断：56px 树形轮廓可辨，但脸与年轮减弱；思考状态差异偏弱；静止年轮仍偏亮。状态表边缘间距紧，不作为可直接切割的生产精灵图。角色与现有偏写实探索者的风格一致性待用户评审。PNG 尚未满足单张 200KB；未做生产压缩。此版为待选方向的概念稿，非用户已批准定稿。

## 最终提示词
### 主图
Use case: stylized-concept. Create the primary concept design for a personal life-journaling app mascot. Single small friendly young sapling creature, full body, centered, slight three-quarter view, requested 2048x2048 transparent PNG. It is a TREE, not a humanoid. A single slim gently curved short honey-tan tree trunk, two tiny soft dark eyes and subtle calm mouth on the trunk, two short tapered branch stubs without hands. Rounded canopy made of a few large overlapping soft leaf clusters, clear tree silhouette readable at 56 pixels wide. Low simple mound of warm brown soil at base; trunk planted directly in soil, NO exposed feet or leg-like roots. Quiet, patient, attentive personality. Faint concentric elliptical growth rings on lower front trunk glow softly, symbolic memories; restrained rings, not a big magical portal. Mint-green #7FD6B0 canopy with restrained warm amber #E8C07A tips and ring glow. NO PURPLE anywhere. Soft hand-painted digital illustration, clean broad shapes, subtle gradients, gentle rim light, polished mobile game mascot quality, Pixar-lite but flatter, minimal surface details. Small, soft, youthful, not muscular or fantasy warrior. Canopy broader than trunk, enough exposed trunk to read the tiny face and rings. Full silhouette unobstructed, nearly fills canvas with safe margins. Genuinely fully transparent background, no backdrop, no background glow, no checkerboard painted into image. No text, no props, no clothing, no shoes, no human limbs, no fingers, no heavy outlines, no photorealism.

### 五状态
Use case: stylized-concept. Input image is the identity reference for the EXACT SAME tree mascot. Create one transparent-background five-state character concept sheet, five full-body characters in ONE horizontal row, evenly spaced, same size and ground baseline, no overlap, no text or labels. Requested wide 3000x1000. Preserve the reference tree's mint green rounded layered canopy, amber leaf tips, curved honey wood trunk, tiny brown eyes and mouth on trunk, two short twig stubs, small low soil mound, glowing concentric oval memory rings. NO human limbs, no legs, feet, fingers, clothes or purple. Soft hand-painted mobile game illustration. Keep identity and proportions consistent across all five. Left to right exactly: 1 IDLE calm relaxed tiny smile normal canopy and restrained rings. 2 SPEAKING small visibly open mouth, canopy gently lifted/open with soft warm light through leaf gaps, branch stubs subtly spread. 3 LISTENING mouth closed, attentive slight trunk lean, ONE distinctive leaf raised clearly above canopy like a listening ear (still botanical leaf, not actual ear), eyes attentive. 4 THINKING eyes slightly looking upward, subtle asymmetric concentric amber ring highlights suggesting rotational phase, tiny closed thoughtful mouth, no icons. 5 STILL / SLEEPING eyes closed as two short curved lines, canopy gently settled, ring light extremely faint, branches lowered. These are static key poses, not animation. Reduce fussy texture and stray glow speckles. True alpha transparency everywhere outside character silhouettes including spaces between characters. No scene, no ground plane beyond each small soil mound, no background glow, no checkerboard, no lettering, no decorative symbols.

