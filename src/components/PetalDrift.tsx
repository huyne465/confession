'use client';

import { useReducedMotion } from 'motion/react';
import { useMemo } from 'react';

/** Deterministic pseudo-random so server and client markup agree. */
function seeded(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * The slow drift from the Stitch "Hiệu ứng Tuyết rơi" variants. Purely
 * atmospheric, so it is scoped to one section, runs on transform and opacity
 * only, and disappears entirely under prefers-reduced-motion.
 */
export function PetalDrift({ count = 26 }: { count?: number }) {
  const reduce = useReducedMotion();

  const petals = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: seeded(i, 1) * 100,
        size: 4 + seeded(i, 2) * 6,
        duration: 14 + seeded(i, 3) * 14,
        delay: -seeded(i, 4) * 24,
        drift: `${(seeded(i, 5) - 0.5) * 120}px`,
        opacity: 0.25 + seeded(i, 6) * 0.4,
      })),
    [count],
  );

  if (reduce) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {petals.map((petal, i) => (
        <span
          key={i}
          className="petal"
          style={{
            left: `${petal.left}%`,
            width: petal.size,
            height: petal.size,
            opacity: petal.opacity,
            animationDuration: `${petal.duration}s`,
            animationDelay: `${petal.delay}s`,
            ['--drift' as string]: petal.drift,
          }}
        />
      ))}

      <style jsx>{`
        .petal {
          position: absolute;
          top: -6%;
          border-radius: 9999px;
          background-color: #cca830;
          will-change: transform;
          animation-name: petal-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes petal-fall {
          from {
            transform: translate3d(0, -10vh, 0);
          }
          to {
            transform: translate3d(var(--drift), 110vh, 0);
          }
        }
      `}</style>
    </div>
  );
}
