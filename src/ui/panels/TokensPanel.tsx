import { PhaseGate, PhaseHeader, type PanelProps } from '../common';

export function TokensPanel({ result, onHover, onSelect, compact }: PanelProps) {
  const tokens = result.lexer.output ?? [];
  return (
    <div className="panel">
      {!compact && <PhaseHeader n={1} title="Lexical analysis" io="source text → tokens" />}
      <PhaseGate result={result} id="lexer">
        <p className="panel-note">
          {tokens.length} tokens. The scanner reads one character at a time; spaces, new lines and #
          comments produce no tokens.
        </p>
        <table className="grid tokens">
          <thead>
            <tr>
              <th>#</th>
              <th>Kind</th>
              <th>Lexeme</th>
              <th>Value</th>
              <th>Line:Col</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t, i) => (
              <tr
                key={i}
                onMouseEnter={() => onHover(t.span)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onSelect(t.span)}
              >
                <td className="muted">{i + 1}</td>
                <td>
                  <span className={`kind k-${t.kind}`}>{t.kind}</span>
                </td>
                <td className="mono">{t.lexeme}</td>
                <td className="mono">{t.value === undefined ? '' : String(t.value)}</td>
                <td className="mono muted">
                  {t.span.line}:{t.span.col}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PhaseGate>
    </div>
  );
}
