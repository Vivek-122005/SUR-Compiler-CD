import type { IRInstr, Span } from '../../compiler/types';
import { formatInstr, instrNumber } from '../../compiler/ir/print';
import { PhaseGate, PhaseHeader, type PanelProps } from '../common';

export function IRListing({
  ir,
  onHover,
  marks,
}: {
  ir: IRInstr[];
  onHover: (s: Span | null) => void;
  marks?: Set<number>;
}) {
  let depth = 0;
  return (
    <ol className="ir">
      {ir.map((ins, i) => {
        if (ins.op === 'ENDLOOP') depth--;
        const d = depth;
        if (ins.op === 'LOOP') depth++;
        const src = 'src' in ins ? ins.src : undefined;
        return (
          <li
            key={i}
            className={`op-${ins.op} ${marks?.has(i) ? 'changed' : ''}`}
            onMouseEnter={() => src && onHover(src)}
            onMouseLeave={() => onHover(null)}
          >
            <span className="lineno">{instrNumber(i)}</span>
            <span style={{ paddingLeft: `${Math.max(0, d) * 1.2}em` }}>{formatInstr(ins)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function IRPanel({ result, onHover, compact }: PanelProps) {
  const ir = result.ir.output ?? [];
  return (
    <div className="panel">
      {!compact && (
        <PhaseHeader
          n={4}
          title="Intermediate code generation"
          io="checked AST → three-address-style IR"
        />
      )}
      <PhaseGate result={result} id="ir">
        <p className="panel-note">
          {ir.length} instructions. Symbolic on purpose: no frequencies or seconds yet — that is the
          optimizer&apos;s constant-folding pass. Hover an instruction to highlight its source.
        </p>
        <IRListing ir={ir} onHover={onHover} />
      </PhaseGate>
    </div>
  );
}
