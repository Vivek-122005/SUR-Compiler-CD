import type { ReactNode } from 'react';
import type { CompileResult, PhaseId, PhaseResult, Span } from '../compiler/types';
import { PHASES, firstFailedPhase } from '../compiler/compile';

export interface PanelProps {
  result: CompileResult;
  source: string;
  optimizerOn: boolean;
  onHover: (span: Span | null) => void;
  onSelect: (span: Span) => void;
  compact?: boolean;
}

export type PhaseState = 'ok' | 'error' | 'warning' | 'skipped' | 'off';

export function phaseState(r: CompileResult, id: PhaseId, optimizerOn = true): PhaseState {
  const p = r[id] as PhaseResult<unknown>;
  if (id === 'optimizer' && !optimizerOn && p.output) return 'off';
  if (p.status === 'error') return 'error';
  if (p.status === 'skipped') return 'skipped';
  return p.diagnostics.some((d) => d.severity === 'warning') ? 'warning' : 'ok';
}

/** Shows the children only if the phase ran; otherwise the "skipped" message. */
export function PhaseGate({
  result,
  id,
  children,
}: {
  result: CompileResult;
  id: PhaseId;
  children: ReactNode;
}) {
  const p = result[id] as PhaseResult<unknown>;
  if (p.output) return <>{children}</>;
  const failed = firstFailedPhase(result);
  return (
    <div className="skipped">
      <strong>Skipped:</strong> fix the errors in Phase {failed ?? '?'} first
      {failed && (
        <div className="muted">
          ({PHASES[failed - 1].name} found{' '}
          {result.diagnostics.filter((d) => d.severity === 'error').length} error(s) — see Problems)
        </div>
      )}
    </div>
  );
}

export function PhaseHeader({
  n,
  title,
  io,
  children,
}: {
  n: number;
  title: string;
  io: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel-head">
      <div>
        <span className="phase-num">Phase {n}</span> <strong>{title}</strong>
        <span className="io">{io}</span>
      </div>
      <div className="panel-tools">{children}</div>
    </div>
  );
}

export const fmtMs = (ms: number) =>
  ms < 0.01 ? '<0.01 ms' : ms < 1 ? `${ms.toFixed(2)} ms` : `${ms.toFixed(1)} ms`;

/** Line-level LCS diff: which lines of `b` are new compared to `a`. */
export function changedLines(a: string[], b: string[]): Set<number> {
  const changed = new Set<number>();
  if (a.length * b.length > 250_000) return changed;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let i = 0;
  let j = 0;
  while (j < b.length) {
    if (i < a.length && a[i] === b[j]) {
      i++;
      j++;
    } else if (i < a.length && dp[i + 1][j] >= dp[i][j + 1]) i++;
    else changed.add(j++);
  }
  return changed;
}
