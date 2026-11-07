// Golden tests: tokens, tree, IR and JS for each example must not change by accident.
// Run `npx vitest run -u` to update after reviewing a deliberate change.
import { describe, it, expect } from 'vitest';
import { compile } from '../src/compiler/compile';
import { printIR } from '../src/compiler/ir/print';
import { example, EXAMPLES } from './helpers';

describe('golden', () => {
  for (const f of EXAMPLES) {
    it(f, async () => {
      const r = compile(example(f));
      const base = f.replace('.sur', '');
      const tokens = r.lexer
        .output!.map((t) => `${t.kind} ${JSON.stringify(t.lexeme)} ${t.span.line}:${t.span.col}`)
        .join('\n');
      await expect(tokens + '\n').toMatchFileSnapshot(`golden/${base}.tokens.txt`);
      const tree = JSON.stringify(
        r.parser.output,
        (k, v) => (k.endsWith('pan') ? undefined : v),
        2,
      );
      await expect(tree + '\n').toMatchFileSnapshot(`golden/${base}.tree.json`);
      if (r.ir.output)
        await expect(printIR(r.ir.output) + '\n').toMatchFileSnapshot(`golden/${base}.ir.txt`);
      if (r.optimizer.output)
        await expect(printIR(r.optimizer.output.ir) + '\n').toMatchFileSnapshot(
          `golden/${base}.opt.txt`,
        );
      if (r.codegen.output)
        await expect(r.codegen.output.js).toMatchFileSnapshot(`golden/${base}.js.txt`);
      if (!r.ok)
        await expect(
          r.diagnostics
            .map((d) => `${d.code} ${d.span?.line}:${d.span?.col} ${d.message}`)
            .join('\n') + '\n',
        ).toMatchFileSnapshot(`golden/${base}.errors.txt`);
    });
  }
});
