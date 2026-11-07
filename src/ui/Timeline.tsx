import { useMemo } from 'react';
import type { ScheduledEvent } from '../compiler/types';

/** A simple piano roll with sargam labels, so the output is visible even with the sound off. */
export function Timeline({
  schedule,
  total,
  now,
  height = 120,
}: {
  schedule: ScheduledEvent[] | undefined;
  total: number;
  now: number | null;
  height?: number;
}) {
  const { lo, hi } = useMemo(() => {
    const f = (schedule ?? []).filter((e) => e.freq !== null).map((e) => Math.log2(e.freq!));
    return {
      lo: Math.min(...f, Math.log2(261.63)) - 0.08,
      hi: Math.max(...f, Math.log2(523.25)) + 0.08,
    };
  }, [schedule]);

  if (!schedule || schedule.length === 0) {
    return (
      <div className="timeline empty muted">
        Timeline: compile a program without errors to see its notes.
      </div>
    );
  }
  const pxPerSec = Math.max(40, Math.min(110, 1100 / Math.max(total, 1)));
  const width = Math.max(600, total * pxPerSec + 20);
  const y = (freq: number) => 18 + (1 - (Math.log2(freq) - lo) / (hi - lo)) * (height - 40);
  const current =
    now === null ? -1 : schedule.findIndex((e) => now >= e.start && now < e.start + e.duration);

  return (
    <div className="timeline">
      <svg width={width} height={height} role="img" aria-label="note timeline">
        {Array.from({ length: Math.floor(total) + 1 }, (_, s) => (
          <g key={s}>
            <line
              x1={10 + s * pxPerSec}
              x2={10 + s * pxPerSec}
              y1={0}
              y2={height - 14}
              className="tl-grid"
            />
            <text x={12 + s * pxPerSec} y={height - 3} className="tl-sec">
              {s}s
            </text>
          </g>
        ))}
        {schedule.map((e, i) =>
          e.freq === null ? (
            <rect
              key={i}
              x={10 + e.start * pxPerSec}
              y={height - 26}
              width={Math.max(2, e.duration * pxPerSec - 2)}
              height={6}
              className="tl-rest"
              rx={2}
            >
              <title>rest {e.duration.toFixed(2)} s</title>
            </rect>
          ) : (
            <g key={i} className={i === current ? 'tl-note playing' : 'tl-note'}>
              <rect
                x={10 + e.start * pxPerSec}
                y={y(e.freq) - 9}
                width={Math.max(4, e.duration * pxPerSec - 3)}
                height={18}
                rx={4}
              />
              <text x={14 + e.start * pxPerSec} y={y(e.freq) + 4}>
                {e.label}
              </text>
              <title>
                {e.label} · {e.freq} Hz · {e.start.toFixed(2)}–{(e.start + e.duration).toFixed(2)} s
              </title>
            </g>
          ),
        )}
        {now !== null && (
          <line
            x1={10 + now * pxPerSec}
            x2={10 + now * pxPerSec}
            y1={0}
            y2={height - 14}
            className="tl-cursor"
          />
        )}
      </svg>
    </div>
  );
}
