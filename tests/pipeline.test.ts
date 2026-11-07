import { describe, it, expect } from 'vitest';
import { compile } from '../src/compiler/compile';
import { example, PROF, EXAMPLES } from './helpers';
import { printIR } from '../src/compiler/ir/print';

describe('pipeline', () => {
  it("the professor's line compiles with no errors and plays 11 notes in 6.6 seconds", () => {
    const r = compile(PROF);
    expect(r.ok).toBe(true);
    expect(r.diagnostics).toEqual([]);
    expect(r.codegen.output!.schedule.filter((e) => e.freq !== null)).toHaveLength(11);
    expect(r.codegen.output!.totalSeconds).toBe(6.6);
  });

  it('all six phases produce output for the four valid examples', () => {
    for (const f of EXAMPLES.slice(0, 4)) {
      const r = compile(example(f));
      for (const p of [r.lexer, r.parser, r.semantic, r.ir, r.optimizer, r.codegen]) {
        expect(p.status, `${f} ${p.phase}`).toBe('ok');
        expect(p.output).toBeDefined();
        expect(p.timeMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('Example 5: three errors at once, Phase 3 red, 4–6 skipped', () => {
    const r = compile(example('05-errors.sur'));
    expect(r.ok).toBe(false);
    expect(r.diagnostics).toHaveLength(3);
    expect(
      [r.lexer, r.parser, r.semantic, r.ir, r.optimizer, r.codegen].map((p) => p.status),
    ).toEqual(['ok', 'ok', 'error', 'skipped', 'skipped', 'skipped']);
  });

  it('a lexer error skips every later phase', () => {
    const r = compile('sa @');
    expect(
      [r.parser, r.semantic, r.ir, r.optimizer, r.codegen].every((p) => p.status === 'skipped'),
    ).toBe(true);
  });

  it('warnings never stop the pipeline', () => {
    const r = compile('sa repeat 3 { } tempo 90');
    expect(r.ok).toBe(true);
    expect(r.diagnostics.map((d) => d.code)).toEqual(['W002', 'W001']);
  });

  it('is pure: same input, same output', () => {
    const strip = (x: unknown) => JSON.stringify(x, (k, v) => (k === 'timeMs' ? 0 : v));
    expect(strip(compile(example('03-nested.sur')))).toBe(strip(compile(example('03-nested.sur'))));
  });

  it('an empty program compiles to TEMPO, HALT', () => {
    const r = compile('');
    expect(r.ok).toBe(true);
    expect(printIR(r.ir.output!)).toBe('000 TEMPO 100\n001 HALT');
  });
});
