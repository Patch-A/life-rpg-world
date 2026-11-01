# 树人五状态素材 · v3 重出需求单

2026-11-01 · 方案 B（重出五状态表）已由用户拍板。
依据：`REVIEW-2026-11-01.md` 里 v2 的四个未解问题。**下面每一条都是从实测数据反推出来的，不是审美偏好。**

---

## 一、v2 到底哪里不能用（给 GPT 看的原因，不是抱怨）

| 问题 | 实测证据 | 后果 |
|---|---|---|
| 五棵树连在一起 | 列间最小 alpha 分别是 251 / 250 / 252，只有第 4–5 棵之间是 9 | 无法自动切片，必须手工抠 |
| 高度不一致 | `listening` 那片竖叶让 3 号高 621px，其余 523–573px | 等高盒子里 `contain` 会让另外四棵一起缩小 |
| thinking 与 idle 分不出 | 缩到 56px 几乎重合 | thinking 是停留最久的状态，这个差异等于白做 |
| 枝端像手 | `x390-810, y700-900` 两根对称短枝、肩高、末端带叶簇 | 56px 下读作「在挥手的两只手」，比真枝还显眼 |
| 自带土包与椭圆台座打架 | 树踩土包、土包浮在 CSS 椭圆上，中间空一截 | 两层底座（这条改 CSS 解决，素材保留土包） |

---

## 二、硬约束（缺一条就要重出）

1. **五个独立文件**，不是一张连着的表。文件名固定：
   `state-idle.png` / `state-speaking.png` / `state-listening.png` / `state-thinking.png` / `state-still.png`
2. **五个文件画布尺寸完全相同**（建议 1024×1024），每张都把树**居中放在同一位置**，
   土包底边落在**同一个 y 坐标**（±2px）。这样前端切状态时不会跳。
3. **透明底**：四角 alpha=0，四周留白 ≥ 画布 8%，背景不能有棋盘格、渐变、投影、外发光晕。
4. **形态差异必须靠剪影，不能只靠表情/颜色**（56px 下颜色和五官都糊了）。见第四节。
5. **枝端不许带叶簇**，不许肩高左右对称外翘。整棵树只能有「天然枝条」，不能读作手臂。
6. **不做人形**：没有性别、衣服、鞋，没有肌肉和壮硕躯干。
7. 配色沿用 v2：树冠薄荷青绿 `#7FD6B0`、树干哑光蜜色、年轮柔和琥珀 `#E8C07A`。
   **紫/品红像素为 0**（这是硬指标，v2 已达标，别破坏）。

---

## 三、直接可以粘给 GPT 的提示词

```
Use case: precise-object-edit. Input 1 is the EDIT TARGET: the approved five-state tree mascot sheet. Input 2 is COLOR REFERENCE: the approved mint palette master.

GOAL: split the sheet into five SEPARATE single-character images and fix four measured defects. This is a production delivery, not a redesign.

DELIVER FIVE SEPARATE PNG FILES, each 1024x1024, each containing exactly ONE full-body tree, centered, with the bottom of the soil mound at the same y position in all five (within 2 px). Order and file names:
1. state-idle.png    — calm, upright, eyes open neutral, gentle closed smile
2. state-speaking.png — mouth open mid-speech, soft light in the leaf gaps
3. state-listening.png — one small leaf raised like an ear, head tilted slightly toward the listener
4. state-thinking.png — attentive upward gaze, faint amber memory rings
5. state-still.png    — eyes closed, branches lowered, almost no glow

MANDATORY FIXES:
(A) Fully alpha-transparent background everywhere outside the silhouette. Every corner alpha = 0. No checklist pattern, no backdrop, no drop shadow, no glow halo, no gradient. Keep at least 8% empty margin on all four sides.
(B) SILHOUETTE-LEVEL state difference. At 56x56 px, thinking must still be distinguishable from idle using the outline alone. Achieve it structurally: in state-thinking, raise ONE front branch tip clearly ABOVE the canopy outline and lean the whole body forward slightly (about 8 degrees) with the canopy compressed; in state-idle keep the silhouette upright and symmetric with nothing breaking the outline. Do not rely on eye direction, mouth shape or color to carry this difference.
(C) NO leaf clusters at branch tips, and NO pair of symmetric outward branches at shoulder height. Branch tips must end bare or turn upward inward. The character must never read as "waving hands" or "arms".
(D) Keep the small soil mound under the trunk - it is the ground the tree stands on. Do not remove it, do not add a second plinth, base or platform, do not add an ellipse under it.
(E) Keep every state the same character: same face, same trunk curve, same leaf cluster layout, same body proportions. Only pose, gaze and lighting differ.

STYLE: soft hand-painted Q-version illustration, clean readable shapes, mint/jade canopy #7FD6B0 with muted teal shadows, muted honey wood trunk, desaturated neutral earthy brown soil, subtle warm amber accents under 10% of the canopy, faint amber rings #E8C07A only in thinking and speaking, especially faint in still.
NO purple, no magenta, no neon cyan anywhere on the character. No human limbs, hands, fingers, clothes, shoes, hair, accessories. No text, no symbols, no particles, no added props. No background of any kind.
```

---

## 四、我拿到素材后会验什么（验收清单，先说清楚）

| 项 | 判据 | 谁来判 |
|---|---|---|
| 五张画布尺寸一致 | 逐张读像素尺寸，必须完全相同 | 我，脚本 |
| 土包基线对齐 | 五张内容包围盒底边差 ≤ 2px | 我，脚本 |
| 透明底干净 | 四角 alpha=0；每张全透明面积 ≥ 30% | 我，脚本 |
| 无紫色 | 紫/品红像素 0（a≥128、s>0.28、h∈[255,330)） | 我，脚本 |
| 枝端无叶簇、不像手 | 350% 与 56px 各看一次 | 我，肉眼 |
| thinking / idle 剪影可分 | 缩到 56px 做剪影叠差，差异像素占比 ≥ 8% | 我，脚本 |
| 真机观感 | 荣耀 Magic 7 Pro 系统浏览器上实际看 | **你** |

前六项我能验，**最后一项只有你能验**。素材到了我先跑脚本，脚本过了我再报「可以装机看」，不提前说「完成了」。

---

## 五、如果 GPT 一次出不来

按优先级砍，前三条不能砍：
1. 五张分开 + 画布一致 + 基线对齐（不改就等于没解决切片问题）
2. 剪影级 thinking/idle 差异
3. 枝端不像手
4. 配色微调、琥珀光晕强度——这些可以后补
