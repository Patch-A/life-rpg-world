# 记录官形象 · 树人 概念稿需求单

用途：交给 GPT（或任意生图模型）出**概念稿**，定方向用。
不是最终素材规格——落地还要按 `public/art-lab/asset-production-brief.md` 补正式稿。
日期：2026-10-31

---

## 一、直接可用的提示词

把下面整段贴给生图模型。英文提示词对多数模型更稳，后面附中文版。

### 英文

```
A small friendly tree creature, mascot character design, for a personal life-journaling app.

SUBJECT: A young sapling-person. Not humanoid — no human arms, no human legs,
no clothing, no footwear. A single slim tree trunk as the body, gently curved,
with a calm expressive face on the trunk (two small soft eyes, a subtle mouth).
The crown is a rounded canopy of layered leaves. Two short branch stubs serve
as arms. Roots curl at the base instead of feet.

KEY DETAIL: faint concentric growth rings visible on the trunk, glowing softly —
these are the app's "memories".

PERSONALITY: quiet, patient, attentive. It listens more than it speaks.

STYLE: soft hand-painted digital illustration, clean shapes, subtle gradients,
no heavy outlines, no photorealism. Pixar-lite but flatter. Similar production
value to a polished mobile-game mascot, NOT a detailed fantasy creature.

COLOR: canopy and rings in mint-green to warm amber (#7FD6B0 → #E8C07A).
Deep purple may appear ONLY as a faint background glow, never in the character.

LIGHTING: soft rim light, gentle internal glow from the trunk rings.

BACKGROUND: fully transparent. Character centered, standing, facing viewer
at a slight three-quarter angle.

RENDER: single character, full body, high detail, 2048×2048.
```

### 中文

```
一个友善的小树人，吉祥物角色设计，用于个人生活记录 App。

主体：一株年轻的树。不是人形——没有人类的手臂、没有人类的腿、不穿衣服、
不穿鞋。身体是一根微微弯曲的细树干，树干上有平静的表情（两只柔和的小眼睛，
一张不明显的嘴）。树冠是圆润的、分层的叶簇。两根短枝代替手臂。底部是蜷曲的
根，不是脚。

关键细节：树干上有隐约的年轮，微微发光——这就是这个 App 的"记忆"。

性格：安静、有耐心、专注听。它说得少，听得多。

风格：柔和手绘感数字插画，造型干净，细腻渐变，不要粗描边，不要写实。
接近皮克斯但更扁平。完成度对标精修的手机游戏吉祥物，不是细节繁复的奇幻生物。

颜色：树冠与年轮用薄荷绿到暖琥珀（#7FD6B0 → #E8C07A）。
深紫只能作为极淡的背景光，不能出现在角色身上。

光线：柔和轮廓光，树干年轮有极弱的内发光。

背景：完全透明。角色居中，直立，面向观众，略带四分之三侧角。

渲染：单个角色，全身，高细节，2048×2048。
```

---

## 二、必须避开的坑（逐一核对）

这些不是建议，是查证过的问题：

| 坑 | 为什么 | 怎么检查 |
|---|---|---|
| **画成人形** | 现在屏幕上站的是玩家角色的异性版本，这正是要摆脱的东西 | 看有没有人手人脚、有没有衣服裤子 |
| **长成"树人战士"** | 奇幻作品里的树人（Ent）是有肌肉、有脸的壮汉 | 它应该是矮的、软的、小的，不像战士 |
| **细节太多** | 手机陪伴条里只有 **56px 宽** | 把图缩到 56px，还认得出是树吗？枝杈糊成一坨就是废稿 |
| **配色撞紫** | 主色是 `#a98ecf` 紫，撞了会分不出是谁 | 角色身上不许出现紫色 |
| **风格漂移** | 和 `character-lab` 那套放一起像两个游戏 | 和 `public/character-lab/male-explorer.webp` 并排看 |
| **背景不透明** | 要叠在场景渐变上 | 必须是透明通道 PNG |

---

## 三、要出几张

按优先级：

1. **一张定稿**：全身、透明背景、正视或轻微四分之三侧。用来定方向。
2. **五张状态**（同一角色，只改姿态和表情）：
   - `idle` 平时：极慢呼吸
   - `speaking` 说话：树冠轻张，光从叶缝透出
   - `listening` 听你说：一片叶子竖起像耳朵
   - `thinking` 等回复：年轮在转
   - `sleeping` 静止：完全不动，只有极弱光
3. **一张 56px 测试**：把定稿缩到 56px，确认还认得出。

**第 3 张比第 2 张重要。** 如果 56px 认不出，前面全部作废。

---

## 四、交付与验收

| 项 | 要求 |
|---|---|
| 格式 | PNG，透明通道 |
| 尺寸 | 2048×2048（`.webp` 压缩版另外转） |
| 单张体积 | 压到 200KB 以内，和现有素材同级（`male-explorer.webp` 144KB） |
| 摆放 | 角色居中偏下，脚（根）在画布底线附近，上方留树冠空间 |
| 验收 | 56px 看得出是树、看得出在听/在说、不撞紫色、和现有角色并排不违和 |

---

## 五、这份需求单不包含的

- **不做 3D**。现有 `character-lab` 是 2D webp，GLB 那条线（`art-lab/`）另算。
- **不做换装/皮肤**。一棵树就够了，认得出是因为它始终是那棵树。
- **不承诺 AI 出图能直接上线**。概念稿 → 正式素材是两步，
  第二步要按 `asset-production-brief.md` 的规范补（多状态、透明、两档尺寸）。
