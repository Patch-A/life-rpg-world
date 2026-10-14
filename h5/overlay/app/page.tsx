import './submission.css';
export const dynamic='force-dynamic';
export default function Submission(){
 const ai=process.env.AI_ENABLED==='true'&&!!process.env.DEEPSEEK_API_KEY;
 return <main className="submission-shell">
  <header className="submission-header"><a href="/" className="submission-brand">人生 RPG<span>成长星球</span></a><a href="/about">试用说明</a></header>
  <section className="submission-intro"><div className="submission-copy"><p className="submission-edition">H5 参赛试用版</p><h1>把想做的事，<br/>变成今天的一小步。</h1><p className="submission-lead">目标太大时，先找到一个做得完的行动。记下真实进展，让下一步有据可依。</p><div className="submission-actions"><a className="primary" href="/demo">先体验演示</a><a className="secondary" href="/access">受邀真实试用</a></div><p className="submission-status">{ai?'真实 AI 已启用，受邀用户按额度使用。':'当前真实 AI 尚未启用；演示为固定虚构样例。'}<br/>演示无需登录；个人记录仅在独立试用账号下保存。</p></div><img className="submission-world" src="/world.jpg" alt="由山脉、海湾与城镇组成的人生成长星球" fetchPriority="high"/></section>
  <section className="submission-flow" aria-labelledby="flow-title"><h2 id="flow-title">从一个目标，走到下一次行动</h2><ol><li><strong>说清想做什么</strong><p>写下学习、创作或个人项目目标，以及你能投入的时间。</p></li><li><strong>自己选择下一步</strong><p>修改、拒绝或确认 AI 建议；确认之后才成为你的行动。</p></li><li><strong>记录后再调整</strong><p>记录实际发生的事，复盘引用这些记录，继续安排下一步。</p></li></ol></section>
  <footer className="submission-footer"><p>目前面向成年人的小范围试用。建议需要你判断，AI 不会替你判定完成或增加经验。</p><a href="/about">数据、额度与反馈说明</a><span>未接入支付宝授权、支付或小程序。</span></footer>
 </main>;
}
