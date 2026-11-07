import { describe, it, expect } from 'vitest';
import { irOf, PROF, example, EXAMPLES } from './helpers';
import { printIR } from '../src/compiler/ir/print';
import { musicSignature } from '../src/compiler/ir/expand';
import { optimize } from '../src/compiler/optimizer';
import { deadCode } from '../src/compiler/optimizer/dead-code';
import { loopSimplify } from '../src/compiler/optimizer/loop-simplify';
import { loopCollapse } from '../src/compiler/optimizer/loop-collapse';
import { restMerge } from '../src/compiler/optimizer/rest-merge';
import { unroll } from '../src/compiler/optimizer/unroll';
import { constantFold } from '../src/compiler/optimizer/constant-fold';
import type { IRInstr } from '../src/compiler/types';

const ops = (ir: IRInstr[]) => ir.map((i) => i.op).join(' ');

describe('Phase 5 — optimizer', () => {
  it('Example 1: unrolling and folding give the documented 13 instructions', () => {
    const r = optimize(irOf(PROF)).output!;
    expect(printIR(r.ir)).toBe(
      [
        '000 TEMPO 100',
        '001 PLAY sa 261.63 Hz 0.600 s',
        '002 PLAY re 293.66 Hz 0.600 s',
        '003 PLAY ga 329.63 Hz 0.600 s',
        '004 PLAY ma 349.23 Hz 0.600 s',
        '005 PLAY pa 392.00 Hz 0.600 s',
        '006 PLAY dha 440.00 Hz 0.600 s',
        '007 PLAY ni 493.88 Hz 0.600 s',
        "008 PLAY sa' 523.25 Hz 0.600 s",
        '009 PLAY dha 440.00 Hz 0.600 s',
        '010 PLAY ni 493.88 Hz 0.600 s',
        "011 PLAY sa' 523.25 Hz 0.600 s",
        '012 HALT',
      ].join('\n'),
    );
    const unrolled = r.passes.find((p) => p.pass === 'Small-loop unrolling')!;
    expect(unrolled).toMatchObject({ changed: true, before: 12, after: 13 });
  });

  it('Example 2 (optimizer demo): 11 → 7 instructions, one LOOP count=6 and one REST beats=3', () => {
    const before = irOf(example('04-optimizer-demo.sur'));
    expect(before).toHaveLength(11);
    const r = optimize(before).output!;
    expect(r.ir).toHaveLength(7);
    expect(r.ir.filter((i) => i.op === 'LOOP')).toEqual([{ op: 'LOOP', count: 6, label: 'L1' }]);
    const rests = r.ir.filter((i) => i.op === 'REST');
    expect(rests).toHaveLength(1);
    expect(rests[0]).toMatchObject({ beats: 3, seconds: 1.8 });
    expect(r.passes.filter((p) => p.changed).map((p) => p.pass)).toEqual([
      'Loop collapsing',
      'Rest merging',
      'Constant folding',
    ]);
  });

  it('keeps the music identical for every example', () => {
    for (const f of EXAMPLES.slice(0, 4)) {
      const ir = irOf(example(f));
      expect(musicSignature(optimize(ir).output!.ir)).toBe(musicSignature(ir));
    }
  });

  describe('each pass', () => {
    const L = (count: number, label: string): IRInstr => ({ op: 'LOOP', count, label });
    const E = (label: string): IRInstr => ({ op: 'ENDLOOP', label });

    it('dead code: removes empty loops, leaves full ones', () => {
      expect(ops(deadCode(irOf('sa repeat 3 { } re')).ir)).toBe('TEMPO PLAY PLAY HALT');
      const full = irOf('repeat 3 { sa }');
      expect(deadCode(full).report.changed).toBe(false);
    });

    it('loop simplify: LOOP count=1 → body; count=2 untouched', () => {
      expect(ops(loopSimplify(irOf('repeat 1 { sa re }')).ir)).toBe('TEMPO PLAY PLAY HALT');
      expect(loopSimplify(irOf('repeat 2 { sa }')).report.changed).toBe(false);
    });

    it('loop collapse: 2 × 3 → 6; not when the outer body has other work', () => {
      const r = loopCollapse(irOf('repeat 2 { repeat 3 { sa } }'));
      expect(r.ir.filter((i) => i.op === 'LOOP')).toEqual([L(6, 'L1')]);
      expect(loopCollapse(irOf('repeat 2 { re repeat 3 { sa } }')).report.changed).toBe(false);
      // triple nesting collapses all the way
      const triple = loopCollapse([
        L(2, 'L1'),
        L(3, 'L2'),
        L(4, 'L3'),
        { op: 'HALT' },
        E('L3'),
        E('L2'),
        E('L1'),
      ]);
      expect(triple.ir[0]).toEqual(L(24, 'L1'));
    });

    it('rest merge: adjacent rests merge; separated ones do not', () => {
      const r = restMerge(irOf('- -:2 -'));
      expect(r.ir.filter((i) => i.op === 'REST')).toHaveLength(1);
      expect(r.ir[1]).toMatchObject({ op: 'REST', beats: 4 });
      expect(restMerge(irOf('- sa -')).report.changed).toBe(false);
    });

    it('unroll: small innermost loops only', () => {
      expect(ops(unroll(irOf('repeat 4 { sa re }')).ir)).toBe(
        'TEMPO PLAY PLAY PLAY PLAY PLAY PLAY PLAY PLAY HALT',
      );
      expect(unroll(irOf('repeat 5 { sa re }')).report.changed).toBe(false); // 10 > 8
      const nested = unroll(irOf('repeat 9 { re repeat 2 { sa } }'));
      expect(nested.ir.filter((i) => i.op === 'LOOP')).toHaveLength(1); // only the inner one unrolled
    });

    it('constant fold: fills freq and seconds; does nothing when already folded', () => {
      const r = constantFold(irOf('tempo 120 .sa - '));
      expect(r.ir[1]).toMatchObject({ freq: 130.81, seconds: 0.5 });
      expect(r.ir[2]).toMatchObject({ seconds: 0.5 });
      expect(constantFold(r.ir).report.changed).toBe(false);
    });
  });

  it('never produces a LOOP with count 0 or an unmatched label', () => {
    const r = optimize(irOf('repeat 3 { repeat 1 { } } repeat 2 { repeat 4 { sa } - - }')).output!;
    const stack: string[] = [];
    for (const i of r.ir) {
      if (i.op === 'LOOP') {
        expect(i.count).toBeGreaterThan(0);
        stack.push(i.label);
      }
      if (i.op === 'ENDLOOP') expect(stack.pop()).toBe(i.label);
    }
    expect(stack).toEqual([]);
  });
});
