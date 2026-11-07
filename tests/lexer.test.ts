import { describe, it, expect } from 'vitest';
import { lex } from '../src/compiler/lexer/lexer';
import { PROF, codes } from './helpers';

describe('Phase 1 — lexer', () => {
  it("lexes the professor's line into exactly 15 tokens with these positions", () => {
    const r = lex(PROF);
    expect(r.status).toBe('ok');
    const rows = r.output!.map((t) => [t.kind, t.lexeme, t.value, `${t.span.line}:${t.span.col}`]);
    expect(rows).toEqual([
      ['WORD', 'sa', 'sa', '1:1'],
      ['WORD', 're', 're', '1:4'],
      ['WORD', 'ga', 'ga', '1:7'],
      ['WORD', 'ma', 'ma', '1:10'],
      ['WORD', 'pa', 'pa', '1:13'],
      ['SEMI', ';', undefined, '1:15'],
      ['REPEAT', 'repeat', undefined, '1:17'],
      ['NUMBER', '2', 2, '1:24'],
      ['LBRACE', '{', undefined, '1:26'],
      ['WORD', 'dha', 'dha', '1:28'],
      ['WORD', 'ni', 'ni', '1:32'],
      ['WORD', 'sa', 'sa', '1:35'],
      ['TICK', "'", undefined, '1:37'],
      ['RBRACE', '}', undefined, '1:39'],
      ['EOF', '', undefined, '1:40'],
    ]);
  });

  it('keeps the lexeme as written but normalises swars to lowercase', () => {
    const t = lex('SA Re gA').output!;
    expect(t.slice(0, 3).map((x) => [x.kind, x.lexeme, x.value])).toEqual([
      ['WORD', 'SA', 'sa'],
      ['WORD', 'Re', 're'],
      ['WORD', 'gA', 'ga'],
    ]);
    expect(lex('TEMPO 90 Repeat').output!.map((x) => x.kind)).toEqual([
      'TEMPO',
      'NUMBER',
      'REPEAT',
      'EOF',
    ]);
  });

  it('distinguishes negative numbers, rests and rest durations', () => {
    const kinds = (s: string) => lex(s).output!.map((t) => [t.kind, t.value]);
    expect(kinds('repeat -2')).toEqual([
      ['REPEAT', undefined],
      ['NUMBER', -2],
      ['EOF', undefined],
    ]);
    expect(kinds('- 2')).toEqual([
      ['DASH', undefined],
      ['NUMBER', 2],
      ['EOF', undefined],
    ]);
    expect(kinds('-:2')).toEqual([
      ['DASH', undefined],
      ['COLON', undefined],
      ['NUMBER', 2],
      ['EOF', undefined],
    ]);
    expect(kinds('re:0.5')).toEqual([
      ['WORD', 're'],
      ['COLON', undefined],
      ['NUMBER', 0.5],
      ['EOF', undefined],
    ]);
  });

  it('reports L001 for an illegal character and keeps scanning', () => {
    const r = lex('sa @ re');
    expect(r.status).toBe('error');
    expect(codes(r.diagnostics)).toEqual(['L001']);
    expect(r.diagnostics[0].message).toBe("illegal character '@'");
    expect(r.diagnostics[0].span).toMatchObject({ line: 1, col: 4, length: 1 });
    expect(r.output!.map((t) => t.kind)).toEqual(['WORD', 'WORD', 'EOF']);
  });

  it('reports L002 for malformed numbers', () => {
    for (const [src, lexeme] of [
      ['sa:2.3.4', '2.3.4'],
      ['sa:5.', '5.'],
    ]) {
      const r = lex(src);
      expect(codes(r.diagnostics)).toEqual(['L002']);
      expect(r.diagnostics[0].message).toBe(`malformed number '${lexeme}'`);
    }
  });

  it('skips comments and blank lines but keeps line numbers correct', () => {
    const t = lex('# heading\n\n  sa # trailing\nre').output!;
    expect(t.map((x) => `${x.kind}@${x.span.line}:${x.span.col}`)).toEqual([
      'WORD@3:3',
      'WORD@4:1',
      'EOF@4:3',
    ]);
  });

  it('accepts the curly quote as an upper-octave mark', () => {
    expect(lex('sa’').output!.map((t) => t.kind)).toEqual(['WORD', 'TICK', 'EOF']);
  });

  it('counts a tab as one column', () => {
    expect(lex('\tsa').output![0].span.col).toBe(2);
  });

  it('gives one EOF and no errors for an empty file', () => {
    const r = lex('');
    expect(r.output!.map((t) => t.kind)).toEqual(['EOF']);
    expect(r.diagnostics).toEqual([]);
  });

  it('records spans with exclusive end column and offsets', () => {
    const t = lex('  dha').output![0];
    expect(t.span).toEqual({ line: 1, col: 3, endLine: 1, endCol: 6, offset: 2, length: 3 });
  });
});
