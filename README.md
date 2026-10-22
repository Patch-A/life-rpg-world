# 人生 RPG · 成长星球

把想做的事变成今天的一小步，用行动记录决定下一步。

![人生RPG · 成长星球封面](docs/submission-cover.png)

**2026-10-22：当前投稿入口转向 QMuse（妙思）。** [打开妙思作品](https://render.qmuse.pub/p/muse/4351857479964072/index.html) · [部署与验证记录](docs/QMUSE_DEPLOYMENT.md) · [QMuse源码](qmuse/)。已公开发布，访客存档、两次真实DeepSeek的拆解—修改确认—记录—引用复盘及反馈回执均已验证；尚未正式投递比赛。密钥仅在服务端，旧版存档保留。

以下 v0.3 信息为2026-10-21 Cloudflare历史部署记录，不替代当前妙思投稿入口。

**H5 v0.3公开试用版已部署，真实DeepSeek已启用，无需ChatGPT登录或邀请码。尚未代替本人正式投稿。**

[打开在线作品](https://life-rpg-world.patch-neighborhood-demo.workers.dev) · [v0.3投稿附件](https://github.com/Patch-A/life-rpg-world/releases/tag/online-submission-v0.3) · [投稿材料入口](submission/README.md) · [本地运行说明](h5/README.md) · [线上验证记录](docs/PUBLIC_H5_DEPLOYMENT.md)

在线版使用本人Cloudflare Workers/D1免费额度，DeepSeek用量由维护者承担。访客点击同意后各自建立独立存档，凭据保存在本浏览器30天，没有自动找回；请及时导出。照片上传暂不开放。免费额度和默认域名不保证所有国内网络可达，实际手机流量/支付宝内浏览器仍待本人核验。

## 产品做什么

面向有学习、创作或个人项目目标的成年人。输入目标、成功标准、可用时间和障碍，AI给出包含步骤、耗时和完成标准的候选行动。你可以修改、拒绝或确认，确认后才保存。留下行动记录，再根据所选目标最近的有效文字记录生成带引用的短复盘与下一步。

成长经验、升级和奖励由确定性规则处理，AI不会替你认定现实完成。照片、生日和纪念为可选补充。反馈会给出回执，可查看、删除本人反馈并导出存档。

## 体验与交付状态

| 项目 | 当前情况 |
| --- | --- |
| 独立H5 | 在线v0.3为React静态资源＋Cloudflare Worker＋D1；本地v0.2保留Node24/Next/SQLite |
| 本地入口 | 运行后打开 `http://127.0.0.1:3187`，仅当前电脑可访问 |
| 固定演示 | `/demo`，明确标注虚构样例，不调用模型、不建立私人存档 |
| 真实AI | 在线服务已启用并验证生成/确认/记录/引用复盘；每访客3次/日，全站20次/日，失败计数 |
| 私人账号 | 在线为每浏览器独立访客，无需邀请码；本地v0.2仍由启动器自动生成专属邀请码 |
| 独立在线服务 | [HTTPS作品入口](https://life-rpg-world.patch-neighborhood-demo.workers.dev)，不是GitHub页面或localhost |
| 照片 | 线上免费版不上传；本地及旧Sites保留已有实现和照片 |
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

本地SQLite部署仍需单实例和持久磁盘。本轮线上使用独立Workers/D1免费额度，适配和复现步骤见 [`online/README.md`](online/README.md)。不购买域名、不升级套餐、不开通R2。两个项目共享本人Cloudflare账号的免费配额；本项目次数限额不限制模型账户其他应用的支出。长期备份恢复、真机及目标网络仍待补验。

## 已完成的验证

2026-10-21线上HTTPS页面、两访客隔离/保存/并发冲突、伪造身份与跨源拒绝、反馈回执/去重/隔离及合成访客删除通过。发出两次真实DeepSeek请求，虚构目标生成—编辑确认—防重复—虚构记录—带有效引用复盘—保存通过；删除草案不会返还AI次数。当前电脑浏览器已看到真实公开首页，见[截图](docs/public-h5-home.png)及[部署记录](docs/PUBLIC_H5_DEPLOYMENT.md)。尚未验证手机流量、全部国内运营商、支付宝内浏览器或真实用户效果。

2026-10-20生产编译和TypeScript通过。实际HTTP覆盖双虚构账号登录、匿名/伪造身份拒绝、存档和照片隔离、并发冲突、反馈幂等、退出与停用、关闭AI无模型调用。另以两次真实DeepSeek请求验证虚构目标生成、编辑确认、防重复确认、虚构记录及带有效引用的复盘保存。

这是本机工程验证，不是公网、浏览器视觉、真机、支付宝内浏览器或真实用户效果验证。见[状态记录](docs/H5_SUBMISSION_STATUS.md)。

## 数据与许可

GitHub只存源码和投稿材料，不存模型Key、邀请码、会话、生产数据库、私人照片或用户存档。不要通过公开Issue提交这些信息。下载者在自己环境生成自己的账号。

原创软件代码和文档采用[MIT许可证](LICENSE)。第三方代码保留各自许可，见[第三方声明](THIRD_PARTY_NOTICES.md)。**视觉素材不包含在该MIT授权范围内**，见[素材说明](ASSETS.md)。源码公开不代表已完成素材的赛事权利声明，参赛人仍需按实际情况核对。
