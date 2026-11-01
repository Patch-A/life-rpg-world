import {createFileRoute} from '@tanstack/react-router';
import {useRef,useState} from 'react';
import Page from '@/app/page';
import {blank,day,normalizeGame,type Game} from '@/lib/game';

function fixture():Game{
 const state=blank();
 const earlier=new Date(Date.now()-3600000);
 state.profile={name:'星球探索者',focus:'career',createdAt:'2026-10-01T00:00:00.000Z',gender:'female',avatarId:'female'};
 state.goals=[{id:'preview-goal',title:'完成我的第一个创作',domain:'career',target:60,unit:'分钟',deadline:'',paused:false,createdAt:state.profile.createdAt}];
 state.tasks=[{id:'preview-task',title:'写出作品的三个想法',domain:'career',target:10,unit:'分钟',repeat:true,goalId:'preview-goal',archived:false,completionCriteria:'写下三个想法，其中至少一个是自己想尝试的。'}];
 state.logs=[{id:'preview-old',taskId:'preview-task',title:'整理过去的灵感',domain:'career',value:5,unit:'分钟',goalId:'preview-goal',xp:0,date:day(earlier),at:earlier.toISOString(),undone:false,note:'我发现自己更想表达一个小故事，而不是一次做很多功能。',source:'manual'}];
 return state;
}

function Preview(){
 const snapshot=useRef<Game>(fixture());
 const failNext=useRef(false);
 const [epoch,setEpoch]=useState(0);
 const [message,setMessage]=useState('演示进度在页面内存中，刷新会重置；表单草稿可能暂存在当前标签页。');
 function reread(){snapshot.current=normalizeGame(JSON.parse(JSON.stringify(snapshot.current)));setEpoch(n=>n+1);setMessage('已序列化并重新读取同一份虚构存档，可再次进入营地核对选择和回响。');}
 function reset(){snapshot.current=fixture();failNext.current=false;setEpoch(n=>n+1);setMessage('已重置虚构示例，可体验另一个启程方向。');}
 return <><div className="camp-preview-tools"><button onClick={reread}>模拟重读这份演示存档</button><button onClick={reset}>重置虚构示例</button><button onClick={()=>{failNext.current=true;setMessage('下一次保存会模拟失败，用于核对预览和输入是否保留。');}}>模拟下次保存失败</button><span role="status">{message}</span></div><Page key={epoch} preview={{state:snapshot.current,onChange:s=>{snapshot.current=s;setMessage('虚构进度已更新，可重读检查；未写入云端。');},allowAction:()=>{if(failNext.current){failNext.current=false;setMessage('已模拟一次保存失败，下面的选择与输入应保留，可以重试。');return false;}return true;}}}/></>;
}

function DevelopmentPreview(){return import.meta.env.DEV?<Preview/>:<main className="info-page panel"><h1>开发预览未开放</h1><a href="#/">返回作品首页</a></main>;}
export const Route=createFileRoute('/journey-preview')({component:DevelopmentPreview});
