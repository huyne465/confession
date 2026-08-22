'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { verifyPin } from '@/lib/api';

type Props = {
  question: string;
  hint: string;
  children: React.ReactNode;
};

const SLOTS = 6;

/**
 * The whole site sits behind this. Two burgundy curtain halves cover the
 * viewport; a correct 6-digit date parts them. Motion is the state transition
 * from "locked" to "open", so it is motivated, not decoration.
 */
export function CurtainGate({ question, hint, children }: Props) {
  const [digits, setDigits] = useState<string[]>(Array(SLOTS).fill(''));
  const [status, setStatus] = useState<'idle' | 'checking' | 'wrong'>('idle');
  const [opened, setOpened] = useState(false);
  const [gone, setGone] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const reduce = useReducedMotion();

  const pin = digits.join('');
  const complete = pin.length === SLOTS && digits.every(Boolean);

  // Scroll stays locked while the curtain is up.
  useEffect(() => {
    document.body.style.overflow = gone ? '' : 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [gone]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  function setDigit(index: number, raw: string) {
    const value = raw.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    if (status === 'wrong') setStatus('idle');
    if (value && index < SLOTS - 1) inputs.current[index + 1]?.focus();
  }

  function onKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (event.key === 'Enter' && complete) void submit();
  }

  function onPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, SLOTS);
    if (!pasted) return;
    event.preventDefault();
    const next = Array(SLOTS).fill('');
    pasted.split('').forEach((char, i) => (next[i] = char));
    setDigits(next);
    inputs.current[Math.min(pasted.length, SLOTS - 1)]?.focus();
  }

  async function submit() {
    if (!complete || status === 'checking') return;
    setStatus('checking');
    const ok = await verifyPin(pin);
    if (!ok) {
      setStatus('wrong');
      setDigits(Array(SLOTS).fill(''));
      inputs.current[0]?.focus();
      return;
    }
    setStatus('idle');
    setOpened(true);
    // The piano stage waits for this before it plays its opening line and its
    // first note: the correct PIN is the gesture that unlocks audio.
    window.dispatchEvent(new CustomEvent('curtain:open'));
    window.setTimeout(() => setGone(true), reduce ? 0 : 1700);
  }

  return (
    <>
      {children}

      <AnimatePresence>
        {!gone && (
          <motion.div
            key="gate"
            className="fixed inset-0 z-50"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Curtain halves */}
            <motion.div
              className="absolute inset-y-0 left-0 w-1/2 origin-left bg-burgundy shadow-[inset_-30px_0_60px_rgb(0_0_0/0.45)]"
              style={{ borderRight: '1px solid rgb(204 168 48 / 0.35)' }}
              animate={{ scaleX: opened ? 0 : 1 }}
              transition={{ duration: reduce ? 0 : 1.5, ease: [0.645, 0.045, 0.355, 1] }}
            />
            <motion.div
              className="absolute inset-y-0 right-0 w-1/2 origin-right bg-burgundy shadow-[inset_30px_0_60px_rgb(0_0_0/0.45)]"
              style={{ borderLeft: '1px solid rgb(204 168 48 / 0.35)' }}
              animate={{ scaleX: opened ? 0 : 1 }}
              transition={{ duration: reduce ? 0 : 1.5, ease: [0.645, 0.045, 0.355, 1] }}
            />

            {/* Lock panel */}
            <AnimatePresence>
              {!opened && (
                <motion.div
                  key="panel"
                  className="absolute inset-0 grid place-items-center px-6"
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="w-full max-w-[26rem] border border-gold bg-surface p-8 shadow-[0_30px_60px_-25px_rgb(0_0_0/0.55)] sm:p-12">
                    <h1 className="text-center text-[clamp(1.75rem,7vw,2.5rem)] leading-[1.15] font-semibold text-burgundy italic pb-1">
                      {question}
                    </h1>
                    <p className="mt-3 text-center text-base text-ink-soft italic">
                      {hint}
                    </p>

                    <div className="mt-10 flex justify-center gap-1.5 sm:gap-2">
                      {digits.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => {
                            inputs.current[index] = el;
                          }}
                          value={digit}
                          onChange={(event) => setDigit(index, event.target.value)}
                          onKeyDown={(event) => onKeyDown(index, event)}
                          onPaste={onPaste}
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={1}
                          aria-label={`Chữ số ${index + 1}`}
                          className="h-14 w-11 border-0 border-b-2 border-gold bg-surface-low text-center text-2xl text-ink caret-burgundy focus:border-burgundy focus:bg-surface-lowest focus:outline-none sm:w-12"
                        />
                      ))}
                    </div>

                    <p
                      role="status"
                      aria-live="polite"
                      className={`mt-4 min-h-6 text-center text-sm ${
                        status === 'wrong' ? 'text-burgundy-tint' : 'text-transparent'
                      }`}
                    >
                      {status === 'wrong' ? 'Chưa đúng rồi. Thử lại nhé.' : 'x'}
                    </p>

                    <button
                      type="button"
                      onClick={() => void submit()}
                      disabled={!complete || status === 'checking'}
                      className="mt-4 w-full rounded-frame bg-burgundy px-8 py-4 text-sm font-semibold tracking-[0.18em] text-gold-pale uppercase transition-all duration-300 hover:bg-burgundy-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {status === 'checking' ? 'Đang mở...' : 'Mở cửa trái tim'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
