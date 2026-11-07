export function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Milliseconds since t0, rounded to microseconds. */
export function elapsed(t0: number): number {
  return Math.round((now() - t0) * 1000) / 1000;
}
