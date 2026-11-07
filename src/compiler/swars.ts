// The swar table and the frequency / duration helpers shared by Phase 3, 5 and 6.

export const SWARS: readonly { name: string; semitone: number }[] = [
  { name: 'sa', semitone: 0 },
  { name: 're', semitone: 2 },
  { name: 'ga', semitone: 4 },
  { name: 'ma', semitone: 5 },
  { name: 'pa', semitone: 7 },
  { name: 'dha', semitone: 9 },
  { name: 'ni', semitone: 11 },
];

export const SWAR_NAMES = SWARS.map((s) => s.name);

/**
 * Sa = C4 (261.63 Hz), equal temperament. We keep the exact value of C4
 * (A4 = 440 Hz, nine semitones up) so that every rounded frequency matches the
 * standard table: re 293.66, dha 440.00, sa' 523.25 …
 */
export const BASE_FREQ = 440 * Math.pow(2, -9 / 12); // 261.6255653…
export const DEFAULT_TEMPO = 100;

export function semitoneOf(name: string): number | undefined {
  return SWARS.find((s) => s.name === name)?.semitone;
}

/** frequency = 261.63 × 2^((s + 12·o) / 12), rounded to 2 decimals. */
export function frequency(semitone: number, octave: -1 | 0 | 1): number {
  return round(BASE_FREQ * Math.pow(2, (semitone + 12 * octave) / 12), 2);
}

/** Frequency of a named swar; throws on unknown names (only validated names reach this). */
export function swarFrequency(name: string, octave: -1 | 0 | 1): number {
  const s = semitoneOf(name);
  if (s === undefined) throw new Error(`unknown swar '${name}'`);
  return frequency(s, octave);
}

/** One beat lasts 60 / tempo seconds. */
export function beatSeconds(bpm: number): number {
  return 60 / bpm;
}

export function seconds(beats: number, bpm: number): number {
  return round(beats * beatSeconds(bpm), 6);
}

export function round(x: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(x * f) / f;
}

/** Display label: .ni, sa, sa' */
export function swarLabel(name: string, octave: -1 | 0 | 1): string {
  return (octave === -1 ? '.' : '') + name + (octave === 1 ? "'" : '');
}
