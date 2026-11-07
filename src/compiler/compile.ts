// The pipeline: six pure phases called in order.
//  1. If a phase reports any error, later phases do not run and are marked skipped.
//  2. Warnings never stop the pipeline.
//  3. A thrown exception is a compiler bug: it becomes C001, never a crash.

import type { CompileResult, Diagnostic, PhaseId, PhaseResult } from './types';
import { lex } from './lexer/lexer';
import { parse } from './parser/parser';
import { analyze } from './semantic/analyzer';
import { generateIR } from './ir/generate';
import { optimize } from './optimizer';
import { generate } from './codegen/generate';
import { makeDiagnostic, sortDiagnostics } from './diagnostics';
import { now, elapsed } from './timing';

export interface CompileOptions {
  /** Optimizer on/off switch. Default on. */
  optimize?: boolean;
}

export const PHASES: { id: PhaseId; n: number; name: string; short: string }[] = [
  { id: 'lexer', n: 1, name: 'Lexical analysis', short: 'Lexer' },
  { id: 'parser', n: 2, name: 'Syntax analysis', short: 'Parser' },
  { id: 'semantic', n: 3, name: 'Semantic analysis', short: 'Semantic' },
  { id: 'ir', n: 4, name: 'Intermediate code generation', short: 'IR' },
  { id: 'optimizer', n: 5, name: 'Code optimization', short: 'Optimizer' },
  { id: 'codegen', n: 6, name: 'Code generation', short: 'Codegen' },
];

const skipped = <T>(phase: PhaseId): PhaseResult<T> => ({
  phase,
  status: 'skipped',
  diagnostics: [],
  timeMs: 0,
});

export function guard<T>(phase: PhaseId, run: () => PhaseResult<T>): PhaseResult<T> {
  const t0 = now();
  try {
    return run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      phase,
      status: 'error',
      diagnostics: [
        makeDiagnostic(
          'C001',
          'error',
          phase,
          `internal compiler error: ${msg}`,
          undefined,
          'please report this; it is a bug, not your mistake',
        ),
      ],
      timeMs: elapsed(t0),
    };
  }
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const useOptimizer = options.optimize ?? true;

  const lexer = guard('lexer', () => lex(source));
  const parser =
    lexer.status === 'ok' ? guard('parser', () => parse(lexer.output!)) : skipped<never>('parser');
  const semantic =
    parser.status === 'ok'
      ? guard('semantic', () => analyze(parser.output!))
      : skipped<never>('semantic');
  const ir =
    semantic.status === 'ok'
      ? guard('ir', () => generateIR(semantic.output!.program, semantic.output!.symbols))
      : skipped<never>('ir');

  let optimizer: CompileResult['optimizer'];
  if (ir.status !== 'ok') optimizer = skipped('optimizer');
  else if (!useOptimizer)
    optimizer = {
      phase: 'optimizer',
      status: 'skipped',
      output: { ir: ir.output!, passes: [] },
      diagnostics: [],
      timeMs: 0,
    };
  else optimizer = guard('optimizer', () => optimize(ir.output!));

  const codegenInput = optimizer.output?.ir;
  const codegen =
    ir.status === 'ok' && optimizer.status !== 'error' && codegenInput
      ? guard('codegen', () => generate(codegenInput))
      : skipped<never>('codegen');

  const all: Diagnostic[] = [lexer, parser, semantic, ir, optimizer, codegen].flatMap(
    (p) => p.diagnostics,
  );
  const diagnostics = sortDiagnostics(all);
  return {
    ok: codegen.status === 'ok' && !diagnostics.some((d) => d.severity === 'error'),
    lexer,
    parser,
    semantic,
    ir,
    optimizer,
    codegen,
    diagnostics,
  };
}

/** For the UI: the first phase that failed, if any. */
export function firstFailedPhase(r: CompileResult): number | null {
  const order = [r.lexer, r.parser, r.semantic, r.ir, r.optimizer, r.codegen];
  const i = order.findIndex((p) => p.status === 'error');
  return i === -1 ? null : i + 1;
}
