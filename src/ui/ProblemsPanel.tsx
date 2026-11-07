import type { Diagnostic, Span } from '../compiler/types';
import { formatDiagnostic } from '../compiler/diagnostics';

export function ProblemsPanel({
  diagnostics,
  source,
  onSelect,
}: {
  diagnostics: Diagnostic[];
  source: string;
  onSelect: (s: Span) => void;
}) {
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.length - errors;
  return (
    <section className="problems">
      <div className="problems-head">
        Problems ({diagnostics.length})
        {diagnostics.length > 0 && (
          <span className="muted">
            {' '}
            · {errors} error{errors === 1 ? '' : 's'}, {warnings} warning{warnings === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {diagnostics.length === 0 ? (
        <div className="muted pad">No problems. Press ▶ Play to hear the tune.</div>
      ) : (
        <ul>
          {diagnostics.map((d, i) => (
            <li
              key={i}
              className={`diag sev-${d.severity}`}
              onClick={() => d.span && onSelect(d.span)}
            >
              <pre>{formatDiagnostic(d, source)}</pre>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
