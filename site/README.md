# 人生RPG · 成长星球

首版投稿目标：把学习、创作与个人项目目标变成今天可执行的小行动，记录实际进展，再由AI根据记录调整下一步。

## 当前实现（2026-10-12）

- 现有今天、目标、世界、我的，正式2D角色与星球保留。
- DeepSeek服务端生成最多3个候选行动；可修改标题和完成标准、拒绝或确认。确认后原子保存目标和行动，重复确认不重复创建。
- AI复盘只读取所选目标最近最多12条文字记录，验证引用归属；可只保存复盘，也可同时确认下一项行动。模型不直接改变经验。
- AI创建的项目有独立成功标准；累计时长表示投入，实际目标达成由用户确认。旧累计目标规则保留。
- 首次建档无需生日或照片；生日与人生纪念可稍后补充。首版AI试用面向成年人，自我确认不等于正式年龄核验。
- 反馈按用户保存，有回执、本人查看/删除；维护者通过受保护的Sites数据库工具查看，没有公开反馈列表。
- /demo 是固定虚构演示，不调用模型、不写私人存档；/about 说明数据、费用限制、导出与删除路径。
- 原生日、纪念、照片、储蓄、奖励去重与旧存档兼容保留。男角色使用男装，女角色使用女装；原README中任意混穿的说法已过期。

## 本地运行

要求Node.js >=22.13.0；init-local-db.mjs使用Node内置SQLite，需要支持该模块的版本。pnpm版本以package.json为准，保持锁文件。

    corepack pnpm install --frozen-lockfile
    node scripts/run-framework.mjs build
    node scripts/run-framework.mjs dev

本地将模型配置放在被Git忽略的.dev.vars，字段参考.env.example，不要提交真实值。先生成dist/server/wrangler.json，按順序应用drizzle/下全部迁移；旧README只应用第一份迁移的指引已过期。

正常本地D1命令（每份未应用SQL执行一次）：

    node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_zippy_monster_badoon.sql

Windows本轮Wrangler迁移子进程崩溃，预览服务器可运行。首次启动并停止预览后，可使用 node scripts/init-local-db.mjs 初始化此checkout的唯一空本地D1文件；该脚本维护自己的本地迁移记录，拒绝未识别的已有数据库，不接触生产数据。已有正常Wrangler初始化的数据库继续沿用原迁移方式。

## 模型与运行配置

生产通过Sites环境变量配置：DEEPSEEK_API_KEY必须为secret；DEEPSEEK_MODEL可配置，默认deepseek-flash；AI_ENABLED=false关闭调用；默认每用户每日10次、全站每日100次。失败尝试计入次数，输入、输出、并发和超时均有限制。环境变量变更需重新部署生效。

草案读取窗口30天、反馈读取窗口90天，过期内容随请求限量清理；已确认记录在私人存档中保存。API只从可信Sites身份读取用户数据，不能直接信任公开客户端身份头或JSON。迁出Sites时需要独立可信认证适配。

## 验证与边界

本轮已进行类型检查、构建、隔离SQLite API测试、规则检查，以及本地浏览器使用虚构数据的真实DeepSeek拆解/确认/记录/复盘/反馈流程。390px浏览器视口无横向溢出。这些不等于真实手机、支付宝内浏览器、第二真实账号或长期使用效果验收。

主要检查：verify-agent.mjs（模型HTTP显式模拟，验证服务端授权、引用与配额）、verify-api.mjs（存档、照片隔离与冲突）、verify-growth.mjs、verify-birthday.mjs、verify-wardrobe-rules.mjs、verify-character-integration.mjs。不得将模拟模型测试称为真实模型评估。

## 发布、归档与支付宝

已有Sites项目ID保留在.openai/hosting.json。Sites发布与GitHub归档是两项动作。生产D1/R2、用户照片、存档和凭据不进入GitHub；依赖、构建和缓存不提交。

当前为网页作品，未完成支付宝小程序上架、账单/步数/支付或阿宝接入。小程序主体、原生/H5路线、域名与授权需要独立核验；个人小程序不能默认使用web-view。参赛投稿、许愿关联与用户分发也分别保存回执。

维护与交接、投稿材料及本轮版本对应关系，见GitHub归档仓库根目录docs/。源码、依赖与既有素材的许可证按各自来源处理，不因私有归档而自动获得公开分发权。
