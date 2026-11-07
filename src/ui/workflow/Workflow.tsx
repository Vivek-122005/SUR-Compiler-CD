// Workflow dashboard — a presentation view that walks through the six compiler
// phases one slide at a time, using live output from the chosen program.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { compile, PHASES } from '../../compiler/compile';
import type { CompileResult, NoteStmt, Span, Stmt } from '../../compiler/types';
import { formatDiagnostic } from '../../compiler/diagnostics';
import { formatInstr, instrNumber } from '../../compiler/ir/print';
import { noteIds } from '../../compiler/codegen/generate';
import { spanText } from '../../compiler/span';
import { EXAMPLES, loadSource, loadOptimizer } from '../examples';
import { fmtMs, phaseState, type PanelProps } from '../common';
import { PHASE_INFO, type PhaseInfo } from './phaseInfo';
import { TokensPanel } from '../panels/TokensPanel';
import { TreePanel } from '../panels/TreePanel';
import { SymbolsPanel } from '../panels/SymbolsPanel';
import { IRPanel } from '../panels/IRPanel';
import { OptimizerPanel } from '../panels/OptimizerPanel';
import { CodegenPanel } from '../panels/CodegenPanel';
import { Timeline } from '../Timeline';
import { usePlayback } from '../usePlayback';

const PANELS = [TokensPanel, TreePanel, SymbolsPanel, IRPanel, OptimizerPanel, CodegenPanel];

const SLIDES = [
  { id: 'overview', title: 'The pipeline' },
  ...PHASE_INFO.map((p) => ({ id: p.id, title: `${p.n} · ${p.name}` })),
  { id: 'trace', title: 'Trace one note end to end' },
  { id: 'errors', title: 'Error handling & recovery' },
  { id: 'design', title: 'Design & testing' },
];

/** Source text with one span highlighted. */
function SourceView({
  source,
  span,
  kind = 'hover',
}: {
  source: string;
  span: Span | null;
  kind?: string;
}) {
  if (!span) return <pre className="source-view">{source}</pre>;
  const a = span.offset;
  const b = span.offset + span.length;
  return (
    <pre className="source-view">
      {source.slice(0, a)}
      <mark className={`sv-${kind}`}>{source.slice(a, b) || ' '}</mark>
      {source.slice(b)}
    </pre>
  );
}

function outputSize(r: CompileResult, i: number): string {
  switch (i) {
    case 0:
      return r.lexer.output ? `${r.lexer.output.length} tokens` : '';
    case 1: {
      const count = (s: Stmt[]): number =>
        s.reduce((a, x) => a + 1 + (x.kind === 'Repeat' ? count(x.body) : 0), 0);
      return r.parser.output ? `${count(r.parser.output.body) + 1} AST nodes` : '';
    }
    case 2:
      return r.semantic.output ? `${r.semantic.output.symbols.stats.totalBeats} beats checked` : '';
    case 3:
      return r.ir.output ? `${r.ir.output.length} instructions` : '';
    case 4:
      return r.optimizer.output ? `${r.optimizer.output.ir.length} instructions` : '';
    case 5:
      return r.codegen.output ? `${r.codegen.output.js.split('\n').length} lines of JS` : '';
  }
  return '';
}

function Pipeline({
  result,
  optimizerOn,
  onPick,
}: {
  result: CompileResult;
  optimizerOn: boolean;
  onPick: (i: number) => void;
}) {
  return (
    <div className="pipeline">
      <div className="pipe-io">
        <div className="pipe-src">source text</div>
      </div>
      {PHASE_INFO.map((p, i) => {
        const st = phaseState(result, p.id, optimizerOn);
        return (
          <div key={p.id} className="pipe-step">
            <div className="pipe-arrow">
              <span>↓</span> <code>{p.inputType}</code>
            </div>
            <button className={`pipe-box st-${st}`} onClick={() => onPick(i + 1)}>
              <span className="pipe-n">{p.n}</span>
              <span className="pipe-name">
                {p.name}
                <small>{p.textbook}</small>
              </span>
              <span className="pipe-out">
                {st === 'skipped'
                  ? 'skipped'
                  : st === 'off'
                    ? 'switched off'
                    : outputSize(result, i)}
                <small>{st !== 'skipped' && st !== 'off' ? fmtMs(result[p.id].timeMs) : ''}</small>
              </span>
            </button>
          </div>
        );
      })}
      <div className="pipe-step">
        <div className="pipe-arrow">
          <span>↓</span> <code>JavaScript</code>
        </div>
        <div className="pipe-src sound">🔊 Web Audio playback</div>
      </div>
    </div>
  );
}

function PhaseSlide({
  info,
  props,
  hover,
}: {
  info: PhaseInfo;
  props: PanelProps;
  hover: Span | null;
}) {
  const Panel = PANELS[info.n - 1];
  const st = phaseState(props.result, info.id, props.optimizerOn);
  return (
    <div className="slide-phase">
      <div className="explain">
        <div className="eyebrow">
          Phase {info.n} of 6 · {info.textbook}
        </div>
        <h2>{info.name}</h2>
        <div className="io-flow">
          <span className="io-box">
            {info.input}
            <code>{info.inputType}</code>
          </span>
          <span className="io-arrow">→</span>
          <span className={`io-box phase st-${st}`}>Phase {info.n}</span>
          <span className="io-arrow">→</span>
          <span className="io-box">
            {info.output}
            <code>{info.outputType}</code>
          </span>
        </div>
        <p className="lead">{info.what}</p>
        <h4>How it works</h4>
        <ol className="steps">
          {info.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {info.errors.length > 0 && (
          <>
            <h4>Errors this phase reports</h4>
            <table className="grid errs">
              <tbody>
                {info.errors.map((e) => (
                  <tr key={e.code}>
                    <td className="mono">{e.code}</td>
                    <td>{e.message}</td>
                    <td className="mono muted">{e.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div className="callout">{info.why}</div>
        <div className="module">
          Module:{' '}
          {info.module.map((m) => (
            <code key={m}>{m}</code>
          ))}
        </div>
      </div>
      <div className="live">
        <div className="live-head">
          <span>Live output for this program</span>
          <span className={`badge st-${st}`}>
            {st === 'off' ? 'off' : props.result[info.id].status}
          </span>
        </div>
        <SourceView source={props.source} span={hover} />
        <div className="live-panel">
          <Panel {...props} compact />
        </div>
      </div>
    </div>
  );
}

function flattenNotes(stmts: Stmt[]): NoteStmt[] {
  return stmts.flatMap((s) =>
    s.kind === 'Note' ? [s] : s.kind === 'Repeat' ? flattenNotes(s.body) : [],
  );
}

function TraceSlide({ result, source }: { result: CompileResult; source: string }) {
  const notes = useMemo(
    () => (result.semantic.output ? flattenNotes(result.semantic.output.program.body) : []),
    [result],
  );
  const [pick, setPick] = useState(0);
  if (!result.ok || notes.length === 0) {
    return (
      <div className="skipped">
        Choose a program that compiles without errors (and has at least one note) to trace a note.
      </div>
    );
  }
  const note = notes[Math.min(pick, notes.length - 1)];
  const at = note.span.offset;
  const inSpan = (s: Span) => s.offset >= at && s.offset < at + note.span.length;
  const tokens = result.lexer.output!.filter((t) => inSpan(t.span));
  const ir = result.ir
    .output!.map((ins, i) => ({ ins, i }))
    .filter(({ ins }) => 'src' in ins && ins.src.offset === at);
  const opt = (result.optimizer.output?.ir ?? [])
    .map((ins, i) => ({ ins, i }))
    .filter(({ ins }) => 'src' in ins && ins.src.offset === at);
  const optIR = result.optimizer.output?.ir ?? result.ir.output!;
  const id = noteIds(optIR).idOf(note.span);
  const jsLines = result.codegen
    .output!.js.split('\n')
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.includes(`, ${id}); //`));
  const plays = result.codegen.output!.schedule.filter((e) => e.src && e.src.offset === at);

  const Step = ({
    n,
    title,
    children,
  }: {
    n: number | string;
    title: string;
    children: ReactNode;
  }) => (
    <div className="trace-step">
      <div className="trace-n">{n}</div>
      <div>
        <div className="trace-title">{title}</div>
        <div className="trace-body">{children}</div>
      </div>
    </div>
  );

  return (
    <div className="trace">
      <div className="eyebrow">All six phases, one note</div>
      <h2>Trace one note end to end</h2>
      <div className="trace-pick">
        <span className="muted">Pick a note from the program:</span>
        {notes.map((n, i) => (
          <button
            key={i}
            className={i === pick ? 'chip active' : 'chip'}
            onClick={() => setPick(i)}
          >
            {spanText(source, n.span)}
            <small>
              {n.span.line}:{n.span.col}
            </small>
          </button>
        ))}
      </div>
      <SourceView source={source} span={note.span} kind="play" />
      <div className="trace-flow">
        <Step n="✎" title="Source characters">
          <code>{JSON.stringify(spanText(source, note.span))}</code> at line {note.span.line},
          column {note.span.col} (offset {note.span.offset}, length {note.span.length})
        </Step>
        <Step n={1} title="Lexer → tokens">
          {tokens.map((t, i) => (
            <span key={i} className={`kind k-${t.kind}`}>
              {t.kind} {t.lexeme}
            </span>
          ))}
        </Step>
        <Step n={2} title="Parser → AST node">
          <code>
            Note {'{'} name: &apos;{note.name}&apos;, lowerMark: {String(note.lowerMark)},
            upperMark: {String(note.upperMark)}, beats: {note.beats} {'}'}
          </code>
        </Step>
        <Step n={3} title="Semantic → checked + annotated">
          ✓ &apos;{note.name}&apos; is a real swar · semitone <b>{note.semitone}</b> · octave{' '}
          <b>{note.octave === 1 ? '+1' : note.octave}</b> · duration {note.beats} beat(s) is valid
        </Step>
        <Step n={4} title="IR → symbolic instruction">
          {ir.map(({ ins, i }) => (
            <code key={i} className="block">
              {instrNumber(i)} {formatInstr(ins)}
            </code>
          ))}
        </Step>
        <Step n={5} title="Optimizer → folded constants">
          {result.optimizer.status === 'skipped' ? (
            <span className="muted">optimizer switched off — codegen folds the values itself</span>
          ) : (
            <>
              {opt.slice(0, 4).map(({ ins, i }) => (
                <code key={i} className="block">
                  {instrNumber(i)} {formatInstr(ins)}
                </code>
              ))}
              {opt.length > 4 && (
                <span className="muted">… {opt.length - 4} more copies (unrolled)</span>
              )}
            </>
          )}
        </Step>
        <Step n={6} title="Codegen → JavaScript">
          {jsLines.slice(0, 3).map(({ l, i }) => (
            <code key={i} className="block">
              {l.trim()}
            </code>
          ))}
          <span className="muted"> note id {id}</span>
        </Step>
        <Step n="🔊" title="Sound">
          Plays {plays.length} time{plays.length === 1 ? '' : 's'} at{' '}
          {plays
            .slice(0, 8)
            .map((e) => `${e.start.toFixed(2)} s`)
            .join(', ')}
          {plays.length > 8 ? '…' : ''} — {plays[0]?.freq} Hz for {plays[0]?.duration.toFixed(3)} s
        </Step>
      </div>
    </div>
  );
}

function ErrorsSlide() {
  const [src, setSrc] = useState(EXAMPLES.find((e) => e.id === 'errors')!.source);
  const r = useMemo(() => compile(src), [src]);
  return (
    <div className="slide-errors">
      <div className="explain">
        <h2>Error handling &amp; recovery</h2>
        <ul className="steps">
          <li>
            Every problem is a <b>Diagnostic</b>: code, severity, the phase that found it, a
            plain-English message, the exact source span and, where possible, a hint.
          </li>
          <li>
            Phases 1–3 <b>recover</b> and keep going, so one run shows every problem at once (the
            parser uses panic mode).
          </li>
          <li>
            If a phase reports an error, the later phases do not run — they are marked{' '}
            <b>skipped</b>. Warnings never stop the pipeline.
          </li>
          <li>
            Diagnostics are sorted by line, then column. A thrown exception is a compiler bug and
            becomes <b>C001</b>, never a crash.
          </li>
        </ul>
        <h4>Try it — edit the program below</h4>
        <textarea
          className="err-input"
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          spellCheck={false}
          rows={6}
        />
        <div className="mini-bar">
          {PHASES.map((p) => (
            <span key={p.id} className={`mini st-${phaseState(r, p.id)}`}>
              {p.n} {p.short}
            </span>
          ))}
        </div>
      </div>
      <div className="live">
        <div className="live-head">
          <span>
            {r.diagnostics.length} diagnostic{r.diagnostics.length === 1 ? '' : 's'} in one run
          </span>
        </div>
        {r.diagnostics.length === 0 ? (
          <div className="skipped">No problems — all six phases are green.</div>
        ) : (
          r.diagnostics.map((d, i) => (
            <pre key={i} className={`diag-block sev-${d.severity}`}>
              {formatDiagnostic(d, src)}
            </pre>
          ))
        )}
      </div>
    </div>
  );
}

function DesignSlide() {
  return (
    <div className="slide-design">
      <h2>Design &amp; testing</h2>
      <div className="cards">
        <div className="card">
          <h4>Six pure functions</h4>
          <p>
            <code>compile()</code> calls{' '}
            <code>lex → parse → analyze → generateIR → optimize → generate</code> in order. Each
            takes the previous phase&apos;s output and returns its own output plus diagnostics. Same
            input, same output, no global state.
          </p>
        </div>
        <div className="card">
          <h4>Hand-written front end</h4>
          <p>
            No parser generators, no regex lexer: a character scanner and a recursive-descent parser
            with one function per grammar rule.
          </p>
        </div>
        <div className="card">
          <h4>One shared contract</h4>
          <p>
            <code>src/compiler/types.ts</code> defines Token, AST, SymbolTable, IRInstr, PassReport,
            CodegenOutput — every phase codes against it. The compiler never imports React, the DOM
            or Web Audio.
          </p>
        </div>
        <div className="card">
          <h4>Tested at every level</h4>
          <p>
            Unit tests per phase, one test per error code, golden files for every example, and
            property tests (fast-check): the optimizer never changes the music, and the parser never
            loops on random input.
          </p>
        </div>
        <div className="card">
          <h4>Visible at every step</h4>
          <p>
            Token table, tree, symbol table with ✓/✗ checks, IR listing, before/after optimizer
            diff, generated JS, and a timeline — each phase is on screen.
          </p>
        </div>
        <div className="card">
          <h4>Also a CLI</h4>
          <p>
            <code>npm run surc examples/01-professor.sur -- --phase ir</code> prints any
            phase&apos;s output in the terminal.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Workflow() {
  const [slide, setSlide] = useState(() => {
    const m = /slide=(\d+)/.exec(location.hash);
    return m ? Math.min(Number(m[1]), SLIDES.length - 1) : 0;
  });
  const [programId, setProgramId] = useState('current');
  const [optimizerOn, setOptimizerOn] = useState(loadOptimizer);
  const [hover, setHover] = useState<Span | null>(null);
  const source =
    programId === 'current' ? loadSource() : EXAMPLES.find((e) => e.id === programId)!.source;
  const result = useMemo(() => compile(source, { optimize: optimizerOn }), [source, optimizerOn]);
  const [playSpan, setPlaySpan] = useState<Span | null>(null);
  const { playing, now, play, stop } = usePlayback(result, setPlaySpan);

  const go = useCallback((i: number) => {
    const n = Math.max(0, Math.min(SLIDES.length - 1, i));
    setSlide(n);
    setHover(null);
    history.replaceState(null, '', `#/workflow?slide=${n}`);
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        go(slide + 1);
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        go(slide - 1);
      }
      if (e.key === 'Home') go(0);
      if (e.key === 'End') go(SLIDES.length - 1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [slide, go]);

  const present = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } catch {
      /* fullscreen not allowed */
    }
  };

  const props: PanelProps = {
    result,
    source,
    optimizerOn,
    onHover: setHover,
    onSelect: setHover,
  };
  const s = SLIDES[slide];
  const info = PHASE_INFO.find((p) => p.id === s.id);

  return (
    <div className="workflow">
      <header className="topbar">
        <a className="navlink" href="#/">
          ← Editor
        </a>
        <div className="brand">
          <span className="logo">स</span> Sur · Compiler workflow
        </div>
        <select
          value={programId}
          onChange={(e) => (stop(), setProgramId(e.target.value))}
          aria-label="program"
        >
          <option value="current">Program from the editor</option>
          {EXAMPLES.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <label className="switch">
          <input
            type="checkbox"
            checked={optimizerOn}
            onChange={(e) => setOptimizerOn(e.target.checked)}
          />{' '}
          Optimizer <b>{optimizerOn ? 'on' : 'off'}</b>
        </label>
        <button className="primary" onClick={play} disabled={!result.ok}>
          ▶ Play
        </button>
        <button onClick={stop} disabled={!playing}>
          ■ Stop
        </button>
        <span className="spacer" />
        <button onClick={present} title="Full screen">
          ⛶ Present
        </button>
      </header>

      <div className="wf-body">
        <aside className="stepper">
          {SLIDES.map((x, i) => {
            const ph = PHASE_INFO.find((p) => p.id === x.id);
            const st = ph ? phaseState(result, ph.id, optimizerOn) : '';
            return (
              <button
                key={x.id}
                className={`step ${i === slide ? 'active' : ''}`}
                onClick={() => go(i)}
              >
                {ph && <span className={`dot st-${st}`} />}
                {x.title}
              </button>
            );
          })}
          <div className="muted small">← → keys to move · ⛶ for full screen</div>
        </aside>

        <section className="slide">
          {s.id === 'overview' && (
            <div className="slide-overview">
              <div className="explain">
                <div className="eyebrow">Compiler design course project</div>
                <h1>Sur — from sargam to sound in six phases</h1>
                <p className="lead">
                  Sur is a small compiler for Indian music notation. It reads sargam like{' '}
                  <code>
                    sa re ga ma pa; repeat 2 {'{'} dha ni sa&apos; {'}'}
                  </code>
                  , runs it through all six classic compiler phases, and plays the result as a tune
                  in the browser.
                </p>
                <h4>The program being compiled</h4>
                <SourceView source={source} span={playSpan} kind="play" />
                <div className="summary-line">
                  {result.ok ? (
                    <>
                      ✓ compiles ·{' '}
                      {result.codegen.output!.schedule.filter((e) => e.freq !== null).length} notes
                      · {result.codegen.output!.totalSeconds.toFixed(1)} s · total compile time{' '}
                      {fmtMs(
                        [
                          result.lexer,
                          result.parser,
                          result.semantic,
                          result.ir,
                          result.optimizer,
                          result.codegen,
                        ].reduce((a, p) => a + p.timeMs, 0),
                      )}
                    </>
                  ) : (
                    <>
                      ✗ {result.diagnostics.filter((d) => d.severity === 'error').length} error(s) —
                      later phases skipped
                    </>
                  )}
                </div>
                <p className="muted">Click any phase to open its slide.</p>
              </div>
              <Pipeline result={result} optimizerOn={optimizerOn} onPick={go} />
            </div>
          )}
          {info && <PhaseSlide info={info} props={props} hover={hover ?? playSpan} />}
          {s.id === 'trace' && <TraceSlide result={result} source={source} />}
          {s.id === 'errors' && <ErrorsSlide />}
          {s.id === 'design' && <DesignSlide />}
        </section>
      </div>

      <footer className="wf-foot">
        <button onClick={() => go(slide - 1)} disabled={slide === 0}>
          ← Previous
        </button>
        <div className="wf-timeline">
          <Timeline
            schedule={result.codegen.output?.schedule}
            total={result.codegen.output?.totalSeconds ?? 0}
            now={now}
            height={70}
          />
        </div>
        <span className="muted">
          {slide + 1} / {SLIDES.length}
        </span>
        <button
          className="primary"
          onClick={() => go(slide + 1)}
          disabled={slide === SLIDES.length - 1}
        >
          Next →
        </button>
      </footer>
    </div>
  );
}
