import { useMemo } from 'react';
import { formatInstr } from '../../compiler/ir/print';
import { PASSES, FOLD_PASS } from '../../compiler/optimizer';
import { PhaseGate, PhaseHeader, changedLines, type PanelProps } from '../common';
import { IRListing } from './IRPanel';

const TEXTBOOK = Object.fromEntries([...PASSES, FOLD_PASS].map((p) => [p.name, p.textbook]));

export function OptimizerPanel({ result, onHover, optimizerOn, compact }: PanelProps) {
  const before = useMemo(() => result.ir.output ?? [], [result]);
  const after = useMemo(() => result.optimizer.output?.ir ?? [], [result]);
  const passes = result.optimizer.output?.passes ?? [];
  const marks = useMemo(
    () => changedLines(before.map(formatInstr), after.map(formatInstr)),
    [before, after],
  );
  const loops = (xs: typeof before) => xs.filter((i) => i.op === 'LOOP').length;

  return (
    <div className="panel">
      {!compact && (
        <PhaseHeader n={5} title="Code optimization" io="IR → optimized IR + pass report" />
      )}
      <PhaseGate result={result} id="ir">
        {!optimizerOn ? (
          <div className="skipped">
            <strong>Optimizer is switched off.</strong> Phase 6 runs on the unoptimized IR and works
            out frequencies itself — and the tune sounds exactly the same. Turn it on in the header
            to see the passes.
          </div>
        ) : (
          <>
            <div className="side-by-side">
              <div>
                <h4>
                  Before ({before.length} instructions, {loops(before)} loop
                  {loops(before) === 1 ? '' : 's'})
                </h4>
                <IRListing ir={before} onHover={onHover} />
              </div>
              <div>
                <h4>
                  After ({after.length} instructions, {loops(after)} loop
                  {loops(after) === 1 ? '' : 's'})
                </h4>
                <IRListing ir={after} onHover={onHover} marks={marks} />
              </div>
            </div>
            <h4>Pass report</h4>
            <table className="grid passes">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Pass</th>
                  <th>Textbook name</th>
                  <th>Changed</th>
                  <th>Instrs</th>
                  <th>What changed</th>
                </tr>
              </thead>
              <tbody>
                {passes.map((p, i) => (
                  <tr key={p.pass} className={p.changed ? 'fired' : 'dim'}>
                    <td>{i + 1}</td>
                    <td>{p.pass}</td>
                    <td className="muted">{TEXTBOOK[p.pass]}</td>
                    <td>{p.changed ? '✓ yes' : '—'}</td>
                    <td className="mono">
                      {p.before} → {p.after}
                    </td>
                    <td>{p.notes.join('; ') || <span className="muted">did not fire</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="panel-note">
              Passes 1–5 repeat until nothing changes (
              {result.optimizer.output && 'rounds' in result.optimizer.output
                ? String((result.optimizer.output as { rounds?: number }).rounds)
                : '?'}{' '}
              round(s) this time); constant folding runs once at the end. Safety rule: the optimized
              IR must play exactly the same music — checked by a property test on 200 random
              programs.
            </p>
          </>
        )}
      </PhaseGate>
    </div>
  );
}
