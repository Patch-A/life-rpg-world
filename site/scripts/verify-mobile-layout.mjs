// 手机排版：只核对样式表与页面结构，不涉及运行时渲染。
// 真机验收另做，这里证明不了「手机上好看」，只能证明「该有的规则在、该被覆盖的被覆盖」。
process.on('uncaughtException',e=>{console.error(String(e.stack||e).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'[module]'));process.exit(1);});
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const globals=source('app/globals.css');
const charCss=source('components/character-2d.css');
const page=source('app/page.tsx');
const memCss=source('components/memory-list.css');

// 取出某个选择器在 text 里第 n 次出现时后面那段声明块。找不到返回空串，
// 由调用方先断言「找到了」——本项目反复踩到「在空串上断言」的坑：
// 空串 .includes(...) 恒 false，空串上的正则恒不匹配，两种都会把「规则不存在」伪装成「规则写错了」。
const nthBlock=(text,selector,nth=0)=>{
  // 选择器参数里常带结尾的 `{`，先剥掉：带着它去找 `{` 会定位到下一条规则的左括号，
  // 于是返回的是「下一条规则的内容」，断言就检查了错的对象。
  const needle=selector.replace(/\{$/,'');
  let at=-1;
  for(let i=0;i<=nth;i++){
    at=text.indexOf(needle,at+1);
    if(at<0)return '';
  }
  const open=text.indexOf('{',at+needle.length);
  if(open<0)return '';
  const close=text.indexOf('}',open);
  return close<0?'':text.slice(open+1,close);
};
// 找出 css 里所有 `@media(max-width:<mark>px){...}` 块的内容并拼在一起。
// 只取第一块是错的：globals.css 里有多块 760px 断点，手机规则可能落在任何一块。
const mediaBlocks=(css,mark)=>{
  const needle=`@media(max-width:${mark}px){`;
  const parts=[];
  for(let at=css.indexOf(needle);at>-1;at=css.indexOf(needle,at+1)){
    let depth=0,open=-1;
    for(let i=at;i<css.length;i++){
      if(css[i]==='{'){depth++;if(open<0)open=i;}
      else if(css[i]==='}'){depth--;if(depth===0){parts.push(css.slice(open+1,i));break;}}
    }
  }
  return parts.join('\n');
};
const mobile=mediaBlocks(globals,760);
assert.ok(mobile.trim().length>0,'globals.css 必须存在 760px 断点');

// 从声明块里取一条属性的数值，换算成 px（1rem = 16px）。取不到返回 NaN——
// NaN 和任何阈值比较都是 false，断言会红，不会静默通过。
const pxOf=(block,prop)=>{
  const m=block.match(new RegExp(`(?:^|[;{\\s])${prop}:\\s*([\\d.]+)(px|rem)`));
  if(!m)return NaN;
  const n=Number(m[1]);
  return m[2]==='rem'?n*16:n;
};
// 在某个断点块里找出选择器对应的所有声明块，按出现顺序返回。
// 一个选择器在一个断点里可以出现多次（`.a,.b{max-width}` 在前、`.a{font-size}` 在后），
// 只取第一条会漏掉真正设了字号的那条。
const rulesIn=(css,selector)=>{
  const esc=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp(`(?:^|[,}\\n])\\s*${esc}\\s*(?=[,{])`,'g');
  const out=[];
  for(let hit=re.exec(css);hit;hit=re.exec(css)){
    const open=css.indexOf('{',hit.index+hit[0].length);
    if(open<0)continue;
    if(css.lastIndexOf('}',open)>hit.index)continue;
    const close=css.indexOf('}',open);
    if(close<0)continue;
    out.push(css.slice(open+1,close));
  }
  return out;
};

// 「我的」页人物面板：手机断点里必有一条带 grid-template-areas 的 .character-panel 规则。
// 同一个选择器在别的断点里还有「只改 padding」的版本，所以要按「哪一块里有 areas」来定位。
const panelBlock=[...mobile.matchAll(/\.character-panel\{([^}]*)\}/g)].map(m=>m[1]).find(r=>r.includes('grid-template-areas'));
assert.ok(panelBlock,'手机断点必须把「我的」页人物面板排成横向卡片，否则首屏只有人物');
assert.ok(/grid-template-columns:\s*\d+px\s+minmax\(0,1fr\)/.test(panelBlock),'横向卡片必须是「定宽人物 + 可伸缩信息」两列');
const rows=(panelBlock.match(/grid-template-areas:[^;]*/)||[''])[0].match(/"([^"]*)"/g)||[];
assert.ok(rows.length>=2,'横向卡片必须显式写 grid-template-areas，把表头与「人物 + 信息」分成两行');
const [headRow,bodyRow]=rows.map(r=>r.replace(/"/g,'').trim().split(/\s+/));
assert.ok(headRow.length===2,'第一行应是通栏表头（同一名字出现两次）');
assert.ok(bodyRow.length===2&&bodyRow[0]!==bodyRow[1],`人物与信息必须在同一行且各占一列，实际第二行是「${bodyRow.join(' ')}」`);

// 人物场景高度：手机断点里必须覆盖，且桌面值不受影响。
const sceneMobile=[...mobile.matchAll(/\.profile-character \.rpg-character2d__scene\{([^}]*)\}/g)].map(m=>m[1])[0];
assert.ok(sceneMobile,'手机断点必须覆盖「我的」页人物场景高度');
const sceneH=Number((sceneMobile.match(/height:\s*(\d+)px/)||[])[1]);
assert.ok(sceneH>0,'人物场景高度必须是具体像素');
assert.ok(sceneH<=200,`手机人物场景必须压到 200px 以内，实际 ${sceneH}px：否则首屏只剩人物`);
const sceneGlobal=nthBlock(charCss,'.rpg-character2d__scene{');
assert.ok(sceneGlobal.length>0,'character-2d.css 必须保留场景高度规则');
assert.ok(sceneGlobal.includes('height:430px'),'桌面场景高度不应因手机规则改变');

// 菜单先于展示：手机上「人生档案与设置」必须排到同列其它面板之前。
const settingsRule=nthBlock(mobile,'.profile-settings{');
assert.ok(settingsRule.length>0,'手机断点必须有「人生档案与设置」的排序规则');
assert.ok(/order:\s*-\d/.test(settingsRule),'手机上「人生档案与设置」必须排到同列其它面板之前');
// order 作用在一个页面里根本不存在的类上，等于没写。
assert.ok(page.includes('<section className="panel profile-settings">'),'页面里必须有 profile-settings 类：没有它，order 规则是死规则');
assert.equal(page.includes('<section className="panel"><h2>人生档案与设置</h2>'),false,'「人生档案与设置」的旧 class 组合不应残留，否则排序规则命中不到');

// 死规则会骗人：@media 里那条 .character-art{height:340px} 指向一个没有任何组件渲染的类名，
// 留着它会让人以为手机端已有高度覆盖，实际覆盖的是空气。
assert.equal(/\.character-art\s*\{/.test(globals),false,'不得保留 .character-art 规则：没有组件渲染这个类名，它只会误导排查');

// 记忆弹窗：「全部清空」必须一直可见。
// 让整个弹窗滚动时按钮落在滚动区之外（手机实测按钮 y=920，视口 844），用户找不到撤销入口。
const factsRules=[...memCss.matchAll(/\.memory-facts\{([^}]*)\}/g)].map(m=>m[1]);
assert.ok(factsRules.length>=2,`memory-list.css 必须有两条 .memory-facts 规则（布局 + 滚动容器），实际 ${factsRules.length} 条`);
const scroller=factsRules.find(r=>r.includes('overflow-y'));
assert.ok(scroller,'卡片列表必须自己是滚动容器');
assert.ok(/max-height:\s*min\(/.test(scroller),'滚动容器必须限制高度，否则它永远不滚动');
assert.ok(scroller.includes('overscroll-behavior:contain'),'滚动容器必须拦住滚动穿透，否则滑到底会带动弹窗后的页面');
const memTsx=source('components/memory-list.tsx');
assert.ok(memTsx.includes('onClearAll'),'清空按钮必须由弹窗容器提供回调，才能留在卡片滚动区之外');
assert.equal(/window\.confirm/.test(memTsx),false,'不得用 window.confirm 替代页面级确认框');

// 6. 字号下限。桌面把标签写成 .65~.77rem（10.4~12.3px）在 390 宽的屏上就是「所有内容都很小」，
//    390×844 实测正文 13.5px、按钮 12.5px，用户的原话是要凑近看。这里按像素值卡下限，
//    而不是检查字符串里有没有某个字号——改大改小都要落在阈值内，否则红。
const chatCss=source('components/chat-room.css');
const chatMobile=mediaBlocks(chatCss,600);
assert.ok(chatMobile.trim().length>0,'chat-room.css 必须有 600px 断点：聊天是主界面，手机字号得单独定');
const readPx=(css,selector,prop,label)=>{
  const blocks=rulesIn(css,selector);
  assert.ok(blocks.length>0,`${label}：断点里必须有 ${selector} 规则`);
  // 层叠里最后一条声明生效，所以取「声明了这条属性的最后一块」。
  const withProp=blocks.filter(b=>Number.isFinite(pxOf(b,prop)));
  assert.ok(withProp.length>0,`${label}：${selector} 必须显式写出 ${prop}，否则继承桌面值就是小字`);
  return pxOf(withProp[withProp.length-1],prop);
};
const bubbleFs=readPx(chatMobile,'.chat-room__bubble','font-size','聊天气泡');
assert.ok(bubbleFs>=15,`手机聊天气泡正文必须 ≥15px，实际 ${bubbleFs}px`);
for(const sel of ['.chat-room__claim','.chat-room__keep','.chat-room__undo','.chat-room__delete']){
  const fs=readPx(chatMobile,sel,'font-size','记录上的操作按钮');
  assert.ok(fs>=14,`手机上 ${sel} 文字必须 ≥14px，实际 ${fs}px`);
  const h=readPx(chatMobile,sel,'min-height','记录上的操作按钮');
  assert.ok(h>=44,`手机上 ${sel} 触控高度必须 ≥44px，实际 ${h}px：40px 以下手指点不准`);
}
const exportH=readPx(chatMobile,'.chat-room__export','min-height','导出按钮');
assert.ok(exportH>=44,`手机上导出按钮触控高度必须 ≥44px，实际 ${exportH}px`);
const metaFs=readPx(chatMobile,'.chat-room__record-meta','font-size','记录元信息');
assert.ok(metaFs>=13,`手机记录元信息必须 ≥13px，实际 ${metaFs}px`);
const sceneMobileCss=mediaBlocks(source('components/assistant-scene.css'),600);
const lineFs=readPx(sceneMobileCss,'.assistant-scene__bubble','font-size','记录官的话');
assert.ok(lineFs>=13.5,`手机上记录官的话必须 ≥13.5px，实际 ${lineFs}px`);
// 台词超过 3 行时，原来 max-height+overflow:auto 会把句子切一半、还给一条滚动条；
// 完整台词本来就出现在下方聊天流里，这里只该是预览，用省略号收尾。
assert.ok(!/\.assistant-scene__bubble\{[^}]*overflow:\s*auto/.test(sceneMobileCss),'记录官气泡不得在手机上做内部滚动：会切半句并冒出滚动条');
const lineClamp=[...sceneMobileCss.matchAll(/\.assistant-scene__line\{([^}]*)\}/g)].map(m=>m[1])[0];
assert.ok(lineClamp,'手机断点必须给记录官台词加截断规则');
assert.ok(/-webkit-line-clamp:\s*[1-4]/.test(lineClamp),`台词截断必须限定在 1–4 行内，实际「${lineClamp}」`);
assert.ok(lineClamp.includes('overflow:hidden'),'台词截断必须配合 overflow:hidden，否则省略号不出现');
// globals 里的标签类：手机断点里必须抬到 12.5px 以上。
// 成长页这几条是中文正文（「认知领域」「已点亮」「每段旅程都始于第一步」「0/5 次」），
// 不是装饰行；.eyebrow 在别的页面是英文装饰，但成长页往里放中文，所以一并卡下限。
for(const sel of ['.chapter-tag','.level-pill','.xp-strip','.task-meta .reward','.bag-grid small','.save-foot','.private-label',
  '.eyebrow','.region-progress','.node-state','.journey-node small','.skill-row small']){
  const fs=readPx(mobile,sel,'font-size',`手机标签 ${sel}`);
  assert.ok(fs>=12.5,`手机上 ${sel} 必须 ≥12.5px，实际 ${fs}px`);
}
// 桌面字号不得被顺手改掉：抬字号只发生在手机断点里。
const deskMeta=nthBlock(chatCss,'.chat-room__record-meta{');
assert.ok(deskMeta.includes('11.5px'),'桌面记录元信息字号应保持 11.5px：手机字号只在 600px 断点里抬');

// 触控目标下限：手机上小到点不准的控件，和「点了没反应」是同一件事。
// 弹窗关闭键原来只有 16×26（实测），在右上角单手最难够到的地方；
// 开关视觉尺寸 32×18，但必须有一个 44px 高的透明命中区，否则只有轨道本身可点。
const dlgTsx=source('components/ui/dialog.tsx');
assert.ok(/right-2 grid size-11 place-items-center/.test(dlgTsx),'弹窗关闭键必须有 44×44 的触控区，不能只有图标本身大');
const switchHit=[...mobile.matchAll(/\[data-slot=switch\]:after\{([^}]*)\}/g)].map(m=>m[1])[0];
assert.ok(switchHit,'手机断点必须给开关补一条 44px 高的命中区规则');
assert.ok(/height:\s*44px/.test(switchHit),`开关命中区必须 44px 高，实际「${switchHit}」`);

console.log('PASS 手机排版的样式与结构约束成立');