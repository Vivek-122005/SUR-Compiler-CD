// Phase 1 — Lexical analysis.
// A hand-written scanner: reads the source one character at a time and groups
// characters into tokens. No regex-based lexer library.

import type { Diagnostic, PhaseResult, Span, Token, TokenKind } from '../types';
import { makeDiagnostic, hasErrors } from '../diagnostics';
import { now, elapsed } from '../timing';

const KEYWORDS: Record<string, TokenKind> = { tempo: 'TEMPO', repeat: 'REPEAT' };

const SINGLE: Record<string, TokenKind> = {
  '{': 'LBRACE',
  '}': 'RBRACE',
  ';': 'SEMI',
  '.': 'DOT',
  ':': 'COLON',
  "'": 'TICK',
  '’': 'TICK', // ’ curly quote that phones and docs insert
};

const isLetter = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
const isDigit = (c: string) => c >= '0' && c <= '9';

export function lex(source: string): PhaseResult<Token[]> {
  const t0 = now();
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];

  let i = 0; // offset
  let line = 1;
  let col = 1;

  const peek = (k = 0) => source[i + k] ?? '';

  /** Span from a saved start position to the current position (same line). */
  const spanFrom = (startOffset: number, startLine: number, startCol: number): Span => ({
    line: startLine,
    col: startCol,
    endLine: line,
    endCol: col,
    offset: startOffset,
    length: i - startOffset,
  });

  const advance = () => {
    const c = source[i++];
    if (c === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
    return c;
  };

  while (i < source.length) {
    const c = peek();
    const so = i;
    const sl = line;
    const sc = col;

    // 1. whitespace
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      advance();
      continue;
    }

    // 2. comment: skip to end of line
    if (c === '#') {
      while (i < source.length && peek() !== '\n') advance();
      continue;
    }

    // 3. letters -> keyword or WORD (lower-cased)
    if (isLetter(c)) {
      while (isLetter(peek())) advance();
      const lexeme = source.slice(so, i);
      const lower = lexeme.toLowerCase();
      const kind = KEYWORDS[lower] ?? 'WORD';
      const tok: Token = { kind, lexeme, span: spanFrom(so, sl, sc) };
      if (kind === 'WORD') tok.value = lower;
      tokens.push(tok);
      continue;
    }

    // 4/5. digits, or '-' directly followed by a digit -> NUMBER
    if (isDigit(c) || (c === '-' && isDigit(peek(1)))) {
      if (c === '-') advance();
      while (isDigit(peek())) advance();
      let malformed = false;
      if (peek() === '.') {
        if (isDigit(peek(1))) {
          advance();
          while (isDigit(peek())) advance();
        } else {
          // "5." — a dot with no digits after it
          advance();
          malformed = true;
        }
        // "2.3.4" — another dot means a malformed number; swallow the rest of it
        while (peek() === '.' || isDigit(peek())) {
          advance();
          malformed = true;
        }
      }
      const lexeme = source.slice(so, i);
      const span = spanFrom(so, sl, sc);
      if (malformed) {
        diagnostics.push(
          makeDiagnostic(
            'L002',
            'error',
            'lexer',
            `malformed number '${lexeme}'`,
            span,
            'numbers look like 2 or 0.5',
          ),
        );
      } else {
        tokens.push({ kind: 'NUMBER', lexeme, value: Number(lexeme), span });
      }
      continue;
    }

    // 6. '-' otherwise is the rest symbol
    if (c === '-') {
      advance();
      tokens.push({ kind: 'DASH', lexeme: '-', span: spanFrom(so, sl, sc) });
      continue;
    }

    // 7. single-character tokens
    const single = SINGLE[c];
    if (single) {
      advance();
      tokens.push({ kind: single, lexeme: c, span: spanFrom(so, sl, sc) });
      continue;
    }

    // 8. anything else: report, skip, keep scanning
    // (take a whole surrogate pair so emoji are reported as one character)
    const code = source.codePointAt(i) ?? 0;
    const ch = String.fromCodePoint(code);
    for (let k = 0; k < ch.length; k++) advance();
    diagnostics.push(
      makeDiagnostic(
        'L001',
        'error',
        'lexer',
        `illegal character '${ch}'`,
        spanFrom(so, sl, sc),
        "Sur uses only swars, numbers and { } ; . ' : - #",
      ),
    );
  }

  // End of input: always exactly one EOF
  tokens.push({
    kind: 'EOF',
    lexeme: '',
    span: { line, col, endLine: line, endCol: col, offset: i, length: 0 },
  });

  return {
    phase: 'lexer',
    status: hasErrors(diagnostics) ? 'error' : 'ok',
    output: tokens,
    diagnostics,
    timeMs: elapsed(t0),
  };
}
