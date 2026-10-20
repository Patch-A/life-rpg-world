# 低成本托管候选与本地运行边界

2026-10-20。用户选择继续寻找低成本托管，未选择购买腾讯云服务器或域名。当前独立H5已完成本机HTTP和两次虚构数据真实模型验收；没有独立公网部署。以下为来源核对与适配判断，不是已取得用户套餐资格或承诺永久免费。

## 当前建议

先用本机启动器体验，再核验免预付托管是否真正适用。优先评估能直接运行现有Node24/SQLite/私有照片目录的单实例容器，避免为了免费额度重写全部登录和数据库。ClawCloud Run是有条件候选；需在控制台核验实际资格、持久卷锁/WAL支持、额度、原生HTTPS域名及目标网络。没有一个候选已通过这些部署验收，因此本轮不自动注册、绑定GitHub、接受条款、充值或部署。

## 候选比较

| 候选 | 核对到的事实 | 对本项目的判断/未知 |
| --- | --- | --- |
| 本机运行 | 当前应用已本地验证；无需先买服务器/域名；真实模型仍按API用量收费 | 最快供本人体验；电脑停止即离线，localhost不能直接作投稿网址。没有自动开放公网隧道 |
| ClawCloud Run | 官方定价/FAQ检索摘要称新用户首月5美元赠额，符合180天GitHub账号条件可按月续赠；官方App Launchpad说明支持持久存储、公开HTTPS地址和环境变量 | 有条件优先核验，尽量复用现有运行方式。赠额是资源预算，不是4核8GB可满负荷免费。当前定价/FAQ/账单正文直接抓取502，来源有较早抓取日期；控制台资格、实际计费、持久卷是否支持SQLite WAL、国内线路、暂停与删除规则均未核验。不能称永久免费或保证国内稳定 |
| Cloudflare Workers＋D1 | 官方当前Free为每日10万请求、每次10ms CPU；D1免费总存储5GB，有读写额度；R2开通须走订阅结算流程，含免费用量但可计费 | 免费额度是备选，但NodeSQLite版不能直接上传；需重新适配运行时、认证/存储并评估CPU。现有原Sites的D1/R2不等于拥有独立Cloudflare账号资源。默认域名的国内可用性和照片订阅仍未知 |
| Render Free | 官方说明15分钟空闲休眠，重启/休眠/部署会丢失本机SQLite和上传文件；免费服务不能挂持久盘；免费Postgres30天到期 | 不能直接拿现有本地磁盘方案存真实用户数据。不作为本轮快速完整投稿默认方案。若改外部数据库与照片存储，要另算工程与资源成本 |
| Zeabur | 官方新项目共享集群已弃用，套餐免费/5美元并不自动包含可运行的独立服务器；需另核对Server资源 | 不用旧教程的“免费共享容器”承诺。官网、文档与某旧子域页面存在范围/历史不一致，本轮不以单页宣传选型 |
| 国内CloudBase | 官方HTTP网关说明默认域名开发测试有限制，正式浏览器访问生产必须使用自定义域名 | 可作为后续国内选项，但不能拿免费默认域名承诺完整免域名、免备案正式服务 |

## 资源估算方法

ClawCloud官方定价检索页列示CPU约4美元/核月、内存2美元/GB月、存储0.12美元/GB月。若暂按0.25核、1GB内存、1GB卷计算，约3.12美元/月，未加网络、构建、备份和其他服务；这是配置假设，非实际账单或性能验收。平台可能按配额/上下限而非平均利用率结算，实际以当前控制台为准。不能因“最高4核8GB”就认为相应资源包含在5美元内。

托管赠额不含DeepSeek调用费用。超过额度可能暂停，试用到期/余额不足时的保留和清理规则须事先核验。当前不填写未经确认的国内访问速度、可用区、个人备案/其他合规结论。

## 本地账号与邀请码

邀请码由本应用的 `scripts/manage.mjs invite` 生成，每位试用者独立一份，映射独立存档；不是外部平台邀请码。现有本机预览账号位于被Git忽略的本地数据目录，已核对有效。不要复制任何实际值到本文件。

公开参赛需要降低评委操作负担，但不应公开共用一份私人存档。评审凭据如何交付仍应依据实际报名渠道决定；固定演示可以免登录，但不能冒充真实AI。后续如调整免登录体验，必须保留每位使用者的数据边界与模型额度控制。

## 来源及核验范围

- [ClawCloud当前定价入口](https://run.claw.cloud/pricing)、[官方FAQ](https://docs.run.claw.cloud/clawcloud-run/faq)、[账单说明](https://docs.run.claw.cloud/clawcloud-run/billing-and-usage)：官方检索摘要可读，直接抓取502，资格与价格保留待复核。
- [App Launchpad](https://docs.run.claw.cloud/clawcloud-run/guide/app-launchpad)、[持久存储](https://docs.run.claw.cloud/clawcloud-run/guide/app-launchpad/persistent-storage)、[部署示例与HTTPS](https://docs.run.claw.cloud/clawcloud-run/migration/migrate-from-docker)：官方文档支持能力判断，不证明本项目持久卷和线路已验收。
- [Cloudflare Workers价格](https://developers.cloudflare.com/workers/platform/pricing/)、[D1价格](https://developers.cloudflare.com/d1/platform/pricing/)、[R2开通](https://developers.cloudflare.com/r2/get-started/)：本轮正文读取。
- [Render免费服务](https://render.com/docs/free)：本轮读取官方页，区别于较旧博客中不同的数据库有效期。
- [Zeabur共享集群弃用](https://zeabur.com/docs/en-US/server/shared-cluster)、[当前价格](https://zeabur.com/pricing)：不按旧共享集群教程估算。
- [CloudBase HTTP网关默认域名](https://docs.cloudbase.net/service/introduce)：官方说明当前浏览器生产访问条件。
