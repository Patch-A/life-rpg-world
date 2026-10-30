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
// 找出所有 @media(max-width:760px) 块并拼在一起。
// 只取第一块是错的：globals.css 里有多块 760px 断点，手机规则可能落在任何一块。
const mobileCss=()=>{
  const mark='@media(max-width:760px){';
  const parts=[];
  for(let at=globals.indexOf(mark);at>-1;at=globals.indexOf(mark,at+1)){
    let depth=0,open=-1;
    for(let i=at;i<globals.length;i++){
      if(globals[i]==='{'){depth++;if(open<0)open=i;}
      else if(globals[i]==='}'){depth--;if(depth===0){parts.push(globals.slice(open+1,i));break;}}
    }
  }
  return parts.join('\n');
};
const mobile=mobileCss();
assert.ok(mobile.includes('{')||mobile.includes(':'),'globals.css 必须存在 760px 断点');

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

console.log('PASS 手机排版的样式与结构约束成立');
