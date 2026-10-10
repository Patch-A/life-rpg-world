'use client';
import {useState} from 'react';
export function LifeArt({src,alt,className}:{src:string;alt:string;className?:string}){
 const [failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 return <><img src={src+(retry?'?retry='+retry:'')} alt={alt} className={className} decoding="async" loading="lazy" width={1200} height={943} style={failed?{display:'none'}:undefined} onLoad={()=>setFailed(false)} onError={()=>setFailed(true)}/>{failed&&<div className="art-load-error" role="status"><span>{alt}暂时未能加载</span><button type="button" className="secondary compact" onClick={()=>{setRetry(retry+1);setFailed(false);}}>重新加载图片</button></div>}</>;
}
