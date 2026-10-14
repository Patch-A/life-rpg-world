'use client';
import {useEffect} from 'react';
export function H5SessionBoundary(){
 useEffect(()=>{function changed(event:StorageEvent){if(event.key!=='h5-account-change')return;try{for(const key of Object.keys(sessionStorage))if(key.startsWith('life-rpg-'))sessionStorage.removeItem(key);}catch{}window.location.reload();}function restored(event:PageTransitionEvent){if(event.persisted)window.location.reload();}window.addEventListener('storage',changed);window.addEventListener('pageshow',restored);return()=>{window.removeEventListener('storage',changed);window.removeEventListener('pageshow',restored);};},[]);
 return null;
}
