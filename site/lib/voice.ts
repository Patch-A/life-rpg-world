// 按住说话用的 Web Speech 封装。
//
// 为什么单独一个文件：`SpeechRecognition` 不是所有环境都有，而且**缺 API 的两种原因要分开说**，
// 否则又会变成上次那种「明明没发请求，却报网络连接失败」的误导性提示。
//
//   1. 浏览器根本没有这个 API —— 旧内核（荣耀那台系统浏览器是百度内核 Chrome/97）可能没有。
//   2. 有 API，但这个地址用不了 —— Chrome 只在**安全上下文**（https 或 localhost）里允许语音识别。
//      `http://192.168.1.5:5174` 打开时 `isSecureContext === false`，麦克风和语音识别一起失效。
//      真机验证要走 `adb reverse tcp:5174 tcp:5174` + 手机访问 `http://localhost:5174`。
//
// 这里只做能力判断和一层薄封装，不碰 UI、不碰发送：转出来的文字一律交给用户确认后再发。

export type VoiceProblem = 'not-secure' | 'unsupported';

export type VoiceStatus = {ok: true} | {ok: false; reason: VoiceProblem};

/** 给用户看的原因。不要在这里说「请检查网络」——问题不在网络上。 */
export const VOICE_REASON: Record<VoiceProblem, string> = {
  'not-secure': '这个地址用不了麦克风：浏览器只允许 https 或 localhost。',
  unsupported: '这个浏览器没有语音识别功能，只能打字。',
};

/** 识别失败时给用户看的话。`network` 在国内极其常见，别含糊过去。 */
const VOICE_ERROR: Record<string, string> = {
  'not-allowed': '浏览器没有允许使用麦克风。到浏览器的网站设置里把它打开再试。',
  'service-not-allowed': '浏览器拒绝提供语音服务，换个浏览器或改用打字。',
  'no-speech': '没听到声音。按住再说一次，凑近一点。',
  'audio-capture': '没找到麦克风。检查一下是不是被别的应用占着。',
  network: '浏览器的语音识别服务连不上。它常走境外服务器，国内网络经常失败，先用打字。',
  aborted: '',
};

// 只声明这里真正用到的那几个字段，不引第三方类型。
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechResultEventLike) => void) | null;
  onerror: ((e: {error?: string}) => void) | null;
  onend: (() => void) | null;
}

interface SpeechResultEventLike {
  resultIndex: number;
  results: ArrayLike<{isFinal: boolean; 0?: {transcript: string}}>;
}

function getCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return typeof ctor === 'function' ? (ctor as new () => SpeechRecognitionLike) : null;
}

/** 服务端渲染时的答案。服务端没有 window，一律当作没有语音。 */
export const SERVER_VOICE_STATUS: VoiceStatus = {ok: false, reason: 'unsupported'};

// 能力在页面生命周期里不会变，缓存一份让引用稳定：
// `useSyncExternalStore` 的 getSnapshot 每次渲染都会调，返回新对象会导致无限重渲染。
let cached: VoiceStatus | null = null;

/** 能不能用语音输入。纯本地判断，不发请求。 */
export function voiceStatus(): VoiceStatus {
  if (cached) return cached;
  if (typeof window === 'undefined') return SERVER_VOICE_STATUS;
  if (!getCtor()) cached = {ok: false, reason: 'unsupported'};
  else if (window.isSecureContext === false) cached = {ok: false, reason: 'not-secure'};
  else cached = {ok: true};
  return cached;
}

/** 给 `useSyncExternalStore` 用的空订阅：能力不会变，不需要监听。 */
export function subscribeVoice(): () => void {
  return () => {};
}

export interface VoiceSession {
  /** 松手时调：把还没出结果的那段话收尾，会再触发一次 onTranscript(final=true)。 */
  stop(): void;
  /** 放弃这次识别，不再回调。离开页面时用这个。 */
  cancel(): void;
}

export interface VoiceHandlers {
  /** 目前为止听全了的话。final=false 是还在变的部分，可以只用来预览。 */
  onTranscript(text: string, final: boolean): void;
  /** 识别失败。空字符串表示「不用提示」（比如用户自己取消）。 */
  onError(message: string): void;
  /** 这次识别彻底结束，按钮回到可以再按的状态。成功失败都会调一次。 */
  onEnd(): void;
}

/**
 * 开始一次按住说话。
 *
 * 返回 null 表示起不来（环境不支持），这时不要改 UI 状态——调用方先 `voiceStatus()` 判断。
 * 注意 `start()` 在部分浏览器里是异步失败的：抛错不在这里，而是在 onerror 里。
 */
export function startListening(h: VoiceHandlers): VoiceSession | null {
  const Ctor = getCtor();
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = 'zh-CN';
  // 按住说话期间允许停顿：松开才收尾，别说到一半自己断。
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let finalText = '';
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    h.onEnd();
  };

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const piece = r?.[0]?.transcript ?? '';
      if (r.isFinal) finalText += piece;
      else interim += piece;
    }
    const all = (finalText + interim).trim();
    if (all) h.onTranscript(all, interim === '');
  };

  rec.onerror = (e) => {
    const code = e?.error ?? '';
    // aborted 是调用方自己取消的，不算错误。
    if (code !== 'aborted') h.onError(VOICE_ERROR[code] ?? '语音识别失败了。先用打字吧。');
    finish();
  };

  // onend 是唯一的收尾信号：stop() 之后浏览器会补一次最终结果再触发它。
  rec.onend = () => {
    if (finalText.trim()) h.onTranscript(finalText.trim(), true);
    finish();
  };

  try {
    rec.start();
  } catch {
    // InvalidStateError（上一次还没退干净）之类的，当作没起来处理。
    finish();
    return null;
  }

  return {
    stop() {
      try {
        rec.stop();
      } catch {
        finish();
      }
    },
    cancel() {
      finished = true; // 先断掉回调，避免 abort 引发的 onend 再通知一次
      try {
        rec.abort();
      } catch {
        /* 已经结束就什么都不做 */
      }
    },
  };
}
