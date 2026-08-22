'use client';

import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react/dist/ssr';
import { useReducedMotion } from 'motion/react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { Photo } from '@/lib/types';
import { useReveal } from './Reveal';

type Anime = typeof import('animejs');

/** Each card keeps its own lean, so the pile never looks machine-stacked. */
const TILTS = [-1.5, 2.4, -2.9, 1.6, 3.2];

/** How far a drag has to travel before it counts as a flick. */
const THROW = 56;

type CardState = {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
};

function stackState(depth: number, cardIdx: number): CardState {
  const tilt = TILTS[cardIdx % TILTS.length];
  return {
    x: 0,
    y: depth * 13,
    scale: 1 - depth * 0.045,
    rotate: depth === 0 ? tilt * 0.4 : tilt,
    opacity: depth > 3 ? 0 : 1 - depth * 0.13,
  };
}

function staticStyle(depth: number, cardIdx: number): React.CSSProperties {
  const s = stackState(depth, cardIdx);
  return {
    transform: `translateY(${s.y}px) rotate(${s.rotate}deg) scale(${s.scale})`,
    opacity: s.opacity,
    zIndex: 20 - depth,
  };
}

/**
 * Chapter II. A Locket-style pile of polaroids: the front card is thrown aside
 * and the next springs up to take its place. Drag is the primary gesture; the
 * two buttons are there for a mouse and for the keyboard.
 */
export function MemoryMosaic({ photos }: { photos: Photo[] }) {
  const revealRef = useReveal<HTMLDivElement>();
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const animeRef = useRef<Anime | null>(null);
  const timeoutRef = useRef(0);
  const drag = useRef({ startX: 0, startY: 0, dx: 0, active: false });
  const stateRef = useRef({
    order: photos.map((_, i) => i),
    pos: 0,
    busy: false,
  });

  const [pos, setPos] = useState(0);
  const reduce = useReducedMotion();
  const total = photos.length;

  useEffect(() => {
    stateRef.current = { order: photos.map((_, i) => i), pos: 0, busy: false };
    setPos(0);
  }, [photos]);

  useEffect(() => {
    let cancelled = false;
    void import('animejs').then((anime) => {
      if (cancelled) return;
      animeRef.current = anime;
      layout(false);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutRef.current);
    };
    // The layout only depends on the photo set, which is re-seeded above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  function layout(animated: boolean) {
    const anime = animeRef.current;
    if (!anime) return;
    const { animate, utils } = anime;
    stateRef.current.order.forEach((cardIdx, depth) => {
      const el = cardRefs.current[cardIdx];
      if (!el) return;
      el.style.zIndex = String(20 - depth);
      const state = stackState(depth, cardIdx);
      if (animated && !reduce) {
        animate(el, {
          ...state,
          duration: 640,
          ease: anime.createSpring({ stiffness: 96, damping: 15 }),
        });
      } else {
        utils.set(el, state);
      }
    });
    setPos(stateRef.current.pos);
  }

  function advance(dir: 1 | -1) {
    const anime = animeRef.current;
    const st = stateRef.current;
    if (!anime || st.busy || total < 2) return;
    const { animate, utils } = anime;
    const n = total;
    st.busy = true;

    if (dir > 0) {
      const leavingIdx = st.order[0];
      const leaving = cardRefs.current[leavingIdx];
      if (!leaving) {
        st.busy = false;
        return;
      }
      const settle = () => {
        st.order.push(st.order.shift() as number);
        st.pos = (st.pos + 1) % n;
        utils.set(leaving, stackState(n - 1, st.order[n - 1]));
        layout(true);
        st.busy = false;
      };
      if (reduce) {
        settle();
        return;
      }
      animate(leaving, {
        x: 430,
        rotate: 15,
        opacity: 0,
        duration: 400,
        ease: 'outQuad',
        onComplete: settle,
      });
      return;
    }

    const returning = st.order[n - 1];
    st.order.unshift(st.order.pop() as number);
    st.pos = (st.pos + n - 1) % n;
    const el = cardRefs.current[returning];
    if (el) utils.set(el, { x: -430, rotate: -15, opacity: 0 });
    layout(true);
    timeoutRef.current = window.setTimeout(() => {
      st.busy = false;
    }, reduce ? 0 : 660);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (stateRef.current.busy || total < 2) return;
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      active: true,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const anime = animeRef.current;
    const d = drag.current;
    if (!d.active || !anime) return;
    const nx = event.clientX - d.startX;
    // A mostly-vertical move is the reader scrolling the page, not flicking.
    if (Math.abs(event.clientY - d.startY) > Math.abs(nx) + 14) return;
    d.dx = nx;
    const frontIdx = stateRef.current.order[0];
    const front = cardRefs.current[frontIdx];
    if (!front) return;
    anime.utils.set(front, {
      x: nx,
      rotate: TILTS[frontIdx % TILTS.length] * 0.4 + nx * 0.03,
    });
  }

  function endDrag() {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    if (Math.abs(d.dx) > THROW) advance(d.dx > 0 ? 1 : -1);
    else layout(true);
  }

  return (
    <section
      id="khoanh-khac"
      className="scroll-mt-16 border-t border-burgundy/12 bg-surface-low pt-[84px] pb-24"
    >
      <div className="mx-auto max-w-[35rem] px-6">
        <p className="text-[11px] tracking-[0.24em] text-gold-deep uppercase tabular-nums">
          II — Khoảnh khắc
        </p>
        <h2 className="mt-5 text-[clamp(34px,9.5vw,52px)] leading-[1.02] tracking-[-0.03em] text-balance text-burgundy">
          Mảnh ghép ký ức
        </h2>
        <div className="mt-[26px] mb-[18px] h-px bg-burgundy/15" />
        <p className="text-[15px] leading-[1.8] text-ink-soft">
          Những tấm ảnh rời rạc, xếp cạnh nhau thành một năm tháng.
        </p>

        {total === 0 ? (
          <div className="mt-8 border border-dashed border-hairline p-10 text-center">
            <p className="text-[15px] text-ink-soft italic">Album còn trống.</p>
            <p className="mt-2 text-[13px] text-ink-faint">
              Tải ảnh lên qua POST /api/uploads rồi tạo bản ghi ở /api/photos.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-3.5 mb-[26px] text-[11px] tracking-[0.2em] text-ink-soft/55 uppercase">
              Vuốt ngang để lật — {total} tấm
            </p>

            <div
              ref={revealRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerLeave={endDrag}
              className="relative h-[460px] touch-pan-y select-none"
            >
              {photos.map((photo, index) => (
                <figure
                  key={photo.id}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  style={staticStyle(index, index)}
                  className="absolute inset-x-0 top-0 mx-auto w-[min(292px,76vw)] cursor-grab border border-burgundy/15 bg-surface-lowest px-[13px] pt-[13px] pb-[46px] shadow-[0_18px_40px_-22px_rgb(74_4_4/0.35)] will-change-transform active:cursor-grabbing"
                >
                  <div className="relative block aspect-[4/5] w-full">
                    <Image
                      src={photo.imageUrl}
                      alt={photo.title ?? 'Ảnh kỷ niệm'}
                      fill
                      draggable={false}
                      sizes="(max-width: 400px) 76vw, 292px"
                      className="pointer-events-none object-cover contrast-[1.05] saturate-[0.82] sepia-[0.22]"
                    />
                  </div>
                  {photo.title ? (
                    <figcaption className="absolute inset-x-[13px] bottom-[15px] text-[15px] leading-[1.3] text-burgundy italic">
                      {photo.title}
                      {photo.subtitle ? (
                        <span className="mt-[3px] block text-[10px] tracking-[0.16em] text-ink-soft/60 not-italic uppercase">
                          {photo.subtitle}
                        </span>
                      ) : null}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>

            <div className="mt-1 flex items-center justify-between">
              <span
                aria-live="polite"
                className="text-[11px] tracking-[0.2em] text-ink-soft/60 tabular-nums"
              >
                {String(pos + 1).padStart(2, '0')} /{' '}
                {String(total).padStart(2, '0')}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => advance(-1)}
                  disabled={total < 2}
                  aria-label="Tấm trước"
                  className="rounded-frame grid h-[34px] w-[34px] place-items-center border border-gold/60 text-gold-deep transition-colors duration-300 hover:bg-gold/12 disabled:opacity-40"
                >
                  <CaretLeftIcon size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => advance(1)}
                  disabled={total < 2}
                  aria-label="Tấm sau"
                  className="rounded-frame grid h-[34px] w-[34px] place-items-center border border-gold/60 text-gold-deep transition-colors duration-300 hover:bg-gold/12 disabled:opacity-40"
                >
                  <CaretRightIcon size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
