import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompileResult, Span } from '../compiler/types';
import { noteIds } from '../compiler/codegen/generate';
import { player } from '../audio/player';

/** Play / Stop plus the "now playing" state: note span for the editor, time for the timeline. */
export function usePlayback(result: CompileResult, onNoteSpan?: (s: Span | null) => void) {
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const raf = useRef(0);
  const cb = useRef(onNoteSpan);
  cb.current = onNoteSpan;

  const stop = useCallback(() => {
    player.stop();
    cancelAnimationFrame(raf.current);
    setPlaying(false);
    setNow(null);
    cb.current?.(null);
  }, []);

  const play = useCallback(async () => {
    const out = result.codegen.output;
    if (!out || !result.ok) return;
    const ir = result.optimizer.output?.ir ?? result.ir.output ?? [];
    const spans = noteIds(ir).spans;
    setError(null);
    try {
      await player.play(out.js, {
        onNote: (id) => cb.current?.(spans.get(id) ?? null),
        onStart: (startedAt) => {
          setPlaying(true);
          const tick = () => {
            const t = (performance.now() - startedAt) / 1000;
            setNow(t < 0 ? 0 : t);
            raf.current = requestAnimationFrame(tick);
          };
          cancelAnimationFrame(raf.current);
          raf.current = requestAnimationFrame(tick);
        },
        onEnd: () => {
          cancelAnimationFrame(raf.current);
          setPlaying(false);
          setNow(null);
          cb.current?.(null);
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      stop();
    }
  }, [result, stop]);

  // stop when the component goes away
  useEffect(() => stop, [stop]);

  return { playing, now, play, stop, error };
}
