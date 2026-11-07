# Sur Compiler 🎵

Sur is a small compiler for Indian music notation. It reads sargam like

```
sa re ga ma pa; repeat 2 { dha ni sa' }
```

runs it through **all six classic compiler phases**, shows the output of every phase on screen, and plays the result as a tune in the browser.

| # | Compiler phase | Input → output | Shown on screen as | Module |
|---|---|---|---|---|
| 1 | Lexical analysis | source text → tokens | Token table | `src/compiler/lexer/` |
| 2 | Syntax analysis | tokens → parse tree (AST) | Collapsible tree | `src/compiler/parser/` |
| 3 | Semantic analysis | AST → checked AST + symbol table | Symbol table + ✓/✗ checks | `src/compiler/semantic/` |
| 4 | Intermediate code generation | checked AST → three-address-style IR | Numbered IR listing | `src/compiler/ir/` |
| 5 | Code optimization | IR → optimized IR | Before/after diff + pass report | `src/compiler/optimizer/` |
| 6 | Code generation | optimized IR → JavaScript | Generated code + Play + timeline | `src/compiler/codegen/` |

## Two views

- **Compiler** (`#/`) — editor on the left, the six phase panels on the right, a phase bar across the top (green / amber / red / grey with run times), problems panel, and a note timeline. Compiles 300 ms after you stop typing, or on **Compile** / **Ctrl/Cmd + Enter**.
- **Workflow dashboard** (`#/workflow`) — a presentation view that explains the whole pipeline: an overview diagram, one slide per phase (what it does, the algorithm, the errors it reports, and its live output for the current program), a slide that **traces one note through all six phases**, an interactive error-recovery slide, and a design & testing summary. Use ← → to move between slides and **⛶ Present** for full screen.

## Run it

Requires Node.js 18+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit, error-catalogue, golden and property tests
npm run lint
npm run build      # production build in dist/
```

Command line — print any phase's output:

```bash
npm run surc examples/01-professor.sur -- --phase ir
npm run surc examples/04-optimizer-demo.sur -- --phase opt
npm run surc examples/05-errors.sur            # shows the three diagnostics
```

Phases: `tokens | ast | symbols | ir | opt | js | schedule | all`; add `--no-opt` to skip the optimizer.

## Deploy (public URL)

The repo includes `.github/workflows/deploy.yml`. In GitHub: **Settings → Pages → Source: GitHub Actions**, then push to `main`. The app is published at `https://<user>.github.io/SUR-Compiler/`.

## The language in one minute

| Feature | Syntax | Meaning |
|---|---|---|
| Note | `sa re ga ma pa dha ni` | The seven shuddh swars, middle octave, 1 beat each |
| Upper / lower octave | `sa'` / `.ni` | One octave up / down |
| Duration | `sa:2`, `re:0.5` | Beats, 0.25–8 in steps of 0.25 |
| Rest | `-`, `-:2` | Silence |
| Repeat | `repeat 2 { dha ni sa' }` | Plays the block N times (1–32); can be nested |
| Tempo | `tempo 90` | 40–240 bpm, default 100, at most once |
| Separator / comment | space, new line, `;` / `# text` | |

Full details: [`docs/language.md`](docs/language.md) · errors: [`docs/errors.md`](docs/errors.md) · course report: [`docs/report.md`](docs/report.md) · demo script: [`docs/demo-script.md`](docs/demo-script.md).

## Project structure

```
src/compiler/      the compiler — no React, DOM or Web Audio imports
  types.ts         shared contract between all phases
  lexer/ parser/ semantic/ ir/ optimizer/ codegen/
  compile.ts       runs the six phases, builds CompileResult
src/audio/         Web Audio player for the generated JavaScript
src/ui/            React app: editor, phase bar, six panels, timeline
src/ui/workflow/   the presentation dashboard
src/cli.ts         command-line front end
examples/          the five example programs
tests/             unit, error-catalogue, golden and property tests
docs/              language guide, error catalogue, course report, demo script
```

Built with TypeScript (strict), Vite, React 18, CodeMirror 6, Vitest and fast-check. The lexer and parser are hand-written — no parser generators.
