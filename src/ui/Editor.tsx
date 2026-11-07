import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
  type DecorationSet,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { setDiagnostics, lintGutter, type Diagnostic as CMDiagnostic } from '@codemirror/lint';
import { StreamLanguage, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { Diagnostic, Span } from '../compiler/types';
import { SWAR_NAMES } from '../compiler/swars';

// ---- Sur syntax highlighting (display only — the real lexer is Phase 1) ----
const surLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match('#')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(/^-?\d+(\.\d+)?/)) return 'number';
    const word = stream.match(/^[A-Za-z]+/) as RegExpMatchArray | null;
    if (word) {
      const w = word[0].toLowerCase();
      if (w === 'tempo' || w === 'repeat') return 'keyword';
      return SWAR_NAMES.includes(w) ? 'variableName' : 'invalid';
    }
    stream.next();
    return 'punctuation';
  },
});
const surHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#7c3aed', fontWeight: '600' },
  { tag: tags.number, color: '#0f766e' },
  { tag: tags.comment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#1e293b' },
  { tag: tags.invalid, color: '#b91c1c' },
  { tag: tags.punctuation, color: '#c2410c' },
]);

// ---- highlight a source range (hover in panels, note being played) ----
const setHighlight = StateEffect.define<{
  from: number;
  to: number;
  kind: 'hover' | 'play';
} | null>();
const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setHighlight)) {
        if (!e.value || e.value.to <= e.value.from) deco = Decoration.none;
        else {
          const len = tr.state.doc.length;
          const from = Math.min(e.value.from, len);
          const to = Math.min(e.value.to, len);
          deco =
            from < to
              ? Decoration.set([
                  Decoration.mark({ class: `cm-sur-${e.value.kind}` }).range(from, to),
                ])
              : Decoration.none;
        }
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export interface EditorHandle {
  select(span: Span): void;
  highlight(span: Span | null, kind?: 'hover' | 'play'): void;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  diagnostics: Diagnostic[];
  onRun: () => void;
}

export const Editor = forwardRef<EditorHandle, Props>(function Editor(
  { value, onChange, diagnostics, onRun },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cb = useRef({ onChange, onRun });
  cb.current = { onChange, onRun };

  useEffect(() => {
    const extensions: Extension[] = [
      lineNumbers(),
      history(),
      drawSelection(),
      highlightActiveLine(),
      lintGutter(),
      surLanguage,
      syntaxHighlighting(surHighlight),
      highlightField,
      keymap.of([
        { key: 'Mod-Enter', run: () => (cb.current.onRun(), true) },
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) cb.current.onChange(u.state.doc.toString());
      }),
      EditorView.theme({
        '&': { height: '100%', fontSize: '15px' },
        '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.6' },
        '.cm-content': { padding: '8px 0' },
      }),
    ];
    view.current = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: host.current!,
    });
    return () => view.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // external value changes (examples menu)
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  // red / yellow wavy underlines
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const len = v.state.doc.length;
    const cm: CMDiagnostic[] = diagnostics.map((d) => {
      const from = Math.min(d.span?.offset ?? 0, len);
      const to = Math.min(Math.max(from + (d.span?.length ?? 0), from + 1), len);
      return {
        from,
        to: Math.max(from, to),
        severity: d.severity,
        source: d.code,
        message: d.message + (d.hint ? ` — hint: ${d.hint}` : ''),
      };
    });
    v.dispatch(setDiagnostics(v.state, cm));
  }, [diagnostics]);

  useImperativeHandle(ref, () => ({
    select(span) {
      const v = view.current;
      if (!v) return;
      const len = v.state.doc.length;
      const from = Math.min(span.offset, len);
      v.dispatch({
        selection: { anchor: from, head: Math.min(span.offset + span.length, len) },
        scrollIntoView: true,
      });
      v.focus();
    },
    highlight(span, kind = 'hover') {
      view.current?.dispatch({
        effects: setHighlight.of(
          span ? { from: span.offset, to: span.offset + span.length, kind } : null,
        ),
      });
    },
  }));

  return <div className="editor" ref={host} />;
});
