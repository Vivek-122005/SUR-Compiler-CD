// Phase 4 — Intermediate code generation.
// Flattens the checked tree into a numbered list of simple instructions,
// like three-address code. The IR knows nothing about Web Audio or JavaScript,
// and stays symbolic: no frequencies or seconds yet (that is Phase 5's job).

import type { IRInstr, PhaseResult, Program, Stmt, SymbolTable } from '../types';
import { now, elapsed } from '../timing';

export function generateIR(program: Program, symbols: SymbolTable): PhaseResult<IRInstr[]> {
  const t0 = now();
  const ir: IRInstr[] = [];
  let labelCounter = 0;

  // Rule 1: TEMPO always comes first, so the tempo statement's position does not matter.
  ir.push({ op: 'TEMPO', bpm: symbols.tempo.bpm });

  const emit = (stmts: Stmt[]) => {
    for (const s of stmts) {
      switch (s.kind) {
        case 'Tempo':
          break; // already emitted as instruction 000
        case 'Note':
          ir.push({
            op: 'PLAY',
            swar: s.name,
            octave: s.octave ?? (s.upperMark ? 1 : s.lowerMark ? -1 : 0),
            beats: s.beats,
            src: s.span,
          });
          break;
        case 'Rest':
          ir.push({ op: 'REST', beats: s.beats, src: s.span });
          break;
        case 'Repeat': {
          const label = `L${++labelCounter}`;
          ir.push({ op: 'LOOP', count: s.count, label });
          emit(s.body);
          ir.push({ op: 'ENDLOOP', label });
          break;
        }
      }
    }
  };
  emit(program.body);
  ir.push({ op: 'HALT' });

  return { phase: 'ir', status: 'ok', output: ir, diagnostics: [], timeMs: elapsed(t0) };
}
