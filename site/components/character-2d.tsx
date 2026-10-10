'use client';

import {useEffect, useRef, useState} from 'react';
import {Expand, Heart, Sparkles, UserRound} from 'lucide-react';
import type {AvatarId} from '@/lib/appearance';
import {characterArt, characterDescription} from '@/lib/character-art';
import './character-2d.css';

type Appearance = {gender: AvatarId; outfit?: string; className?: string};
type CharacterProps = Appearance & {quiet?: boolean; paused?: boolean; compact?: boolean};
const greetings = ['今天的小小进步，也值得被看见。', '不用赶路，我们一步一步来。', '准备好了吗？去完成今天的一件小事。'];

// Key each loader by its source so switching outfits cannot retain an old error.
function Artwork({src, alt, portrait = false, retryable = false}: {src: string; alt: string; portrait?: boolean; retryable?: boolean}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth) setStatus('ready');
    const timer = window.setTimeout(() => setStatus(s => s === 'loading' ? 'error' : s), 15000);
    return () => window.clearTimeout(timer);
  }, [attempt]);
  return <span className={`rpg-art rpg-art--${status}`}>
    <img ref={img} src={`${src}${attempt ? `?retry=${attempt}` : ''}`} alt={alt} width={portrait ? 200 : 768} height={portrait ? 220 : 1152} decoding="async" draggable={false} onLoad={() => setStatus('ready')} onError={() => setStatus('error')}/>
    {status !== 'ready' && <span className="rpg-art__status" role="status"><UserRound size={24}/><span>{status === 'loading' ? '载入形象…' : '形象暂未载入'}</span>{status === 'error' && retryable && <button type="button" onClick={() => {setStatus('loading'); setAttempt(n => n + 1);}}>重新加载</button>}</span>}
  </span>;
}

export function CharacterPreview({gender, outfit = 'explorer', className = '', portrait = false}: Appearance & {portrait?: boolean}) {
  const src = characterArt(gender, outfit, portrait);
  return <span className={`rpg-character-preview ${portrait ? 'rpg-character-preview--portrait' : ''} ${className}`}><Artwork key={src} src={src} alt={characterDescription(gender, outfit)} portrait={portrait}/></span>;
}

export function Character2D(props: CharacterProps) {
  return <CharacterScene key={`${props.gender}-${props.outfit || 'explorer'}`} {...props}/>;
}

function CharacterScene({gender, outfit = 'explorer', quiet = false, paused = false, compact = false, className = ''}: CharacterProps) {
  const [zoom, setZoom] = useState(false);
  const [speech, setSpeech] = useState('');
  const [hidden, setHidden] = useState(false);
  const count = useRef(0);
  const src = characterArt(gender, outfit);
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    change(); document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => {
    if (!speech) return;
    const timer = window.setTimeout(() => setSpeech(''), 5000);
    return () => window.clearTimeout(timer);
  }, [speech]);
  const hello = () => setSpeech(greetings[count.current++ % greetings.length]);
  return <section className={`rpg-character2d ${compact ? 'rpg-character2d--compact' : ''} ${zoom ? 'rpg-character2d--close' : ''} ${quiet || paused || hidden ? 'rpg-character2d--still' : ''} ${className}`} aria-label="角色展示">
    <div className="rpg-character2d__scene">
      <span className="rpg-character2d__badge"><Sparkles size={13}/>星光营地</span>
      <div className="rpg-character2d__halo" aria-hidden="true"/>
      <div className="rpg-character2d__pedestal" aria-hidden="true"/>
      <div className="rpg-character2d__actor"><Artwork key={src} src={src} alt={characterDescription(gender, outfit)} retryable/></div>
      <button type="button" className="rpg-character2d__touch" onClick={hello} disabled={paused} aria-label="与角色打招呼"/>
      {speech && <div className="rpg-character2d__speech" role="status">{speech}</div>}
    </div>
    <div className="rpg-character2d__controls"><button type="button" onClick={hello} disabled={paused}><Heart size={15}/>打个招呼</button><button type="button" onClick={() => setZoom(z => !z)} disabled={paused} aria-pressed={zoom}><Expand size={15}/>{zoom ? '查看全身' : '靠近看看'}</button></div>
  </section>;
}
