'use client';

import { useEffect, useRef, useState, useId } from 'react';
import type { CharacterController, CharacterGender } from './character-renderer';
import './character-3d.css';

export type Character3DProps = {
  gender: CharacterGender;
  outfit?: string;
  quiet?: boolean;
  paused?: boolean;
  className?: string;
  compact?: boolean;
};

/** Small clothing/profile cards stay vector-only, saving WebGL contexts and memory. */
export function CharacterPreview({ gender, outfit = 'explorer', className = '' }: Pick<Character3DProps, 'gender' | 'outfit' | 'className'>) {
  const id = useId().replace(/:/g, '');
  const female = gender === 'female';
  const suit = outfit === 'suit', dress = outfit === 'dress';
  return <svg className={`rpg-character-preview ${className}`} viewBox="0 0 180 230" role="img" aria-label={`${female ? '女' : '男'}角色，${suit ? '星光西装' : dress ? '月光礼裙' : '启程探索装'}预览`}>
    <defs>
      <linearGradient id={`${id}-skin`} x1="0" x2="1" y2="1"><stop stopColor="#f9ddbb"/><stop offset="1" stopColor="#d9a385"/></linearGradient>
      <linearGradient id={`${id}-cloth`} x1="0" x2="1" y2="1"><stop stopColor={suit ? '#565165' : '#b097dd'}/><stop offset="1" stopColor={suit ? '#262435' : '#635298'}/></linearGradient>
      <linearGradient id={`${id}-hair`} x1="0" x2="1" y2="1"><stop stopColor={female ? '#765465' : '#765447'}/><stop offset="1" stopColor="#352630"/></linearGradient>
    </defs>
    <ellipse cx="90" cy="214" rx="48" ry="9" fill="#120d25" opacity=".45"/>
    <ellipse cx="90" cy="210" rx="57" ry="12" fill="#332748" stroke="#a78bbd" strokeWidth="1.5"/>
    <path d="M72 160v37m35-37v37" stroke="#40314f" strokeWidth="19" strokeLinecap="round"/>
    <path d="M70 195l-9 6m48-6 9 6" stroke="#282436" strokeWidth="20" strokeLinecap="round"/>
    <path d="m62 112-9 45m64-45 10 45" stroke={dress ? '#edc09e' : suit ? '#403b50' : '#8a73bc'} strokeWidth="18" strokeLinecap="round"/>
    <circle cx="52" cy="161" r="9" fill={`url(#${id}-skin)`}/><circle cx="128" cy="161" r="9" fill={`url(#${id}-skin)`}/>
    <path d="M67 106q23-13 46 0l5 53q-28 14-56 0Z" fill={`url(#${id}-cloth)`}/>
    <path d="M83 95v11q7 8 14 0V95" fill={`url(#${id}-skin)`}/>
    {suit ? <><path d="m74 106 16 31 16-31" fill="#f4e4d0"/><path d="m72 104 18 33-19-16-8-5m45-8-18 29 19-16 8-5" fill="#5c4c6d"/><path d="m81 109 9 4 9-4v9l-9-4-9 4Z" fill="#dfb870"/><circle cx="90" cy="144" r="2" fill="#dfb870"/><circle cx="90" cy="153" r="2" fill="#dfb870"/></> : dress ? <><path d="M68 143h44q7 32 27 47-49 18-98 0 18-19 27-47Z" fill={`url(#${id}-cloth)`}/><path d="M44 189q46 16 92 0" fill="none" stroke="#c4adeb" strokeWidth="4"/><path d="m77 150-12 42m25-42v46m13-46 12 42" stroke="#c3a9e7" strokeWidth="2"/><path d="M67 143h46" stroke="#e9c17c" strokeWidth="5"/><path d="m78 108 12 12 12-12" stroke="#e6c384" strokeWidth="2.5" fill="none"/><circle cx="90" cy="120" r="3" fill="#91d9d1"/></> : <><path d="M69 103q20 21 43 1" stroke="#c8b2ea" strokeWidth="10" fill="none"/><path d="m98 111 9 23" stroke="#c8b2ea" strokeWidth="8"/><path d="M62 151h56" stroke="#473651" strokeWidth="7"/><rect x="86" y="147" width="10" height="8" rx="2" fill="#e1b676"/><path d="m68 116 5 33m38-33-5 33" stroke="#584264" strokeWidth="4"/></>}
    {female && <path d="M54 56q-9 48 6 67l16-7 30 1 17 6q14-37 1-67Z" fill={`url(#${id}-hair)`}/>}
    <ellipse cx="53" cy="75" rx="7" ry="10" fill="#e5b191"/><ellipse cx="127" cy="75" rx="7" ry="10" fill="#e5b191"/>
    <ellipse cx="90" cy="71" rx="37" ry="41" fill={`url(#${id}-skin)`}/>
    <path d={female ? 'M54 69q-9-41 37-44 44 0 37 45l-12-19q-8 5-24-9-15 16-29 13Z' : 'M53 63q-7-38 30-40l12 3q36-4 36 40l-12-16q-22 8-38-4-6 13-22 11Z'} fill={`url(#${id}-hair)`}/>
    {female && <><path d="M58 49q-10 36 2 59m63-59q10 36-2 59" stroke="#654454" strokeWidth="10" strokeLinecap="round"/><path d="m119 55 2-6 2 6 6 1-5 4 1 6-5-3-5 3 1-6-4-4Z" fill="#eac683"/></>}
    <path d="m70 63 10-2m20 0 10 2" stroke="#654542" strokeWidth="3" strokeLinecap="round"/>
    <ellipse cx="76" cy="75" rx="7" ry="9" fill="#fff6e8"/><ellipse cx="104" cy="75" rx="7" ry="9" fill="#fff6e8"/>
    <ellipse cx="77" cy="76" rx="4.5" ry="6.5" fill="#513946"/><ellipse cx="103" cy="76" rx="4.5" ry="6.5" fill="#513946"/>
    <circle cx="75" cy="73" r="2" fill="#fff"/><circle cx="101" cy="73" r="2" fill="#fff"/>
    <ellipse cx="66" cy="85" rx="6" ry="2.5" fill="#db9691" opacity=".6"/><ellipse cx="114" cy="85" rx="6" ry="2.5" fill="#db9691" opacity=".6"/>
    <path d="m88 82 2 3 3-2" stroke="#cf9b80" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M83 93q7 5 14 0" stroke="#a7626e" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="m78 130 2-5 2 5 5 1-4 3 1 5-4-2-4 2 1-5-4-3Z" fill="#e9c07c"/>
  </svg>;
}

export function Character3D({ gender, outfit = 'explorer', quiet = false, paused = false, className = '', compact = false }: Character3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<CharacterController | null>(null);
  const current = useRef({ gender, outfit, quiet, paused });
  const visibleRef = useRef(false);
  const pointer = useRef<{ id: number; x: number; startX: number; startY: number; moved: boolean; axis: 'pending' | 'horizontal' | 'vertical' } | null>(null);
  const [state, setState] = useState<'waiting' | 'loading' | 'ready' | 'fallback'>('waiting');
  const [retry, setRetry] = useState(0);
  const statusId = useId();

  useEffect(() => { current.current = { gender, outfit, quiet, paused }; }, [gender, outfit, quiet, paused]);

  useEffect(() => {
    let cancelled = false, loading = false, visible = false;
    const host = hostRef.current, canvas = canvasRef.current;
    if (!host || !canvas) return;
    const fail = () => {
      if (cancelled) return;
      controllerRef.current?.dispose();
      controllerRef.current = null;
      setState('fallback');
    };
    const initialize = async () => {
      if (loading || controllerRef.current || cancelled) return;
      loading = true;
      setState('loading');
      try {
        const { createCharacterRenderer } = await import('./character-renderer');
        if (cancelled) return;
        const { gender, outfit, quiet } = current.current;
        const controller = createCharacterRenderer(canvas, { gender, outfit, quiet, onError: fail });
        controllerRef.current = controller;
        controller.setVisible(visible && !current.current.paused);
        setState('ready');
      } catch { fail(); }
      finally { loading = false; }
    };
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      visibleRef.current = visible;
      controllerRef.current?.setVisible(visible && !current.current.paused);
      if (visible) void initialize();
    }, { threshold: .01 }) : null;
    if (observer) observer.observe(host); else { visible = true; visibleRef.current = true; void initialize(); }
    return () => {
      cancelled = true;
      observer?.disconnect();
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, [retry]);

  useEffect(() => { controllerRef.current?.setCharacter(gender, outfit); }, [gender, outfit]);
  useEffect(() => { controllerRef.current?.setQuiet(quiet); }, [quiet]);
  useEffect(() => { controllerRef.current?.setVisible(visibleRef.current && !paused); }, [paused]);

  return <div ref={hostRef} className={`rpg-character3d ${compact ? 'rpg-character3d--compact' : ''} ${className}`}>
    <div className="rpg-character3d__halo" aria-hidden="true"/>
    <span className="rpg-character3d__badge">{state === 'ready' ? '实时 3D 角色' : '你的成长角色'}</span>
    <div className="rpg-character3d__viewport" role="group" aria-label={`${gender === 'female' ? '女' : '男'}角色三维展示`} aria-describedby={statusId} tabIndex={state === 'ready' ? 0 : -1}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); controllerRef.current?.turn(event.key === 'ArrowLeft' ? -.35 : .35);
        } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); controllerRef.current?.wave(); }
        else if (event.key === 'Home') { event.preventDefault(); controllerRef.current?.reset(); }
      }}
      onPointerDown={event => {
        if (state !== 'ready' || (event.pointerType === 'mouse' && event.button !== 0)) return;
        pointer.current = { id: event.pointerId, x: event.clientX, startX: event.clientX, startY: event.clientY, moved: false, axis: 'pending' };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const drag = pointer.current;
        if (!drag || drag.id !== event.pointerId) return;
        const dx = event.clientX - drag.x;
        const distanceX = Math.abs(event.clientX - drag.startX), distanceY = Math.abs(event.clientY - drag.startY);
        if (distanceX + distanceY > 6) {
          drag.moved = true;
          if (drag.axis === 'pending') drag.axis = distanceX >= distanceY ? 'horizontal' : 'vertical';
        }
        if (drag.axis === 'horizontal') controllerRef.current?.turn(dx * .012);
        drag.x = event.clientX;
      }}
      onPointerUp={event => {
        const drag = pointer.current;
        if (drag?.id !== event.pointerId) return;
        if (!drag.moved) controllerRef.current?.wave();
        pointer.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { pointer.current = null; }} onLostPointerCapture={() => { pointer.current = null; }}>
      <canvas key={retry} ref={canvasRef} className="rpg-character3d__canvas" aria-hidden="true" style={{ visibility: state === 'ready' ? 'visible' : 'hidden' }}/>
      {state !== 'ready' && <div className="rpg-character3d__placeholder">
        <CharacterPreview gender={gender} outfit={outfit}/>
        {state === 'loading' && <span className="rpg-character3d__loading">正在唤醒角色…</span>}
      </div>}
    </div>
    <div className="rpg-character3d__footer">
      <p id={statusId} className="rpg-character3d__hint" aria-live="polite">{state === 'ready' ? '左右拖动转身 · 点击角色挥手' : state === 'fallback' ? '3D 暂时无法显示，已切换为角色预览' : '角色进入视野后加载'}</p>
      {state === 'ready' ? <div className="rpg-character3d__controls">
        <button type="button" onClick={() => controllerRef.current?.wave()} aria-label="让角色挥手打招呼">挥手</button>
        <button type="button" onClick={() => controllerRef.current?.reset()} aria-label="恢复角色正面视角">回到正面</button>
      </div> : state === 'fallback' ? <button type="button" className="rpg-character3d__retry" onClick={() => { setState('waiting'); setRetry(value => value + 1); }}>重试 3D</button> : null}
    </div>
  </div>;
}
