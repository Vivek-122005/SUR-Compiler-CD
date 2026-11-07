// Pass 6 — Constant folding: works out each PLAY's frequency and each PLAY/REST's
// seconds at compile time. Codegen uses the same helper when the optimizer is off.
import type { IRInstr } from '../types';
import { DEFAULT_TEMPO, seconds, swarFrequency } from '../swars';
import { report, type PassOutput } from './pass';

/** Returns a copy of the IR with freq and seconds filled in. */
export function foldValues(ir: IRInstr[]): IRInstr[] {
  let bpm = DEFAULT_TEMPO;
  return ir.map((ins) => {
    switch (ins.op) {
      case 'TEMPO':
        bpm = ins.bpm;
        return ins;
      case 'PLAY':
        return {
          ...ins,
          freq: swarFrequency(ins.swar, ins.octave),
          seconds: seconds(ins.beats, bpm),
        };
      case 'REST':
        return { ...ins, seconds: seconds(ins.beats, bpm) };
      default:
        return ins;
    }
  });
}

export function constantFold(ir: IRInstr[]): PassOutput {
  const out = foldValues(ir);
  let plays = 0;
  let rests = 0;
  ir.forEach((ins) => {
    if (ins.op === 'PLAY' && (ins.freq === undefined || ins.seconds === undefined)) plays++;
    if (ins.op === 'REST' && ins.seconds === undefined) rests++;
  });
  const notes =
    plays + rests > 0
      ? [
          `${plays} PLAY frequencies and durations, ${rests} REST durations computed at compile time`,
        ]
      : [];
  return report('Constant folding', ir, out, notes);
}
