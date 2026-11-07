// One test per catalogue code: fires with the exact message and span, and does not fire on valid input.
import { describe, it, expect } from 'vitest';
import { compile } from '../src/compiler/compile';
import { formatDiagnostic } from '../src/compiler/diagnostics';
import { spanText } from '../src/compiler/span';

const CATALOGUE: {
  code: string;
  src: string;
  message: string;
  at: string;
  hint?: string;
  severity?: 'warning';
}[] = [
  {
    code: 'L001',
    src: 'sa @ re',
    message: "illegal character '@'",
    at: '@',
    hint: "Sur uses only swars, numbers and { } ; . ' : - #",
  },
  {
    code: 'L002',
    src: 'sa:2.3.4',
    message: "malformed number '2.3.4'",
    at: '2.3.4',
    hint: 'numbers look like 2 or 0.5',
  },
  {
    code: 'P001',
    src: 'sa re 2 ga',
    message: "unexpected NUMBER '2'",
    at: '2',
    hint: 'to give a note 2 beats, write sa:2',
  },
  {
    code: 'P002',
    src: 'repeat { sa }',
    message: "expected a repeat count after 'repeat'",
    at: 'repeat',
    hint: 'example: repeat 2 { sa re }',
  },
  { code: 'P003', src: 'repeat 2 sa re', message: "expected '{' after the repeat count", at: '2' },
  {
    code: 'P004',
    src: 'repeat 2 { sa re',
    message: 'this repeat block is never closed',
    at: 'repeat',
    hint: "add '}' at the end of the block",
  },
  { code: 'P005', src: 'sa }', message: "unexpected '}' with no open block", at: '}' },
  {
    code: 'P006',
    src: 'sa:',
    message: "expected a number after ':'",
    at: ':',
    hint: 'example: sa:2',
  },
  {
    code: 'P007',
    src: 'tempo fast',
    message: "expected a number after 'tempo'",
    at: 'fast',
    hint: 'example: tempo 90',
  },
  {
    code: 'P008',
    src: "sa''",
    message: 'misplaced octave mark',
    at: "'",
    hint: "use .sa for lower or sa' for upper; only one mark",
  },
  {
    code: 'S001',
    src: 'sa re gaa ma',
    message: "unknown swar 'gaa'",
    at: 'gaa',
    hint: "did you mean 'ga'?",
  },
  {
    code: 'S002',
    src: 'repeat 0 { pa }',
    message: 'repeat count must be positive, got 0',
    at: '0',
  },
  {
    code: 'S003',
    src: 'repeat 2.5 { pa }',
    message: 'repeat count must be a whole number, got 2.5',
    at: '2.5',
  },
  {
    code: 'S004',
    src: 'repeat 500 { pa }',
    message: 'repeat count 500 is too large (max 32)',
    at: '500',
  },
  {
    code: 'S005',
    src: 'sa:9',
    message: 'duration must be 0.25 to 8 beats in steps of 0.25, got 9',
    at: '9',
  },
  {
    code: 'S006',
    src: 'tempo 500',
    message: 'tempo must be 40 to 240 bpm, got 500',
    at: 'tempo 500',
  },
  {
    code: 'S007',
    src: 'tempo 90\ntempo 100',
    message: 'tempo is already set on line 1',
    at: 'tempo 100',
    hint: 'remove one tempo line',
  },
  {
    code: 'S008',
    src: ".sa'",
    message: 'a note cannot be both lower and upper octave',
    at: ".sa'",
  },
  {
    code: 'W001',
    src: 'sa tempo 90',
    message: 'tempo applies to the whole piece; move it to the top',
    at: 'tempo 90',
    severity: 'warning',
  },
  {
    code: 'W002',
    src: 'repeat 3 { }',
    message: 'empty repeat block does nothing',
    at: 'repeat 3 { }',
    hint: 'the optimizer will remove it',
    severity: 'warning',
  },
];

const VALID = [
  "sa re ga ma pa; repeat 2 { dha ni sa' }",
  'tempo 90 .ni sa:2 -:0.5 repeat 3 { re }',
];

describe('error catalogue', () => {
  for (const e of CATALOGUE) {
    it(`${e.code}: ${e.message}`, () => {
      const r = compile(e.src);
      const d = r.diagnostics.find((x) => x.code === e.code);
      expect(d, JSON.stringify(r.diagnostics)).toBeDefined();
      expect(d!.message).toBe(e.message);
      expect(d!.severity).toBe(e.severity ?? 'error');
      if (e.hint) expect(d!.hint).toBe(e.hint);
      expect(spanText(e.src, d!.span!)).toBe(e.at);
      for (const v of VALID)
        expect(compile(v).diagnostics.map((x) => x.code)).not.toContain(e.code);
    });
  }

  it('L002 also fires for 5.', () => {
    expect(compile('sa:5.').diagnostics[0]).toMatchObject({
      code: 'L002',
      message: "malformed number '5.'",
    });
  });

  it('W003: this piece is N minutes long', () => {
    const d = compile('repeat 32 { repeat 32 { sa:8 } }').diagnostics.find(
      (x) => x.code === 'W003',
    )!;
    expect(d.message).toBe('this piece is 81.9 minutes long');
    expect(d.hint).toBe('very large nested repeats');
  });

  it('C001: an exception inside a phase is wrapped as a diagnostic, never thrown', async () => {
    const { guard } = await import('../src/compiler/compile');
    const r = guard('codegen', () => {
      throw new Error('boom');
    });
    expect(r.status).toBe('error');
    expect(r.diagnostics[0]).toMatchObject({
      code: 'C001',
      severity: 'error',
      message: 'internal compiler error: boom',
      hint: 'please report this; it is a bug, not your mistake',
    });
    // and through the real pipeline: malformed IR in codegen becomes C001
    const { generate } = await import('../src/compiler/codegen/generate');
    const bad = guard('codegen', () =>
      generate([{ op: 'LOOP', count: 2, label: 'L1' }, { op: 'HALT' }]),
    );
    expect(bad.diagnostics[0].code).toBe('C001');
  });

  it('formats diagnostics in the documented display format', () => {
    const src = 'sa re gaa ma';
    const text = formatDiagnostic(compile(src).diagnostics[0], src);
    expect(text).toBe(
      [
        "error[S001] semantic: unknown swar 'gaa'",
        ' --> line 1, col 7',
        '  |',
        '1 | sa re gaa ma',
        '  |       ^^^ not one of: sa re ga ma pa dha ni',
        '  |',
        "  = hint: did you mean 'ga'?",
      ].join('\n'),
    );
  });

  it('sorts diagnostics by line, then column', () => {
    const r = compile('xx\nrepeat 0 { yy }');
    expect(r.diagnostics.map((d) => `${d.span!.line}:${d.span!.col}`)).toEqual([
      '1:1',
      '2:8',
      '2:12',
    ]);
  });
});
