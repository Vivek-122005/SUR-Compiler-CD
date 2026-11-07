import { describe, it, expect } from 'vitest';
import { irOf, PROF, example } from './helpers';
import { printIR } from '../src/compiler/ir/print';
import { expand, matchLoops } from '../src/compiler/ir/expand';

describe('Phase 4 — intermediate code', () => {
  it("printIR gives exactly the listing for the professor's line", () => {
    expect(printIR(irOf(PROF))).toBe(
      [
        '000 TEMPO 100',
        '001 PLAY sa oct=0 beats=1',
        '002 PLAY re oct=0 beats=1',
        '003 PLAY ga oct=0 beats=1',
        '004 PLAY ma oct=0 beats=1',
        '005 PLAY pa oct=0 beats=1',
        '006 LOOP L1 count=2',
        '007 PLAY dha oct=0 beats=1',
        '008 PLAY ni oct=0 beats=1',
        '009 PLAY sa oct=+1 beats=1',
        '010 ENDLOOP L1',
        '011 HALT',
      ].join('\n'),
    );
  });

  it('nests loops properly: LOOP L1 … LOOP L2 … ENDLOOP L2 … ENDLOOP L1', () => {
    const ops = irOf(example('03-nested.sur'))
      .filter((i) => i.op === 'LOOP' || i.op === 'ENDLOOP')
      .map((i) => `${i.op} ${(i as { label: string }).label}`);
    expect(ops).toEqual(['LOOP L1', 'LOOP L2', 'ENDLOOP L2', 'ENDLOOP L1']);
  });

  it('always starts with TEMPO and ends with HALT, whatever the tempo position', () => {
    const ir = irOf('sa tempo 90 re');
    expect(ir[0]).toEqual({ op: 'TEMPO', bpm: 90 });
    expect(ir[ir.length - 1]).toEqual({ op: 'HALT' });
    expect(ir.filter((i) => i.op === 'TEMPO')).toHaveLength(1);
  });

  it('has no freq or seconds yet, and every PLAY/REST has a src span', () => {
    for (const ins of irOf(example('03-nested.sur'))) {
      if (ins.op === 'PLAY' || ins.op === 'REST') {
        expect(ins.seconds).toBeUndefined();
        expect(ins.src).toBeDefined();
        if (ins.op === 'PLAY') expect(ins.freq).toBeUndefined();
      }
    }
  });

  it('records the lower octave as -1', () => {
    expect(printIR(irOf('.ni - :2'.replace(' :2', '')))).toContain('PLAY ni oct=-1 beats=1');
  });

  it('expand plays the IR on paper', () => {
    const e = expand(irOf(PROF));
    expect(e).toHaveLength(11);
    expect(e.map((x) => x.label).join(' ')).toBe("sa re ga ma pa dha ni sa' dha ni sa'");
  });

  it('matchLoops rejects unmatched labels', () => {
    expect(() => matchLoops([{ op: 'LOOP', count: 2, label: 'L1' }])).toThrow();
    expect(() => matchLoops([{ op: 'ENDLOOP', label: 'L1' }])).toThrow();
  });
});
