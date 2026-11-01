# 记录官 · 树人 v3 接入归档（2026-11-01 第三段）

> 承接同日 `RECORDKEEPER_SESSION_2026-11-01-B.md`。分支 `codex/recordkeeper-v1`，
> **仍未推送，无 upstream**。本次 HEAD `1a990a0`。

---

## 一、本次做完的

### 1. 素材验收：20/20 通过（我自己跑的，不是转述）

```
cd site && node scripts/check-treant-states.mjs ../docs/art/recordkeeper-states-v3
```

| 项 | 实测 |
|---|---|
| 五张画布 | 1024×1024，完全一致 |
| 土包基线 | 五张底边都是 y=918，**差 0px** |
| 水平中心 | 差 1.0px |
| 四角 alpha | 全部 0 |
| 全透明面积 | 70.7%–76.3% |
| 紫/品红像素 | **五张都是 0**（没有用到容忍值） |
| thinking vs idle 剪影 | 56px 下差 **12.0%**（门槛 8%） |

素材方还额外用「固定 1024 画布直接缩到 56」量了一次，XOR 差异 10.46%，占两者剪影并集 33.68%。
两种量法都过，说明 12% 不是靠脚本的包围盒归一化凑出来的。

### 2. 接入（`1a990a0`）

- 五张 PNG 转 WebP 放 `public/recordkeeper/`：单张 65–79KB，合计约 365KB，
  比原 PNG（约 2.9MB）小 87%。调色板已核对，配色没有被压缩改坏。
- `treant.tsx`：手绘 SVG 占位 → 五张图叠加，只切 `opacity`。
  **外部契约没变**，仍是 `.treant` 盒子和 `data-state`，`assistant-scene` 一行没改接线。
- 五张全部常驻 DOM。换 `src` 会在弱网手机上闪一下空白，而树人是首页常驻的。
- 新增第五态 `still`（素材自带闭眼）。**这是本段发现并修掉的一个真 bug**：
  第一版 CSS 里漏了 `still` 的选择器，切过去会是**全透明，屏幕上什么都没有**。
- 移除 CSS 椭圆台座（`.assistant-scene__pedestal`）。素材自带土包，两者叠加=两层底座。
- 呼吸动画按状态分节奏：listening 停住、speaking 2.6s、thinking 3.6s、idle/still 5.2s，幅度 1.2%。
- 移动端光晕重新对齐到树人内容中心（原来偏右 2px，80px 的条里看着像两个圆叠着）。

### 3. 「减少动态效果」走通

`assistant-scene` 里监听 `prefers-reduced-motion` 和 `html.reduced`，idle 时切到 `still`。
实测：加 `reduced` 类后 `data-state=still`、只显示 still 那张、`animation-name: none`。

---

## 二、验证到什么程度

### 本次核对过的（本地 Chrome + CDP）

| 项 | 方法 | 结果 |
|---|---|---|
| TypeScript | `tsc --noEmit` | 无错误 |
| ESLint | 改动文件 | 0 error；`treant.tsx` 有 5 条 `<img>` 建议用 `next/image` 的 warning，**故意不采纳**（理由见下） |
| 五张图都加载 | CDP 读 `naturalWidth` | 全部 1024×1024 |
| 切态生效 | 逐个设 `data-state` | idle/speaking/listening/thinking/still 各自只显示对应一张 |
| 移动端尺寸 | 366×694、dpr3 | 树人 56×71，条高 80，**页面不溢出**（scrollHeight 694 = innerHeight） |
| 桌面尺寸 | 1280×900、dpr1 | 树人 388×229，场景 539×360，不裁切 |
| 台座已移除 | DOM 查询 | `.assistant-scene__pedestal` 不存在 |
| reduced 路径 | 加 `reduced` 类 | 切到 still，动画 none |

**为什么不用 `next/image`**：五张图要常驻并叠在一起切透明度，`next/image` 的懒加载和
尺寸优化会和这个用法打架；而且这只是 5 张静态图，按 `<img>` + WebP 已经压到 65–79KB。
warning 留着不处理，是权衡后的选择，不是漏了。

### 未验证 / 不在本次范围

- **真机一次都没跑。** 所有「通过」都是本地 Chrome + CDP（安卓 UA、366×694、dpr3 模拟）。
  荣耀那台百度内核 Chrome/97 上，WebP、`object-fit`、`transition` 的实际观感都要再看。
- **56px 下的辨识度只验了「能看出差异」，没验「好不好看」。** 这是主观项，只有你能判。
- 语音仍未真机验证（上一段的结论不变）。
- 素人（数字人形象素材）仍未做。
- 怪兽三态、树人整体观感、记录官完整闭环——**依然没在真机上验收过**。

---

## 三、踩过的坑

1. **CSS 里漏一个状态选择器 = 屏幕上什么都没有。**
   五张图各自 `opacity:0`，靠 `[data-state='X']` 抬高对应那张。少写一条，
   那个状态就是全透明的。**加状态时先数一遍选择器有几条。**
2. **素材自带底座时，先删掉 CSS 里原有的底座。** 树踩土包、土包浮在椭圆上，
   中间空一截，量不出来但一眼就看出是两层。
3. **「光晕居中」不等于「树居中」。** 素材左右留白不对称（左 166px / 右 166px 但内容中心偏 1px），
   光晕按盒子居中会差 1–2px，在 80px 的条里就看得出来。
4. **调试 Chrome 默认开 `prefers-reduced-motion: reduce`。** 量动画前必须
   `Emulation.setEmulatedMedia` 设 `no-preference`，否则所有动画量出来都是 none。
   这次反过来利用了它——正好验证了 reduced 路径。

---

## 四、悬而未决

| 事项 | 状态 |
|---|---|
| 真机看五态观感 | **未做**。素材码率、WebP 兼容、56px 观感都要在荣耀那台上看 |
| 语音真机验证 | 未做（需 `adb reverse tcp:5173` + `http://localhost:5173`） |
| 素人（数字人形象） | 未做 |
| 桌面端树人 388×229 是否偏小 | 待你实际看过再定；我判断在 539px 宽的卡里是合理的，但这是我的判断 |
| 首页 80px 条里 56px 的树人是不是够大 | 同上，设计上它就是个头像位 |

---

## 五、下一步

1. **真机验收树人五态**（本轮唯一堵点）。
2. 真机验收语音。
3. 素人形象素材。

真机验收要看的四件事，按重要性：
- 五张图在荣耀那台上**颜色有没有偏**（WebP + 百度内核的组合没验过）
- thinking 的裸枝在真机 56px 下**能不能看出在思考**
- 切态时**有没有闪**（淡入 0.22s）
- 土包底部**有没有被裁**
