import { lex } from '../src/compiler/lexer/lexer';
import { parse } from '../src/compiler/parser/parser';
import { analyze } from '../src/compiler/semantic/analyzer';
import { generateIR } from '../src/compiler/ir/generate';
import type { Program } from '../src/compiler/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const PROF = "sa re ga ma pa; repeat 2 { dha ni sa' }";

export const parseSrc = (src: string) => parse(lex(src).output!);
export const analyzeSrc = (src: string) => analyze(parseSrc(src).output!);
export const irOf = (src: string) => {
  const a = analyzeSrc(src).output!;
  return generateIR(a.program, a.symbols).output!;
};
export const codes = (ds: { code: string }[]) => ds.map((d) => d.code);
export const example = (name: string) =>
  readFileSync(join(__dirname, '..', 'examples', name), 'utf8');
export const EXAMPLES = [
  '01-professor.sur',
  '02-aaroh-avroh.sur',
  '03-nested.sur',
  '04-optimizer-demo.sur',
  '05-errors.sur',
];

/** Strip spans so trees can be compared by shape. */
export function shape(p: Program): unknown {
  return JSON.parse(
    JSON.stringify(p, (k, v) =>
      k === 'span' || k === 'countSpan' || k === 'beatsSpan' ? undefined : v,
    ),
  );
}
