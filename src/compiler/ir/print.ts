import type { IRInstr } from '../types';
import { swarLabel } from '../swars';

const oct = (o: -1 | 0 | 1) => (o === 1 ? '+1' : String(o));

/** One instruction as text, without its number. */
export function formatInstr(ins: IRInstr): string {
  switch (ins.op) {
    case 'TEMPO':
      return `TEMPO ${ins.bpm}`;
    case 'PLAY':
      if (ins.freq !== undefined && ins.seconds !== undefined) {
        return `PLAY ${swarLabel(ins.swar, ins.octave)} ${ins.freq.toFixed(2)} Hz ${ins.seconds.toFixed(3)} s`;
      }
      return `PLAY ${ins.swar} oct=${oct(ins.octave)} beats=${ins.beats}`;
    case 'REST':
      if (ins.seconds !== undefined) return `REST ${ins.seconds.toFixed(3)} s`;
      return `REST beats=${ins.beats}`;
    case 'LOOP':
      return `LOOP ${ins.label} count=${ins.count}`;
    case 'ENDLOOP':
      return `ENDLOOP ${ins.label}`;
    case 'HALT':
      return 'HALT';
  }
}

export const instrNumber = (i: number) => String(i).padStart(3, '0');

/** Numbered IR listing: "000 TEMPO 100". With indent=true, loop bodies are indented. */
export function printIR(ir: IRInstr[], opts: { indent?: boolean } = {}): string {
  let depth = 0;
  return ir
    .map((ins, i) => {
      if (ins.op === 'ENDLOOP') depth--;
      const pad = opts.indent ? '  '.repeat(Math.max(0, depth)) : '';
      if (ins.op === 'LOOP') depth++;
      return `${instrNumber(i)} ${pad}${formatInstr(ins)}`;
    })
    .join('\n');
}
