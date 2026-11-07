import { describe, it, expect } from 'vitest';
import { analyzeSrc, codes, example, PROF } from './helpers';
import { suggestSwar, levenshtein } from '../src/compiler/semantic/suggest';
import { semanticChecks } from '../src/compiler/semantic/checks';
import type { NoteStmt, Stmt } from '../src/compiler/types';

const notes = (stmts: Stmt[]): NoteStmt[] =>
  stmts.flatMap((s) => (s.kind === 'Note' ? [s] : s.kind === 'Repeat' ? notes(s.body) : []));

describe('Phase 3 — semantic analysis', () => {
  it('Example 5 gives exactly S001 (gaa, hint ga), S002 (repeat 0) and S002 (repeat -2) in one run', () => {
    const r = analyzeSrc(example('05-errors.sur'));
    expect(codes(r.diagnostics)).toEqual(['S001', 'S002', 'S002']);
    expect(r.diagnostics[0]).toMatchObject({
      message: "unknown swar 'gaa'",
      hint: "did you mean 'ga'?",
    });
    expect(r.diagnostics[0].span).toMatchObject({ line: 2, col: 7, length: 3 });
    expect(r.diagnostics[1].message).toBe('repeat count must be positive, got 0');
    expect(r.diagnostics[2].message).toBe('repeat count must be positive, got -2');
  });

  it('Examples 1–3 give no errors', () => {
    for (const f of [
      '01-professor.sur',
      '02-aaroh-avroh.sur',
      '03-nested.sur',
      '04-optimizer-demo.sur',
    ]) {
      expect(analyzeSrc(example(f)).diagnostics).toEqual([]);
    }
  });

  it('builds the documented symbol table for Example 3', () => {
    const { symbols } = analyzeSrc(example('03-nested.sur')).output!;
    expect(symbols.swars.map((s) => [s.name, s.semitone, s.uses])).toEqual([
      ['sa', 0, 2],
      ['re', 2, 1],
      ['ga', 4, 1],
      ['ma', 5, 0],
      ['pa', 7, 0],
      ['dha', 9, 1],
      ['ni', 11, 1],
    ]);
    expect(symbols.tempo).toMatchObject({ bpm: 90, source: 'declared', span: { line: 2, col: 1 } });
    expect(symbols.stats).toEqual({
      notes: 6,
      rests: 2,
      repeats: 2,
      maxNesting: 2,
      totalBeats: 30,
      totalSeconds: 20,
    });
  });

  it('defaults the tempo to 100', () => {
    const { symbols } = analyzeSrc(PROF).output!;
    expect(symbols.tempo).toEqual({ bpm: 100, source: 'default' });
    expect(symbols.stats.totalBeats).toBe(11);
    expect(symbols.stats.totalSeconds).toBe(6.6);
  });

  it('fills in octave and semitone of every note after a successful run', () => {
    const { program } = analyzeSrc(".ni sa re' " + PROF).output!;
    const ns = notes(program.body);
    expect(ns.every((n) => n.octave !== undefined && n.semitone !== undefined)).toBe(true);
    expect(ns.slice(0, 3).map((n) => [n.name, n.octave, n.semitone])).toEqual([
      ['ni', -1, 11],
      ['sa', 0, 0],
      ['re', 1, 2],
    ]);
  });

  it('does not mutate its input (pure)', async () => {
    const { parseSrc } = await import('./helpers');
    const p = parseSrc('sa re').output!;
    const before = JSON.stringify(p);
    analyzeSrc('sa re');
    expect(JSON.stringify(p)).toBe(before);
  });

  const cases: [string, string, string][] = [
    ['S001', 'so', 'sa'],
    ['S002', 'repeat 0 { sa }', 'repeat 2 { sa }'],
    ['S003', 'repeat 2.5 { sa }', 'repeat 3 { sa }'],
    ['S004', 'repeat 500 { sa }', 'repeat 32 { sa }'],
    ['S005', 'sa:9', 'sa:8'],
    ['S006', 'tempo 500', 'tempo 240'],
    ['S007', 'tempo 90 tempo 100', 'tempo 90'],
    ['S008', ".sa'", '.sa'],
    ['W001', 'sa re tempo 90', 'tempo 90 sa re'],
    ['W002', 'repeat 3 { }', 'repeat 3 { sa }'],
    ['W003', 'repeat 32 { repeat 32 { sa:8 } }', 'repeat 32 { sa:8 }'],
  ];
  for (const [code, bad, good] of cases) {
    it(`${code}: fails on "${bad}" and passes on "${good}"`, () => {
      expect(codes(analyzeSrc(bad).diagnostics)).toContain(code);
      expect(codes(analyzeSrc(good).diagnostics)).not.toContain(code);
    });
  }

  it('S005 also checks steps of 0.25 and zero, and rests', () => {
    for (const s of ['sa:0', 'sa:0.3', '-:9', 're:0.1'])
      expect(codes(analyzeSrc(s).diagnostics)).toEqual(['S005']);
    for (const s of ['sa:0.25', 'sa:1.75', '-:0.5']) expect(analyzeSrc(s).diagnostics).toEqual([]);
  });

  it('warnings do not make the phase fail', () => {
    expect(analyzeSrc('repeat 3 { } sa').status).toBe('ok');
  });

  it('collects many errors at once', () => {
    expect(codes(analyzeSrc('xx repeat 0 { yy:9 } tempo 9').diagnostics).sort()).toEqual(
      ['S001', 'S001', 'S002', 'S005', 'S006', 'W001'].sort(),
    );
  });

  it('builds a list of ✓/✗ checks for the panel', () => {
    const ok = semanticChecks(analyzeSrc(PROF).diagnostics);
    expect(ok.every((c) => c.ok)).toBe(true);
    const bad = semanticChecks(analyzeSrc(example('05-errors.sur')).diagnostics);
    expect(bad.filter((c) => !c.ok).map((c) => c.label)).toEqual([
      'All swars are valid',
      'All repeat counts are positive whole numbers',
    ]);
  });
});

describe('did-you-mean hints', () => {
  it('uses the alias table first', () => {
    expect(suggestSwar('ri')).toBe('re');
    expect(suggestSwar('da')).toBe('dha');
    expect(suggestSwar('ne')).toBe('ni');
    expect(suggestSwar('saa')).toBe('sa');
  });
  it('falls back to edit distance ≤ 2, else nothing', () => {
    expect(suggestSwar('dhaa')).toBe('dha');
    expect(suggestSwar('nii')).toBe('ni');
    expect(suggestSwar('xylophone')).toBeUndefined();
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
  it('gives no hint when nothing is close', () => {
    expect(analyzeSrc('banana').diagnostics[0].hint).toBeUndefined();
  });
});
