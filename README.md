# 人生 RPG · 成长星球

把想做的事变成今天的一小步，用行动记录决定下一步。

![人生RPG · 成长星球封面](docs/submission-cover.png)

**H5 v0.2开源源码版：本地登录、双账号隔离和真实AI流程已验证；尚未独立公网部署、尚未正式投稿。**

[下载H5源码与投稿附件](https://github.com/Patch-A/life-rpg-world/releases/tag/h5-submission-v0.2) · [投稿材料入口](submission/README.md) · [本地运行说明](h5/README.md) · [版本状态](docs/H5_SUBMISSION_STATUS.md)

## 产品做什么

面向有学习、创作或个人项目目标的成年人。输入目标、成功标准、可用时间和障碍，AI给出包含步骤、耗时和完成标准的候选行动。你可以修改、拒绝或确认，确认后才保存。留下行动记录，再根据所选目标最近的有效文字记录生成带引用的短复盘与下一步。

成长经验、升级和奖励由确定性规则处理，AI不会替你认定现实完成。照片、生日和纪念为可选补充。反馈会给出回执，可查看、删除本人反馈并导出存档。

## 体验与交付状态

| 项目 | 当前情况 |
| --- | --- |
| 独立H5 | Node.js24 / Next.js / SQLite / 私有照片目录，独立试用账号，无需ChatGPT |
| 本地入口 | 运行后打开 `http://127.0.0.1:3187`，仅当前电脑可访问 |
| 固定演示 | `/demo`，明确标注虚构样例，不调用模型、不建立私人存档 |
| 真实AI | 服务端DeepSeek已实现并本地验证，下载包默认关闭，不含Key |
| 私人账号 | 本应用生成的专属邀请码，首次本地启动生成，不由外部平台提供 |
| 独立在线服务 | 尚未部署，仓库链接不等于在线AI体验网址 |
| 支付宝接入 | 尚无小程序上架、身份授权、账单、步数、支付或阿宝分发 |
| 投稿 | 已准备源码、封面、文案和运行材料，尚无正式提交回执 |

旧Sites保留为历史展示，ChatGPT登录已出现地区限制，公开AI已关闭。旧URL不替代当前H5的可用性证明。旧存档未清空，新旧账号尚未自动合并。

## 在本机运行

建议下载Release中的 `life-rpg-h5-submission-v0.2.zip`，解压进入 `life-rpg-h5/`。需要Node.js24及锁定的pnpm11.25.0：

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm build
node start-local.mjs
```

启动器仅监听本机，首次初始化SQLite并生成 `data/local-preview-invitation.json`。复制其中的 `invitationCode` 到 `/access` 登录；`accountId` 只是管理标识。邀请码等同私人账号凭据，不要公开或共用。存档和照片在 `data/`，关闭进程不会删除，删除该目录会丢失数据。

默认强制关闭AI且不读取密钥。若要本人进行真实模型测试，可显式指定已有、被Git忽略的测试配置文件：

```sh
node start-local.mjs --test-key-file ABSOLUTE_IGNORED_TEST_FILE
```

真实AI需联网并产生API用量。不要将Key放在命令行、Git或公开材料中；公开服务须使用另行授权正式用途的配置。

若从完整Git仓库开发，先生成独立源码，再按上述步骤运行：

```sh
git clone https://github.com/Patch-A/life-rpg-world.git
cd life-rpg-world
node scripts/prepare-h5.mjs
cd outputs/h5-submission
```

GitHub自动生成的仓库Source code ZIP没有Git元数据，上述导出步骤针对Git克隆。Release中的独立H5包已导出，可直接安装/构建。

## 代码与部署

- [`site/`](site/)：原Sites源码、素材与历史规则。
- [`h5/overlay/`](h5/overlay/)：独立运行、身份、存储、首页和部署适配。
- [`scripts/prepare-h5.mjs`](scripts/prepare-h5.mjs)：白名单导出，不复制运行环境或私人数据。
- [`scripts/verify-h5.mjs`](scripts/verify-h5.mjs)：实际本机HTTP验收，默认无模型调用。
- [`h5/overlay/deploy/`](h5/overlay/deploy/)：单机HTTPS模板，尚未在云主机验收。
- [`docs/LOW_COST_HOSTING_REVIEW.md`](docs/LOW_COST_HOSTING_REVIEW.md)：低成本候选及未验证条件。

单实例访问SQLite，数据目录须持久化且不能暴露为静态文件。正式上线还需托管、HTTPS、可信公开Origin、备份恢复、正式模型预算及目标网络验收。低成本候选尚未选定，不承诺免费资格或国内访问质量。

## 已完成的验证

2026-10-20生产编译和TypeScript通过。实际HTTP覆盖双虚构账号登录、匿名/伪造身份拒绝、存档和照片隔离、并发冲突、反馈幂等、退出与停用、关闭AI无模型调用。另以两次真实DeepSeek请求验证虚构目标生成、编辑确认、防重复确认、虚构记录及带有效引用的复盘保存。

这是本机工程验证，不是公网、浏览器视觉、真机、支付宝内浏览器或真实用户效果验证。见[状态记录](docs/H5_SUBMISSION_STATUS.md)。

## 数据与许可

GitHub只存源码和投稿材料，不存模型Key、邀请码、会话、生产数据库、私人照片或用户存档。不要通过公开Issue提交这些信息。下载者在自己环境生成自己的账号。

原创软件代码和文档采用[MIT许可证](LICENSE)。第三方代码保留各自许可，见[第三方声明](THIRD_PARTY_NOTICES.md)。**视觉素材不包含在该MIT授权范围内**，见[素材说明](ASSETS.md)。源码公开不代表已完成素材的赛事权利声明，参赛人仍需按实际情况核对。
