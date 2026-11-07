// Shared types for the Sur compiler. This file is the contract between all six phases.
// Copied exactly from the Architecture section of the project plan.

export type PhaseId = 'lexer' | 'parser' | 'semantic' | 'ir' | 'optimizer' | 'codegen';

export interface Span {
  line: number;
  col: number; // 1-based start
  endLine: number;
  endCol: number; // 1-based, exclusive end column
  offset: number;
  length: number; // 0-based character offset into source
}

export interface Diagnostic {
  code: string; // e.g. 'S001'
  severity: 'error' | 'warning';
  phase: PhaseId;
  message: string;
  span?: Span;
  hint?: string; // e.g. "did you mean 'ga'?"
}

// Phase 1
export type TokenKind =
  | 'WORD'
  | 'NUMBER'
  | 'TEMPO'
  | 'REPEAT'
  | 'LBRACE'
  | 'RBRACE'
  | 'SEMI'
  | 'DOT'
  | 'TICK'
  | 'COLON'
  | 'DASH'
  | 'EOF';

export interface Token {
  kind: TokenKind;
  lexeme: string;
  value?: number | string;
  span: Span;
}

// Phase 2
export type Stmt = TempoStmt | RepeatStmt | NoteStmt | RestStmt;
export interface Program {
  kind: 'Program';
  body: Stmt[];
  span: Span;
}
export interface TempoStmt {
  kind: 'Tempo';
  bpm: number;
  span: Span;
}
export interface RepeatStmt {
  kind: 'Repeat';
  count: number;
  body: Stmt[];
  span: Span;
  countSpan: Span;
}
export interface NoteStmt {
  kind: 'Note';
  name: string;
  lowerMark: boolean;
  upperMark: boolean;
  beats: number;
  beatsSpan?: Span;
  span: Span;
  octave?: -1 | 0 | 1;
  semitone?: number; // filled by Phase 3
}
export interface RestStmt {
  kind: 'Rest';
  beats: number;
  beatsSpan?: Span;
  span: Span;
}

// Phase 3
export interface SymbolTable {
  swars: { name: string; semitone: number; uses: number }[]; // all 7, with use counts
  tempo: { bpm: number; source: 'default' | 'declared'; span?: Span };
  stats: {
    notes: number;
    rests: number;
    repeats: number;
    maxNesting: number;
    totalBeats: number;
    totalSeconds: number;
  };
}

// Phases 4 and 5
export type IRInstr =
  | { op: 'TEMPO'; bpm: number }
  | {
      op: 'PLAY';
      swar: string;
      octave: -1 | 0 | 1;
      beats: number;
      freq?: number;
      seconds?: number;
      src: Span;
    }
  | { op: 'REST'; beats: number; seconds?: number; src: Span }
  | { op: 'LOOP'; count: number; label: string }
  | { op: 'ENDLOOP'; label: string }
  | { op: 'HALT' };

export interface PassReport {
  pass: string;
  changed: boolean;
  before: number;
  after: number;
  notes: string[];
}

// Phase 6
export interface ScheduledEvent {
  start: number;
  duration: number;
  freq: number | null;
  label: string;
  src?: Span;
}
export interface CodegenOutput {
  js: string;
  schedule: ScheduledEvent[];
  totalSeconds: number;
}

// Pipeline
export interface PhaseResult<T> {
  phase: PhaseId;
  status: 'ok' | 'error' | 'skipped';
  output?: T;
  diagnostics: Diagnostic[];
  timeMs: number;
}

export interface CompileResult {
  ok: boolean;
  lexer: PhaseResult<Token[]>;
  parser: PhaseResult<Program>;
  semantic: PhaseResult<{ program: Program; symbols: SymbolTable }>;
  ir: PhaseResult<IRInstr[]>;
  optimizer: PhaseResult<{ ir: IRInstr[]; passes: PassReport[] }>;
  codegen: PhaseResult<CodegenOutput>;
  diagnostics: Diagnostic[]; // all phases, in source order
}
