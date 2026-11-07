// Teaching content for the workflow dashboard: one entry per compiler phase.
import type { PhaseId } from '../../compiler/types';

export interface PhaseInfo {
  id: PhaseId;
  n: number;
  name: string;
  textbook: string;
  input: string;
  output: string;
  inputType: string;
  outputType: string;
  module: string[];
  what: string;
  steps: string[];
  errors: { code: string; message: string; example: string }[];
  why: string;
}

export const PHASE_INFO: PhaseInfo[] = [
  {
    id: 'lexer',
    n: 1,
    name: 'Lexical analysis',
    textbook: 'Scanner / tokenizer',
    input: 'Source text',
    output: 'Tokens',
    inputType: 'string',
    outputType: 'Token[]',
    module: ['src/compiler/lexer/lexer.ts'],
    what: 'Reads the program one character at a time and groups characters into tokens — the "words" of Sur. Every token remembers exactly where it came from (line, column, offset), which is what lets every later phase point at the exact characters.',
    steps: [
      'Skip spaces, tabs, new lines; skip # comments to the end of the line',
      'Letters [A-Za-z]+ → lowercase; "tempo"/"repeat" become keywords, anything else a WORD',
      'Digits → NUMBER; a "-" directly before a digit makes a negative number',
      '"-" on its own is the rest symbol (DASH); { } ; . : \' are single-character tokens',
      'Anything else → error L001, skip it, keep scanning; always end with exactly one EOF',
    ],
    errors: [
      { code: 'L001', message: "illegal character '@'", example: 'sa @ re' },
      { code: 'L002', message: "malformed number '2.3.4'", example: 'sa:2.3.4' },
    ],
    why: 'The lexer is hand-written (no regex lexer library), so it is a real finite-state scanner. Case-insensitive swars and the curly ’ quote from phones are handled here, so the parser never sees them.',
  },
  {
    id: 'parser',
    n: 2,
    name: 'Syntax analysis',
    textbook: 'Recursive-descent parser',
    input: 'Tokens',
    output: 'Parse tree (AST)',
    inputType: 'Token[]',
    outputType: 'Program',
    module: ['src/compiler/parser/parser.ts'],
    what: 'Checks that the tokens are arranged according to the grammar and builds a tree: Program → Repeat → Note. Each grammar rule is one function. The parser checks shape only — "gaa" is a fine note name to the parser; deciding it is not a real swar is Phase 3\'s job.',
    steps: [
      'program = { item } EOF            → parseProgram()',
      'item = statement | ";"             → parseItem()',
      'tempo_stmt = "tempo" NUMBER        → parseTempo()',
      'repeat_stmt = "repeat" NUMBER "{" { item } "}" → parseRepeat()',
      'note = [ "." ] WORD [ "\'" ] [ ":" NUMBER ] → parseNote()',
      'rest = "-" [ ":" NUMBER ]          → parseRest()',
    ],
    errors: [
      { code: 'P001', message: "unexpected NUMBER '2'", example: 'sa re 2 ga' },
      { code: 'P002', message: "expected a repeat count after 'repeat'", example: 'repeat { sa }' },
      { code: 'P003', message: "expected '{' after the repeat count", example: 'repeat 2 sa re' },
      { code: 'P004', message: 'this repeat block is never closed', example: 'repeat 2 { sa re' },
      { code: 'P005', message: "unexpected '}' with no open block", example: 'sa }' },
      { code: 'P006', message: "expected a number after ':'", example: 'sa:' },
      { code: 'P007', message: "expected a number after 'tempo'", example: 'tempo fast' },
      { code: 'P008', message: 'misplaced octave mark', example: "sa''" },
    ],
    why: 'Error recovery (panic mode): on an unexpected token the parser records the error, skips to a safe point (; } tempo repeat WORD - . EOF) and carries on — so one run reports every syntax error, and it can never loop forever.',
  },
  {
    id: 'semantic',
    n: 3,
    name: 'Semantic analysis',
    textbook: 'Type / meaning checking + symbol table',
    input: 'AST',
    output: 'Checked AST + symbol table',
    inputType: 'Program',
    outputType: '{ program, symbols: SymbolTable }',
    module: ['src/compiler/semantic/analyzer.ts', 'src/compiler/semantic/suggest.ts'],
    what: 'Walks the tree once and asks "is this allowed?". It implements the professor\'s two required checks — only real swars, and repeat counts must be positive — plus checks on durations and tempo. It fills in each note\'s octave and semitone and builds the symbol table.',
    steps: [
      'Look up every note name in the swar table (sa re ga ma pa dha ni)',
      'Unknown name → S001 with a "did you mean" hint (alias table, then Levenshtein ≤ 2)',
      'Repeat count must be a positive whole number ≤ 32 (S002–S004)',
      'Duration 0.25–8 beats in steps of 0.25; tempo 40–240, declared once (S005–S007)',
      'Fill in octave (−1 / 0 / +1) and semitone; count uses; compute total beats and seconds',
    ],
    errors: [
      { code: 'S001', message: "unknown swar 'gaa' — did you mean 'ga'?", example: 'sa re gaa ma' },
      { code: 'S002', message: 'repeat count must be positive, got 0', example: 'repeat 0 { pa }' },
      {
        code: 'S003',
        message: 'repeat count must be a whole number, got 2.5',
        example: 'repeat 2.5 { pa }',
      },
      {
        code: 'S004',
        message: 'repeat count 500 is too large (max 32)',
        example: 'repeat 500 { pa }',
      },
      { code: 'S005', message: 'duration must be 0.25 to 8 beats…', example: 'sa:9' },
      { code: 'S006', message: 'tempo must be 40 to 240 bpm', example: 'tempo 500' },
      { code: 'S007', message: 'tempo is already set on line 1', example: 'tempo 90 tempo 100' },
      { code: 'S008', message: 'a note cannot be both lower and upper octave', example: ".sa'" },
      {
        code: 'W001–W003',
        message: 'warnings: late tempo, empty repeat, very long piece',
        example: 'sa tempo 90',
      },
    ],
    why: 'Splitting "shape" (Phase 2) from "meaning" (Phase 3) is exactly what the professor\'s semantic-check column asks for: the grammar accepts any word as a note, and this phase decides which words are real swars.',
  },
  {
    id: 'ir',
    n: 4,
    name: 'Intermediate code generation',
    textbook: 'Three-address code',
    input: 'Checked AST',
    output: 'Numbered IR listing',
    inputType: '{ program, symbols }',
    outputType: 'IRInstr[]',
    module: [
      'src/compiler/ir/generate.ts',
      'src/compiler/ir/print.ts',
      'src/compiler/ir/expand.ts',
    ],
    what: 'Flattens the tree into a numbered list of simple instructions, like three-address code in a textbook compiler. The IR knows nothing about Web Audio or JavaScript, so a different back end (MIDI, say) could reuse it.',
    steps: [
      "Emit TEMPO first (declared or default 100) — so the tempo line's position does not matter",
      'Note → PLAY swar octave beats;  Rest → REST beats',
      'Repeat → LOOP Ln count … body … ENDLOOP Ln  (labels L1, L2 … in order)',
      'Emit HALT last',
      'Stay symbolic: no frequencies or seconds yet; every PLAY/REST keeps its source span',
    ],
    errors: [],
    why: 'A machine-independent middle layer is what makes optimization possible: Phase 5 rewrites this list without caring how it will finally be played.',
  },
  {
    id: 'optimizer',
    n: 5,
    name: 'Code optimization',
    textbook: 'Machine-independent optimization',
    input: 'IR',
    output: 'Optimized IR + pass report',
    inputType: 'IRInstr[]',
    outputType: '{ ir, passes: PassReport[] }',
    module: [
      'src/compiler/optimizer/index.ts',
      'dead-code.ts · loop-simplify.ts · loop-collapse.ts',
      'rest-merge.ts · unroll.ts · constant-fold.ts',
    ],
    what: 'Rewrites the IR into an equivalent but simpler or faster version. Each pass is a separate function so the dashboard can show exactly what each one changed. Passes 1–5 repeat until nothing changes; constant folding runs once at the end.',
    steps: [
      'Dead code elimination — remove empty LOOP … ENDLOOP pairs',
      'Loop simplification — LOOP count=1 → just the body',
      'Loop collapsing — LOOP 2 { LOOP 3 { … } } → LOOP 6 { … }',
      'Rest merging (peephole) — adjacent RESTs become one',
      'Small-loop unrolling — count × body ≤ 8 and no inner loop → copy it out',
      'Constant folding — work out every frequency (Hz) and duration (s) at compile time',
    ],
    errors: [],
    why: 'Safety rule: an optimization must never change the music. expand() plays the IR "on paper"; before and after must give the same notes in the same order — verified by a property test on 200 random programs.',
  },
  {
    id: 'codegen',
    n: 6,
    name: 'Code generation',
    textbook: 'Target code emission',
    input: 'Optimized IR',
    output: 'JavaScript + note schedule',
    inputType: 'IRInstr[]',
    outputType: 'CodegenOutput { js, schedule }',
    module: ['src/compiler/codegen/generate.ts', 'src/audio/player.ts'],
    what: "Turns the optimized IR into readable JavaScript that plays the tune through the browser's Web Audio API. JavaScript is the target language the way x86 is for a C compiler. It also produces the note schedule that draws the timeline.",
    steps: [
      'TEMPO → header comment  (1 beat = 60 / tempo seconds)',
      'PLAY → note(freq, seconds, id);  REST → rest(seconds);',
      'LOOP → for (let i1 = 0; i1 < n; i1++) {   ENDLOOP → }',
      'HALT → return t;',
      'The player runs the code with new Function(ctx, out, onNote) on a click',
    ],
    errors: [
      {
        code: 'C001',
        message: 'internal compiler error — a bug, not your mistake',
        example: '(exception in phases 4–6)',
      },
    ],
    why: 'Safety: the generator only ever writes numbers and fixed text into the code; swar names come from the validated swar table, never straight from user input.',
  },
];
