// Runs the JavaScript produced by Phase 6 through the Web Audio API.
//  - The AudioContext is created only when the user presses Play (autoplay rules).
//  - `out` is a master gain node, so Stop can mute and disconnect everything at once.
//  - onNote(id, time) is turned into a timer that fires when that note starts sounding.

export interface PlayHandlers {
  onNote: (id: number) => void;
  onStart: (startedAt: number) => void; // performance.now() when sound begins
  onEnd: () => void;
}

type AudioCtor = typeof AudioContext;

export class Player {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  playing = false;

  async play(js: string, h: PlayHandlers): Promise<void> {
    this.stop(); // Play twice never overlaps two tunes
    const Ctor: AudioCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) throw new Error('This browser has no Web Audio API');
    if (!this.ctx) this.ctx = new Ctor();
    const ctx = this.ctx;
    if (ctx.state === 'suspended') await ctx.resume();

    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(ctx.destination);
    this.out = out;

    const base = ctx.currentTime;
    const wallBase = performance.now();
    const toMs = (t: number) => Math.max(0, (t - base) * 1000);

    const onNote = (id: number, t: number) => {
      this.timers.push(setTimeout(() => h.onNote(id), toMs(t)));
    };

    const program = new Function('ctx', 'out', 'onNote', js) as (
      c: AudioContext,
      o: AudioNode,
      n: (id: number, t: number) => void,
    ) => number;
    const end = program(ctx, out, onNote);
    this.playing = true;
    // the generated code starts at currentTime + 0.1
    h.onStart(wallBase + 100);
    this.timers.push(
      setTimeout(
        () => {
          this.playing = false;
          h.onEnd();
        },
        toMs(end) + 50,
      ),
    );
  }

  /** Silences playback immediately. */
  stop(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (this.out && this.ctx) {
      try {
        this.out.gain.cancelScheduledValues(this.ctx.currentTime);
        this.out.gain.setValueAtTime(0, this.ctx.currentTime);
        this.out.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.out = null;
    this.playing = false;
  }
}

export const player = new Player();
