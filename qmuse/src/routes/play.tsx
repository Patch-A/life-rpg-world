import {createFileRoute} from '@tanstack/react-router';
import {useEffect} from 'react';
import Game from '../app/page';
function Play(){useEffect(()=>{function changed(e:StorageEvent){if(e.key==='life-rpg-qmuse-change'){for(const key of Object.keys(sessionStorage))if(key.startsWith('life-rpg-'))sessionStorage.removeItem(key);location.reload();}}function restored(e:PageTransitionEvent){if(e.persisted)location.reload();}window.addEventListener('storage',changed);window.addEventListener('pageshow',restored);return()=>{window.removeEventListener('storage',changed);window.removeEventListener('pageshow',restored);};},[]);return <><p className="qm-banner">妙思试用 · <a href="#/access">访客管理/删除数据</a> · <a href="#/about">AI与数据说明</a> · 照片上传暂不开放</p><Game/></>;}
export const Route=createFileRoute('/play')({component:Play});
