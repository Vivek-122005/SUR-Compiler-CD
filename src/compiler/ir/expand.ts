// Plays the IR "on paper" into a flat list of sounds and silences.
// Used by the optimizer's safety rule (expand(before) must equal expand(after))
// and by the code generator to build the note schedule.

import type { IRInstr, Span } from '../types';
import { DEFAULT_TEMPO, swarFrequency } from '../swars';

export interface ExpandedEvent {
  /** null = silence */
  freq: number | null;
  beats: number;
  bpm: number;
  label: string;
  src?: Span;
  /** index of the IR instruction that produced it */
  instr: number;
}

/** Matching ENDLOOP index for every LOOP index. Throws on unmatched labels (a compiler bug). */
export function matchLoops(ir: IRInstr[]): Map<number, number> {
  const stack: { i: number; label: string }[] = [];
  const match = new Map<number, number>();
  ir.forEach((ins, i) => {
    if (ins.op === 'LOOP') stack.push({ i, label: ins.label });
    if (ins.op === 'ENDLOOP') {
      const open = stack.pop();
      if (!open || open.label !== ins.label) throw new Error(`unmatched ENDLOOP ${ins.label}`);
      match.set(open.i, i);
    }
  });
  if (stack.length) throw new Error(`unmatched LOOP ${stack[stack.length - 1].label}`);
  return match;
}

export function expand(ir: IRInstr[], opts: { mergeRests?: boolean } = {}): ExpandedEvent[] {
  const match = matchLoops(ir);
  const out: ExpandedEvent[] = [];
  let bpm = DEFAULT_TEMPO;

  const run = (from: number, to: number) => {
    for (let i = from; i < to; i++) {
      const ins = ir[i];
      switch (ins.op) {
        case 'TEMPO':
          bpm = ins.bpm;
          break;
        case 'PLAY': {
          const freq = ins.freq ?? swarFrequency(ins.swar, ins.octave);
          const label = (ins.octave === -1 ? '.' : '') + ins.swar + (ins.octave === 1 ? "'" : '');
          out.push({ freq, beats: ins.beats, bpm, label, src: ins.src, instr: i });
          break;
        }
        case 'REST':
          out.push({ freq: null, beats: ins.beats, bpm, label: '-', src: ins.src, instr: i });
          break;
        case 'LOOP': {
          const end = match.get(i)!;
          for (let k = 0; k < ins.count; k++) run(i + 1, end);
          i = end;
          break;
        }
        case 'ENDLOOP':
          break;
        case 'HALT':
          return;
      }
    }
  };
  run(0, ir.length);
  return opts.mergeRests ? mergeAdjacentRests(out) : out;
}

/** Merged rests count as the same silence. */
export function mergeAdjacentRests(events: ExpandedEvent[]): ExpandedEvent[] {
  const out: ExpandedEvent[] = [];
  for (const e of events) {
    const prev = out[out.length - 1];
    if (prev && prev.freq === null && e.freq === null && prev.bpm === e.bpm) {
      out[out.length - 1] = { ...prev, beats: prev.beats + e.beats };
    } else {
      out.push({ ...e });
    }
  }
  return out;
}

/** A comparable fingerprint of the music: notes, order and lengths. */
export function musicSignature(ir: IRInstr[]): string {
  return expand(ir, { mergeRests: true })
    .map((e) => `${e.freq ?? '-'}@${e.beats}/${e.bpm}`)
    .join(' ');
}
