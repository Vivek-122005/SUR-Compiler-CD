import type { CompileResult } from '../compiler/types';
import { PHASES } from '../compiler/compile';
import { fmtMs, phaseState } from './common';

const STATE_LABEL = {
  ok: 'ok',
  error: 'errors',
  warning: 'warnings',
  skipped: 'skipped',
  off: 'off',
};

export function PhaseBar({
  result,
  active,
  onPick,
  optimizerOn,
}: {
  result: CompileResult;
  active: number;
  onPick: (i: number) => void;
  optimizerOn: boolean;
}) {
  return (
    <nav className="phasebar" aria-label="compiler phases">
      {PHASES.map((p, i) => {
        const st = phaseState(result, p.id, optimizerOn);
        const res = result[p.id];
        return (
          <div key={p.id} className="phase-wrap">
            {i > 0 && <span className="arrow">→</span>}
            <button
              className={`phase-chip st-${st} ${active === i ? 'active' : ''}`}
              onClick={() => onPick(i)}
              title={`${p.name}: ${STATE_LABEL[st]}`}
            >
              <span className="dot" />
              <span className="chip-name">
                {p.n} {p.short}
              </span>
              <span className="chip-time">
                {res.status === 'skipped' && st !== 'off'
                  ? 'skipped'
                  : st === 'off'
                    ? 'off'
                    : fmtMs(res.timeMs)}
              </span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
