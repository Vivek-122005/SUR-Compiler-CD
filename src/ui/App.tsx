import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { compile, PHASES } from '../compiler/compile';
import type { Span } from '../compiler/types';
import { Editor, type EditorHandle } from './Editor';
import { PhaseBar } from './PhaseBar';
import { ProblemsPanel } from './ProblemsPanel';
import { Timeline } from './Timeline';
import { TokensPanel } from './panels/TokensPanel';
import { TreePanel } from './panels/TreePanel';
import { SymbolsPanel } from './panels/SymbolsPanel';
import { IRPanel } from './panels/IRPanel';
import { OptimizerPanel } from './panels/OptimizerPanel';
import { CodegenPanel } from './panels/CodegenPanel';
import { EXAMPLES, loadOptimizer, loadSource, saveOptimizer, saveSource } from './examples';
import { usePlayback } from './usePlayback';
import type { PanelProps } from './common';

const TABS = ['Tokens', 'Tree', 'Symbols', 'IR', 'Opt', 'JS'];
const PANELS = [TokensPanel, TreePanel, SymbolsPanel, IRPanel, OptimizerPanel, CodegenPanel];

export function App() {
  const [source, setSource] = useState(loadSource);
  const [compiled, setCompiled] = useState(source); // what was last compiled
  const [optimizerOn, setOptimizerOn] = useState(loadOptimizer);
  const [tab, setTab] = useState(0);
  const editor = useRef<EditorHandle>(null);

  const result = useMemo(
    () => compile(compiled, { optimize: optimizerOn }),
    [compiled, optimizerOn],
  );
  const runNow = useCallback(() => setCompiled(source), [source]);

  // Compile runs automatically 300 ms after the user stops typing.
  useEffect(() => {
    saveSource(source);
    const t = setTimeout(() => setCompiled(source), 300);
    return () => clearTimeout(t);
  }, [source]);
  useEffect(() => saveOptimizer(optimizerOn), [optimizerOn]);

  const { playing, now, play, stop, error } = usePlayback(result, (span) =>
    editor.current?.highlight(span, 'play'),
  );

  const onHover = useCallback((s: Span | null) => editor.current?.highlight(s, 'hover'), []);
  const onSelect = useCallback((s: Span) => editor.current?.select(s), []);

  const loadExample = (id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    stop();
    setSource(ex.source);
    setCompiled(ex.source);
    if (id === 'optimizer') setTab(4);
    if (id === 'errors') setTab(2);
  };

  // Ctrl/Cmd+Enter anywhere compiles
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runNow();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [runNow]);

  const Panel = PANELS[tab];
  const props: PanelProps = { result, source: compiled, optimizerOn, onHover, onSelect };
  const errors = result.diagnostics.filter((d) => d.severity === 'error').length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">स</span> Sur Compiler
        </div>
        <select aria-label="Examples" value="" onChange={(e) => loadExample(e.target.value)}>
          <option value="" disabled>
            Examples ▾
          </option>
          {EXAMPLES.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <button onClick={runNow} title="Ctrl/Cmd + Enter">
          Compile
        </button>
        <button
          className="primary"
          onClick={play}
          disabled={!result.ok}
          title={result.ok ? 'Play the tune' : 'Fix the errors first'}
        >
          ▶ Play
        </button>
        <button onClick={stop} disabled={!playing}>
          ■ Stop
        </button>
        <label className="switch">
          <input
            type="checkbox"
            checked={optimizerOn}
            onChange={(e) => setOptimizerOn(e.target.checked)}
          />{' '}
          Optimizer <b>{optimizerOn ? 'on' : 'off'}</b>
        </label>
        <span className="spacer" />
        <a className="navlink" href="#/workflow">
          Workflow dashboard →
        </a>
      </header>

      <PhaseBar result={result} active={tab} onPick={setTab} optimizerOn={optimizerOn} />

      <main className="workspace">
        <section className="left">
          <Editor
            ref={editor}
            value={source}
            onChange={setSource}
            diagnostics={result.diagnostics}
            onRun={runNow}
          />
          <ProblemsPanel diagnostics={result.diagnostics} source={compiled} onSelect={onSelect} />
        </section>
        <section className="right">
          <div className="tabs" role="tablist">
            {TABS.map((t, i) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === i}
                className={tab === i ? 'tab active' : 'tab'}
                onClick={() => setTab(i)}
              >
                <span className="muted">{i + 1}</span> {t}
              </button>
            ))}
            <span className="tab-title muted">{PHASES[tab].name}</span>
          </div>
          <div className="tab-body">
            <Panel {...props} />
          </div>
        </section>
      </main>

      <footer className="bottom">
        <div className="tl-head">
          Timeline {playing && <span className="now-playing">▲ now playing</span>}
          {error && <span className="err"> {error}</span>}
          {!result.ok && errors > 0 && (
            <span className="muted"> — {errors} error(s): Play is disabled</span>
          )}
        </div>
        <Timeline
          schedule={result.codegen.output?.schedule}
          total={result.codegen.output?.totalSeconds ?? 0}
          now={now}
        />
      </footer>
    </div>
  );
}
