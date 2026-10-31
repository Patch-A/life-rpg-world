'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {Volume2} from 'lucide-react';
import {Treant, type TreantState} from './treant';
import './assistant-scene.css';

export type AssistantPosture = 'companion' | 'counselor';

export interface AssistantSceneProps {
  /** 陪伴者（坐低、语速慢）或咨询师（站直、光更亮）。 */
  posture: AssistantPosture;
  /** 记录官当前要说的话；变化且 speaking 为真时朗读一次。 */
  line: string;
  /** 记录官是否处于说话状态；只用来判断是否朗读，不直接控制动画。 */
  speaking: boolean;
  /** 任务 9 的对话区回调；组件内部也会重新朗读当前 line。 */
  onReplay: () => void;
  /** 正在等模型回复。等多久，树人就转多久。 */
  thinking?: boolean;
  /** 麦克风开着。语音输入还没接上时传 false。 */
  listening?: boolean;
}

export function AssistantScene({posture, line, speaking, onReplay, thinking = false, listening = false}: AssistantSceneProps) {
  const [reading, setReading] = useState(false);
  const lastRead = useRef('');
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  // brief 基线 rate=.95；按裁定：陪伴者更慢（.9），咨询师常规（1）。
  const rate = posture === 'companion' ? 0.9 : 1;

  const speak = useCallback((text: string, force: boolean) => {
    if (!text || typeof window === 'undefined') return;
    if (typeof window.speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
    if (!force && lastRead.current === text) return;
    try {
      if (window.localStorage.getItem('life-rpg-voice') === '0') return;
    } catch {
      // 隐私模式读取 localStorage 会抛错，按「未关闭朗读」处理。
    }
    lastRead.current = text;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = rate;
      currentUtterance.current = utterance;
      utterance.onstart = () => { if (currentUtterance.current === utterance) setReading(true); };
      utterance.onend = () => { if (currentUtterance.current === utterance) { currentUtterance.current = null; setReading(false); } };
      utterance.onerror = () => { if (currentUtterance.current === utterance) { currentUtterance.current = null; setReading(false); } };
      // 浏览器可能因为没有用户手势拒绝自动朗读：静默失败，只影响声音，不影响画面。
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      currentUtterance.current = null;
    }
  }, [rate]);

  // 只在 line 变化且 speaking 为真时触发朗读；lastRead 保证同一句话不会因 speaking 反复切换而重读。
  useEffect(() => {
    if (speaking) speak(line, false);
  }, [line, speaking, speak]);

  // 卸载时停掉朗读，避免用户切页后声音还在读。
  useEffect(() => () => {
    currentUtterance.current = null;
    if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') return;
    window.speechSynthesis.cancel();
  }, []);

  const replay = () => {
    onReplay();
    speak(line, true);
  };

  // 状态只认「真的在出声」的 reading，不认外层那个一次性信号 speaking。
  // speaking 是被 page.tsx 在下一个 tick 就复位的触发器（见那边的注释），拿它驱动动画
  // 只有一帧，等于没有；而且朗读被关掉时它也会闪一下，等于在骗人。
  const treantState: TreantState = listening ? 'listening' : reading ? 'speaking' : thinking ? 'thinking' : 'idle';

  // data-season 预留季节位：V1 固定 'none'，后续季节变化只改这里的值，样式按属性呼应。
  return (
    <section
      className="assistant-scene"
      data-posture={posture}
      data-season="none"
      aria-label="记录官"
    >
      <div className="assistant-scene__sky" aria-hidden="true"/>
      <div className="assistant-scene__halo" aria-hidden="true"/>
      <div className="assistant-scene__pedestal" aria-hidden="true"/>
      <div className="assistant-scene__actor">
        <Treant state={treantState}/>
      </div>
      <button type="button" className="assistant-scene__touch" onClick={replay} aria-label="再听记录官说一次"/>
      {/* 气泡常驻，让 role=status 在文本变化前就存在于无障碍树里；没有台词时只做透明处理。 */}
      <div className={`assistant-scene__bubble${line ? '' : ' assistant-scene__bubble--quiet'}`}>
        <p className="assistant-scene__line" role="status">{line}</p>
      </div>
      <button
        type="button"
        className="assistant-scene__replay"
        onClick={replay}
        aria-label="重新朗读记录官的话"
        aria-pressed={reading}
      >
        <Volume2 size={16}/>
        <span className="assistant-scene__replay-label">{reading ? '朗读中' : '重读'}</span>
      </button>
    </section>
  );
}
