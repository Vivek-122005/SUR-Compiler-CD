import type { Span } from './types';

/** A span that covers everything from the start of `a` to the end of `b`. */
export function joinSpans(a: Span, b: Span): Span {
  return {
    line: a.line,
    col: a.col,
    endLine: b.endLine,
    endCol: b.endCol,
    offset: a.offset,
    length: b.offset + b.length - a.offset,
  };
}

export function spanText(source: string, span: Span): string {
  return source.slice(span.offset, span.offset + span.length);
}

export const formatPos = (s: Span) => `${s.line}:${s.col}`;
