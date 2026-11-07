import { describe, it, expect } from 'vitest';
import { compile } from '../src/compiler/compile';
import { PROF, example } from './helpers';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Phase 6 — code generation', () => {
  it("the professor's line gives the golden JavaScript and plays for 6.6 seconds", () => {
    const out = compile(PROF).codegen.output!;
    const golden = readFileSync(join(__dirname, 'golden', 'professor.js.txt'), 'utf8');
    expect(out.js).toBe(golden);
    expect(out.totalSeconds).toBe(6.6);
  });

  it('schedule has 11 events with starts 0.0, 0.6, 1.2 … 6.0', () => {
    const s = compile(PROF).codegen.output!.schedule;
    expect(s).toHaveLength(11);
    expect(s.map((e) => e.start)).toEqual([0, 0.6, 1.2, 1.8, 2.4, 3, 3.6, 4.2, 4.8, 5.4, 6]);
    expect(s.every((e) => e.duration === 0.6)).toBe(true);
    expect(s[7]).toMatchObject({ label: "sa'", freq: 523.25 });
  });

  it('unrolled copies share their original note id', () => {
    const ids = [
      ...compile(PROF).codegen.output!.js.matchAll(/note\([\d.]+, [\d.]+, (\d+)\)/g),
    ].map((m) => Number(m[1]));
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 6, 7, 8]);
  });

  it('nested loops generate nested for loops with distinct counters i1, i2', () => {
    const js = compile('repeat 9 { re repeat 5 { sa re } }').codegen.output!.js;
    expect(js).toContain('for (let i1 = 0; i1 < 9; i1++) {');
    expect(js).toContain('  for (let i2 = 0; i2 < 5; i2++) {');
  });

  it('emits rest() for rests and return t at the end', () => {
    const js = compile(example('04-optimizer-demo.sur')).codegen.output!.js;
    expect(js).toContain('rest(1.800);');
    expect(js.trimEnd().endsWith('return t;')).toBe(true);
  });

  it('works when the optimizer is off (folds values itself)', () => {
    const off = compile(PROF, { optimize: false });
    expect(off.optimizer.status).toBe('skipped');
    expect(off.codegen.status).toBe('ok');
    expect(off.codegen.output!.js).toContain('for (let i1 = 0; i1 < 2; i1++) {');
    expect(off.codegen.output!.js).toContain("note(523.25, 0.600, 8); // sa'");
  });

  it('optimizer on and off give the same schedule for every example', () => {
    for (const f of [
      '01-professor.sur',
      '02-aaroh-avroh.sur',
      '03-nested.sur',
      '04-optimizer-demo.sur',
    ]) {
      const s = (o: boolean) =>
        compile(example(f), { optimize: o }).codegen.output!.schedule.map(
          ({ src: _src, ...e }) => e,
        );
      expect(s(false)).toEqual(s(true));
    }
  });

  it('the generated code actually runs and calls the audio API in order', () => {
    const js = compile(example('03-nested.sur')).codegen.output!.js;
    const started: number[] = [];
    const node = () => ({
      connect: (x: unknown) => x,
      gain: { setValueAtTime() {}, linearRampToValueAtTime() {} },
    });
    const ctx = {
      currentTime: 0,
      createGain: node,
      createOscillator: () => ({
        ...node(),
        type: '',
        frequency: { value: 0 },
        start: (t: number) => started.push(t),
        stop() {},
      }),
    };
    const fn = new Function('ctx', 'out', 'onNote', js);
    const end = fn(ctx, {}, () => {});
    expect(started).toHaveLength(
      compile(example('03-nested.sur')).codegen.output!.schedule.filter((e) => e.freq !== null)
        .length,
    );
    expect(end).toBeCloseTo(0.1 + 20, 2);
  });
});
