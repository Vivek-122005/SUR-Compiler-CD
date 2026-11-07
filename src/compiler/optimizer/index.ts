// Phase 5 — Code optimization.
// Rewrites the IR into an equivalent but simpler version. Each pass is a separate
// function (ir) → { ir, report }. Passes 1–5 repeat until nothing changes
// (at most 5 rounds); pass 6 (constant folding) runs once at the end.
// Safety rule: an optimization must never change the music (see ir/expand.ts).

import type { IRInstr, PassReport, PhaseResult } from '../types';
import { now, elapsed } from '../timing';
import { deadCode } from './dead-code';
import { loopSimplify } from './loop-simplify';
import { loopCollapse } from './loop-collapse';
import { restMerge } from './rest-merge';
import { unroll } from './unroll';
import { constantFold } from './constant-fold';
import type { Pass } from './pass';

export const PASSES: { name: string; textbook: string; fn: Pass; summary: string }[] = [
  {
    name: 'Dead code elimination',
    textbook: 'Dead code elimination',
    fn: deadCode,
    summary: 'Removes empty LOOP … ENDLOOP pairs',
  },
  {
    name: 'Loop simplification',
    textbook: 'Strength reduction (control)',
    fn: loopSimplify,
    summary: 'LOOP count=1 → just the body',
  },
  {
    name: 'Loop collapsing',
    textbook: 'Loop fusion / folding',
    fn: loopCollapse,
    summary: 'A loop whose body is only another loop becomes one loop',
  },
  {
    name: 'Rest merging',
    textbook: 'Peephole optimization',
    fn: restMerge,
    summary: 'Adjacent RESTs become one with the summed beats',
  },
  {
    name: 'Small-loop unrolling',
    textbook: 'Loop unrolling',
    fn: unroll,
    summary: 'count × body ≤ 8 and no inner loop → copy the body out',
  },
];
export const FOLD_PASS = {
  name: 'Constant folding',
  textbook: 'Constant folding',
  fn: constantFold,
  summary: 'Frequencies and seconds worked out at compile time',
};

export const MAX_ROUNDS = 5;

export function optimize(
  input: IRInstr[],
): PhaseResult<{ ir: IRInstr[]; passes: PassReport[]; rounds?: number }> {
  const t0 = now();
  let ir = input;
  const reports: PassReport[] = [];
  let rounds = 0;
  for (; rounds < MAX_ROUNDS;) {
    rounds++;
    let changedThisRound = false;
    PASSES.forEach((p, k) => {
      const before = ir.length;
      const res = p.fn(ir);
      const r = (reports[k] ??= { pass: p.name, changed: false, before, after: before, notes: [] });
      if (res.report.changed) {
        // before = size when the pass first fired; after = size after its last change
        if (!r.changed) r.before = before;
        r.changed = true;
        r.after = res.ir.length;
        r.notes.push(...res.report.notes);
        changedThisRound = true;
      }
      ir = res.ir;
    });
    if (!changedThisRound) break;
  }
  const fold = FOLD_PASS.fn(ir);
  ir = fold.ir;
  return {
    phase: 'optimizer',
    status: 'ok',
    output: { ir, passes: [...reports, fold.report], rounds },
    diagnostics: [],
    timeMs: elapsed(t0),
  };
}
