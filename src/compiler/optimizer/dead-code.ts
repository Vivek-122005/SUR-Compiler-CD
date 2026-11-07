// Pass 1 — Dead code elimination: removes empty LOOP … ENDLOOP pairs (from W002).
import type { IRInstr } from '../types';
import { report, type PassOutput } from './pass';

export function deadCode(ir: IRInstr[]): PassOutput {
  const out: IRInstr[] = [];
  const notes: string[] = [];
  for (const ins of ir) {
    const prev = out[out.length - 1];
    if (ins.op === 'ENDLOOP' && prev?.op === 'LOOP' && prev.label === ins.label) {
      out.pop();
      notes.push(`empty loop ${ins.label} removed`);
      continue;
    }
    out.push(ins);
  }
  return report('Dead code elimination', ir, out, notes);
}
