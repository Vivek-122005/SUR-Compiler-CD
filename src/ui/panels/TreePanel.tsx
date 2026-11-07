import { useState } from 'react';
import type { Span, Stmt } from '../../compiler/types';
import { PhaseGate, PhaseHeader, type PanelProps } from '../common';

const beats = (n: number) => `${n} beat${n === 1 ? '' : 's'}`;

function label(s: Stmt): { title: string; detail: string } {
  switch (s.kind) {
    case 'Note': {
      const marks = [s.lowerMark && 'lower mark', s.upperMark && 'upper mark']
        .filter(Boolean)
        .join(', ');
      return {
        title: `Note ${s.lowerMark ? '.' : ''}${s.name}${s.upperMark ? "'" : ''}`,
        detail: `${beats(s.beats)}${marks ? ', ' + marks : ''}`,
      };
    }
    case 'Rest':
      return { title: 'Rest', detail: beats(s.beats) };
    case 'Tempo':
      return { title: `Tempo ${s.bpm}`, detail: 'bpm' };
    case 'Repeat':
      return {
        title: `Repeat ×${s.count}`,
        detail: `${s.body.length} item${s.body.length === 1 ? '' : 's'}`,
      };
  }
}

function Node({
  s,
  onHover,
  onSelect,
}: {
  s: Stmt;
  onHover: (x: Span | null) => void;
  onSelect: (x: Span) => void;
}) {
  const [open, setOpen] = useState(true);
  const { title, detail } = label(s);
  return (
    <li>
      <div
        className={`tnode n-${s.kind}`}
        onMouseEnter={() => onHover(s.span)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onSelect(s.span)}
      >
        {s.kind === 'Repeat' ? (
          <button
            className="twisty"
            onClick={(e) => (e.stopPropagation(), setOpen(!open))}
            aria-label="toggle"
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="twisty" />
        )}
        <span className="tkind">{title}</span> <span className="muted">({detail})</span>
      </div>
      {s.kind === 'Repeat' && open && (
        <ul>
          {s.body.map((c, i) => (
            <Node key={i} s={c} onHover={onHover} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TreePanel({ result, onHover, onSelect, compact }: PanelProps) {
  const program = result.parser.output;
  return (
    <div className="panel">
      {!compact && <PhaseHeader n={2} title="Syntax analysis" io="tokens → parse tree (AST)" />}
      <PhaseGate result={result} id="parser">
        <p className="panel-note">
          Recursive descent: one function per grammar rule. Click a node to select its source text.
        </p>
        <ul className="tree">
          <li>
            <div className="tnode n-Program">
              <span className="twisty" />
              <span className="tkind">Program</span>{' '}
              <span className="muted">({program?.body.length} statements)</span>
            </div>
            <ul>
              {program?.body.map((s, i) => (
                <Node key={i} s={s} onHover={onHover} onSelect={onSelect} />
              ))}
            </ul>
          </li>
        </ul>
      </PhaseGate>
    </div>
  );
}
