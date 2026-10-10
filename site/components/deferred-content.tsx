'use client';
import {Component,Suspense,type ReactNode} from 'react';

class ContentRecovery extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div className="art-load-error" role="alert"><p>这部分内容暂时未能加载。</p><p className="note">已保存的进度仍在。未提交的表单草稿可在本次浏览器会话中恢复。</p><button type="button" className="secondary" onClick={()=>window.location.reload()}>重新加载页面</button></div>:this.props.children;}
}
export function DeferredContent({children,fallback}:{children:ReactNode;fallback:ReactNode}){return <ContentRecovery><Suspense fallback={fallback}>{children}</Suspense></ContentRecovery>;}
