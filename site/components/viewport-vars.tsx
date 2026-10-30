'use client';
import {useEffect} from 'react';

/* 把「视觉视口」的尺寸与位置暴露成 CSS 变量。
   为什么需要：弹窗是 position:fixed + vh 定尺寸的，这些单位量的都是**布局视口**。
   手机双指/双击放大后，看得见的区域（视觉视口）会小很多，按钮却仍按布局视口定位，
   于是弹窗撑满整块可见区、关闭键和底部按钮落在屏幕外，而模态锁又会 preventDefault 掉
   touchmove，导致整页既拖不动也够不着。写到 CSS 变量里，弹窗就能贴着看得见的区域排版。
   顺带解决了安卓软键盘顶起时弹窗被遮住的问题。 */
export function ViewportVars(){
 useEffect(()=>{
  const root=document.documentElement;
  const apply=()=>{
   const vv=window.visualViewport;
   const h=vv?vv.height:window.innerHeight;
   const w=vv?vv.width:window.innerWidth;
   // 视觉视口为空或异常时不写入，让 CSS 里的 vh 兜底值生效。
   if(!(h>0)||!(w>0))return;
   root.style.setProperty('--vvh',`${Math.round(h)}px`);
   root.style.setProperty('--vvw',`${Math.round(w)}px`);
   root.style.setProperty('--vv-top',`${Math.round(vv?vv.offsetTop:0)}px`);
   root.style.setProperty('--vv-left',`${Math.round(vv?vv.offsetLeft:0)}px`);
   // 可见区实在太矮（大幅放大或软键盘顶起）时打个标记，让弹窗收起说明文字、收紧留白，
   // 把高度让给真正要操作的内容。CSS 没法直接对变量做媒体查询，所以由这里判断。
   if(h<400)root.dataset.vvh='short';else delete root.dataset.vvh;
  };
  apply();
  const vv=window.visualViewport;
  vv?.addEventListener('resize',apply);
  vv?.addEventListener('scroll',apply);
  window.addEventListener('resize',apply);
  window.addEventListener('orientationchange',apply);
  return ()=>{
   vv?.removeEventListener('resize',apply);
   vv?.removeEventListener('scroll',apply);
   window.removeEventListener('resize',apply);
   window.removeEventListener('orientationchange',apply);
  };
 },[]);
 return null;
}
