// Phase 3 — Semantic analysis.
// Walks the AST once and answers "is this allowed?": real swars only, positive
// whole repeat counts, sane durations and tempo. Fills in each note's octave and
// semitone, and builds the symbol table. Collects every problem; never stops early.

import type {
  Diagnostic,
  NoteStmt,
  PhaseResult,
  Program,
  Span,
  Stmt,
  SymbolTable,
  TempoStmt,
} from '../types';
import { hasErrors, makeDiagnostic } from '../diagnostics';
import { DEFAULT_TEMPO, SWARS, semitoneOf, round } from '../swars';
import { suggestSwar } from './suggest';
import { now, elapsed } from '../timing';

export const LIMITS = {
  maxRepeat: 32,
  minBeats: 0.25,
  maxBeats: 8,
  minTempo: 40,
  maxTempo: 240,
  maxSeconds: 600,
};

/** The span of just the swar name inside a note (skipping a leading '.'). */
function nameSpan(note: NoteStmt): Span {
  const shift = note.lowerMark ? 1 : 0;
  return {
    line: note.span.line,
    col: note.span.col + shift,
    endLine: note.span.line,
    endCol: note.span.col + shift + note.name.length,
    offset: note.span.offset + shift,
    length: note.name.length,
  };
}

const fmt = (n: number) => String(n);

export function analyze(input: Program): PhaseResult<{ program: Program; symbols: SymbolTable }> {
  const t0 = now();
  // Phases are pure: work on a copy so the caller's AST is untouched.
  const program: Program = structuredClone(input);
  const diagnostics: Diagnostic[] = [];
  const err = (code: string, message: string, span?: Span, hint?: string) =>
    diagnostics.push(makeDiagnostic(code, 'error', 'semantic', message, span, hint));
  const warn = (code: string, message: string, span?: Span, hint?: string) =>
    diagnostics.push(makeDiagnostic(code, 'warning', 'semantic', message, span, hint));

  const uses = new Map<string, number>(SWARS.map((s) => [s.name, 0]));
  const stats = { notes: 0, rests: 0, repeats: 0, maxNesting: 0, totalBeats: 0, totalSeconds: 0 };
  let tempoStmt: TempoStmt | undefined;
  let seenSound = false;

  const checkBeats = (beats: number, span: Span | undefined, whole: Span) => {
    const okRange = beats >= LIMITS.minBeats && beats <= LIMITS.maxBeats;
    const okStep = Number.isInteger(beats * 4);
    if (!okRange || !okStep) {
      err(
        'S005',
        `duration must be 0.25 to 8 beats in steps of 0.25, got ${fmt(beats)}`,
        span ?? whole,
      );
      return false;
    }
    return true;
  };

  /** Returns the number of beats this list of statements plays (one pass). */
  const walk = (stmts: Stmt[], depth: number): number => {
    let beats = 0;
    for (const s of stmts) {
      switch (s.kind) {
        case 'Tempo': {
          if (tempoStmt) {
            err(
              'S007',
              `tempo is already set on line ${tempoStmt.span.line}`,
              s.span,
              'remove one tempo line',
            );
            break;
          }
          tempoStmt = s;
          if (s.bpm < LIMITS.minTempo || s.bpm > LIMITS.maxTempo) {
            err('S006', `tempo must be 40 to 240 bpm, got ${fmt(s.bpm)}`, s.span);
          }
          if (seenSound) {
            warn('W001', 'tempo applies to the whole piece; move it to the top', s.span);
          }
          break;
        }
        case 'Note': {
          seenSound = true;
          stats.notes++;
          const semitone = semitoneOf(s.name);
          if (semitone === undefined) {
            const guess = suggestSwar(s.name);
            err(
              'S001',
              `unknown swar '${s.name}'`,
              nameSpan(s),
              guess ? `did you mean '${guess}'?` : undefined,
            );
          } else {
            uses.set(s.name, (uses.get(s.name) ?? 0) + 1);
            s.semitone = semitone;
          }
          if (s.lowerMark && s.upperMark) {
            err('S008', 'a note cannot be both lower and upper octave', s.span);
          }
          s.octave = s.lowerMark && !s.upperMark ? -1 : s.upperMark && !s.lowerMark ? 1 : 0;
          if (checkBeats(s.beats, s.beatsSpan, s.span)) beats += s.beats;
          break;
        }
        case 'Rest': {
          seenSound = true;
          stats.rests++;
          if (checkBeats(s.beats, s.beatsSpan, s.span)) beats += s.beats;
          break;
        }
        case 'Repeat': {
          stats.repeats++;
          stats.maxNesting = Math.max(stats.maxNesting, depth + 1);
          let countOk = false;
          if (s.count <= 0) {
            err('S002', `repeat count must be positive, got ${fmt(s.count)}`, s.countSpan);
          } else if (!Number.isInteger(s.count)) {
            err('S003', `repeat count must be a whole number, got ${fmt(s.count)}`, s.countSpan);
          } else if (s.count > LIMITS.maxRepeat) {
            err('S004', `repeat count ${fmt(s.count)} is too large (max 32)`, s.countSpan);
          } else {
            countOk = true;
          }
          if (s.body.length === 0) {
            warn('W002', 'empty repeat block does nothing', s.span, 'the optimizer will remove it');
          }
          const inner = walk(s.body, depth + 1);
          beats += countOk ? inner * s.count : inner;
          break;
        }
      }
    }
    return beats;
  };

  stats.totalBeats = walk(program.body, 0);

  const validTempo =
    tempoStmt && tempoStmt.bpm >= LIMITS.minTempo && tempoStmt.bpm <= LIMITS.maxTempo
      ? tempoStmt.bpm
      : DEFAULT_TEMPO;
  stats.totalSeconds = round((stats.totalBeats * 60) / validTempo, 3);

  if (stats.totalSeconds > LIMITS.maxSeconds) {
    warn(
      'W003',
      `this piece is ${(stats.totalSeconds / 60).toFixed(1)} minutes long`,
      undefined,
      'very large nested repeats',
    );
  }

  const symbols: SymbolTable = {
    swars: SWARS.map((s) => ({ name: s.name, semitone: s.semitone, uses: uses.get(s.name) ?? 0 })),
    tempo: tempoStmt
      ? { bpm: tempoStmt.bpm, source: 'declared', span: tempoStmt.span }
      : { bpm: DEFAULT_TEMPO, source: 'default' },
    stats,
  };

  return {
    phase: 'semantic',
    status: hasErrors(diagnostics) ? 'error' : 'ok',
    output: { program, symbols },
    diagnostics,
    timeMs: elapsed(t0),
  };
}
