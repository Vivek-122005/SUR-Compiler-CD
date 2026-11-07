// The list of semantic checks shown under the symbol table, each with ✓ or ✗.
// Makes the semantic phase visible even when the program is correct.

import type { Diagnostic } from '../types';

export interface CheckResult {
  label: string;
  codes: string[];
  ok: boolean;
  severity: 'error' | 'warning';
  required: boolean; // required by the professor's topic list
  failures: Diagnostic[];
}

export const CHECKS: {
  label: string;
  codes: string[];
  severity: 'error' | 'warning';
  required: boolean;
}[] = [
  { label: 'All swars are valid', codes: ['S001'], severity: 'error', required: true },
  {
    label: 'All repeat counts are positive whole numbers',
    codes: ['S002', 'S003'],
    severity: 'error',
    required: true,
  },
  { label: 'Repeat counts are at most 32', codes: ['S004'], severity: 'error', required: false },
  {
    label: 'Durations are 0.25–8 beats in steps of 0.25',
    codes: ['S005'],
    severity: 'error',
    required: false,
  },
  { label: 'Tempo is 40–240 bpm', codes: ['S006'], severity: 'error', required: false },
  { label: 'Tempo is declared at most once', codes: ['S007'], severity: 'error', required: false },
  {
    label: 'No note is both lower and upper octave',
    codes: ['S008'],
    severity: 'error',
    required: false,
  },
  {
    label: 'Tempo comes before the first note',
    codes: ['W001'],
    severity: 'warning',
    required: false,
  },
  { label: 'No empty repeat blocks', codes: ['W002'], severity: 'warning', required: false },
  {
    label: 'Piece is at most 10 minutes long',
    codes: ['W003'],
    severity: 'warning',
    required: false,
  },
];

export function semanticChecks(diagnostics: Diagnostic[]): CheckResult[] {
  return CHECKS.map((c) => {
    const failures = diagnostics.filter((d) => c.codes.includes(d.code));
    return { ...c, ok: failures.length === 0, failures };
  });
}
