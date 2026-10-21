# 免费托管的公开H5入口

2026-10-21：已沿用邻里陪伴的Cloudflare Workers Free＋D1 Free路线部署，作品入口 <https://life-rpg-world.patch-neighborhood-demo.workers.dev>，真实DeepSeek已启用并通过两次虚构数据线上完整流程。独立Worker名 `life-rpg-world`，独立D1名 `life-rpg-world-public`；不读写原Sites或本地存档，不开通R2、不升级付费套餐、不购买域名。实际检查及未验事项见 `docs/PUBLIC_H5_DEPLOYMENT.md`。

## 版本边界

保留原星球、2D角色、性别服装规则、目标、行动、确认、引用复盘和反馈。Vite编译现有React页面为静态资源，Worker复用现有确定性规则与API；单独适配可信访客身份及用量账本。不是把Node SQLite直接上传，不是重新发布Sites。

访客在 `/access` 明确同意后创建独立账号，无ChatGPT或邀请码；HttpOnly/SameSite=Lax/线上Secure Cookie，原始凭据不入D1，只存哈希。凭据30天有效，无自动找回；导出在“我的”，可在访客页确认删除本人云端记录。退出不自动删存档。跨标签页切换与BFCache恢复会清理本应用临时输入并刷新。

仅对精确Request对象授予服务端验证身份，不信任公网oai或其他身份头；写接口严格同源并限制流式正文大小。新入口照片上传关闭，不订阅R2；原站点和旧照片保留。默认构建配置AI关闭，模型凭据只存在服务端Secret中。

用户于2026-10-21明确授权原测试凭据用于本次公开参赛试用并接受模型用量。真实AI最多每访客3次/北京时间日、全站20次/日、全站5次/分钟、每访客2次/分钟；独立D1单条条件INSERT原子预留，失败计数，删草案不返还。次数不是人民币预算上限；网络与模型服务仍可能失败，不能自动判定用户完成或给奖励。

## 构建与部署

使用现有 `site/package.json` 锁定依赖；先在site安装，再在仓库根执行 `node online/build.mjs`。已有依赖在其他本项目checkout时可用环境变量 `LIFE_RPG_DEPENDENCIES_DIR` 指向其根目录。构建只复制Git跟踪源码及公开素材，不复制Sites环境、身份、数据库或依赖；临时目录在被忽略的outputs中。

Wrangler使用 `site/node_modules/wrangler/bin/wrangler.js`。在本人Cloudflare授权后创建独立D1，把真实ID写入被Git忽略的 `online/wrangler.local.json`，以其为配置应用 `online/migrations/` 并发布。发布前先同步GitHub。配置中仅DB标识，密钥不得写普通vars、源码、命令参数、日志或ZIP。首次发布AI关闭，Secret设置成功后才启用。

`online/wrangler.jsonc` 是默认AI关闭的公开模板，占位D1不能直接用于生产。修改build输入后必须重建静态页与Worker；固定Release标签不移动。

## 免费与未验收事项

[Workers Free](https://developers.cloudflare.com/workers/platform/pricing/)有每日动态请求额度和CPU限制，[D1 Free](https://developers.cloudflare.com/d1/platform/pricing/)有读写/存储限制；用尽可失败，不自动升级。DeepSeek另按账户计费。本轮OAuth能创建D1/发布，读取订阅账单API返回403，因此不把这一步描述为已读到完整账单；未执行套餐升级或购买动作。

workers.dev提供HTTPS，无需购买域名，不保证中国大陆所有运营商可达。发布成功、当前电脑可访问、真实手机流量、支付宝内浏览器和真实用户效果应分别记录。未代替本人正式投稿或接受赛事条款。界面/数据保留范围见 `/about`，源码公开不代表所有美术素材获MIT授权。
