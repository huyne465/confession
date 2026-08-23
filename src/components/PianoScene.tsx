'use client';

import { SpeakerHighIcon, SpeakerSlashIcon } from '@phosphor-icons/react/dist/ssr';
import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { assetUrl } from '@/lib/api';
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
  /** Loops once the reader is past the last note. Empty means no music. */
  musicUrl?: string;
};

const DEFAULT_OPENING =
  'Anh rất thích nghe những bản piano mà em tự đánh tự thu và anh may mắn được nghe nó.';

const DEFAULT_NOTES: PianoNote[] = [
  {
    eyebrow: 'Điều thứ nhất',
    title: 'Xin chào forever crush của anh',
    body: 'Trộm vía mỗi lần nhìn thấy An thi vẫn không thay lòng với cô bạn hồi nhỏ của mình',
  },
  {
    eyebrow: 'Điều thứ hai',
    title: 'Có thể là tôi sai',
    body: 'Nhưng lỡ sai rồi Huy muốn trở thành một người mà An có thể tự hào là xứng đáng để yêu',
  },
  {
    eyebrow: 'Điều thứ ba',
    title: 'Tôi yêu em nhiều tới mức',
    body: 'Dù cho có những tính xấu hay thiếu sót gì thì Huy yêu cả những cái đó luôn vì đâu ai hoàn hảo đâu. Không phải vì ngoại hình mà là vì tính cách của An',
  },
  {
    eyebrow: 'Điều thứ tư',
    title: 'An là một người mạnh mẽ',
    body: 'Dẫu biết là thế nhưng Huy vẫn muốn được che chở cho An mỗi khi An cần',
  },
  {
    eyebrow: 'Điều thứ năm',
    title: 'Ý Chí',
    body: 'Đã có một khoảng thời gian Huy bị mất định hướng và An là người mà Huy nghĩ đến để cố gắng trong cuộc sống này và Huy rất biết ơn vì An xuất hiện trong đời Huy để cho Huy biết ý nghĩa của cuộc sống này',
  },
  {
    eyebrow: 'Điều thứ sáu',
    title: 'Những Ai tệ với An',
    body: 'Có thể là vì vài mối tính trước mà An khép lòng không muốn chia sẻ thêm gì cho Huy biết nhưng Huy vẫn luôn muốn hiểu thêm về An để tụi mình hòa hợp với nhau hơn',
  },
  {
    eyebrow: 'Điều thứ bảy',
    title: 'Xin lỗi vì những lần trẻ con',
    body: 'Huy mặc dù chưa lớn và trưởng thành trong suy nghĩ nhưng vì An Huy sẽ cố gắng để thay đổi. Cảm ơn vì An đã cho Huy cơ hội để đi đến tới đây',
  },
  {
    eyebrow: 'Điều thứ tám',
    title: 'Điều anh giữ tới cuối',
    body: 'Anh muốn còn được nghe Em đàn, Em chửi anh, giận anh, Đá dái và thậm chí là xua đủa anh thêm nhiều năm nữa. Tiếp tục vuốt xuống nhé',
  },
];

const FREQS = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];

/**
 * Struck-piano samples, rendered offline. Oscillators built one note at a time
 * on a phone CPU is what made the scene buzz: four voices per note, several
 * notes overlapping, and nothing between them and the output but hope.
 */
const NOTE_FILES = ['c4', 'd4', 'e4', 'f4', 'g4', 'a4', 'b4', 'c5'].map(
  (n) => `/assets/media/notes/${n}.mp3`,
);

/** Once the lid starts closing, the album has begun and the track comes in. */
const MUSIC_AT = 0.9;
/** Which white key lights up per note — the octave under the player's hand. */
const KEY_FOR_NOTE = [14, 15, 16, 17, 18, 19, 20, 21];

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
  /** Scroll position the page is at, and the damped one the camera follows. */
  targetP: number;
  shownP: number;
  active: number;
  visible: boolean;
  openingDone: boolean;
  /** A key is mid-press, so the frame has something to show even at rest. */
  keysMoving: boolean;
  /** The camera has caught up with the scroll and has nothing left to draw. */
  settled: boolean;
  /** Highest note index actually reached, so a restored scroll cannot cheat. */
  notesSeen: number;
  /** The reader started at the top of the scene rather than being dropped in. */
  travelled: boolean;
  /** Milliseconds between frames, or 0 for as fast as the display allows. */
  minFrame: number;
  lastFrame: number;
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
  musicUrl = '',
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
  const busRef = useRef<GainNode | null>(null);
  const samplesRef = useRef<Array<AudioBuffer | null>>([]);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicOnRef = useRef(false);
  const musicPrimedRef = useRef(false);
  const mutedRef = useRef(startMuted);

  const [muted, setMuted] = useState(startMuted);
  const [audioState, setAudioState] = useState('none');
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [debug, setDebug] = useState(false);
  const reduce = useReducedMotion();

  const count = notes.length;
  const words = opening.split(' ');
  /** Sound can only actually come out of a context the browser has started. */
  const live = audioState === 'running';

  /**
   * Mobile browsers only let an AudioContext start inside a user gesture, and
   * only synchronously — anything after an `await` is already too late. So the
   * context is created and resumed on the first touch anywhere on the page,
   * long before a note is due.
   */
  const unlockAudio = useCallback(() => {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) {
      setAudioState('unsupported');
      return null;
    }
    if (!audioRef.current) {
      const created = new Ctx();
      audioRef.current = created;
      // Safari flips to its non-standard 'interrupted' on its own — after a
      // call, a route change, or a background. Watch rather than assume.
      created.onstatechange = () => setAudioState(created.state);

      // Everything goes through one bus into a limiter. Notes overlap — each
      // rings for nearly three seconds — and without a ceiling the sum clips,
      // which is the buzz you hear rather than any fault in the notes.
      const bus = created.createGain();
      bus.gain.value = 0.9;
      const limiter = created.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      bus.connect(limiter).connect(created.destination);
      busRef.current = bus;

      void loadSamples(created);
    }
    const ctx = audioRef.current;

    // An <audio> element has its own permission. Touching play() inside this
    // same gesture is what buys the right to start it programmatically later.
    const music = musicRef.current;
    if (music && !musicOnRef.current && !musicPrimedRef.current) {
      musicPrimedRef.current = true;
      // Priming is a permission trick, not playback: the element has to start
      // once inside a gesture for a later programmatic play to be allowed. It
      // must be inaudible, or the gate answers itself with a burst of music.
      music.muted = true;
      music.volume = 0;
      void music
        .play()
        .then(() => {
          music.pause();
          music.currentTime = 0;
          music.muted = false;
        })
        .catch(() => {
          music.muted = false;
          // Refused. The scroll trigger will try again from its own gesture.
        });
    }
    // Anything that is not 'running' is worth a resume, including Safari's
    // 'interrupted', which is not in the spec and which no === check will catch.
    if (ctx.state !== 'running') void ctx.resume().then(() => setAudioState(ctx.state));
    // iOS needs something to actually play before it counts the context as live.
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    setAudioState(ctx.state);
    return ctx;
  }, []);

  /** Fetch the eight samples once, in parallel, and forget the failures. */
  const loadSamples = useCallback(async (ctx: AudioContext) => {
    samplesRef.current = await Promise.all(
      NOTE_FILES.map(async (file) => {
        try {
          const res = await fetch(assetUrl(file));
          if (!res.ok) return null;
          return await ctx.decodeAudioData(await res.arrayBuffer());
        } catch {
          // A missing sample is not worth breaking the scene over; the
          // oscillator fallback below still makes a sound.
          return null;
        }
      }),
    );
  }, []);

  /** One struck note per memory: the sample if it arrived, synthesis if not. */
  const playNote = useCallback(
    (index: number) => {
      if (mutedRef.current) return;
      // If no gesture ever reached the unlock listener, try here: on desktop a
      // context can be built outside one, and this is the last chance to notice.
      const ctx = audioRef.current ?? unlockAudio();
      if (!ctx) return;
      const bus: AudioNode = busRef.current ?? ctx.destination;

      const sample = samplesRef.current[index % NOTE_FILES.length];
      if (sample) {
        if (ctx.state !== 'running') {
          void ctx.resume().then(() => setAudioState(ctx.state));
        }
        const source = ctx.createBufferSource();
        source.buffer = sample;
        const gain = ctx.createGain();
        gain.gain.value = 0.85;
        source.connect(gain).connect(bus);
        source.start();
        return;
      }
      // Nudge, do not gate. A previous version refused unless the state read
      // exactly 'running', which silenced Safari for good: it parks contexts in
      // 'interrupted', and resume() needs a tick before the state catches up.
      // A note scheduled into a context that never wakes is merely inaudible;
      // refusing to schedule one guarantees it.
      if (ctx.state !== 'running') {
        void ctx.resume().then(() => setAudioState(ctx.state));
      }

      const t = ctx.currentTime;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.2, t + 0.012);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);

      // Phone speakers have no bottom end, so the filter opens higher than it
      // would on desktop or the note all but disappears.
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3400;
      out.connect(lp).connect(bus);

      [1, 2, 3, 4].forEach((harmonic, n) => {
        const osc = ctx.createOscillator();
        osc.type = n === 0 ? 'triangle' : 'sine';
        osc.frequency.value = FREQS[index % FREQS.length] * harmonic;
        // A struck string is never perfectly in tune with its own harmonics.
        osc.detune.value = n * 2.5;
        const gain = ctx.createGain();
        gain.gain.value = [0.9, 0.26, 0.1, 0.04][n];
        osc.connect(gain).connect(out);
        osc.start(t);
        osc.stop(t + 2.8);
      });
    },
    [unlockAudio],
  );

  useEffect(() => {
    mutedRef.current = muted;
    const music = musicRef.current;
    if (!music) return;
    if (muted) music.pause();
    else if (musicOnRef.current) void music.play().catch(() => { });
  }, [muted]);

  /** Bring the track up over a couple of seconds rather than dropping it in. */
  const startMusic = useCallback(() => {
    const music = musicRef.current;
    if (!music || musicOnRef.current || mutedRef.current || !musicUrl) return;
    musicOnRef.current = true;
    music.volume = 0;
    void music
      .play()
      .then(() => {
        setMusicPlaying(true);
        const target = 0.5;
        const started = performance.now();
        const ramp = () => {
          const t = Math.min(1, (performance.now() - started) / 2600);
          music.volume = target * t;
          if (t < 1 && !music.paused) requestAnimationFrame(ramp);
        };
        requestAnimationFrame(ramp);
      })
      .catch(() => {
        // Refused without a gesture. The sound toggle is the way back in.
        musicOnRef.current = false;
      });
  }, [musicUrl]);

  // First gesture anywhere unlocks audio. Kept until it takes: a touchstart
  // during a scroll does not always count on iOS, so it may need a second try.
  useEffect(() => {
    // Every event the HTML spec counts as activation-triggering. touchend is
    // here because a tap that turns into a scroll never produces a click.
    const events: Array<keyof DocumentEventMap> = [
      'pointerdown',
      'pointerup',
      'touchend',
      'mousedown',
      'click',
      'keydown',
    ];
    const onGesture = () => {
      const ctx = unlockAudio();
      if (ctx && ctx.state === 'running') {
        events.forEach((e) => document.removeEventListener(e, onGesture));
      }
    };
    events.forEach((e) =>
      document.addEventListener(e, onGesture, { passive: true }),
    );

    // Coming back from a background tab suspends the context again.
    const onVisible = () => {
      const ctx = audioRef.current;
      if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') {
        void ctx.resume().then(() => setAudioState(ctx.state));
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    setDebug(new URLSearchParams(window.location.search).has('audiodebug'));

    return () => {
      events.forEach((e) => document.removeEventListener(e, onGesture));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [unlockAudio]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    let cancelled = false;
    let stage: Stage | null = null;
    let onScroll: (() => void) | null = null;
    let onCurtain: (() => void) | null = null;
    let io: IntersectionObserver | null = null;

    const spring = (anime: Anime, stiffness: number, damping: number) =>
      anime.createSpring({ stiffness, damping });

    /** One scrubbed anime timeline: intro, eight notes, then the lid closing. */
    function buildTimeline(anime: Anime, cam: Engine['cam']): Timeline {
      const tl = anime.createTimeline({
        autoplay: false,
        defaults: { duration: 1000, ease: 'inOutSine' },
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

    /** Dip the white key the note belongs to, then let it rise back. */
    function strikeKey(engine: Engine, noteIndex: number) {
      const key = KEY_FOR_NOTE[noteIndex % KEY_FOR_NOTE.length];
      if (key >= engine.stage.keyCount) return;
      if (reduce) return;
      const press = { v: 1 };
      engine.keysMoving = true;
      engine.anime.animate(press, {
        v: 0,
        duration: 620,
        ease: 'outQuad',
        onUpdate: () => {
          engine.stage.setKeyDepth(key, press.v);
          engine.settled = false;
        },
        onComplete: () => {
          engine.keysMoving = false;
        },
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
          idx === 0 ? 'Tám điều chưa nói' : `Nốt 0${idx} / 0${count}`;
      }

      tickRefs.current.forEach((tick, i) => {
        if (!tick) return;
        animate(tick, {
          backgroundColor: i < idx ? TICK_ON : TICK_OFF,
          duration: reduce ? 1 : 420,
          ease: 'outQuad',
        });
      });

      if (idx > 0) {
        playNote(idx - 1);
        strikeKey(engine, idx - 1);
      }
    }

    function readScroll(engine: Engine) {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const span = el.offsetHeight - window.innerHeight;
      engine.targetP = Math.min(
        1,
        Math.max(0, -rect.top / Math.max(1, span)),
      );

      const idx = Math.min(
        count,
        Math.max(0, Math.floor(engine.targetP * (count + 2))),
      );
      if (idx !== engine.active) goToNote(engine, idx);
      if (engine.targetP > 0.005) playOpening(engine);

      // "After the eight notes" means having gone through them, not merely
      // being below them. A refresh restores the scroll position, and the old
      // check read that as the reader having arrived — so the track started
      // over a page nobody had scrolled yet.
      if (engine.travelled) engine.notesSeen = Math.max(engine.notesSeen, idx);
      if (engine.notesSeen >= count && engine.targetP > MUSIC_AT) startMusic();
    }

    /**
     * The camera chases the scroll rather than snapping to it. Momentum scroll
     * on a phone arrives in coarse jumps, and a camera that copies them frame
     * for frame reads as stutter, not as speed.
     */
    function loop(engine: Engine, now: number) {
      engine.raf = requestAnimationFrame((t) => loop(engine, t));
      if (!engine.visible) return;

      // A phone that renders this at 60 costs twice the battery and drops
      // frames anyway. Half rate, evenly spaced, reads as smoother than an
      // uneven 60 ever does.
      if (engine.minFrame > 0) {
        if (now - engine.lastFrame < engine.minFrame) return;
        engine.lastFrame = now;
      }

      const gap = engine.targetP - engine.shownP;
      const moving = Math.abs(gap) > 0.00002;
      if (moving) engine.shownP += gap * (reduce ? 1 : 0.14);
      else engine.shownP = engine.targetP;

      // A stage that is perfectly still looks like a photograph — but only a
      // machine with frames to spare gets to spend them on breathing.
      const breathing = !reduce && engine.stage.quality === 'high';
      if (!moving && !breathing && !engine.keysMoving && engine.settled) return;
      engine.settled = !moving;

      engine.tl.seek(engine.shownP * engine.tl.duration);
      engine.stage.setCamera(
        engine.cam.az + (breathing ? Math.sin(now * 0.00026) * 0.75 : 0),
        engine.cam.el + (breathing ? Math.sin(now * 0.00019) * 0.45 : 0),
        engine.cam.dist,
      );
      engine.stage.setLid(engine.cam.lid);
      engine.stage.render();

      const paper = paperRef.current;
      if (paper) {
        paper.style.opacity = String(
          Math.max(0, Math.min(1, engine.cam.paper)),
        );
      }
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
        targetP: 0,
        shownP: 0,
        active: 0,
        visible: true,
        openingDone: false,
        notesSeen: 0,
        travelled: false,
        keysMoving: false,
        settled: false,
        minFrame: stage.quality === 'low' ? 1000 / 30 : 0,
        lastFrame: 0,
        raf: 0,
      };
      engineRef.current = engine;

      onScroll = () => readScroll(engine);
      window.addEventListener('scroll', onScroll, { passive: true });

      // Off-screen the loop idles: no point rendering a stage nobody can see.
      io = new IntersectionObserver(
        ([entry]) => {
          engine.visible = entry.isIntersecting;
        },
        { threshold: 0 },
      );
      io.observe(section);

      // The curtain gate owns the first gesture, so the headline waits for it.
      onCurtain = () => {
        playOpening(engine);
        playNote(0);
        strikeKey(engine, 0);
      };
      window.addEventListener('curtain:open', onCurtain);

      // A story behind a gate is meant to be read from the first line. Letting
      // the browser restore a scroll position drops the reader into the middle
      // of a scene whose state was never built.
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);

      readScroll(engine);
      engine.travelled = engine.targetP < 0.05;
      engine.shownP = engine.targetP;
      loop(engine, 0);
    })();

    return () => {
      cancelled = true;
      if (onScroll) window.removeEventListener('scroll', onScroll);
      if (onCurtain) window.removeEventListener('curtain:open', onCurtain);
      io?.disconnect();
      const engine = engineRef.current;
      if (engine) cancelAnimationFrame(engine.raf);
      engineRef.current = null;
      stage?.dispose();
    };
  }, [count, playNote, reduce, startMusic]);

  function toggleSound() {
    const next = !muted;
    mutedRef.current = next;
    setMuted(next);
    if (next) return;
    // This click is a gesture, so it is the best chance to start the context.
    unlockAudio();
    // Unmuting after the trigger point should bring the track back, not a note.
    if (musicOnRef.current || (engineRef.current?.targetP ?? 0) > MUSIC_AT) {
      musicOnRef.current = false;
      startMusic();
    } else {
      playNote(0);
    }
  }

  return (
    <>
      {musicUrl ? (
        // preload="none" keeps 700KB off the first paint; nothing needs it until
        // the reader is eight notes deep.
        <audio ref={musicRef} src={assetUrl(musicUrl)} loop preload="none" />
      ) : null}

      {/* Once music is playing it outlives this section, so the way to silence
        it has to outlive the section too. */}
      {musicPlaying ? (
        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}
          className="fixed right-4 bottom-4 z-40 grid h-11 w-11 place-items-center rounded-full border border-gold/45 bg-stage/80 text-gold shadow-[0_10px_30px_-12px_rgb(0_0_0/0.8)] backdrop-blur-sm transition-colors duration-300 hover:bg-gold/15"
        >
          {muted ? <SpeakerSlashIcon size={17} /> : <SpeakerHighIcon size={17} />}
        </button>
      ) : null}

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

            <div className="flex items-center gap-3">
              {debug ? (
                <span className="rounded-full bg-burgundy/70 px-2.5 py-1 text-[10px] tracking-[0.14em] text-surface uppercase tabular-nums">
                  audio: {audioState}
                </span>
              ) : null}

              {/* The button tells the truth: sound wanted but not yet granted is
                its own state, and tapping it is what grants it. */}
              {!muted && !live ? (
                <span className="text-[10px] tracking-[0.18em] text-gold/80 uppercase">
                  Chạm để bật tiếng
                </span>
              ) : null}

              <button
                type="button"
                onClick={toggleSound}
                aria-label={
                  muted ? 'Bật tiếng' : live ? 'Tắt tiếng' : 'Chạm để bật tiếng'
                }
                aria-pressed={!muted && live}
                className={`grid h-[34px] w-[34px] place-items-center rounded-full border text-gold transition-colors duration-300 hover:bg-gold/10 ${!muted && !live
                  ? 'animate-pulse border-gold'
                  : 'border-gold/45'
                  }`}
              >
                {muted || !live ? (
                  <SpeakerSlashIcon size={15} />
                ) : (
                  <SpeakerHighIcon size={15} />
                )}
              </button>
            </div>
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
    </>
  );
}
