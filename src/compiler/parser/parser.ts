// Phase 2 — Syntax analysis.
// Hand-written recursive descent: one function per grammar rule.
//
//   program     = { item } EOF ;
//   item        = statement | ";" ;
//   statement   = tempo_stmt | repeat_stmt | note | rest ;
//   tempo_stmt  = "tempo" NUMBER ;
//   repeat_stmt = "repeat" NUMBER "{" { item } "}" ;
//   note        = [ "." ] WORD [ "'" ] [ ":" NUMBER ] ;
//   rest        = "-" [ ":" NUMBER ] ;
//
// The parser checks shape only. Whether "gaa" is a real swar, or whether
// "repeat 0" makes sense, is the semantic phase's job.

import type {
  Diagnostic,
  NoteStmt,
  PhaseResult,
  Program,
  RepeatStmt,
  RestStmt,
  Span,
  Stmt,
  TempoStmt,
  Token,
  TokenKind,
} from '../types';
import { hasErrors, makeDiagnostic } from '../diagnostics';
import { joinSpans } from '../span';
import { now, elapsed } from '../timing';

/** Tokens where panic-mode recovery may stop skipping. */
const SAFE_POINTS: ReadonlySet<TokenKind> = new Set([
  'SEMI',
  'RBRACE',
  'TEMPO',
  'REPEAT',
  'WORD',
  'DASH',
  'DOT',
  'EOF',
]);

class Parser {
  private pos = 0;
  readonly diagnostics: Diagnostic[] = [];

  constructor(private readonly tokens: Token[]) {
    // Defensive: the lexer always ends with EOF, but hand-built token lists might not.
    if (tokens.length === 0 || tokens[tokens.length - 1].kind !== 'EOF') {
      const last = tokens[tokens.length - 1]?.span;
      const at = last
        ? { ...last, col: last.endCol, offset: last.offset + last.length, length: 0 }
        : { line: 1, col: 1, endLine: 1, endCol: 1, offset: 0, length: 0 };
      this.tokens = [...tokens, { kind: 'EOF', lexeme: '', span: at }];
    }
  }

  // ---- helpers ----------------------------------------------------------
  peek(k = 0): Token {
    return this.tokens[Math.min(this.pos + k, this.tokens.length - 1)];
  }
  advance(): Token {
    const t = this.peek();
    if (t.kind !== 'EOF') this.pos++;
    return t;
  }
  check(kind: TokenKind): boolean {
    return this.peek().kind === kind;
  }
  /** Consume a token of `kind` or report `code` at `at` (default: the current token). */
  expect(kind: TokenKind, code: string, message: string, hint?: string, at?: Span): Token | null {
    if (this.check(kind)) return this.advance();
    this.error(code, message, at ?? this.peek().span, hint);
    return null;
  }
  error(code: string, message: string, span: Span, hint?: string) {
    this.diagnostics.push(makeDiagnostic(code, 'error', 'parser', message, span, hint));
  }
  /** Panic mode: always consume at least one token, then skip to a safe point. */
  synchronize() {
    this.advance();
    while (!SAFE_POINTS.has(this.peek().kind)) this.advance();
  }

  // ---- grammar rules ----------------------------------------------------

  /** program = { item } EOF */
  parseProgram(): Program {
    const body: Stmt[] = [];
    const start = this.peek().span;
    while (!this.check('EOF')) {
      if (this.check('RBRACE')) {
        const t = this.advance();
        this.error('P005', "unexpected '}' with no open block", t.span);
        continue;
      }
      const stmt = this.parseItem();
      if (stmt) body.push(stmt);
    }
    const end = this.peek().span;
    return { kind: 'Program', body, span: joinSpans(start, end) };
  }

  /** item = statement | ";" */
  parseItem(): Stmt | null {
    const t = this.peek();
    switch (t.kind) {
      case 'SEMI':
        this.advance(); // separators are consumed and not put in the tree
        return null;
      case 'TEMPO':
        return this.parseTempo();
      case 'REPEAT':
        return this.parseRepeat();
      case 'DOT':
      case 'WORD':
        return this.parseNote();
      case 'DASH':
        return this.parseRest();
      case 'TICK':
        this.advance();
        this.error(
          'P008',
          'misplaced octave mark',
          t.span,
          "use .sa for lower or sa' for upper; only one mark",
        );
        return null;
      default: {
        const hint =
          t.kind === 'NUMBER'
            ? `to give a note ${t.lexeme} beats, write sa:${t.lexeme}`
            : undefined;
        this.error('P001', `unexpected ${t.kind} '${t.lexeme}'`, t.span, hint);
        this.synchronize();
        return null;
      }
    }
  }

  /** tempo_stmt = "tempo" NUMBER */
  parseTempo(): TempoStmt | null {
    const kw = this.advance();
    const num = this.expect(
      'NUMBER',
      'P007',
      "expected a number after 'tempo'",
      'example: tempo 90',
      this.check('EOF') ? kw.span : this.peek().span,
    );
    if (!num) {
      // "tempo fast": drop the offending word so it is not reported again as a note
      if (this.check('WORD')) this.advance();
      return null;
    }
    return { kind: 'Tempo', bpm: num.value as number, span: joinSpans(kw.span, num.span) };
  }

  /** repeat_stmt = "repeat" NUMBER "{" { item } "}" */
  parseRepeat(): RepeatStmt | null {
    const kw = this.advance();
    let count = NaN;
    let countSpan = kw.span;
    let broken = false;

    if (this.check('NUMBER')) {
      const n = this.advance();
      count = n.value as number;
      countSpan = n.span;
    } else {
      this.error(
        'P002',
        "expected a repeat count after 'repeat'",
        kw.span,
        'example: repeat 2 { sa re }',
      );
      broken = true;
    }

    if (!this.check('LBRACE')) {
      // only report P003 if the count itself was fine, to avoid two errors for one mistake
      if (!broken) this.error('P003', "expected '{' after the repeat count", countSpan);
      return null; // the following notes are parsed as ordinary top-level items
    }
    this.advance(); // {

    const body: Stmt[] = [];
    while (!this.check('RBRACE') && !this.check('EOF')) {
      const stmt = this.parseItem();
      if (stmt) body.push(stmt);
    }
    if (this.check('EOF')) {
      // An unclosed { is reported at the repeat that opened it, once EOF is reached.
      this.error(
        'P004',
        'this repeat block is never closed',
        kw.span,
        "add '}' at the end of the block",
      );
      return null;
    }
    const close = this.advance(); // }
    if (broken) return null;
    return { kind: 'Repeat', count, body, span: joinSpans(kw.span, close.span), countSpan };
  }

  /** note = [ "." ] WORD [ "'" ] [ ":" NUMBER ] */
  parseNote(): NoteStmt | null {
    const first = this.peek();
    let lowerMark = false;
    if (this.check('DOT')) {
      this.advance();
      lowerMark = true;
      if (!this.check('WORD')) {
        this.error(
          'P008',
          'misplaced octave mark',
          first.span,
          "use .sa for lower or sa' for upper; only one mark",
        );
        return null;
      }
    }
    const word = this.advance(); // WORD
    let last = word.span;
    let upperMark = false;
    let ok = true;

    if (this.check('TICK')) {
      last = this.advance().span;
      upperMark = true;
      // sa'' — only one mark allowed
      while (this.check('TICK')) {
        const extra = this.advance();
        if (ok) {
          this.error(
            'P008',
            'misplaced octave mark',
            extra.span,
            "use .sa for lower or sa' for upper; only one mark",
          );
        }
        ok = false;
        last = extra.span;
      }
    }

    let beats = 1;
    let beatsSpan: Span | undefined;
    if (this.check('COLON')) {
      const colon = this.advance();
      last = colon.span;
      if (this.check('NUMBER')) {
        const n = this.advance();
        beats = n.value as number;
        beatsSpan = n.span;
        last = n.span;
      } else {
        this.error('P006', "expected a number after ':'", colon.span, 'example: sa:2');
        ok = false;
      }
    }
    if (!ok) return null;

    const note: NoteStmt = {
      kind: 'Note',
      name: word.value as string,
      lowerMark,
      upperMark,
      beats,
      span: joinSpans(first.span, last),
    };
    if (beatsSpan) note.beatsSpan = beatsSpan;
    return note;
  }

  /** rest = "-" [ ":" NUMBER ] */
  parseRest(): RestStmt | null {
    const dash = this.advance();
    let last = dash.span;
    let beats = 1;
    let beatsSpan: Span | undefined;
    if (this.check('COLON')) {
      const colon = this.advance();
      if (this.check('NUMBER')) {
        const n = this.advance();
        beats = n.value as number;
        beatsSpan = n.span;
        last = n.span;
      } else {
        this.error('P006', "expected a number after ':'", colon.span, 'example: sa:2');
        return null;
      }
    }
    const rest: RestStmt = { kind: 'Rest', beats, span: joinSpans(dash.span, last) };
    if (beatsSpan) rest.beatsSpan = beatsSpan;
    return rest;
  }
}

export function parse(tokens: Token[]): PhaseResult<Program> {
  const t0 = now();
  const p = new Parser(tokens);
  const program = p.parseProgram();
  return {
    phase: 'parser',
    status: hasErrors(p.diagnostics) ? 'error' : 'ok',
    output: program,
    diagnostics: p.diagnostics,
    timeMs: elapsed(t0),
  };
}
