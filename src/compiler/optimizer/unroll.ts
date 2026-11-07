// Pass 5 — Small-loop unrolling: if count × body size ≤ 8 instructions and the
// body has no inner loop, copy the body out and drop the loop.
import type { IRInstr } from '../types';
import { report, type PassOutput } from './pass';

export const UNROLL_LIMIT = 8;

export function unroll(ir: IRInstr[]): PassOutput {
  const out: IRInstr[] = [];
  const notes: string[] = [];
  for (let i = 0; i < ir.length; i++) {
    const ins = ir[i];
    if (ins.op !== 'LOOP') {
      out.push(ins);
      continue;
    }
    // find the body; only innermost loops (no LOOP inside) qualify
    let j = i + 1;
    let inner = false;
    while (
      j < ir.length &&
      !(ir[j].op === 'ENDLOOP' && (ir[j] as { label: string }).label === ins.label)
    ) {
      if (ir[j].op === 'LOOP') inner = true;
      j++;
    }
    const body = ir.slice(i + 1, j);
    if (!inner && ins.count * body.length <= UNROLL_LIMIT) {
      for (let k = 0; k < ins.count; k++) out.push(...body.map((b) => ({ ...b })));
      notes.push(
        `${ins.label} (${ins.count} × ${body.length} instructions) unrolled into ${ins.count * body.length}`,
      );
      i = j; // skip ENDLOOP
    } else {
      out.push(ins);
    }
  }
  return report('Small-loop unrolling', ir, out, notes);
}
