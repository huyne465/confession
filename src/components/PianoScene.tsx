'use client';

import { SpeakerHighIcon, SpeakerSlashIcon } from '@phosphor-icons/react/dist/ssr';
import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createStage, type Stage } from '@/lib/piano-3d';

type Anime = typeof import('animejs');
type Timeline = ReturnType<Anime['createTimeline']>;

export type PianoNote = {
  eyebrow: string;
  title: string;
  body: string;
};

type Props = {
  /** Headline over the open lid, split into words and staggered in. */
  opening?: string;
  /** Eight memories, one per camera shot. */
  notes?: PianoNote[];
  /** Stretches the scrolled section; 1 = the 940vh baseline. */
  sceneLength?: number;
  /** Start silent. The reader can still unmute from the stage. */
  startMuted?: boolean;
};

const DEFAULT_OPENING =
  'Anh rất thích nghe những bản piano mà em đánh cho anh nghe';

const DEFAULT_NOTES: PianoNote[] = [
  {
    eyebrow: 'Điều thứ nhất',
    title: 'Lần đầu Em đàn',
    body: 'Anh chỉ nói là hay. Anh không nói rằng tay anh lạnh đi vì hồi hộp, và đoạn nhạc đó chạy trong đầu anh suốt cả tuần sau.',
  },
  {
    eyebrow: 'Điều thứ hai',
    title: 'Cái nốt Em đánh sai',
    body: 'Mỗi lần Em bấm sai một nốt rồi bật cười, anh lại thấy bản nhạc đó thành của riêng hai đứa.',
  },
  {
    eyebrow: 'Điều thứ ba',
    title: 'Ba mươi lần một câu',
    body: 'Em tập một câu nhạc ba mươi lần. Anh ngồi đó, không mở điện thoại lần nào, chỉ chờ nghe lần thứ ba mươi mốt.',
  },
  {
    eyebrow: 'Điều thứ tư',
    title: '“Mai đàn tiếp nhé”',
    body: 'Em nói câu đó như chuyện thường ngày. Với anh, chính những buổi “mai đàn tiếp” ấy giữ anh đi qua cả tuần dài.',
  },
  {
    eyebrow: 'Điều thứ năm',
    title: 'Bàn tay Em trên phím',
    body: 'Anh nhớ tay Em nhiều hơn nhớ bài nhạc. Nhớ cả cái cách Em dừng lại, xoa hai bàn tay vào nhau khi trời lạnh.',
  },
  {
    eyebrow: 'Điều thứ sáu',
    title: 'Bài Em đàn cho anh',
    body: 'Có một tối Em bảo bài này đàn cho anh. Anh không nói thêm được gì, chỉ ngồi im để nghe cho hết.',
  },
  {
    eyebrow: 'Điều thứ bảy',
    title: 'Những lần anh im lặng',
    body: 'Anh im không phải vì không có gì để nói. Là vì anh chưa tìm ra cách nói cho vừa đủ.',
  },
  {
    eyebrow: 'Điều thứ tám',
    title: 'Điều anh giữ tới cuối',
    body: 'Anh muốn còn được nghe Em đàn thêm nhiều năm nữa. Câu đó, hôm nay anh nói ở đây, trước khi trang cuối mở ra.',
  },
];

const FREQS = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];

/**
 * Azimuth walks a full turn; elevation climbs over the spine side, where the
 * closed face of the lid would otherwise be all there is to look at.
 */
const SHOTS = [
  { az: 30, el: 16, dist: 5.0 },
  { az: 68, el: 24, dist: 4.6 },
  { az: 104, el: 32, dist: 4.9 },
  { az: 140, el: 42, dist: 5.2 },
  { az: 176, el: 24, dist: 4.7 },
  { az: 208, el: 16, dist: 5.4 },
  { az: 152, el: 12, dist: 4.4 },
  { az: 14, el: 20, dist: 4.2 },
];

const TICK_ON = 'rgba(204,168,48,0.85)';
const TICK_OFF = 'rgba(252,249,248,0.14)';

type Engine = {
  anime: Anime;
  stage: Stage;
  tl: Timeline;
  cam: { az: number; el: number; dist: number; lid: number; paper: number };
  active: number;
  camDirty: boolean;
  openingDone: boolean;
  raf: number;
};

/**
 * The whole opening act: a scrubbed camera move around a 3D grand piano, eight
 * memories handed over one shot at a time, then the lid closing as the page
 * wipes to paper. Scroll drives an anime timeline; nothing plays on its own.
 */
export function PianoScene({
  opening = DEFAULT_OPENING,
  notes = DEFAULT_NOTES,
  sceneLength = 1,
  startMuted = false,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const noteRefs = useRef<Array<HTMLDivElement | null>>([]);
  const tickRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const engineRef = useRef<Engine | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(startMuted);

  const [muted, setMuted] = useState(startMuted);
  const reduce = useReducedMotion();

  const count = notes.length;
  const words = opening.split(' ');

  /** One soft struck note per memory. Replaced by the album track when added. */
  const playNote = useCallback((index: number) => {
    if (mutedRef.current) return;
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    audioRef.current = audioRef.current ?? new Ctx();
    const ctx = audioRef.current;
    if (ctx.state === 'suspended') void ctx.resume();

    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.11, t + 0.012);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    out.connect(lp).connect(ctx.destination);

    [1, 2, 3].forEach((harmonic, n) => {
      const osc = ctx.createOscillator();
      osc.type = n === 0 ? 'triangle' : 'sine';
      osc.frequency.value = FREQS[index % FREQS.length] * harmonic;
      const gain = ctx.createGain();
      gain.gain.value = [0.9, 0.22, 0.08][n];
      osc.connect(gain).connect(out);
      osc.start(t);
      osc.stop(t + 2.8);
    });
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    let cancelled = false;
    let stage: Stage | null = null;
    let onScroll: (() => void) | null = null;
    let onCurtain: (() => void) | null = null;

    const spring = (anime: Anime, stiffness: number, damping: number) =>
      anime.createSpring({ stiffness, damping });

    /** One scrubbed anime timeline: intro, eight notes, then the lid closing. */
    function buildTimeline(anime: Anime, cam: Engine['cam']): Timeline {
      const tl = anime.createTimeline({
        autoplay: false,
        defaults: { duration: 1000, ease: 'inOutQuad' },
      });
      tl.add(cam, { az: 12, el: 17, dist: 4.9 }, 0);
      SHOTS.slice(0, count).forEach((shot, i) => {
        tl.add(cam, shot, 1000 * (i + 1));
      });
      tl.add(
        cam,
        { az: -10, el: 26, dist: 7.2, lid: 0.06, paper: 1 },
        1000 * (count + 1),
      );
      return tl;
    }

    function playOpening(engine: Engine) {
      if (engine.openingDone) return;
      engine.openingDone = true;
      const els = wordRefs.current.filter(
        (el): el is HTMLSpanElement => el !== null,
      );
      if (els.length === 0) return;
      const { animate, stagger, utils } = engine.anime;
      if (reduce) {
        utils.set(els, { opacity: 1, y: 0 });
        return;
      }
      animate(els, {
        opacity: [0, 1],
        y: [26, 0],
        delay: stagger(58),
        duration: 900,
        ease: spring(engine.anime, 90, 14),
      });
    }

    function goToNote(engine: Engine, idx: number) {
      const { animate } = engine.anime;
      const prev = noteRefs.current[engine.active];
      const next = noteRefs.current[idx];
      const forward = idx > engine.active;
      engine.active = idx;

      if (prev && prev !== next) {
        animate(prev, {
          opacity: 0,
          y: forward ? -22 : 22,
          duration: reduce ? 1 : 380,
          ease: 'outQuad',
        });
      }
      if (next) {
        animate(next, {
          opacity: [0, 1],
          y: reduce ? [0, 0] : [forward ? 30 : -30, 0],
          duration: reduce ? 1 : 820,
          ease: reduce ? 'linear' : spring(engine.anime, 84, 15),
        });
        if (idx === 0) engine.openingDone = false;
      }

      const counter = counterRef.current;
      if (counter) {
        counter.textContent =
          idx === 0
            ? 'Tám điều chưa nói'
            : `Nốt 0${idx} / 0${count}`;
      }

      tickRefs.current.forEach((tick, i) => {
        if (!tick) return;
        animate(tick, {
          backgroundColor: i < idx ? TICK_ON : TICK_OFF,
          duration: reduce ? 1 : 420,
          ease: 'outQuad',
        });
      });

      if (idx > 0) playNote(idx - 1);
    }

    function tick(engine: Engine) {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const span = el.offsetHeight - window.innerHeight;
      const p = Math.min(1, Math.max(0, -rect.top / Math.max(1, span)));
      engine.tl.seek(p * engine.tl.duration);
      engine.camDirty = true;

      const idx = Math.min(count, Math.max(0, Math.floor(p * (count + 2))));
      if (idx !== engine.active) goToNote(engine, idx);
      if (p > 0.005) playOpening(engine);
    }

    function loop(engine: Engine) {
      if (engine.camDirty) {
        engine.camDirty = false;
        engine.stage.setCamera(engine.cam.az, engine.cam.el, engine.cam.dist);
        engine.stage.setLid(engine.cam.lid);
        engine.stage.render();
        const paper = paperRef.current;
        if (paper) {
          paper.style.opacity = String(
            Math.max(0, Math.min(1, engine.cam.paper)),
          );
        }
      }
      engine.raf = requestAnimationFrame(() => loop(engine));
    }

    void (async () => {
      const anime = await import('animejs');
      if (cancelled) return;

      stage = createStage(canvas, {
        azimuth: -14,
        elevation: 15,
        distance: 5.4,
        targetY: 0.3,
      });

      const cam = { az: -14, el: 15, dist: 5.4, lid: 0.85, paper: 0 };
      const engine: Engine = {
        anime,
        stage,
        tl: buildTimeline(anime, cam),
        cam,
        active: 0,
        camDirty: false,
        openingDone: false,
        raf: 0,
      };
      engineRef.current = engine;

      onScroll = () => tick(engine);
      window.addEventListener('scroll', onScroll, { passive: true });

      // The curtain gate owns the first gesture, so the headline waits for it.
      onCurtain = () => {
        playOpening(engine);
        playNote(0);
      };
      window.addEventListener('curtain:open', onCurtain);

      tick(engine);
      loop(engine);
    })();

    return () => {
      cancelled = true;
      if (onScroll) window.removeEventListener('scroll', onScroll);
      if (onCurtain) window.removeEventListener('curtain:open', onCurtain);
      const engine = engineRef.current;
      if (engine) cancelAnimationFrame(engine.raf);
      engineRef.current = null;
      stage?.dispose();
    };
  }, [count, playNote, reduce]);

  function toggleSound() {
    const next = !muted;
    mutedRef.current = next;
    setMuted(next);
    if (!next) playNote(0);
  }

  return (
    <section
      id="san-khau"
      ref={sectionRef}
      className="relative h-[940vh] bg-stage"
      style={sceneLength === 1 ? undefined : { height: `${Math.round(940 * sceneLength)}vh` }}
    >
      <div className="sticky top-0 h-screen overflow-hidden bg-stage">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block h-full w-full"
        />

        {/* Vignette: dark at the top for the counter, dark at the foot for the text. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(11,10,9,0.62)_0%,rgba(11,10,9,0.05)_22%,rgba(11,10,9,0)_34%,rgba(11,10,9,0.82)_60%,#0b0a09_78%)]"
        />

        {/* Wipes to paper as the lid shuts, handing over to the album below. */}
        <div
          ref={paperRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-surface opacity-0"
        />

        <div className="absolute inset-x-[22px] top-[22px] flex items-center justify-between gap-4">
          <span
            ref={counterRef}
            className="text-[11px] tracking-[0.24em] text-surface/40 uppercase tabular-nums"
          >
            Tám điều chưa nói
          </span>
          <button
            type="button"
            onClick={toggleSound}
            aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}
            aria-pressed={!muted}
            className="grid h-[34px] w-[34px] place-items-center rounded-full border border-gold/45 text-gold transition-colors duration-300 hover:bg-gold/10"
          >
            {muted ? <SpeakerSlashIcon size={15} /> : <SpeakerHighIcon size={15} />}
          </button>
        </div>

        <div
          ref={(el) => {
            noteRefs.current[0] = el;
          }}
          className="absolute inset-x-0 bottom-0 px-6 pb-11"
        >
          <p className="text-[clamp(30px,8.6vw,46px)] leading-[1.16] tracking-[-0.02em] text-pretty text-surface">
            {words.map((word, i) => (
              <span
                key={`${word}-${i}`}
                ref={(el) => {
                  wordRefs.current[i] = el;
                }}
                className="mr-[0.26em] inline-block opacity-0"
              >
                {word}
              </span>
            ))}
          </p>
          <div className="mt-8 flex items-center gap-3">
            <span className="block h-px w-[38px] bg-gold/80" />
            <span className="text-[11px] tracking-[0.24em] text-surface/50 uppercase">
              Cuộn xuống, {count === 8 ? 'tám' : count} điều
            </span>
          </div>
        </div>

        {notes.map((note, i) => (
          <div
            key={note.title}
            ref={(el) => {
              noteRefs.current[i + 1] = el;
            }}
            className="absolute inset-x-0 bottom-0 px-6 pb-11 opacity-0"
          >
            <p className="mb-3.5 text-[11px] tracking-[0.24em] text-gold uppercase">
              {note.eyebrow}
            </p>
            <h2 className="mb-[18px] text-[clamp(32px,9vw,46px)] leading-[1.04] tracking-[-0.025em] text-surface">
              {note.title}
            </h2>
            <p className="max-w-[34ch] text-[15px] leading-[1.8] text-pretty text-surface/70">
              {note.body}
            </p>
          </div>
        ))}

        <div className="absolute inset-x-6 bottom-[22px] flex gap-[5px]">
          {notes.map((note, i) => (
            <span
              key={note.title}
              ref={(el) => {
                tickRefs.current[i] = el;
              }}
              className="h-0.5 flex-1 bg-surface/15"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
