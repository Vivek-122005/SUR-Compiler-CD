import type { Diagnostic, PhaseId, Span } from './types';
import { SWAR_NAMES } from './swars';

export function makeDiagnostic(
  code: string,
  severity: 'error' | 'warning',
  phase: PhaseId,
  message: string,
  span?: Span,
  hint?: string,
): Diagnostic {
  const d: Diagnostic = { code, severity, phase, message };
  if (span) d.span = span;
  if (hint) d.hint = hint;
  return d;
}

export const hasErrors = (ds: Diagnostic[]) => ds.some((d) => d.severity === 'error');

/** Sort by line, then column (diagnostics without a span go last). */
export function sortDiagnostics(ds: Diagnostic[]): Diagnostic[] {
  return [...ds].sort((a, b) => {
    const al = a.span?.line ?? Infinity;
    const bl = b.span?.line ?? Infinity;
    if (al !== bl) return al - bl;
    return (a.span?.col ?? 0) - (b.span?.col ?? 0);
  });
}

/** Extra text shown after the carets for some codes. */
function caretNote(d: Diagnostic): string {
  if (d.code === 'S001') return ` not one of: ${SWAR_NAMES.join(' ')}`;
  return '';
}

/**
 * Display format shared by the error panel and the CLI:
 *
 *   error[S001] semantic: unknown swar 'gaa'
 *    --> line 1, col 7
 *     |
 *   1 | sa re gaa ma
 *     |       ^^^ not one of: sa re ga ma pa dha ni
 *     |
 *     = hint: did you mean 'ga'?
 */
export function formatDiagnostic(d: Diagnostic, source: string): string {
  const out: string[] = [`${d.severity}[${d.code}] ${d.phase}: ${d.message}`];
  if (d.span) {
    const { line, col } = d.span;
    const text = source.split('\n')[line - 1] ?? '';
    const gutter = String(line).length;
    const pad = ' '.repeat(gutter);
    const caretLen = Math.max(
      1,
      d.span.endLine === line ? d.span.endCol - col : text.length - col + 1,
    );
    out.push(`${pad}--> line ${line}, col ${col}`);
    out.push(`${pad} |`);
    out.push(`${line} | ${text.replace(/\r$/, '')}`);
    out.push(`${pad} | ${' '.repeat(col - 1)}${'^'.repeat(caretLen)}${caretNote(d)}`);
    out.push(`${pad} |`);
    if (d.hint) out.push(`${pad} = hint: ${d.hint}`);
  } else if (d.hint) {
    out.push(`  = hint: ${d.hint}`);
  }
  return out.join('\n');
}
