'use client';

import { useEffect, useState } from 'react';

const LINKS = [
  { href: '#hanh-trinh', label: 'Hành trình' },
  { href: '#khoanh-khac', label: 'Khoảnh khắc' },
  { href: '#loi-nhan', label: 'Ký ức' },
  { href: '#ket-thuc', label: 'Kết thúc' },
];

export function SiteNav({ title }: { title: string }) {
  const [active, setActive] = useState('#hanh-trinh');
  const [onStage, setOnStage] = useState(true);

  // The piano stage is full-bleed and dark; a light bar over it would break it.
  useEffect(() => {
    const stage = document.getElementById('san-khau');
    if (!stage) {
      setOnStage(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setOnStage(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // The nav mirrors scroll position so the reader always knows where they are.
  useEffect(() => {
    const sections = LINKS.map((link) =>
      document.querySelector<HTMLElement>(link.href),
    ).filter((el): el is HTMLElement => Boolean(el));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(`#${visible.target.id}`);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      aria-hidden={onStage}
      className={`fixed inset-x-0 top-0 z-40 h-[64px] border-b border-hairline/50 bg-surface/85 backdrop-blur-md transition-all duration-500 ${
        onStage
          ? 'pointer-events-none -translate-y-full opacity-0'
          : 'translate-y-0 opacity-100'
      }`}
    >
      <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <a
          href="#hanh-trinh"
          className="text-lg text-burgundy italic sm:text-xl"
        >
          {title}
        </a>

        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-[13px] tracking-[0.16em] uppercase transition-colors duration-300 ${
                active === link.href
                  ? 'border-b border-gold-deep pb-0.5 text-gold-deep'
                  : 'text-ink-soft/80 hover:text-gold-deep'
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Mobile: one compact jump to the ending, no hamburger for 4 anchors. */}
        <a
          href="#ket-thuc"
          className="rounded-frame border border-gold px-3 py-1.5 text-[12px] tracking-[0.16em] text-gold-deep uppercase md:hidden"
        >
          Kết thúc
        </a>
      </div>
    </header>
  );
}
