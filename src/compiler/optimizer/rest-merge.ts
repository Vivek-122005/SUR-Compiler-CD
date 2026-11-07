// Pass 4 — Rest merging (peephole): adjacent RESTs become one with the summed beats.
import type { IRInstr } from '../types';
import { joinSpans } from '../span';
import { report, type PassOutput } from './pass';

export function restMerge(ir: IRInstr[]): PassOutput {
  const out: IRInstr[] = [];
  const notes: string[] = [];
  let run = 1;
  const flush = () => {
    const last = out[out.length - 1];
    if (run > 1 && last?.op === 'REST')
      notes.push(`${run} adjacent RESTs merged into REST beats=${last.beats}`);
    run = 1;
  };
  for (const ins of ir) {
    const prev = out[out.length - 1];
    if (
      ins.op === 'REST' &&
      prev?.op === 'REST' &&
      prev.seconds === undefined &&
      ins.seconds === undefined
    ) {
      out[out.length - 1] = {
        op: 'REST',
        beats: prev.beats + ins.beats,
        src: joinSpans(prev.src, ins.src),
      };
      run++;
      continue;
    }
    flush();
    out.push(ins);
  }
  flush();
  return report('Rest merging', ir, out, notes);
}
