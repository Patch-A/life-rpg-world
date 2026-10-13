# 人生 RPG · Codex 交接

2026-10-13新增阻塞：用户实际OpenAI登录返回地区不支持，公开演示可达不等于国内完整功能可用。后续优先独立部署与国内用户登录，具体见 `DOMESTIC_LOGIN_BLOCKER.md`，不要沿用“公开后即满足国内体验”的推断。

## 当前首版（2026-10-13）

Sites第12版已发布；2026-10-13已按用户授权公开（策略revision 2），演示/说明匿名200，个人接口匿名401。来源提交 `3bf9860102504ebbeed564f385de40d9f00bbfaf`，208个应用文件在 `site/`，来源清单为 `RELEASE_MANIFEST.json`。新增AI拆解、确认、复盘、反馈和可选生日建档，运行配置及本轮验证见 `RELEASE_STATUS.md`。`SUBMISSION_READY.md`为实际功能投稿说明；未完成正式投稿、第二真实账号及真机验收。下面第11版为历史基线，不代表当前尚无AI功能。

生产新增迁移0003，维护旧迁移不可改写。模型密钥为Sites secret，不在源码内。Windows本地迁移子进程崩溃时可使用 `site/scripts/init-local-db.mjs`，其只接受本checkout空数据库或自身初始化的数据库；停止预览后执行。Sites打包在Windows需要Git Bash置于PATH前，GNU Tar使用 `TAR_OPTIONS=--force-local`。

## 历史基线（2026-10-11）

- 仓库：`Patch-A/life-rpg-world`，私有，默认分支 `main`。
- 网站：https://life-rpg-world.docileape4.chatgpt.site/
- Sites 项目：`appgprj_6ac74d3e30e88191b0707ad3c47fc8a3`。
- Sites 第11版来源提交：`1c66c3c3f82e67819bb42f5eb1ae7c0803397ce3`。
- 对应部署：`appgdep_6aca463629b48191b405a0f1d6e2c365`，核对结果 `succeeded`。
- GitHub保存192个站点源码及素材文件；原始193个跟踪文件中排除 `tsconfig.tsbuildinfo` 编译缓存。每个文件的来源路径、模式、Git blob SHA记录于 `SOURCE_MANIFEST.json`。
- 本次取自 Sites 源码仓库的已发布提交，应用源码及素材未修改；GitHub 保存当前快照，不承载完整 Sites Git 历史。

## 当前产品

主入口为今天、目标、世界、我的。包含自定义目标与行动、按日期记录、经验上限与重复领奖防护、储蓄目标、可补录的人生纪念、生日仪式、照片管理及存档导出。

角色已接入2D立绘。有效组合为男探索装、男西装、女探索装、女礼裙，每种提供全身与近景，共8个WebP角色文件。规则入口为 `lib/appearance.ts`，素材映射为 `lib/character-art.ts`；正式展示组件是 `components/character-2d.tsx`。成人礼解锁与存档兼容逻辑位于 `lib/game.ts`。不能恢复旧版男女衣服任意混穿规则。

`/character-lab` 为独立角色样板，`/art-lab` 及3D代码为美术实验。当前快照保留它们以及已跟踪旧素材，后续清理应先核对引用。未把旧会话下载区中的修复试验 GLB 加入仓库。

## 本地与部署依赖

- Node.js >=22.13.0；`packageManager` 锁定 pnpm 11.25.0，依赖以 `pnpm-lock.yaml` 为准。
- 在 `site/` 执行 `corepack pnpm install --frozen-lockfile`、`corepack pnpm run dev`。
- 开发预览由 Vite/Cloudflare 插件生成本地绑定；构建使用 `corepack pnpm run build`。
- `.openai/hosting.json`：D1逻辑绑定 `DB`，R2逻辑绑定 `BUCKET`。`vite.config.ts` 中为本地占位资源，并非生产数据库ID。
- 应用全部 `drizzle/*.sql` 迁移，而不是只应用原README提到的第一份。构建生成 `dist/server/wrangler.json` 后，对全新本地数据库按编号依次使用 `corepack pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_zippy_monster_badoon.sql`，再处理0001、0002文件。已有数据库先核对已应用迁移，不能重复执行；这些步骤需在新环境实际验证。
- `lib/identity.ts` 依赖 Sites 平台可信注入身份，生产存档和照片按用户隔离。独立部署需增加可信认证适配；客户端身份头不能作为公网认证方案。
- GitHub 是代码快照，不是数据库备份；D1存档、R2照片、环境变量和平台身份配置仍在原站点运行环境。
- Windows本地依赖安装、Cloudflare运行时、迁移与预览未在本次同步重新验证。`install:ci` 为bash脚本，后续在适当环境使用。

## 检查证据与边界

本次：核对已发布版本、源码提交、文件清单；上传后检查GitHub远端blob SHA与文件模式。没有重新安装、构建或运行应用测试。

历史：旧工作会话在2026-10-10完成 `verify-wardrobe-rules.mjs`、`verify-character-integration.mjs`、`verify-v7.mjs`、`verify-birthday.mjs`、`verify-journey.mjs`、`verify-growth.mjs`，退出码0；同一会话报告规则及构建检查通过。该记录支持原发布状态，不能当成本次本地重测。

尚未确认：真实手机交互与视觉、独立克隆后的完整运行、迁出Sites后的身份认证、支付宝授权/接口/上线，以及素材公开分发许可证。旧README中“GitHub暂缓”“不按性别限制”、较早导出版本等表述是历史内容，以当前代码为准。

## 下一步

1. 确定下一阶段功能或验收范围，再在 `site/` 接续修改。
2. 若用户要求验证，先安装锁定依赖，初始化本地D1/R2，验证预览，再使用现有规则脚本与真机检查。
3. 后续修改按 Sites 技能准备、保存和发布到已有项目；GitHub提交本身不会更新线上网站。
