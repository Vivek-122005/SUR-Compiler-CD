import { describe, it, expect } from 'vitest';
import { parseSrc, PROF, codes, shape, example } from './helpers';
import type { RepeatStmt } from '../src/compiler/types';
import { spanText } from '../src/compiler/span';

const note = (name: string, extra: Record<string, unknown> = {}) => ({
  kind: 'Note',
  name,
  lowerMark: false,
  upperMark: false,
  beats: 1,
  ...extra,
});

describe('Phase 2 — parser', () => {
  it("gives exactly the expected tree for the professor's line", () => {
    const r = parseSrc(PROF);
    expect(r.status).toBe('ok');
    expect(shape(r.output!)).toEqual({
      kind: 'Program',
      body: [
        note('sa'),
        note('re'),
        note('ga'),
        note('ma'),
        note('pa'),
        {
          kind: 'Repeat',
          count: 2,
          body: [note('dha'), note('ni'), note('sa', { upperMark: true })],
        },
      ],
    });
  });

  it('parses nested repeats (Example 3)', () => {
    const r = parseSrc(example('03-nested.sur'));
    expect(r.diagnostics).toEqual([]);
    const outer = r.output!.body[1] as RepeatStmt;
    expect(outer.kind).toBe('Repeat');
    expect(outer.body.some((s) => s.kind === 'Repeat')).toBe(true);
  });

  it('parses durations, rests, octave marks and tempo', () => {
    const r = parseSrc("tempo 90 .ni:2 sa' -:0.5 -");
    expect(shape(r.output!)).toEqual({
      kind: 'Program',
      body: [
        { kind: 'Tempo', bpm: 90 },
        note('ni', { lowerMark: true, beats: 2 }),
        note('sa', { upperMark: true }),
        { kind: 'Rest', beats: 0.5 },
        { kind: 'Rest', beats: 1 },
      ],
    });
  });

  it('sa re 2 ga gives one P001 at the 2 and still parses sa, re, ga', () => {
    const r = parseSrc('sa re 2 ga');
    expect(codes(r.diagnostics)).toEqual(['P001']);
    expect(r.diagnostics[0]).toMatchObject({
      message: "unexpected NUMBER '2'",
      hint: 'to give a note 2 beats, write sa:2',
    });
    expect(r.diagnostics[0].span).toMatchObject({ line: 1, col: 7 });
    expect(r.output!.body.map((s) => (s.kind === 'Note' ? s.name : s.kind))).toEqual([
      'sa',
      're',
      'ga',
    ]);
  });

  it('repeat 2 { sa re gives P004 pointing at repeat', () => {
    const r = parseSrc('sa\nrepeat 2 { sa re');
    expect(codes(r.diagnostics)).toEqual(['P004']);
    expect(r.diagnostics[0].span).toMatchObject({ line: 2, col: 1, length: 6 });
  });

  it("sa } gives P005; sa'' gives P008", () => {
    expect(codes(parseSrc('sa }').diagnostics)).toEqual(['P005']);
    expect(codes(parseSrc("sa''").diagnostics)).toEqual(['P008']);
    expect(codes(parseSrc('. ').diagnostics)).toEqual(['P008']);
    expect(codes(parseSrc("' sa").diagnostics)).toEqual(['P008']);
  });

  it('reports P002, P003, P006 and P007', () => {
    expect(codes(parseSrc('repeat { sa }').diagnostics)).toEqual(['P002']);
    expect(codes(parseSrc('repeat 2 sa re').diagnostics)).toEqual(['P003']);
    expect(codes(parseSrc('sa:').diagnostics)).toEqual(['P006']);
    expect(codes(parseSrc('-: sa').diagnostics)).toEqual(['P006']);
    expect(codes(parseSrc('tempo fast').diagnostics)).toEqual(['P007']);
  });

  it('accepts values the semantic phase will judge (gaa, repeat 0, repeat -2, sa:99)', () => {
    for (const src of ['gaa', 'repeat 0 { sa }', 'repeat -2 { sa }', 'sa:99']) {
      expect(parseSrc(src).diagnostics).toEqual([]);
    }
  });

  it('recovers and reports several errors in one run', () => {
    const r = parseSrc('sa 2 re } ga 3');
    expect(codes(r.diagnostics)).toEqual(['P001', 'P005', 'P001']);
  });

  it('gives every AST node a correct span', () => {
    const src = "tempo 90\nrepeat 2 { .dha:2 ni' }\n-:2";
    const p = parseSrc(src).output!;
    const [t, rep, rest] = p.body as [never, RepeatStmt, never];
    expect(spanText(src, (t as { span: never }).span)).toBe('tempo 90');
    expect(spanText(src, rep.span)).toBe("repeat 2 { .dha:2 ni' }");
    expect(spanText(src, rep.countSpan)).toBe('2');
    expect(spanText(src, rep.body[0].span)).toBe('.dha:2');
    expect(spanText(src, rep.body[1].span)).toBe("ni'");
    expect(spanText(src, (rest as { span: never }).span)).toBe('-:2');
  });

  it('never loops forever on garbage', () => {
    const r = parseSrc('{ { } } : : 3 4 } } repeat repeat 2 2 {');
    expect(r.diagnostics.length).toBeGreaterThan(0);
  });
});
