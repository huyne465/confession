'use client';

import Image from 'next/image';
import type { Message } from '@/lib/types';
import { PetalDrift } from './PetalDrift';

type Props = {
  title: string;
  intro: string;
  messages: Message[];
};

/**
 * Chapter III. The letters lie in a row and are read by swiping: native
 * scroll-snap owns the gesture, so it stays as smooth as the page itself and
 * costs no carousel runtime.
 */
export function MessageCarousel({ title, intro, messages }: Props) {
  return (
    <section
      id="loi-nhan"
      className="relative scroll-mt-16 overflow-hidden border-t border-burgundy/12 pt-[84px] pb-24"
    >
      <PetalDrift />

      <div className="relative mx-auto max-w-[35rem] px-6">
        <p className="text-[11px] tracking-[0.24em] text-gold-deep uppercase tabular-nums">
          III — Lời nhắn
        </p>
        <h2 className="mt-5 text-[clamp(34px,9.5vw,52px)] leading-[1.02] tracking-[-0.03em] text-balance text-burgundy">
          {title}
        </h2>
        <div className="mt-[26px] mb-[18px] h-px bg-burgundy/15" />
        <p className="text-[15px] leading-[1.8] text-ink-soft">{intro}</p>
        {messages.length > 0 ? (
          <p className="mt-3.5 text-[11px] tracking-[0.2em] text-ink-soft/55 uppercase">
            Vuốt ngang để đọc — {messages.length} lá
          </p>
        ) : null}
      </div>

      {messages.length === 0 ? (
        <div className="relative mx-auto mt-8 max-w-[35rem] px-6">
          <div className="border border-dashed border-hairline p-10 text-center">
            <p className="text-[15px] text-ink-soft italic">
              Chưa có lời nhắn nào.
            </p>
            <p className="mt-2 text-[13px] text-ink-faint">
              Thêm qua POST /api/messages rồi tải lại trang.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative mt-[30px] flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {messages.map((message) => (
            <Letter key={message.id} message={message} />
          ))}
        </div>
      )}
    </section>
  );
}

function Letter({ message }: { message: Message }) {
  return (
    <article
      className="w-[min(300px,78vw)] flex-none snap-center border border-burgundy/15 bg-surface p-6"
    >
      <div className="relative aspect-[4/5] w-full border-[6px] border-surface-high ring-1 ring-ink/15">
        <Image
          src={message.imageUrl}
          alt={message.title}
          fill
          sizes="(max-width: 420px) 78vw, 300px"
          className="object-cover contrast-[1.05] saturate-[0.82] sepia-[0.22]"
        />
      </div>

      {message.photoCaption ? (
        <p className="mt-2.5 text-[11px] text-ink-soft/75 italic">
          {message.photoCaption}
        </p>
      ) : null}

      <p aria-hidden="true" className="mt-[18px] text-[30px] leading-[0.4] text-gold/75">
        “
      </p>

      <h3 className="mt-3.5 mb-3 text-[26px] leading-[1.12] tracking-[-0.02em] text-burgundy">
        {message.title}
      </h3>

      <p className="text-[14px] leading-[1.8] text-pretty text-ink-soft">
        {message.body}
      </p>

      {message.signature ? (
        <div className="mt-[22px] flex items-center gap-3 border-t border-burgundy/12 pt-3.5">
          <span className="text-[11px] tracking-[0.2em] text-gold-deep uppercase">
            {message.signature}
          </span>
        </div>
      ) : null}
    </article>
  );
}
