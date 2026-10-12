import type { Metadata } from 'next';
import './globals.css';
import './assistant.css';
export const metadata:Metadata={title:'人生RPG · 成长星球',description:'让现实中的每一小步，点亮你的人生星球。',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN" className="dark"><body>{children}</body></html>}
