# Error catalogue

Every problem is a `Diagnostic` with a code, a severity, the phase that found it, a plain-English message, the exact source position and, where possible, a hint. Each code has a test in `tests/errors.test.ts` that checks the exact message and span.

Display format (the problems panel and the CLI use the same text):

```
error[S001] semantic: unknown swar 'gaa'
 --> line 1, col 7
  |
1 | sa re gaa ma
  |       ^^^ not one of: sa re ga ma pa dha ni
  |
  = hint: did you mean 'ga'?
```

| Code | Phase | Severity | Message | Hint / note | Triggered by |
|---|---|---|---|---|---|
| L001 | Lexer | error | illegal character '@' | Sur uses only swars, numbers and { } ; . ' : - # | `sa @ re` |
| L002 | Lexer | error | malformed number '2.3.4' | numbers look like 2 or 0.5 | `sa:2.3.4`, `sa:5.` |
| P001 | Parser | error | unexpected NUMBER '2' | to give a note 2 beats, write sa:2 | `sa re 2 ga` |
| P002 | Parser | error | expected a repeat count after 'repeat' | example: repeat 2 { sa re } | `repeat { sa }` |
| P003 | Parser | error | expected '{' after the repeat count | | `repeat 2 sa re` |
| P004 | Parser | error | this repeat block is never closed | add '}' at the end of the block | `repeat 2 { sa re` |
| P005 | Parser | error | unexpected '}' with no open block | | `sa }` |
| P006 | Parser | error | expected a number after ':' | example: sa:2 | `sa:` |
| P007 | Parser | error | expected a number after 'tempo' | example: tempo 90 | `tempo fast` |
| P008 | Parser | error | misplaced octave mark | use .sa for lower or sa' for upper; only one mark | `sa''`, `.` alone, `'` alone |
| S001 | Semantic | error | unknown swar 'gaa' | did you mean 'ga'? | `gaa`, `so` |
| S002 | Semantic | error | repeat count must be positive, got 0 | | `repeat 0`, `repeat -2` |
| S003 | Semantic | error | repeat count must be a whole number, got 2.5 | | `repeat 2.5` |
| S004 | Semantic | error | repeat count 500 is too large (max 32) | | `repeat 500` |
| S005 | Semantic | error | duration must be 0.25 to 8 beats in steps of 0.25, got 9 | | `sa:9`, `sa:0`, `sa:0.3` |
| S006 | Semantic | error | tempo must be 40 to 240 bpm, got 500 | | `tempo 500` |
| S007 | Semantic | error | tempo is already set on line 1 | remove one tempo line | two tempo lines |
| S008 | Semantic | error | a note cannot be both lower and upper octave | | `.sa'` |
| W001 | Semantic | warning | tempo applies to the whole piece; move it to the top | | `sa tempo 90` |
| W002 | Semantic | warning | empty repeat block does nothing | the optimizer will remove it | `repeat 3 { }` |
| W003 | Semantic | warning | this piece is 14.2 minutes long | very large nested repeats | deeply nested large repeats |
| C001 | any of 4–6 | error | internal compiler error: … | please report this; it is a bug, not your mistake | an exception thrown inside a phase |

## Rules

1. A problem in the user's program never throws: it becomes a `Diagnostic`. Only real bugs become C001, which `compile()` catches and wraps.
2. Phases 1–3 recover and keep going, so one run shows every problem. Phases 4–6 only run on error-free input.
3. Every diagnostic's span points at the smallest useful piece of code: the bad word, not the whole line.
4. Diagnostics are sorted by line, then column.
5. Warnings never stop the pipeline.

## "Did you mean" hints

First a small alias table (`ri→re`, `gaa→ga`, `maa→ma`, `paa→pa`, `da→dha`, `dh→dha`, `ne→ni`, `saa→sa`); otherwise the swar with Levenshtein edit distance ≤ 2; otherwise no hint.
