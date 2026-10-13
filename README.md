# 人生 RPG · 成长星球

2026-10-13：首版AI行动流程已发布为Sites第12版并公开入口；演示无需登录，个人记录和AI仍需登录。当前源码在 `site/`，发布状态与验收边界见 `docs/RELEASE_STATUS.md`，投稿填写材料见 `docs/SUBMISSION_READY.md`。较早第11版来源清单为历史快照；当前208个应用文件对应 `docs/RELEASE_MANIFEST.json`。

个人成长网站：记录目标、日常行动、储蓄进度、人生纪念和生日，以经验、徽章和角色反馈展示成长。

## 当前同步版本

- 来源：Sites 第 **11** 版，发布状态已核对为 succeeded。
- 原始源码提交：`1c66c3c3f82e67819bb42f5eb1ae7c0803397ce3`。
- 站点：[人生 RPG](https://life-rpg-world.docileape4.chatgpt.site/)，沿用现有访问权限。
- GitHub 仓库为私有，应用源码和素材在 [`site/`](site/)。
- 本次同步日期：2026-10-11（北京时间）。

最新角色规则：男角色使用探索装或西装；女角色使用探索装或礼裙。成人礼按角色解锁对应服装，旧存档中的不兼容穿搭由规则层修正。正式角色使用 2D 立绘，支持全身／近景、点击回应和庆祝；3D 相关代码及美术实验保留在原始源码中。

## 接手开发

先读 [`AGENTS.md`](AGENTS.md) 和 [`docs/CODEX_HANDOFF.md`](docs/CODEX_HANDOFF.md)。项目使用 Node.js >=22.13.0、pnpm 11.25.0、React、vinext/Vite，以及 Cloudflare D1/R2。

```sh
git clone https://github.com/Patch-A/life-rpg-world.git
cd life-rpg-world/site
corepack pnpm install --frozen-lockfile
corepack pnpm run dev
```

上述是后续本地启动步骤，本次同步没有安装依赖或运行构建。数据库迁移、运行环境与 Windows 兼容性见交接说明。

## 文档与数据边界

`site/README.md` 保留原版本原文，其中“服装不按性别限制”“GitHub 上传暂缓”等历史段落已过期；当前规则以本 README、交接说明和 `lib/appearance.ts` 为准。

192 个原始站点文件按 Git blob 哈希和模式同步；唯一排除的已跟踪文件是编译缓存 `tsconfig.tsbuildinfo`。详情见 [`docs/SOURCE_MANIFEST.json`](docs/SOURCE_MANIFEST.json)。未上传生产 D1/R2 数据、个人照片、存档导出、环境变量、依赖目录或访问凭据。

此仓库没有新增开源许可证。素材来源与已有第三方许可证保留；公开分发前仍需核对其使用范围。
