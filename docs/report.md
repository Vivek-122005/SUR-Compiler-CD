# Sur Compiler — Course Report

**Project:** Sur, a compiler for Indian sargam notation
**Author:** Vivek (GitHub: Vivek-122005)
**Course:** Compiler Design

## 1. Introduction

Sur turns a line of sargam such as `sa re ga ma pa; repeat 2 { dha ni sa' }` into music. It is built as a classic six-phase compiler: each phase is a separate, pure TypeScript module that takes the previous phase's output and returns its own output plus a list of diagnostics. The browser app shows the output of every phase, and a separate *workflow dashboard* walks through the pipeline slide by slide for presentation.

The language is deliberately small (notes, octave marks, durations, rests, tempo, nested repeats). The difficulty lies in implementing the six phases cleanly, with good error messages and error recovery.

## 2. Architecture

```
source text
   │  Phase 1  Lexical analysis        lexer/lexer.ts        → Token[]
   │  Phase 2  Syntax analysis         parser/parser.ts      → Program (AST)
   │  Phase 3  Semantic analysis       semantic/analyzer.ts  → checked AST + SymbolTable
   │  Phase 4  Intermediate code       ir/generate.ts        → IRInstr[]
   │  Phase 5  Code optimization       optimizer/*.ts        → optimized IR + PassReport[]
   ▼  Phase 6  Code generation         codegen/generate.ts   → JavaScript + note schedule
Web Audio playback (src/audio/player.ts)
```

`compile()` (in `compile.ts`) calls the phases in order. If a phase reports an error, later phases are marked *skipped*; warnings never stop the pipeline; every phase records its run time. All shared data structures live in `types.ts`, which is the contract between phases. The compiler folder imports nothing from React, the DOM or Web Audio (enforced by an ESLint rule), so it also runs from the command line and in tests.

## 3. Phase 1 — Lexical analysis

A hand-written scanner reads one character at a time. Rules, in order: skip whitespace; skip `#` comments; letters become a keyword (`tempo`, `repeat`) or a lower-cased `WORD`; digits (optionally preceded directly by `-`) become a `NUMBER`; a lone `-` is the rest symbol `DASH`; `{ } ; . : '` are single-character tokens (the curly `’` is accepted too); anything else is reported as **L001** and skipped. A number such as `2.3.4` or `5.` is **L002**. Every token records its exact `Span` (line, column, offset, length), which is how every later phase can point at the precise characters. The lexer always emits exactly one `EOF`.

## 4. Phase 2 — Syntax analysis

A recursive-descent parser with one function per grammar rule (`parseProgram`, `parseItem`, `parseTempo`, `parseRepeat`, `parseNote`, `parseRest`) and the helpers `peek`, `advance`, `check` and `expect`. The parser only checks *shape*: it accepts `gaa` as a note name and `repeat 0` as a repeat; meaning is Phase 3's job.

**Error recovery (panic mode).** On an unexpected token the parser records **P001**, then skips tokens until a safe point (`;`, `}`, `tempo`, `repeat`, a word, `-`, `.`, or EOF). It always consumes at least one token after an error, so it can never loop forever — this is checked by a property test on random input. An unclosed `{` is reported (**P004**) at the `repeat` that opened it once EOF is reached.

## 5. Phase 3 — Semantic analysis

One tree walk that:
1. looks up every note name in the swar table (**S001**, with a "did you mean" hint from an alias table or Levenshtein distance ≤ 2);
2. fills in each note's `octave` and `semitone`;
3. validates repeat counts (**S002** positive, **S003** whole, **S004** ≤ 32), durations (**S005**), tempo (**S006**, **S007**) and octave marks (**S008**), with warnings **W001–W003**;
4. builds the symbol table: the seven swars with use counts, the tempo and where it came from, and statistics (notes, rests, repeats, nesting depth, beats actually played, seconds).

These implement the professor's two required semantic checks — only real swars, and positive repeat counts. The UI lists every check with ✓ or ✗ so the phase is visible even when the program is correct. The analyser works on a copy of the AST, so it is pure.

## 6. Phase 4 — Intermediate code generation

The checked tree is flattened into a numbered, three-address-style IR: `TEMPO bpm` (always instruction 000), `PLAY swar octave beats`, `REST beats`, `LOOP Ln count`, `ENDLOOP Ln`, `HALT` (always last). Labels are `L1, L2, …` in order of appearance. The IR is deliberately symbolic — no frequencies or seconds — and knows nothing about JavaScript, so another back end (e.g. MIDI) could reuse it. Every `PLAY`/`REST` keeps its source span so the editor can highlight the note being played.

## 7. Phase 5 — Code optimization

Six passes, each a separate function `(ir) → { ir, report }`:

| # | Pass | Textbook name |
|---|---|---|
| 1 | Remove empty `LOOP … ENDLOOP` pairs | Dead code elimination |
| 2 | `LOOP count=1` → body | Strength reduction (control) |
| 3 | Loop whose body is only another loop → one loop (2 × 3 → 6) | Loop fusion / folding |
| 4 | Adjacent `REST`s → one | Peephole optimization |
| 5 | count × body ≤ 8 and no inner loop → copy out | Loop unrolling |
| 6 | Compute every frequency and duration at compile time | Constant folding |

Passes 1–5 repeat until nothing changes (at most 5 rounds); folding runs once at the end. **Safety rule:** an optimization must never change the music. `expand(ir)` plays the IR "on paper"; for every example and for 200 random valid programs, `expand(before)` equals `expand(after)` (merged rests count as the same silence). On the professor's line the loop is unrolled (12 → 13 instructions, 0 loops); on the optimizer demo, `repeat 2 { repeat 3 { sa re } } - - -` goes from 11 to 7 instructions. The optimizer can be switched off in the UI to show that the tune is identical.

## 8. Phase 6 — Code generation

Each IR instruction becomes JavaScript: `PLAY` → `note(freq, seconds, id);`, `REST` → `rest(seconds);`, `LOOP` → `for (let i1 = 0; i1 < n; i1++) {`, `ENDLOOP` → `}`, `HALT` → `return t;`. The prelude defines `note()` with a triangle oscillator and a soft attack/release envelope. Note ids map back to source spans (unrolled copies share their original's id). The player runs the code with `new Function('ctx', 'out', 'onNote', js)`; the `AudioContext` is created only on a click; `out` is a master gain node so Stop silences everything at once. Codegen also returns a schedule that drives the piano-roll timeline. The generator only writes numbers and fixed text; swar names in comments come from the validated swar table.

## 9. Error handling

Every diagnostic has a code, severity, phase, message, span and optional hint, and is displayed in a compiler-style format with a caret under the offending characters. The editor shows red (errors) and yellow (warnings) wavy underlines; the phase bar turns the failing phase red and later phases grey; Play is disabled while there are errors. The "Errors demo" produces three errors in one run, demonstrating recovery. An exception inside a phase is a compiler bug and is wrapped as **C001** instead of crashing.

## 10. Testing

| Kind | What it proves | Where |
|---|---|---|
| Unit | Each phase meets its acceptance criteria | `tests/<phase>.test.ts` |
| Error | Every catalogue code fires with the exact message and span, and not on valid input | `tests/errors.test.ts` |
| Golden | Tokens, tree, IR, optimized IR and JS for each example don't change by accident | `tests/golden/` |
| Property | The optimizer never changes the music; optimizer on/off give the same schedule; the parser never loops or crashes on random input | `tests/optimizer.property.test.ts` |
| Pipeline | Phase statuses, skipping, purity, the professor's line plays 11 notes in 6.6 s | `tests/pipeline.test.ts` |

110 tests; line coverage of `src/compiler/` is about 98%.

## 11. User interface

- **Compiler view:** editor, phase bar with status and timings, six tabs (tokens, tree, symbols, IR, optimizer diff, JS), problems panel, timeline; hovering a token, tree node or IR instruction highlights its source.
- **Workflow dashboard (`#/workflow`):** an overview pipeline diagram with live statistics, one slide per phase (purpose, algorithm, errors, module, and live output), a slide that traces a single note through all six phases down to the moment it sounds, an interactive error-recovery slide, and a design summary.

## 12. Conclusion and possible extensions

All six phases exist as separate modules and are visible in the UI; the professor's example compiles and plays (11 notes, 6.6 s); the required semantic checks are enforced with clear messages. Possible extensions: raag declarations (e.g. Bhupali rejects ma and ni), komal/tivra swars, taal checks (teentaal = 16 beats per cycle), and exporting the tune as a .wav file with `OfflineAudioContext`.
