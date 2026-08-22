'use client';

import Image from 'next/image';
import { assetUrl } from '@/lib/api';
import type { Milestone } from '@/lib/types';
import { useReveal } from './Reveal';

type Props = {
  title: string;
  intro: string;
  milestones: Milestone[];
};

/**
 * Chapter I. A single reading column: each milestone is a dated entry, its
 * photo printed underneath like a plate in an album rather than floated beside
 * the text. Order on the page is the order of the journey, nothing else.
 */
export function JourneyTimeline({ title, intro, milestones }: Props) {
  return (
    <section id="hanh-trinh" className="scroll-mt-16">
      <div className="mx-auto max-w-[35rem] px-6 pt-[84px] pb-6">
        <p className="text-[11px] tracking-[0.24em] text-gold-deep uppercase tabular-nums">
          I — Hành trình
        </p>
        <h2 className="mt-5 text-[clamp(34px,9.5vw,52px)] leading-[1.02] tracking-[-0.03em] text-balance text-burgundy">
          {title}
        </h2>
        <div className="mt-[26px] mb-[18px] h-px bg-burgundy/15" />
        <p className="text-[15px] leading-[1.8] text-pretty text-ink-soft">
          {intro}
        </p>
      </div>

      {milestones.length === 0 ? (
        <div className="mx-auto max-w-[35rem] px-6 pb-24">
          <div className="border border-dashed border-hairline p-10 text-center">
            <p className="text-[15px] text-ink-soft italic">
              Chưa có mốc thời gian nào được thêm.
            </p>
            <p className="mt-2 text-[13px] text-ink-faint">
              Thêm qua POST /api/milestones rồi tải lại trang.
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex max-w-[35rem] flex-col gap-16 px-6 pb-24">
          {milestones.map((milestone) => (
            <MilestoneEntry key={milestone.id} milestone={milestone} />
          ))}
        </div>
      )}
    </section>
  );
}

function MilestoneEntry({ milestone }: { milestone: Milestone }) {
  const ref = useReveal<HTMLElement>();

  return (
    <article ref={ref} className="flex flex-col gap-5">
      <div className="flex items-baseline gap-3.5">
        <span className="text-[11px] tracking-[0.2em] whitespace-nowrap text-gold-deep uppercase tabular-nums">
          {milestone.dateLabel}
        </span>
        <span className="h-px flex-1 bg-burgundy/15" />
      </div>

      <h3 className="text-[30px] leading-[1.1] tracking-[-0.02em] text-burgundy">
        {milestone.title}
      </h3>

      <p className="text-[15px] leading-[1.8] hyphens-auto text-pretty text-ink-soft">
        {milestone.body}
      </p>

      <figure>
        <div
          className="relative w-full border-[6px] border-surface-high ring-1 ring-ink/15"
          style={{ aspectRatio: milestone.aspect }}
        >
          <Image
            src={assetUrl(milestone.imageUrl)}
            alt={milestone.title}
            fill
            sizes="(max-width: 560px) 92vw, 520px"
            className="object-cover contrast-[1.05] saturate-[0.82] sepia-[0.22]"
          />
        </div>
        {milestone.caption ? (
          <figcaption className="mt-2.5 text-[11px] text-ink-soft/75 italic">
            {milestone.caption}
          </figcaption>
        ) : null}
      </figure>
    </article>
  );
}
