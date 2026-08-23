'use client';

import { useEffect, useState } from 'react';
import { sendAnswer } from '@/lib/api';

type Props = {
  question?: string;
  intro?: string;
};

type Level = {
  label: string;
  reply: string;
  color: string;
};

/** Five answers, and the face has to get from the first to the last smoothly. */
const LEVELS: Level[] = [
  {
    label: 'Không yêu anh à…',
    reply: 'Thôi được rồi. Anh vẫn để nguyên trang này ở đây.',
    color: '#9d4139',
  },
  {
    label: 'Hơi yêu',
    reply: 'Hơi thôi cũng được. Anh làm việc với cái “hơi” đó.',
    color: '#b8722c',
  },
  {
    label: 'Yêu',
    reply: 'Một chữ thôi mà anh đọc đi đọc lại mấy lần.',
    color: '#cca830',
  },
  {
    label: 'Yêu nhiều',
    reply: 'Anh cũng vậy. Nhiều hơn cái em nghĩ.',
    color: '#a8a12e',
  },
  {
    label: 'Rất rất rất nhiều',
    reply: 'Vậy là hôm nay anh không cần gì thêm nữa.',
    color: '#6f8f3a',
  },
];

const LAST = LEVELS.length - 1;
const STORED = 'confession:love-meter';

/** Where the needle points, in degrees: −80 at the left stop, +80 at the right. */
const angleFor = (level: number) => -80 + (level / LAST) * 160;

/** A point on the gauge arc, measured in the same degrees as the needle. */
function onArc(deg: number, radius: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: 100 + radius * Math.cos(rad), y: 100 + radius * Math.sin(rad) };
}

/** One coloured band of the dial. */
function segment(index: number) {
  const span = 160 / LEVELS.length;
  const from = -80 + index * span + 1.5;
  const to = from + span - 3;
  const outer = 78;
  const inner = 58;
  const a = onArc(from, outer);
  const b = onArc(to, outer);
  const c = onArc(to, inner);
  const d = onArc(from, inner);
  return `M ${a.x} ${a.y} A ${outer} ${outer} 0 0 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${inner} ${inner} 0 0 0 ${d.x} ${d.y} Z`;
}

/**
 * The face is drawn rather than typed. Five emoji would jump between five
 * fixed pictures; a mouth whose control point is a function of the answer
 * bends continuously, which is what a dial is supposed to feel like.
 */
function Face({ level }: { level: number }) {
  const t = level / LAST;
  // The mouth's control point crosses the lip line: below it is a frown.
  const curve = 78 - t * 46;
  const brow = 4 - t * 9;
  const eye = 3.4 + t * 0.5;

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <circle cx="50" cy="50" r="38" fill="rgba(252,249,248,0.06)" />
      <circle
        cx="50"
        cy="50"
        r="38"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.5"
      />
      <g style={{ transition: 'transform 320ms cubic-bezier(0.16,1,0.3,1)' }}>
        <line
          x1="30"
          y1={38 + brow}
          x2="42"
          y2={38 - brow}
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <line
          x1="58"
          y1={38 - brow}
          x2="70"
          y2={38 + brow}
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </g>
      <circle cx="36" cy="48" r={eye} fill="currentColor" />
      <circle cx="64" cy="48" r={eye} fill="currentColor" />
      <path
        d={`M 34 62 Q 50 ${curve} 66 62`}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        style={{ transition: 'd 320ms cubic-bezier(0.16,1,0.3,1)' }}
      />
    </svg>
  );
}

/**
 * Chapter II. One question with five answers, on a dial. The needle, the face
 * and the colour all read the same number, so moving the slider moves the whole
 * instrument at once rather than lighting up a separate indicator.
 */
export function LoveMeter({
  question = 'Em có yêu anh không?',
  intro = 'Kéo thanh bên dưới tới chỗ đúng nhất. Không có đáp án sai — anh chỉ muốn biết thật.',
}: Props) {
  const [level, setLevel] = useState(2);
  const [sent, setSent] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // An answer given yesterday should still be on the dial today.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORED);
      if (saved === null) return;
      const value = Number(saved);
      if (Number.isInteger(value) && value >= 0 && value <= LAST) {
        setLevel(value);
        setSent(value);
      }
    } catch {
      // Private windows throw on read. The dial simply starts in the middle.
    }
  }, []);

  const current = LEVELS[level];

  async function submit() {
    setBusy(true);
    setSent(level);
    try {
      window.localStorage.setItem(STORED, String(level));
    } catch {
      // Not being able to remember it is not a reason to refuse the answer.
    }
    try {
      await sendAnswer(level > 0, `meter:${level}`, { kind: 'meter', level });
    } catch {
      // The answer is for the archive. A failed write must not break the moment.
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="khoanh-khac"
      className="scroll-mt-16 border-t border-burgundy/12 bg-surface-low pt-[84px] pb-24"
    >
      <div className="mx-auto max-w-[35rem] px-6">
        <p className="text-[11px] tracking-[0.24em] text-gold-deep uppercase tabular-nums">
          II — Một câu hỏi
        </p>
        <h2 className="mt-5 text-[clamp(34px,9.5vw,52px)] leading-[1.02] tracking-[-0.03em] text-balance text-burgundy">
          {question}
        </h2>
        <div className="mt-[26px] mb-[18px] h-px bg-burgundy/15" />
        <p className="text-[15px] leading-[1.8] text-pretty text-ink-soft">
          {intro}
        </p>

        <div className="mt-10 flex flex-col items-center">
          <div className="relative w-full max-w-[22rem]">
            <svg viewBox="0 0 200 116" className="w-full" role="img" aria-hidden="true">
              {LEVELS.map((entry, i) => (
                <path
                  key={entry.label}
                  d={segment(i)}
                  fill={entry.color}
                  opacity={i === level ? 1 : 0.22}
                  style={{ transition: 'opacity 260ms ease' }}
                />
              ))}

              {/* Needle. One transform, so it swings rather than jumps. */}
              <g
                style={{
                  transform: `rotate(${angleFor(level)}deg)`,
                  transformOrigin: '100px 100px',
                  transition: 'transform 420ms cubic-bezier(0.34,1.4,0.5,1)',
                }}
              >
                <path
                  d="M 100 100 L 96.5 96 L 100 30 L 103.5 96 Z"
                  fill="var(--color-burgundy)"
                />
              </g>
              <circle cx="100" cy="100" r="7" fill="var(--color-burgundy)" />
              <circle cx="100" cy="100" r="2.6" fill="var(--color-surface-low)" />
            </svg>

            <div
              className="pointer-events-none absolute inset-x-0 top-[16%] mx-auto h-[26%] w-[26%]"
              style={{ color: current.color }}
            >
              <Face level={level} />
            </div>
          </div>

          <p
            aria-live="polite"
            className="mt-4 text-[clamp(22px,6vw,30px)] leading-tight text-burgundy italic"
          >
            {current.label}
          </p>

          <label className="mt-8 w-full max-w-[22rem]">
            <span className="sr-only">{question}</span>
            <input
              type="range"
              min={0}
              max={LAST}
              step={1}
              value={level}
              onChange={(event) => setLevel(Number(event.target.value))}
              aria-valuetext={current.label}
              className="love-range w-full"
              style={{ ['--fill' as string]: `${(level / LAST) * 100}%` }}
            />
            <span className="mt-2 flex justify-between text-[10px] tracking-[0.14em] text-ink-soft/55 uppercase tabular-nums">
              {LEVELS.map((entry, i) => (
                <span key={entry.label} className={i === level ? 'text-gold-deep' : ''}>
                  {i}
                </span>
              ))}
            </span>
          </label>

          <div className="mt-8 flex w-full max-w-[22rem] flex-col items-center gap-3">
            {sent === level ? (
              <>
                <p
                  role="status"
                  className="text-center text-[15px] leading-[1.7] text-ink-soft italic"
                >
                  {LEVELS[sent].reply}
                </p>
                <button
                  type="button"
                  onClick={() => setSent(null)}
                  className="rounded-frame border border-gold px-7 py-3 text-[12px] font-semibold tracking-[0.2em] text-gold-deep uppercase transition-colors duration-300 hover:bg-gold/10 active:translate-y-px"
                >
                  Chọn lại
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy}
                className="rounded-frame w-full bg-burgundy px-7 py-4 text-[13px] font-semibold tracking-[0.22em] text-gold-pale uppercase transition-colors duration-300 hover:bg-burgundy-deep active:translate-y-px disabled:opacity-50"
              >
                {sent === null ? 'Gửi câu trả lời' : 'Gửi lại'}
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .love-range {
          -webkit-appearance: none;
          appearance: none;
          height: 34px;
          background: transparent;
          cursor: pointer;
        }

        /* The track is drawn twice, once per engine, because there is no
           shorthand either of them agrees on. */
        .love-range::-webkit-slider-runnable-track {
          height: 4px;
          border-radius: 9999px;
          background: linear-gradient(
            to right,
            var(--color-gold) 0%,
            var(--color-gold) var(--fill),
            rgb(220 192 189 / 0.7) var(--fill),
            rgb(220 192 189 / 0.7) 100%
          );
        }

        .love-range::-moz-range-track {
          height: 4px;
          border-radius: 9999px;
          background: linear-gradient(
            to right,
            var(--color-gold) 0%,
            var(--color-gold) var(--fill),
            rgb(220 192 189 / 0.7) var(--fill),
            rgb(220 192 189 / 0.7) 100%
          );
        }

        .love-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          margin-top: -9px;
          border-radius: 9999px;
          background: var(--color-burgundy);
          border: 3px solid var(--color-surface-low);
          box-shadow: 0 4px 12px -4px rgb(74 4 4 / 0.6);
        }

        .love-range::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 9999px;
          background: var(--color-burgundy);
          border: 3px solid var(--color-surface-low);
          box-shadow: 0 4px 12px -4px rgb(74 4 4 / 0.6);
        }

        .love-range:focus-visible::-webkit-slider-thumb {
          outline: 2px solid var(--color-gold-deep);
          outline-offset: 2px;
        }
      `}</style>
    </section>
  );
}
