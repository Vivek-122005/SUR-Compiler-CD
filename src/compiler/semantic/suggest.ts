// "Did you mean" hints for unknown swars: a small alias table first,
// then the closest swar by Levenshtein edit distance (≤ 2).

import { SWAR_NAMES } from '../swars';

export const ALIASES: Record<string, string> = {
  ri: 're',
  gaa: 'ga',
  maa: 'ma',
  paa: 'pa',
  da: 'dha',
  dh: 'dha',
  ne: 'ni',
  saa: 'sa',
};

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

/** Returns the suggested swar name, or undefined when nothing is close. */
export function suggestSwar(word: string): string | undefined {
  const w = word.toLowerCase();
  if (ALIASES[w]) return ALIASES[w];
  let best: string | undefined;
  let bestDist = 3;
  for (const name of SWAR_NAMES) {
    const d = levenshtein(w, name);
    if (d < bestDist) {
      best = name;
      bestDist = d;
    }
  }
  return best;
}
