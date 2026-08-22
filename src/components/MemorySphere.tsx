'use client';

import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { assetUrl } from '@/lib/api';
import type { Photo } from '@/lib/types';

type Props = {
  title: string;
  intro: string;
  items: Photo[];
};

/** Where a tile sits on the sphere, as the two CSS rotations that put it there. */
type Placement = {
  /** rotateY, degrees. */
  yaw: number;
  /** rotateX, degrees. */
  pitch: number;
  /** Unit vector the tile points along before the sphere itself is turned. */
  dir: [number, number, number];
};

const DEG = 180 / Math.PI;

/**
 * A Fibonacci lattice: the only cheap way to scatter points over a sphere with
 * no clumping at the poles, which every naive lat/long grid does.
 */
function placements(count: number): Placement[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: Placement[] = [];
  for (let i = 0; i < count; i++) {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;

    // Solve rotateY(yaw) rotateX(pitch) translateZ(R) for this direction:
    // the result is (cos p · sin y, −sin p, cos p · cos y).
    const pitch = Math.asin(-y);
    const yaw = Math.atan2(x, z);
    out.push({ yaw: yaw * DEG, pitch: pitch * DEG, dir: [x, y, z] });
  }
  return out;
}

/** How far toward the viewer a tile is once the sphere has been turned. */
function frontness(dir: [number, number, number], rx: number, ry: number) {
  const sx = Math.sin(rx / DEG);
  const cx = Math.cos(rx / DEG);
  const sy = Math.sin(ry / DEG);
  const cy = Math.cos(ry / DEG);
  const [dx, dy, dz] = dir;
  // Rx(rx) · Ry(ry) · dir, z component only — the rest never gets used.
  const z = -dx * sy + dz * cy;
  return dy * sx + z * cx;
}

export function MemorySphere({ title, intro, items }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<Array<HTMLDivElement | null>>([]);
  const fullRefs = useRef<Array<HTMLImageElement | null>>([]);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const loadedFull = useRef(new Set<number>());

  const rot = useRef({ rx: -8, ry: 0, vx: 0, vy: 0 });
  const drag = useRef({ on: false, x: 0, y: 0, moved: false });
  const focusRef = useRef(-1);
  const radiusRef = useRef(220);
  const rafRef = useRef(0);

  const [focus, setFocus] = useState(-1);
  const reduce = useReducedMotion();

  const spots = placements(items.length);

  useEffect(() => {
    const wrap = wrapRef.current;
    const world: HTMLDivElement | null = worldRef.current;
    if (!wrap || !world || items.length === 0) return;
    const stage = world;

    let running = true;

    const measure = () => {
      const w = wrap.clientWidth || 320;
      const h = wrap.clientHeight || 420;
      radiusRef.current = Math.max(150, Math.min(280, Math.min(w, h) * 0.44));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);

    function paint() {
      const { rx, ry } = rot.current;
      const R = radiusRef.current;
      stage.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;

      let best = -1;
      let bestZ = -2;
      const fronts: number[] = [];

      for (let i = 0; i < spots.length; i++) {
        const f = frontness(spots[i].dir, rx, ry);
        fronts.push(f);
        if (f > bestZ) {
          bestZ = f;
          best = i;
        }
      }

      for (let i = 0; i < spots.length; i++) {
        const el = tileRefs.current[i];
        if (!el) continue;
        const f = fronts[i];
        // f runs −1 (behind) to 1 (facing the viewer).
        const near = Math.max(0, f);
        const isFocus = i === best;
        const blur = isFocus ? 0 : (1 - near) * 7 + 0.6;
        const scale = isFocus ? 1.22 : 0.82 + near * 0.16;
        el.style.transform =
          `rotateY(${spots[i].yaw}deg) rotateX(${spots[i].pitch}deg) ` +
          `translateZ(${R}px) scale(${scale})`;
        el.style.filter = `blur(${blur.toFixed(2)}px) saturate(${(0.55 + near * 0.45).toFixed(2)})`;
        el.style.opacity = String(0.3 + near * 0.7);
        el.style.zIndex = String(Math.round(near * 100));
      }

      if (best !== focusRef.current) {
        focusRef.current = best;
        setFocus(best);
      }
    }

    function step() {
      if (!running) return;
      rafRef.current = requestAnimationFrame(step);
      const r = rot.current;

      if (!drag.current.on) {
        if (Math.abs(r.vx) > 0.001 || Math.abs(r.vy) > 0.001) {
          r.rx += r.vx;
          r.ry += r.vy;
          // Enough friction to settle in about a second, not a slot machine.
          r.vx *= 0.94;
          r.vy *= 0.94;
        } else if (!reduce) {
          r.ry += 0.07;
        }
      }
      // Past the poles the whole sphere reads as upside down, so it stops there.
      r.rx = Math.max(-58, Math.min(58, r.rx));
      paint();
    }

    paint();
    rafRef.current = requestAnimationFrame(step);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
    // spots is derived from items.length, which is the only thing that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, reduce]);

  // Only the focused tile earns its full-resolution file and, for a clip, the
  // right to play. Everything else stays a thumbnail on a paused element.
  useEffect(() => {
    if (focus < 0) return;
    const item = items[focus];
    if (!item) return;

    if (item.fullUrl && !loadedFull.current.has(focus)) {
      const img = fullRefs.current[focus];
      if (img) {
        img.src = assetUrl(item.fullUrl);
        loadedFull.current.add(focus);
      }
    }

    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      if (i === focus) {
        if (!video.src && items[i].videoUrl) video.src = assetUrl(items[i].videoUrl);
        void video.play().catch(() => {
          // Autoplay can still be refused. A poster frame is a fine fallback.
        });
      } else if (!video.paused) {
        video.pause();
      }
    });
  }, [focus, items]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    drag.current = { on: true, x: event.clientX, y: event.clientY, moved: false };
    rot.current.vx = 0;
    rot.current.vy = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d.on) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    d.x = event.clientX;
    d.y = event.clientY;

    rot.current.ry += dx * 0.32;
    rot.current.rx -= dy * 0.28;
    rot.current.vy = dx * 0.32;
    rot.current.vx = -dy * 0.28;
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current.on) return;
    drag.current.on = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const stepBy = 14;
    if (event.key === 'ArrowLeft') rot.current.ry -= stepBy;
    else if (event.key === 'ArrowRight') rot.current.ry += stepBy;
    else if (event.key === 'ArrowUp') rot.current.rx -= stepBy;
    else if (event.key === 'ArrowDown') rot.current.rx += stepBy;
    else return;
    event.preventDefault();
  }

  const current = focus >= 0 ? items[focus] : undefined;

  return (
    <section
      id="loi-nhan"
      className="relative scroll-mt-16 overflow-hidden border-t border-gold/15 bg-stage pt-[84px] pb-24"
    >
      {/* A field of faint stars, so the sphere reads as suspended in something. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(1px_1px_at_20%_18%,rgba(252,249,248,0.5),transparent),radial-gradient(1px_1px_at_68%_12%,rgba(252,249,248,0.35),transparent),radial-gradient(1.5px_1.5px_at_82%_44%,rgba(204,168,48,0.4),transparent),radial-gradient(1px_1px_at_34%_62%,rgba(252,249,248,0.3),transparent),radial-gradient(1px_1px_at_12%_82%,rgba(252,249,248,0.35),transparent),radial-gradient(1.5px_1.5px_at_58%_88%,rgba(204,168,48,0.3),transparent)]"
      />

      <div className="relative mx-auto max-w-[35rem] px-6">
        <p className="text-[11px] tracking-[0.24em] text-gold uppercase tabular-nums">
          III — Ký ức
        </p>
        <h2 className="mt-5 text-[clamp(34px,9.5vw,52px)] leading-[1.02] tracking-[-0.03em] text-balance text-surface">
          {title}
        </h2>
        <div className="mt-[26px] mb-[18px] h-px bg-gold/25" />
        <p className="text-[15px] leading-[1.8] text-pretty text-surface/70">
          {intro}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="relative mx-auto mt-8 max-w-[35rem] px-6">
          <div className="border border-dashed border-surface/20 p-10 text-center">
            <p className="text-[15px] text-surface/60 italic">
              Chưa có ký ức nào trong quả cầu.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div
            ref={wrapRef}
            role="application"
            tabIndex={0}
            aria-label="Quả cầu ký ức. Kéo hoặc dùng phím mũi tên để xoay."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
            className="relative mt-10 h-[clamp(340px,74vw,540px)] w-full cursor-grab touch-none select-none [perspective:1100px] focus-visible:outline-none active:cursor-grabbing"
          >
            <div
              ref={worldRef}
              className="absolute top-1/2 left-1/2 h-0 w-0 [transform-style:preserve-3d]"
            >
              {items.map((item, i) => (
                <div
                  key={item.id}
                  ref={(el) => {
                    tileRefs.current[i] = el;
                  }}
                  className="absolute h-[86px] w-[86px] -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-surface/15 bg-stage-soft shadow-[0_10px_30px_-12px_rgb(0_0_0/0.8)] [backface-visibility:hidden] sm:h-[104px] sm:w-[104px]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={assetUrl(item.imageUrl)}
                    alt={item.title ?? 'Một khoảnh khắc'}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="absolute inset-0 h-full w-full object-cover"
                  />

                  {/* The sharp copy fades in over the thumbnail once focused. */}
                  {item.fullUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      ref={(el) => {
                        fullRefs.current[i] = el;
                      }}
                      alt=""
                      aria-hidden="true"
                      decoding="async"
                      draggable={false}
                      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                        focus === i ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  ) : null}

                  {item.mediaType === 'video' ? (
                    <>
                      <video
                        ref={(el) => {
                          videoRefs.current[i] = el;
                        }}
                        muted
                        loop
                        playsInline
                        preload="none"
                        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                          focus === i ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <span
                        aria-hidden="true"
                        className="absolute right-1 bottom-1 grid h-4 w-4 place-items-center rounded-full bg-stage/70 text-[8px] text-gold"
                      >
                        ▶
                      </span>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* The caption sits still while the sphere moves under it. */}
          <div className="relative mx-auto mt-2 flex min-h-[76px] max-w-[35rem] flex-col items-center px-6 text-center">
            <p
              aria-live="polite"
              className="text-[19px] leading-[1.2] text-surface italic"
            >
              {current?.title ?? ''}
            </p>
            {current?.subtitle ? (
              <p className="mt-2 text-[11px] tracking-[0.2em] text-gold/80 uppercase">
                {current.subtitle}
              </p>
            ) : null}
            <p className="mt-4 text-[11px] tracking-[0.2em] text-surface/35 uppercase tabular-nums">
              {items.length} khoảnh khắc — kéo để xoay
            </p>
          </div>
        </>
      )}
    </section>
  );
}
