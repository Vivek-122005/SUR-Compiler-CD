// Pass 2 — Loop simplification: LOOP count=1 becomes just its body.
import type { IRInstr } from '../types';
import { report, type PassOutput } from './pass';

export function loopSimplify(ir: IRInstr[]): PassOutput {
  const drop = new Set<string>();
  const notes: string[] = [];
  for (const ins of ir) {
    if (ins.op === 'LOOP' && ins.count === 1) {
      drop.add(ins.label);
      notes.push(`${ins.label} count=1 replaced by its body`);
    }
  }
  const out = ir.filter(
    (ins) => !((ins.op === 'LOOP' || ins.op === 'ENDLOOP') && drop.has(ins.label)),
  );
  return report('Loop simplification', ir, out, notes);
}
