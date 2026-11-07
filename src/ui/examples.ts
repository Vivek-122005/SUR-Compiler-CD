// The example programs, bundled from examples/*.sur at build time.
import professor from '../../examples/01-professor.sur?raw';
import aaroh from '../../examples/02-aaroh-avroh.sur?raw';
import nested from '../../examples/03-nested.sur?raw';
import optimizer from '../../examples/04-optimizer-demo.sur?raw';
import errors from '../../examples/05-errors.sur?raw';

export const EXAMPLES: { id: string; name: string; source: string }[] = [
  { id: 'professor', name: "Professor's example", source: professor },
  { id: 'aaroh', name: 'Aaroh–avroh', source: aaroh },
  { id: 'nested', name: 'Nested repeats', source: nested },
  { id: 'optimizer', name: 'Optimizer demo', source: optimizer },
  { id: 'errors', name: 'Errors demo', source: errors },
];

const KEY = 'sur:source';
const OPT_KEY = 'sur:optimizer';

export function loadSource(): string {
  try {
    return localStorage.getItem(KEY) ?? EXAMPLES[0].source;
  } catch {
    return EXAMPLES[0].source;
  }
}
export function saveSource(s: string) {
  try {
    localStorage.setItem(KEY, s);
  } catch {
    /* storage unavailable */
  }
}
export function loadOptimizer(): boolean {
  try {
    return localStorage.getItem(OPT_KEY) !== 'off';
  } catch {
    return true;
  }
}
export function saveOptimizer(on: boolean) {
  try {
    localStorage.setItem(OPT_KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable */
  }
}
