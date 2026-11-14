import React, { useCallback, useEffect, useRef, useState } from 'react';
import { faDigits, shuffle } from '../data/tests';

interface TaskProps {
  taskId: 'reaction' | 'stroop' | 'digits' | 'trail';
  onFinish: (raw: Record<string, unknown>) => void;
}

export const PerformanceTaskRunner: React.FC<TaskProps> = ({ taskId, onFinish }) => {
  if (taskId === 'reaction') return <ReactionTask onFinish={onFinish} />;
  if (taskId === 'stroop') return <StroopTask onFinish={onFinish} />;
  if (taskId === 'digits') return <DigitsTask onFinish={onFinish} />;
  return <TrailTask onFinish={onFinish} />;
};

/* ---- ۱) زمان واکنش ---- */
const ReactionTask: React.FC<{ onFinish: (raw: Record<string, unknown>) => void }> = ({
  onFinish,
}) => {
  const TOTAL = 6;
  const [phase, setPhase] = useState<'idle' | 'wait' | 'go' | 'between'>('idle');
  const [trial, setTrial] = useState(0);
  const [bigText, setBigText] = useState('آماده‌اید؟');
  const [subText, setSubText] = useState('برای شروع کلیک کنید یا Space بزنید');
  const [infoText, setInfoText] = useState('یک مرحله‌ی تمرینی و سپس ۵ مرحله‌ی ثبت‌شده انجام می‌شود.');

  const timerRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const timesRef = useRef<number[]>([]);
  const antRef = useRef(0);
  const deadRef = useRef(false);

  const beginTrial = useCallback((tIndex: number) => {
    setPhase('wait');
    setBigText('صبر کنید…');
    setSubText('وقتی صفحه سبز شد، فوراً بزنید');
    setInfoText(
      tIndex === 0
        ? 'مرحله‌ی تمرینی'
        : `مرحله ${faDigits(tIndex)} از ${faDigits(TOTAL - 1)}`
    );
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (deadRef.current) return;
      startRef.current = performance.now();
      setPhase('go');
      setBigText('حالا!');
      setSubText('');
    }, 1500 + Math.random() * 2700);
  }, []);

  const handleHit = useCallback(() => {
    if (deadRef.current) return;
    if (phase === 'idle') {
      setTrial(0);
      beginTrial(0);
      return;
    }
    if (phase === 'wait') {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      antRef.current += 1;
      setPhase('between');
      setBigText('زود بود!');
      setSubText('برای تکرار همین مرحله بزنید');
      return;
    }
    if (phase === 'go') {
      const rt = performance.now() - startRef.current;
      if (trial > 0) timesRef.current.push(rt);
      const nextTrial = trial + 1;
      setTrial(nextTrial);
      if (nextTrial >= TOTAL) {
        deadRef.current = true;
        onFinish({
          times: timesRef.current.map((x) => Math.round(x)),
          ant: antRef.current,
        });
        return;
      }
      setPhase('between');
      setBigText(`${faDigits(Math.round(rt))} میلی‌ثانیه`);
      setSubText('برای مرحله‌ی بعد بزنید');
      return;
    }
    if (phase === 'between') {
      beginTrial(trial);
    }
  }, [phase, trial, beginTrial, onFinish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleHit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [handleHit]);

  useEffect(() => {
    return () => {
      deadRef.current = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const stageColor =
    phase === 'go'
      ? 'bg-[#1f9d57] text-white border-[#1f9d57]'
      : phase === 'wait'
      ? 'bg-[#b83232] text-white border-[#b83232]'
      : 'bg-[#f4f6f7] dark:bg-[#222d36] text-[#1b2733] dark:text-[#e6ecf0] border-[#d5dce1] dark:border-[#33414d]';

  return (
    <div>
      <div
        tabIndex={0}
        role="button"
        aria-label="ناحیه‌ی واکنش"
        onPointerDown={(e) => {
          e.preventDefault();
          handleHit();
        }}
        className={`min-h-[300px] rounded-[10px] border grid place-items-center text-center p-5 select-none touch-manipulation cursor-pointer transition-colors ${stageColor}`}
      >
        <div>
          <div className="text-4xl sm:text-6xl font-extrabold leading-tight tabular-nums">
            {bigText}
          </div>
          {subText && <div className="text-sm mt-2 opacity-90">{subText}</div>}
        </div>
      </div>
      <p className="text-xs text-[#5a6a78] dark:text-[#9aabb8] mt-2">{infoText}</p>
    </div>
  );
};

/* ---- ۲) استروپ رنگ-کلمه ---- */
const SCOL = [
  { n: 'قرمز', c: '#d62828' },
  { n: 'آبی', c: '#2a6df0' },
  { n: 'سبز', c: '#1fa75a' },
  { n: 'زرد', c: '#f0c419' },
];

const StroopTask: React.FC<{ onFinish: (raw: Record<string, unknown>) => void }> = ({
  onFinish,
}) => {
  const [step, setStep] = useState<'intro1' | 'phase1' | 'intro2' | 'phase2'>('intro1');
  const [stimulus, setStimulus] = useState<{ word: string; color: string } | null>(null);
  const pendingResolveRef = useRef<((choice: number) => void) | null>(null);
  const deadRef = useRef(false);
  const resultsARef = useRef<Array<{ rt: number; ok: boolean }>>([]);

  const answer = useCallback((idx: number) => {
    if (pendingResolveRef.current) {
      const fn = pendingResolveRef.current;
      pendingResolveRef.current = null;
      fn(idx);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = parseInt(e.key, 10);
      if (k >= 1 && k <= 4) answer(k - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      deadRef.current = true;
      window.removeEventListener('keydown', onKey);
    };
  }, [answer]);

  const runTrials = async (trials: Array<{ word: string; ink: number }>) => {
    const out: Array<{ rt: number; ok: boolean }> = [];
    for (const t of trials) {
      if (deadRef.current) return out;
      setStimulus(null);
      await new Promise((r) => window.setTimeout(r, 350));
      if (deadRef.current) return out;
      setStimulus({ word: t.word, color: SCOL[t.ink].c });
      const t0 = performance.now();
      const choice = await new Promise<number>((res) => {
        pendingResolveRef.current = res;
      });
      if (deadRef.current) return out;
      out.push({ rt: Math.round(performance.now() - t0), ok: choice === t.ink });
      setStimulus(null);
    }
    return out;
  };

  const startPhase1 = async () => {
    setStep('phase1');
    const trials: Array<{ word: string; ink: number }> = [];
    let last = -1;
    for (let i = 0; i < 12; i++) {
      let k: number;
      do {
        k = Math.floor(Math.random() * 4);
      } while (k === last);
      last = k;
      trials.push({ word: '■■■■', ink: k });
    }
    resultsARef.current = await runTrials(trials);
    if (!deadRef.current) setStep('intro2');
  };

  const startPhase2 = async () => {
    setStep('phase2');
    const trials: Array<{ word: string; ink: number }> = [];
    let last = -1;
    for (let i = 0; i < 20; i++) {
      let k: number;
      do {
        k = Math.floor(Math.random() * 4);
      } while (k === last);
      last = k;
      let w: number;
      do {
        w = Math.floor(Math.random() * 4);
      } while (w === k);
      trials.push({ word: SCOL[w].n, ink: k });
    }
    const rb = await runTrials(trials);
    if (!deadRef.current) {
      onFinish({ a: resultsARef.current, b: rb });
    }
  };

  return (
    <div>
      <div className="min-h-[300px] rounded-[10px] border border-[#33414d] bg-[#20262c] text-white grid place-items-center text-center p-5 select-none">
        {step === 'intro1' && (
          <div className="max-w-lg text-sm leading-8">
            <p>
              <b>مرحله‌ی ۱:</b> به‌جای هر ■■■ رنگ آن را تشخیص دهید و دکمه‌ی همان رنگ (یا کلید ۱ تا ۴
              صفحه‌کلید) را بزنید. هم سریع باشید هم درست.
              <br />
              ۱=قرمز ۲=آبی ۳=سبز ۴=زرد
            </p>
            <button
              type="button"
              onClick={startPhase1}
              className="mt-4 px-5 py-2 rounded-lg font-bold bg-[#0e6a88] text-white hover:opacity-90 cursor-pointer"
            >
              شروع
            </button>
          </div>
        )}
        {step === 'intro2' && (
          <div className="max-w-lg text-sm leading-8">
            <p>
              <b>مرحله‌ی ۲:</b> اکنون کلمات رنگ‌ها نوشته می‌شوند. <b>رنگِ حروف</b> را تشخیص دهید، نه
              معنای کلمه را. مثلاً کلمه‌ی «قرمز» با رنگ آبی → پاسخ آبی.
            </p>
            <button
              type="button"
              onClick={startPhase2}
              className="mt-4 px-5 py-2 rounded-lg font-bold bg-[#0e6a88] text-white hover:opacity-90 cursor-pointer"
            >
              شروع مرحله‌ی ۲
            </button>
          </div>
        )}
        {(step === 'phase1' || step === 'phase2') && stimulus && (
          <div className="text-5xl sm:text-7xl font-extrabold" style={{ color: stimulus.color }}>
            {stimulus.word}
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 mt-3">
        {SCOL.map((c, i) => (
          <button
            key={c.n}
            type="button"
            aria-label={c.n}
            onClick={() => answer(i)}
            style={{ backgroundColor: c.c, borderColor: c.c }}
            className="h-14 rounded-lg border-2 text-white font-bold text-base shadow-sm cursor-pointer hover:opacity-90"
          >
            {faDigits(i + 1)} ({c.n})
          </button>
        ))}
      </div>
    </div>
  );
};

/* ---- ۳) حافظه‌ی ارقام ---- */
const DigitsTask: React.FC<{ onFinish: (raw: Record<string, unknown>) => void }> = ({
  onFinish,
}) => {
  const [intro, setIntro] = useState<'f' | 'b' | null>('f');
  const [shownDigit, setShownDigit] = useState('');
  const [message, setMessage] = useState('');
  const [inputMode, setInputMode] = useState(false);
  const [typed, setTyped] = useState('');

  const deadRef = useRef(false);
  const bestRef = useRef({ f: 0, b: 0 });
  const submitRef = useRef<((val: string) => void) | null>(null);

  const pressKey = useCallback((k: string) => {
    if (!submitRef.current) return;
    if (k === '⌫') {
      setTyped((prev) => prev.slice(0, -1));
    } else if (k === '✓') {
      const fn = submitRef.current;
      submitRef.current = null;
      setTyped((prev) => {
        fn(prev);
        return prev;
      });
    } else {
      setTyped((prev) => (prev.length < 12 ? prev + k : prev));
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) pressKey(e.key);
      else if (e.key === 'Backspace') pressKey('⌫');
      else if (e.key === 'Enter') pressKey('✓');
    };
    window.addEventListener('keydown', onKey);
    return () => {
      deadRef.current = true;
      window.removeEventListener('keydown', onKey);
    };
  }, [pressKey]);

  const runDirection = async (dir: 'f' | 'b') => {
    let len = dir === 'f' ? 3 : 2;
    const max = dir === 'f' ? 9 : 8;
    while (len <= max && !deadRef.current) {
      let passed = false;
      for (let attempt = 0; attempt < 2 && !passed && !deadRef.current; attempt++) {
        const seq: number[] = [];
        for (let i = 0; i < len; i++) {
          let d: number;
          do {
            d = Math.floor(Math.random() * 10);
          } while (seq.length > 0 && d === seq[seq.length - 1]);
          seq.push(d);
        }
        setMessage('دقت کنید…');
        setInputMode(false);
        setTyped('');
        await new Promise((r) => window.setTimeout(r, 700));
        for (const d of seq) {
          if (deadRef.current) return;
          setShownDigit(String(d));
          await new Promise((r) => window.setTimeout(r, 800));
          setShownDigit('');
          await new Promise((r) => window.setTimeout(r, 250));
        }
        if (deadRef.current) return;
        setTyped('');
        setMessage(
          dir === 'f'
            ? 'ارقام را به همان ترتیب وارد کنید و ✓ بزنید'
            : 'ارقام را به‌صورت «برعکس» وارد کنید و ✓ بزنید'
        );
        setInputMode(true);
        const ans = await new Promise<string>((res) => {
          submitRef.current = res;
        });
        const target = (dir === 'f' ? seq : seq.slice().reverse()).join('');
        if (ans === target) passed = true;
      }
      if (passed) {
        bestRef.current[dir] = len;
        len++;
      } else {
        break;
      }
    }
  };

  const handleContinueIntro = async () => {
    if (intro === 'f') {
      setIntro(null);
      await runDirection('f');
      if (!deadRef.current) setIntro('b');
    } else if (intro === 'b') {
      setIntro(null);
      await runDirection('b');
      if (!deadRef.current) {
        onFinish({ f: bestRef.current.f, b: bestRef.current.b });
      }
    }
  };

  return (
    <div className="min-h-[300px] rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-[#f4f6f7] dark:bg-[#222d36] grid place-items-center text-center p-5 select-none">
      {intro ? (
        <div className="max-w-lg text-sm leading-8">
          <p>
            {intro === 'f' ? (
              <>
                <b>بخش اول:</b> اعداد یکی‌یکی نمایش داده می‌شوند. آن‌ها را به همان ترتیب به خاطر
                بسپارید و سپس وارد کنید.
              </>
            ) : (
              <>
                <b>بخش دوم:</b> این بار اعداد را «برعکس» وارد کنید؛ مثلاً ۲-۵-۹ را به‌صورت ۹-۵-۲.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={handleContinueIntro}
            className="mt-4 px-5 py-2 rounded-lg font-bold bg-[#0e6a88] text-white hover:opacity-90 cursor-pointer"
          >
            ادامه
          </button>
        </div>
      ) : (
        <div className="w-full">
          {shownDigit && (
            <div className="text-6xl sm:text-7xl font-extrabold num-ltr">{shownDigit}</div>
          )}
          <div
            className="text-3xl font-extrabold tracking-[8px] min-h-[44px] mt-1"
            style={{ direction: 'ltr' }}
          >
            {typed}
          </div>
          <div className="text-sm text-[#5a6a78] dark:text-[#9aabb8] mt-1">{message}</div>
          {inputMode && (
            <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto mt-3">
              {'1234567890⌫✓'.split('').map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => pressKey(k)}
                  className="h-13 text-xl font-bold rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] hover:border-[#0e6a88] cursor-pointer"
                >
                  {k}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ---- ۴) ردیابی اعداد و حروف (Trail A/B) ---- */
const LETTERS = ['الف', 'ب', 'پ', 'ت', 'ث', 'ج', 'چ', 'ح', 'خ', 'د'];

interface TrailNode {
  label: string;
  x: number;
  y: number;
  index: number;
}

const TrailTask: React.FC<{ onFinish: (raw: Record<string, unknown>) => void }> = ({ onFinish }) => {
  const [intro, setIntro] = useState<'a' | 'b' | null>('a');
  const [nodes, setNodes] = useState<TrailNode[]>([]);
  const [doneCount, setDoneCount] = useState(0);
  const [errIdx, setErrIdx] = useState<number | null>(null);
  const [nextLabel, setNextLabel] = useState('');

  const startRef = useRef(0);
  const errorsRef = useRef(0);
  const partARef = useRef<{ sec: number; err: number }>({ sec: 0, err: 0 });

  const buildLayout = (seq: string[]): TrailNode[] => {
    const cols = 5;
    const rows = Math.ceil(seq.length / cols);
    const cells = shuffle([...Array(cols * rows).keys()]).slice(0, seq.length);
    return seq.map((label, i) => {
      const c = cells[i] % cols;
      const r = Math.floor(cells[i] / cols);
      const x = ((c + 0.5) / cols) * 100 + (Math.random() - 0.5) * 8;
      const y = ((r + 0.5) / rows) * 100 + (Math.random() - 0.5) * 10;
      return { label, x, y, index: i };
    });
  };

  const startPart = (part: 'a' | 'b') => {
    setIntro(null);
    let seq: string[];
    if (part === 'a') {
      seq = [...Array(20).keys()].map((i) => String(i + 1));
    } else {
      seq = [];
      for (let i = 0; i < 10; i++) {
        seq.push(String(i + 1));
        seq.push(LETTERS[i]);
      }
    }
    setNodes(buildLayout(seq));
    setDoneCount(0);
    setNextLabel(seq[0]);
    errorsRef.current = 0;
    startRef.current = performance.now();
  };

  const isPartB = nodes.length === 20 && nodes[1]?.label === 'الف';

  const handleNodeClick = (idx: number) => {
    if (idx === doneCount) {
      const next = doneCount + 1;
      setDoneCount(next);
      if (next >= nodes.length) {
        const sec = Number(((performance.now() - startRef.current) / 1000).toFixed(1));
        const err = errorsRef.current;
        if (!isPartB) {
          partARef.current = { sec, err };
          setIntro('b');
        } else {
          onFinish({
            a: partARef.current.sec,
            b: sec,
            errA: partARef.current.err,
            errB: err,
          });
        }
      } else {
        setNextLabel(nodes[next].label);
      }
    } else {
      errorsRef.current += 1;
      setErrIdx(idx);
      window.setTimeout(() => setErrIdx(null), 260);
    }
  };

  return (
    <div>
      {!intro && (
        <div className="text-sm text-[#5a6a78] dark:text-[#9aabb8] mb-2 font-medium">
          بعدی: <span className="text-[#0e6a88] dark:text-[#4fb4d4] font-bold">{nextLabel}</span>
        </div>
      )}
      <div className="relative w-full h-[420px] rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-[#f4f6f7] dark:bg-[#222d36] touch-manipulation overflow-hidden">
        {intro ? (
          <div className="grid place-items-center h-full text-center p-4">
            <div className="max-w-lg text-sm leading-8">
              <p>
                {intro === 'a' ? (
                  <>
                    <b>بخش اول:</b> اعداد ۱ تا ۲۰ را به ترتیب و تا جای ممکن سریع لمس یا کلیک کنید.
                    اگر اشتباه کردید دوباره درست را بزنید؛ زمان ادامه دارد.
                  </>
                ) : (
                  <>
                    <b>بخش دوم:</b> این بار به‌صورت یک‌درمیان عدد و حرف: ۱ ← الف ← ۲ ← ب ← ۳ ← پ …
                    تا ۱۰ ← د. حروف به ترتیب: الف ب پ ت ث ج چ ح خ د.
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={() => startPart(intro)}
                className="mt-4 px-5 py-2 rounded-lg font-bold bg-[#0e6a88] text-white hover:opacity-90 cursor-pointer"
              >
                شروع
              </button>
            </div>
          </div>
        ) : (
          nodes.map((n) => {
            const isDone = n.index < doneCount;
            const isErr = errIdx === n.index;
            return (
              <button
                key={`${n.index}-${n.label}`}
                type="button"
                onClick={() => handleNodeClick(n.index)}
                style={{ right: `${n.x}%`, top: `${n.y}%` }}
                className={`absolute w-11 h-11 -mt-[22px] -mr-[22px] rounded-full border-2 font-extrabold text-base grid place-items-center cursor-pointer transition-colors ${
                  isDone
                    ? 'bg-[#0e6a88] border-[#0e6a88] text-white'
                    : 'bg-white dark:bg-[#1b242c] border-[#1b2733] dark:border-[#e6ecf0] text-[#1b2733] dark:text-[#e6ecf0]'
                } ${isErr ? 'animate-shake border-[#b83232]' : ''}`}
              >
                {n.label}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
