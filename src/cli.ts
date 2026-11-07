// Command-line front end:  npm run surc examples/01-professor.sur -- --phase ir
// Phases: tokens | ast | symbols | ir | opt | js | schedule | all (default: all)
// Flags:  --no-opt  run codegen on the unoptimized IR

import { readFileSync } from 'node:fs';
import { compile } from './compiler/compile';
import { formatDiagnostic } from './compiler/diagnostics';
import { printIR } from './compiler/ir/print';
import type { Stmt } from './compiler/types';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--phase');
const phaseIdx = args.indexOf('--phase');
const phase = phaseIdx >= 0 ? args[phaseIdx + 1] : 'all';
const noOpt = args.includes('--no-opt');

if (!file) {
  console.error(
    'usage: surc <file.sur> [--phase tokens|ast|symbols|ir|opt|js|schedule|all] [--no-opt]',
  );
  process.exit(2);
}

const source = readFileSync(file, 'utf8');
const r = compile(source, { optimize: !noOpt });

function tree(stmts: Stmt[], prefix = ''): string[] {
  return stmts.flatMap((s, i) => {
    const last = i === stmts.length - 1;
    const branch = prefix + (last ? '└── ' : '├── ');
    const next = prefix + (last ? '    ' : '│   ');
    switch (s.kind) {
      case 'Note':
        return [
          `${branch}Note ${s.lowerMark ? '.' : ''}${s.name}${s.upperMark ? "'" : ''} (${s.beats} beat${s.beats === 1 ? '' : 's'})`,
        ];
      case 'Rest':
        return [`${branch}Rest (${s.beats} beat${s.beats === 1 ? '' : 's'})`];
      case 'Tempo':
        return [`${branch}Tempo ${s.bpm}`];
      case 'Repeat':
        return [`${branch}Repeat ×${s.count}`, ...tree(s.body, next)];
    }
  });
}

const show = (p: string) => phase === 'all' || phase === p;
const section = (title: string) => phase === 'all' && console.log(`\n== ${title} ==`);

if (show('tokens') && r.lexer.output) {
  section('Phase 1 · tokens');
  r.lexer.output.forEach((t, i) =>
    console.log(
      `${String(i + 1).padStart(3)}  ${t.kind.padEnd(7)} ${JSON.stringify(t.lexeme).padEnd(10)} ${t.span.line}:${t.span.col}`,
    ),
  );
}
if (show('ast') && r.parser.output) {
  section('Phase 2 · syntax tree');
  console.log(['Program', ...tree(r.parser.output.body)].join('\n'));
}
if (show('symbols') && r.semantic.output) {
  section('Phase 3 · symbol table');
  console.log(
    JSON.stringify(r.semantic.output.symbols, (k, v) => (k === 'span' ? undefined : v), 2),
  );
}
if (show('ir') && r.ir.output) {
  section('Phase 4 · IR');
  console.log(printIR(r.ir.output));
}
if (show('opt') && r.optimizer.output) {
  section('Phase 5 · optimized IR');
  console.log(printIR(r.optimizer.output.ir));
  for (const p of r.optimizer.output.passes)
    console.log(
      `  ${p.changed ? '*' : ' '} ${p.pass}: ${p.before} → ${p.after} ${p.notes.join('; ')}`,
    );
}
if (show('js') && r.codegen.output) {
  section('Phase 6 · JavaScript');
  console.log(r.codegen.output.js);
}
if (show('schedule') && r.codegen.output) {
  section('Schedule');
  for (const e of r.codegen.output.schedule)
    console.log(
      `${e.start.toFixed(3)}s  ${e.duration.toFixed(3)}s  ${e.label.padEnd(5)} ${e.freq ?? 'rest'}`,
    );
}

for (const d of r.diagnostics) console.error('\n' + formatDiagnostic(d, source));
process.exit(r.diagnostics.some((d) => d.severity === 'error') ? 1 : 0);
