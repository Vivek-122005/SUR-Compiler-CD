import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { compile } from '../src/compiler/compile';
import { parseSrc, irOf } from './helpers';
import { optimize } from '../src/compiler/optimizer';
import { expand, musicSignature } from '../src/compiler/ir/expand';

// Random *valid* Sur programs
const swar = fc.constantFrom('sa', 're', 'ga', 'ma', 'pa', 'dha', 'ni');
const beats = fc.constantFrom('', ':0.25', ':0.5', ':2', ':3');
const note = fc
  .tuple(fc.constantFrom('', '.'), swar, fc.constantFrom('', "'"), beats)
  .map(([d, s, t, b]) => (d && t ? s : d + s + t) + b);
const rest = beats.map((b) => '-' + b);
const item: fc.Arbitrary<string> = fc.letrec((tie) => ({
  item: fc.oneof({ depthSize: 'small', withCrossShrink: true }, note, note, rest, tie('repeat')),
  repeat: fc
    .tuple(fc.integer({ min: 1, max: 4 }), fc.array(tie('item'), { maxLength: 4 }))
    .map(([n, body]) => `repeat ${n} { ${body.join(' ')} }`),
})).item as fc.Arbitrary<string>;
const program = fc
  .tuple(fc.option(fc.integer({ min: 40, max: 240 })), fc.array(item, { maxLength: 8 }))
  .map(([t, items]) => (t ? `tempo ${t}\n` : '') + items.join(' '));

describe('property tests', () => {
  it('expand(before) equals expand(after) for 200 random valid programs', () => {
    fc.assert(
      fc.property(program, (src) => {
        const ir = irOf(src);
        const opt = optimize(ir).output!.ir;
        expect(musicSignature(opt)).toBe(musicSignature(ir));
        const total = (x: typeof ir) => expand(x).reduce((a, e) => a + e.beats, 0);
        expect(total(opt)).toBe(total(ir));
      }),
      { numRuns: 200 },
    );
  });

  it('optimizer on and off give the same schedule', () => {
    fc.assert(
      fc.property(program, (src) => {
        const strip = (r: ReturnType<typeof compile>) =>
          r.codegen.output!.schedule.map(({ start, duration, freq, label }) => ({
            start,
            duration,
            freq,
            label,
          }));
        expect(strip(compile(src, { optimize: false }))).toEqual(
          strip(compile(src, { optimize: true })),
        );
      }),
      { numRuns: 100 },
    );
  });

  it('the parser never loops or throws on random input', () => {
    const alphabet = fc.constantFrom(
      'sa',
      're',
      'gaa',
      ' ',
      ';',
      '{',
      '}',
      '.',
      "'",
      ':',
      '-',
      '2',
      '0.5',
      'repeat',
      'tempo',
      '\n',
      '@',
      '#',
    );
    fc.assert(
      fc.property(fc.array(alphabet, { maxLength: 40 }), (parts) => {
        const r = compile(parts.join(''));
        expect(r.diagnostics.every((d) => d.code !== 'C001')).toBe(true);
        void parseSrc;
      }),
      { numRuns: 200 },
    );
  });
});
