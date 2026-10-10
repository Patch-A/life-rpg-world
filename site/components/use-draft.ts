'use client';
import {useEffect,useRef,useState} from 'react';

// Keep a draft through closing a dialog or a same-tab sign-in redirect.
export function useDraft<T extends object>(key:string,initial:T){
 const [value,setValue]=useState(initial),[ready,setReady]=useState(false),[restored,setRestored]=useState(false);
 const cleared=useRef(false);
 useEffect(()=>{cleared.current=false;setReady(false);setValue(initial);setRestored(false);try{const old=sessionStorage.getItem(key);if(old){setValue({...initial,...JSON.parse(old)});setRestored(true);}}catch{}setReady(true);},[key]);
 useEffect(()=>{if(ready&&!cleared.current)try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}},[value,key,ready]);
 function clear(){cleared.current=true;try{sessionStorage.removeItem(key);}catch{}}
 return {value,setValue,clear,restored};
}
