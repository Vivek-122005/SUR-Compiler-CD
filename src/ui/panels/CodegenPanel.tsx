import { useState, type ReactNode } from 'react';
import { PhaseGate, PhaseHeader, type PanelProps } from '../common';

const KW = new Set(['let', 'const', 'function', 'for', 'return']);

/** Tiny highlighter for the generated JS (comments, keywords, numbers, strings). */
export function highlightJS(js: string): ReactNode[] {
  return js.split('\n').map((line, li) => {
    const parts: ReactNode[] = [];
    const re = /(\/\/.*$)|('[^']*')|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)\b/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    while ((m = re.exec(line))) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      if (m[1])
        parts.push(
          <span key={k++} className="js-c">
            {m[1]}
          </span>,
        );
      else if (m[2])
        parts.push(
          <span key={k++} className="js-s">
            {m[2]}
          </span>,
        );
      else if (m[3])
        parts.push(
          <span key={k++} className="js-n">
            {m[3]}
          </span>,
        );
      else if (m[4] && KW.has(m[4]))
        parts.push(
          <span key={k++} className="js-k">
            {m[4]}
          </span>,
        );
      else if (m[4] === 'note' || m[4] === 'rest')
        parts.push(
          <span key={k++} className="js-f">
            {m[4]}
          </span>,
        );
      else parts.push(m[0]);
      last = m.index + m[0].length;
    }
    parts.push(line.slice(last));
    return (
      <div key={li} className="js-line">
        <span className="lineno">{li + 1}</span>
        {parts}
      </div>
    );
  });
}

export function CodegenPanel({ result, compact }: PanelProps) {
  const out = result.codegen.output;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(out!.js);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked */
    }
  };
  const download = () => {
    const blob = new Blob([out!.js], { type: 'text/javascript' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sur-program.js';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="panel">
      {!compact && (
        <PhaseHeader n={6} title="Code generation" io="optimized IR → JavaScript (Web Audio)">
          {out && (
            <>
              <button onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
              <button onClick={download}>Download .js</button>
            </>
          )}
        </PhaseHeader>
      )}
      <PhaseGate result={result} id="codegen">
        {out && (
          <>
            <p className="panel-note">
              JavaScript is the target language the way x86 is for a C compiler.{' '}
              {out.schedule.filter((e) => e.freq !== null).length} notes,{' '}
              {out.totalSeconds.toFixed(1)} s. Press ▶ Play to run it.
            </p>
            <pre className="js">{highlightJS(out.js)}</pre>
          </>
        )}
      </PhaseGate>
    </div>
  );
}
