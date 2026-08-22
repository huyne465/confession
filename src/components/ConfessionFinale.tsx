'use client';

import { useReducedMotion } from 'motion/react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { assetUrl, sendAnswer } from '@/lib/api';
import type { SiteConfig } from '@/lib/types';

type Props = Pick<
  SiteConfig,
  | 'confessEyebrow'
  | 'confessHeadline'
  | 'confessImageUrl'
  | 'confessVideoUrl'
  | 'confessCaption'
  | 'confessPrimaryCta'
  | 'confessDenyCta'
>;

const SLIP_COLORS = ['#cca830', '#9d4139', '#e6e5b9', '#4a0404'];
const SLIPS = 44;

/** Every slip is a pure function of its index, so server and client agree. */
const slips = Array.from({ length: SLIPS }, (_, i) => ({
  left: (i * 37) % 100,
  width: 4 + (i % 3) * 2,
  height: 10 + (i % 4) * 4,
  color: SLIP_COLORS[i % SLIP_COLORS.length],
}));

function todayLabel(): string {
  const d = new Date();
  return `Hôm nay, ngày ${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
}

/**
 * Chapter IV, on the same near-black as the stage the album opened on. The
 * question is the only thing on the screen; answering it unfolds a letter
 * where the buttons were.
 */
export function ConfessionFinale({
  confessEyebrow,
  confessHeadline,
  confessImageUrl,
  confessVideoUrl,
  confessCaption,
  confessPrimaryCta,
  confessDenyCta,
}: Props) {
  const [accepted, setAccepted] = useState(false);
  const [nudged, setNudged] = useState(false);
  const [dateLine, setDateLine] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // The letter unrolls, and paper slips fall past it. Both wait for the answer.
  useEffect(() => {
    if (!accepted || reduce) return;
    const card = cardRef.current;
    const box = confettiRef.current;
    let cancelled = false;

    void import('animejs').then(({ animate, createSpring, stagger }) => {
      if (cancelled) return;
      if (card) {
        animate(card, {
          scaleY: [0.04, 1],
          opacity: [0, 1],
          duration: 1200,
          ease: createSpring({ stiffness: 62, damping: 16 }),
        });
      }
      if (box) {
        animate(Array.from(box.children) as HTMLElement[], {
          y: ['-10vh', '110vh'],
          x: (_: unknown, i = 0) => (i % 2 ? 1 : -1) * (20 + (i % 7) * 12),
          rotate: (_: unknown, i = 0) => 180 + (i % 5) * 140,
          opacity: [1, 1, 0],
          duration: (_: unknown, i = 0) => 2600 + (i % 6) * 500,
          delay: stagger(45),
          ease: 'linear',
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [accepted, reduce]);

  async function accept() {
    setDateLine(todayLabel());
    setAccepted(true);
    try {
      await sendAnswer(true);
    } catch {
      // The answer is for the archive. A failed write must not break the moment.
    }
  }

  return (
    <section
      id="ket-thuc"
      className="relative scroll-mt-16 overflow-hidden bg-stage px-6 pt-24 pb-[104px]"
    >
      <div className="relative mx-auto max-w-[35rem] text-center">
        <p className="text-[11px] tracking-[0.24em] text-gold uppercase tabular-nums">
          IV — Kết thúc
        </p>

        <figure className="mx-auto mt-[26px] mb-[34px] w-[min(240px,62vw)]">
          <div className="relative aspect-[4/5] w-full overflow-hidden border-[6px] border-stage-soft ring-1 ring-gold/30">
            {confessVideoUrl ? (
              // The last frame of the album is the one that moves. Muted and
              // inline so it can autoplay on a phone at all; the poster covers
              // the wait, and the browser refusing to play leaves it standing.
              <video
                src={assetUrl(confessVideoUrl)}
                poster={confessImageUrl ? assetUrl(confessImageUrl) : undefined}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="Thước phim cuối cùng của album"
                className="h-full w-full object-cover contrast-[1.05] saturate-[0.82] sepia-[0.14]"
              />
            ) : confessImageUrl ? (
              <Image
                src={assetUrl(confessImageUrl)}
                alt="Bức ảnh cuối cùng của album"
                fill
                sizes="(max-width: 420px) 62vw, 240px"
                className="object-cover contrast-[1.05] saturate-[0.82] sepia-[0.22]"
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-stage-soft text-[13px] text-surface/40">
                Chưa có ảnh
              </div>
            )}
          </div>
          <figcaption className="mt-3 text-[15px] text-surface/60 italic">
            {confessCaption}
          </figcaption>
        </figure>

        <p className="mb-4 text-[17px] text-surface/60 italic">{confessEyebrow}</p>
        <h2 className="text-[clamp(36px,10.5vw,58px)] leading-[1.04] tracking-[-0.03em] text-balance text-surface">
          {confessHeadline}
        </h2>

        {accepted ? (
          <div className="mt-10 text-left">
            <div
              ref={cardRef}
              role="status"
              className="origin-top border border-gold/40 bg-surface px-[26px] pt-[30px] pb-[26px]"
            >
              <p className="mb-[18px] text-[11px] tracking-[0.22em] text-gold-deep uppercase tabular-nums">
                {dateLine}
              </p>
              <p className="mb-3.5 text-[27px] leading-[1.12] tracking-[-0.02em] text-burgundy">
                Vậy là từ hôm nay, album này có thêm một trang mới.
              </p>
              <p className="text-[15px] leading-[1.8] text-ink-soft">
                Anh sẽ giữ nó cẩn thận, như giữ tất cả những buổi Em ngồi xuống
                và đàn cho anh nghe. Cảm ơn Em.
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-burgundy/15 pt-3.5">
                <span className="h-px flex-1 bg-gold/50" />
                <span className="text-[16px] text-burgundy italic">Của Em</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-10 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void accept()}
              className="rounded-frame border border-gold px-7 py-4 text-[13px] font-semibold tracking-[0.22em] text-gold uppercase transition-colors duration-300 hover:bg-gold/10 active:translate-y-px"
            >
              {confessPrimaryCta}
            </button>
            <button
              type="button"
              onClick={() => setNudged(true)}
              className="rounded-frame border border-surface/20 px-7 py-4 text-[13px] font-semibold tracking-[0.22em] text-surface/60 uppercase transition-colors duration-300 hover:border-surface/40 active:translate-y-px"
            >
              {confessDenyCta}
            </button>
            <p
              aria-live="polite"
              className={`mt-2 text-[15px] text-surface/55 italic transition-opacity duration-500 ${
                nudged ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {nudged ? 'Không sao. Anh đợi được.' : 'x'}
            </p>
          </div>
        )}
      </div>

      {accepted && !reduce ? (
        <div
          ref={confettiRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          {slips.map((slip, i) => (
            <span
              key={i}
              className="absolute -top-[8%] opacity-90"
              style={{
                left: `${slip.left}%`,
                width: slip.width,
                height: slip.height,
                backgroundColor: slip.color,
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
