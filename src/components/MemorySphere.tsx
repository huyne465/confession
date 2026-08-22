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
const FLAKES = 42;

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
    out.push({
      yaw: Math.atan2(x, z) * DEG,
      pitch: Math.asin(-y) * DEG,
      dir: [x, y, z],
    });
  }
  return out;
}

/** How far toward the viewer a tile is once the globe has been turned. */
function frontness(dir: [number, number, number], rx: number, ry: number) {
  const sx = Math.sin(rx / DEG);
  const cx = Math.cos(rx / DEG);
  const sy = Math.sin(ry / DEG);
  const cy = Math.cos(ry / DEG);
  const [dx, dy, dz] = dir;
  // Rx(rx) · Ry(ry) · dir, z component only — the rest never gets used.
  return dy * sx + (-dx * sy + dz * cy) * cx;
}

/** Deterministic pseudo-random so the server and the client agree on the snow. */
function seeded(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

const SNOW = Array.from({ length: FLAKES }, (_, i) => ({
  left: seeded(i, 1) * 100,
  size: 1.6 + seeded(i, 2) * 3.4,
  duration: 5 + seeded(i, 3) * 7,
  delay: -seeded(i, 4) * 12,
  drift: (seeded(i, 5) - 0.5) * 60,
  opacity: 0.35 + seeded(i, 6) * 0.55,
  sway: 2 + seeded(i, 7) * 3,
}));

/** What was last written to a tile, so a frame that changes nothing writes nothing. */
type Applied = { blur: number; opacity: number; z: number };

export function MemorySphere({ title, intro, items }: Props) {
  const globeRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<Array<HTMLDivElement | null>>([]);
  const fullRefs = useRef<Array<HTMLImageElement | null>>([]);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const appliedRef = useRef<Applied[]>([]);
  const loadedFull = useRef(new Set<number>());

  const rot = useRef({ rx: -8, ry: 0, vx: 0, vy: 0 });
  const snap = useRef<{ rx: number; ry: number } | null>(null);
  const drag = useRef({ on: false, x: 0, y: 0, moved: false });
  const focusRef = useRef(-1);
  const radiusRef = useRef(150);
  const rafRef = useRef(0);

  const [focus, setFocus] = useState(-1);
  const reduce = useReducedMotion();

  const spots = placements(items.length);

  useEffect(() => {
    const globe = globeRef.current;
    const world = worldRef.current;
    if (!globe || !world || items.length === 0) return;
    const stage = world;

    let running = true;
    appliedRef.current = items.map(() => ({ blur: -1, opacity: -1, z: -1 }));

    const measure = () => {
      // Tiles orbit well inside the glass, or they clip through it.
      radiusRef.current = Math.max(96, (globe.clientWidth || 320) * 0.29);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(globe);

    function paint() {
      const { rx, ry } = rot.current;
      const R = radiusRef.current;
      stage.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;

      let best = -1;
      let bestZ = -2;
      for (let i = 0; i < spots.length; i++) {
        const f = frontness(spots[i].dir, rx, ry);
        if (f > bestZ) {
          bestZ = f;
          best = i;
        }
      }

      for (let i = 0; i < spots.length; i++) {
        const el = tileRefs.current[i];
        if (!el) continue;
        const near = Math.max(0, frontness(spots[i].dir, rx, ry));
        const isFocus = i === best;

        // transform is composited, so it can be written every frame for free.
        const scale = isFocus ? 1.28 : 0.72 + near * 0.2;
        el.style.transform =
          `rotateY(${spots[i].yaw}deg) rotateX(${spots[i].pitch}deg) ` +
          `translateZ(${R}px) scale(${scale.toFixed(3)})`;

        // filter and z-index are not. Quantise them and skip the write when the
        // value has not actually moved — this is what a slow spin costs.
        const prev = appliedRef.current[i];
        const blur = isFocus ? 0 : Math.round(((1 - near) * 5 + 0.4) * 4) / 4;
        const opacity = Math.round((0.22 + near * 0.78) * 50) / 50;
        const z = Math.round(near * 60);

        if (blur !== prev.blur) {
          el.style.filter =
            blur === 0
              ? 'none'
              : `blur(${blur}px) saturate(${(0.5 + near * 0.5).toFixed(2)})`;
          prev.blur = blur;
        }
        if (opacity !== prev.opacity) {
          el.style.opacity = String(opacity);
          prev.opacity = opacity;
        }
        if (z !== prev.z) {
          el.style.zIndex = String(z);
          prev.z = z;
        }
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
      const target = snap.current;

      if (target) {
        // Ease onto a tapped tile, and hand control back once it has arrived.
        r.rx += (target.rx - r.rx) * 0.12;
        r.ry += (target.ry - r.ry) * 0.12;
        if (Math.abs(target.rx - r.rx) < 0.05 && Math.abs(target.ry - r.ry) < 0.05) {
          r.rx = target.rx;
          r.ry = target.ry;
          snap.current = null;
        }
      } else if (!drag.current.on) {
        if (Math.abs(r.vx) > 0.001 || Math.abs(r.vy) > 0.001) {
          r.rx += r.vx;
          r.ry += r.vy;
          // Enough friction to settle in about a second, not a slot machine.
          r.vx *= 0.945;
          r.vy *= 0.945;
        } else if (!reduce) {
          r.ry += 0.06;
        }
      }
      // Past the poles the whole globe reads as upside down, so it stops there.
      if (!target) r.rx = Math.max(-52, Math.min(52, r.rx));
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
    snap.current = null;
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

    rot.current.ry += dx * 0.3;
    rot.current.rx -= dy * 0.26;
    rot.current.vy = dx * 0.3;
    rot.current.vx = -dy * 0.26;
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current.on) return;
    drag.current.on = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  /** Turn the globe until this tile faces the viewer. See the derivation above:
   *  bringing dir to +Z needs exactly rotateX(−pitch) rotateY(−yaw). */
  function bringToFront(index: number) {
    if (drag.current.moved) return;
    const spot = spots[index];
    if (!spot) return;
    const current = rot.current.ry;
    let wanted = -spot.yaw;
    // Take the short way round rather than unwinding a full turn.
    while (wanted - current > 180) wanted -= 360;
    while (wanted - current < -180) wanted += 360;
    snap.current = { rx: -spot.pitch, ry: wanted };
    rot.current.vx = 0;
    rot.current.vy = 0;
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const stepBy = 14;
    if (event.key === 'ArrowLeft') rot.current.ry -= stepBy;
    else if (event.key === 'ArrowRight') rot.current.ry += stepBy;
    else if (event.key === 'ArrowUp') rot.current.rx -= stepBy;
    else if (event.key === 'ArrowDown') rot.current.rx += stepBy;
    else return;
    snap.current = null;
    event.preventDefault();
  }

  const current = focus >= 0 ? items[focus] : undefined;

  return (
    <section
      id="loi-nhan"
      className="relative scroll-mt-16 overflow-hidden border-t border-gold/15 bg-stage pt-[84px] pb-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:radial-gradient(1px_1px_at_20%_18%,rgba(252,249,248,0.45),transparent),radial-gradient(1px_1px_at_68%_12%,rgba(252,249,248,0.3),transparent),radial-gradient(1.5px_1.5px_at_82%_44%,rgba(204,168,48,0.35),transparent),radial-gradient(1px_1px_at_34%_66%,rgba(252,249,248,0.25),transparent),radial-gradient(1px_1px_at_12%_86%,rgba(252,249,248,0.3),transparent)]"
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
          <div className="memory-globe relative mx-auto mt-12 w-[min(88vw,26rem)]">
            {/* Light pooled behind the glass, so the ball sits in the dark
                rather than being pasted on top of it. */}
            <div aria-hidden="true" className="globe-halo" />

            <div
              ref={globeRef}
              role="application"
              tabIndex={0}
              aria-label="Quả cầu ký ức. Kéo để xoay, chạm một tấm để đưa nó ra trước."
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onKeyDown}
              className="globe-ball relative aspect-square w-full cursor-grab touch-none select-none focus-visible:outline-none active:cursor-grabbing"
            >
              {/* The memories, orbiting inside the glass. */}
              <div ref={worldRef} className="globe-world">
                {items.map((item, i) => (
                  <div
                    key={item.id}
                    ref={(el) => {
                      tileRefs.current[i] = el;
                    }}
                    onClick={() => bringToFront(i)}
                    className="globe-tile"
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
                        <span aria-hidden="true" className="globe-play">
                          ▶
                        </span>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Snow, the drift it settles onto, and the glass over both. All
                  flat layers: clipping them would flatten the 3D underneath. */}
              {!reduce ? (
                <div aria-hidden="true" className="globe-snow">
                  {SNOW.map((flake, i) => (
                    <span
                      key={i}
                      style={{
                        left: `${flake.left}%`,
                        width: flake.size,
                        height: flake.size,
                        opacity: flake.opacity,
                        animationDuration: `${flake.duration}s, ${flake.sway}s`,
                        animationDelay: `${flake.delay}s, ${flake.delay}s`,
                        ['--drift' as string]: `${flake.drift}px`,
                      }}
                    />
                  ))}
                </div>
              ) : null}

              <div aria-hidden="true" className="globe-drift" />
              <div aria-hidden="true" className="globe-glass" />
              <div aria-hidden="true" className="globe-shine" />
            </div>

            {/* The pedestal the ball rests in. */}
            <div aria-hidden="true" className="globe-base">
              <div className="globe-base-rim" />
              <div className="globe-base-body" />
              <div className="globe-base-foot" />
            </div>
          </div>

          {/* The caption sits still while the globe moves under it. */}
          <div className="relative mx-auto mt-9 flex min-h-[76px] max-w-[35rem] flex-col items-center px-6 text-center">
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
              {items.length} khoảnh khắc — kéo để xoay, chạm để xem
            </p>
          </div>
        </>
      )}

      <style jsx>{`
        .memory-globe {
          --ball: 100%;
          animation: globe-bob 7s ease-in-out infinite;
        }

        .globe-halo {
          position: absolute;
          inset: -14% -14% 6%;
          border-radius: 9999px;
          background: radial-gradient(
            circle at 50% 42%,
            rgba(204, 168, 48, 0.16) 0%,
            rgba(157, 65, 57, 0.08) 38%,
            transparent 68%
          );
          filter: blur(18px);
          pointer-events: none;
        }

        .globe-ball {
          border-radius: 9999px;
          perspective: 900px;
          perspective-origin: 50% 45%;
          /* The glass body itself: dark, cold, faintly lit from within. */
          background:
            radial-gradient(
              circle at 32% 26%,
              rgba(214, 232, 255, 0.18) 0%,
              rgba(120, 150, 190, 0.07) 26%,
              transparent 52%
            ),
            radial-gradient(
              circle at 50% 108%,
              rgba(204, 168, 48, 0.18) 0%,
              transparent 46%
            ),
            radial-gradient(circle at 50% 50%, #14171d 0%, #0a0b0e 74%, #06070a 100%);
          box-shadow:
            inset 0 6px 34px rgba(190, 215, 255, 0.14),
            inset 0 -22px 46px rgba(0, 0, 0, 0.75),
            0 30px 60px -28px rgba(0, 0, 0, 0.9);
        }

        .globe-world {
          position: absolute;
          top: 46%;
          left: 50%;
          width: 0;
          height: 0;
          transform-style: preserve-3d;
        }

        .globe-tile {
          position: absolute;
          width: 74px;
          height: 74px;
          margin-left: -37px;
          margin-top: -37px;
          overflow: hidden;
          border-radius: 2px;
          background: #1a1614;
          box-shadow:
            0 0 0 1px rgba(252, 249, 248, 0.14),
            0 8px 22px -10px rgba(0, 0, 0, 0.9);
          backface-visibility: hidden;
          will-change: transform, opacity;
          cursor: pointer;
        }

        @media (min-width: 640px) {
          .globe-tile {
            width: 88px;
            height: 88px;
            margin-left: -44px;
            margin-top: -44px;
          }
        }

        .globe-play {
          position: absolute;
          right: 3px;
          bottom: 3px;
          display: grid;
          place-items: center;
          width: 15px;
          height: 15px;
          border-radius: 9999px;
          background: rgba(11, 10, 9, 0.72);
          color: #cca830;
          font-size: 8px;
          line-height: 1;
        }

        /* Snow falls in a flat layer clipped to the ball. It has no business
           being inside the preserve-3d chain, which overflow would flatten. */
        .globe-snow {
          position: absolute;
          inset: 0;
          overflow: hidden;
          border-radius: 9999px;
          pointer-events: none;
        }

        .globe-snow span {
          position: absolute;
          top: -8%;
          border-radius: 9999px;
          background: #f2f7ff;
          box-shadow: 0 0 4px rgba(226, 240, 255, 0.7);
          will-change: transform;
          animation-name: flake-fall, flake-sway;
          animation-timing-function: linear, ease-in-out;
          animation-iteration-count: infinite, infinite;
        }

        /* The drift the snow settles into, at the foot of the glass. */
        .globe-drift {
          position: absolute;
          right: 8%;
          bottom: -2%;
          left: 8%;
          height: 26%;
          border-radius: 50% 50% 46% 46% / 100% 100% 34% 34%;
          background: linear-gradient(
            to bottom,
            rgba(226, 240, 255, 0.5),
            rgba(150, 180, 215, 0.16) 55%,
            transparent
          );
          filter: blur(6px);
          pointer-events: none;
        }

        /* Fresnel: glass goes opaque at the grazing edge, clear in the middle. */
        .globe-glass {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          pointer-events: none;
          background: radial-gradient(
            circle at 50% 50%,
            transparent 56%,
            rgba(150, 180, 220, 0.1) 78%,
            rgba(210, 232, 255, 0.26) 93%,
            rgba(255, 255, 255, 0.42) 100%
          );
          /* No backdrop-filter: it forces a readback of everything behind the
             ball on every frame of the spin, which is exactly the cost this
             scene cannot pay on a phone. The gradients carry the glass alone. */
          box-shadow: inset 0 0 0 1px rgba(226, 240, 255, 0.24);
        }

        /* Two specular highlights: the broad one from the key light and the
           narrow crescent that reads as curvature. */
        .globe-shine {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          pointer-events: none;
          overflow: hidden;
        }

        .globe-shine::before {
          content: '';
          position: absolute;
          top: 8%;
          left: 14%;
          width: 34%;
          height: 22%;
          border-radius: 9999px;
          background: linear-gradient(
            140deg,
            rgba(255, 255, 255, 0.5),
            rgba(255, 255, 255, 0.05) 70%
          );
          transform: rotate(-24deg);
          filter: blur(7px);
        }

        .globe-shine::after {
          content: '';
          position: absolute;
          right: 10%;
          bottom: 16%;
          width: 26%;
          height: 9%;
          border-radius: 9999px;
          background: linear-gradient(
            to right,
            transparent,
            rgba(214, 234, 255, 0.4),
            transparent
          );
          transform: rotate(28deg);
          filter: blur(5px);
        }

        /* Pedestal: a faceted band under the glass, warm against all that cold. */
        .globe-base {
          position: relative;
          margin: -7% auto 0;
          width: 62%;
          filter: drop-shadow(0 26px 26px rgba(0, 0, 0, 0.6));
        }

        .globe-base-rim {
          height: 14px;
          border-radius: 9999px;
          background: linear-gradient(
            to bottom,
            rgba(76, 62, 48, 0.95),
            rgba(34, 27, 22, 1)
          );
          box-shadow: inset 0 2px 4px rgba(226, 240, 255, 0.16);
        }

        .globe-base-body {
          height: 46px;
          margin-top: -6px;
          clip-path: polygon(0 0, 100% 0, 88% 100%, 12% 100%);
          background:
            linear-gradient(
              to right,
              #17120f 0%,
              #2e2521 14%,
              #4a3a2c 32%,
              #2b221c 52%,
              #3d3026 72%,
              #1a1512 100%
            );
          border-bottom: 1px solid rgba(204, 168, 48, 0.28);
        }

        .globe-base-foot {
          height: 9px;
          width: 86%;
          margin: 0 auto;
          clip-path: polygon(0 0, 100% 0, 94% 100%, 6% 100%);
          background: linear-gradient(to right, #100d0b, #241d18 40%, #0e0b09);
        }

        @keyframes globe-bob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        @keyframes flake-fall {
          from {
            top: -8%;
          }
          to {
            top: 104%;
          }
        }

        @keyframes flake-sway {
          0%,
          100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(var(--drift));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .memory-globe {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
