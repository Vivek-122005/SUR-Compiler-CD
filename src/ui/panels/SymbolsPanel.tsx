import { semanticChecks } from '../../compiler/semantic/checks';
import { frequency } from '../../compiler/swars';
import { PhaseGate, PhaseHeader, type PanelProps } from '../common';

export function SymbolsPanel({ result, onSelect, compact }: PanelProps) {
  const out = result.semantic.output;
  const checks = semanticChecks(result.semantic.diagnostics);
  return (
    <div className="panel">
      {!compact && (
        <PhaseHeader n={3} title="Semantic analysis" io="AST → checked AST + symbol table" />
      )}
      <PhaseGate result={result} id="semantic">
        {out && (
          <div className="symbols">
            <div>
              <h4>Swar table</h4>
              <table className="grid">
                <thead>
                  <tr>
                    <th>Swar</th>
                    <th>Semitone</th>
                    <th>Middle Hz</th>
                    <th>Uses in source</th>
                  </tr>
                </thead>
                <tbody>
                  {out.symbols.swars.map((s) => (
                    <tr key={s.name} className={s.uses ? '' : 'dim'}>
                      <td className="mono">{s.name}</td>
                      <td className="mono">{s.semitone}</td>
                      <td className="mono">{frequency(s.semitone, 0).toFixed(2)}</td>
                      <td className="mono">{s.uses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4>Settings</h4>
              <p>
                Tempo <strong>{out.symbols.tempo.bpm}</strong> bpm,{' '}
                {out.symbols.tempo.source === 'declared' && out.symbols.tempo.span
                  ? `declared at ${out.symbols.tempo.span.line}:${out.symbols.tempo.span.col}`
                  : 'default'}{' '}
                · 1 beat = {(60 / out.symbols.tempo.bpm).toFixed(3)} s
              </p>
              <h4>Statistics</h4>
              <ul className="stats">
                <li>
                  <b>{out.symbols.stats.notes}</b> notes
                </li>
                <li>
                  <b>{out.symbols.stats.rests}</b> rests
                </li>
                <li>
                  <b>{out.symbols.stats.repeats}</b> repeat blocks
                </li>
                <li>
                  nesting depth <b>{out.symbols.stats.maxNesting}</b>
                </li>
                <li>
                  <b>{out.symbols.stats.totalBeats}</b> beats played
                </li>
                <li>
                  <b>{out.symbols.stats.totalSeconds.toFixed(1)}</b> seconds
                </li>
              </ul>
            </div>
          </div>
        )}
        <h4>Checks</h4>
        <ul className="checks">
          {checks.map((c) => (
            <li
              key={c.label}
              className={c.ok ? 'pass' : c.severity === 'error' ? 'fail' : 'warn'}
              onClick={() => c.failures[0]?.span && onSelect(c.failures[0].span)}
            >
              <span className="mark">{c.ok ? '✓' : c.severity === 'error' ? '✗' : '!'}</span>{' '}
              {c.label}
              {c.required && <span className="tag">required</span>}
              <span className="muted"> {c.codes.join(', ')}</span>
              {!c.ok && (
                <span className="muted">
                  {' '}
                  — {c.failures.length} problem{c.failures.length === 1 ? '' : 's'} (click to jump)
                </span>
              )}
            </li>
          ))}
        </ul>
      </PhaseGate>
    </div>
  );
}
