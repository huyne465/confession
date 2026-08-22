'use client';

import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

/**
 * Light sections rise as they enter. One observer for the whole page and one
 * lazily-loaded anime module, so a section costs a ref and nothing else.
 */
let observer: IntersectionObserver | null = null;
let animeModule: Promise<typeof import('animejs')> | null = null;

function ensureObserver(): IntersectionObserver {
  if (observer) return observer;
  animeModule = animeModule ?? import('animejs');
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer?.unobserve(entry.target);
        const el = entry.target as HTMLElement;
        void animeModule?.then(({ animate, createSpring }) =>
          animate(el, {
            opacity: [0, 1],
            y: [34, 0],
            duration: 900,
            ease: createSpring({ stiffness: 78, damping: 16 }),
          }),
        );
      });
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
  );
  return observer;
}

export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || !('IntersectionObserver' in window)) {
      el.style.opacity = '1';
      return;
    }
    el.style.opacity = '0';
    const io = ensureObserver();
    io.observe(el);
    return () => io.unobserve(el);
  }, [reduce]);

  return ref;
}
