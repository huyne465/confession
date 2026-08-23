export function SiteFooter({ text }: { text: string }) {
  return (
    <footer className="border-t border-gold/20 bg-stage px-6 pt-11 pb-13">
      <div className="mx-auto flex max-w-[35rem] flex-col items-center gap-2.5 text-center">
        <p className="text-[clamp(20px,5.4vw,26px)] leading-[1.3] text-balance text-surface/85 italic">
          {text}
        </p>
        <p className="text-[11px] tracking-[0.2em] text-surface/35 uppercase tabular-nums">
          since 2015
        </p>
      </div>
    </footer>
  );
}
