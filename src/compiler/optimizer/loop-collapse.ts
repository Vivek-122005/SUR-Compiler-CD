// Pass 3 — Loop collapsing: a loop whose body is only another loop becomes one
// loop. LOOP L1 count=2 { LOOP L2 count=3 { body } }  →  LOOP L1 count=6 { body }.
import type { IRInstr } from '../types';
import { matchLoops } from '../ir/expand';
import { report, type PassOutput } from './pass';

export function loopCollapse(ir: IRInstr[]): PassOutput {
  const notes: string[] = [];
  let out = ir;
  // collapse one pair at a time, outermost first, until none is left
  for (;;) {
    const match = matchLoops(out);
    let done = true;
    for (const [open, close] of match) {
      const outer = out[open];
      const inner = out[open + 1];
      if (outer.op !== 'LOOP' || inner?.op !== 'LOOP') continue;
      if (match.get(open + 1) !== close - 1) continue; // outer body is not only the inner loop
      const count = outer.count * inner.count;
      notes.push(
        `${outer.label} × ${inner.label} (${outer.count} × ${inner.count}) collapsed into ${outer.label} count=${count}`,
      );
      out = [
        ...out.slice(0, open),
        { op: 'LOOP', count, label: outer.label },
        ...out.slice(open + 2, close - 1),
        { op: 'ENDLOOP', label: outer.label },
        ...out.slice(close + 1),
      ];
      done = false;
      break;
    }
    if (done) break;
  }
  return report('Loop collapsing', ir, out, notes);
}
