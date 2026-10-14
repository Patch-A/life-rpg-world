import type {Metadata,Viewport} from 'next';
import './globals.css';
import './assistant.css';
import {H5SessionBoundary} from '@/components/h5-session-boundary';
export const metadata:Metadata={title:'人生RPG · 成长星球｜H5参赛版',description:'把想做的事变成今天的一小步，记录真实行动，再决定下一步。',icons:{icon:'/favicon.svg'}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#090d1b'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN" className="dark"><body><H5SessionBoundary/>{children}</body></html>;}
