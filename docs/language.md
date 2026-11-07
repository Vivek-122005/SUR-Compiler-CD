# The Sur language (v1)

Sur v1 has notes, rests, a tempo setting and repeat blocks. That is the whole language. Swars are case-insensitive (`SA` = `sa`); the lexer normalises them to lowercase.

## Features

| Feature | Syntax | Meaning |
|---|---|---|
| Note | `sa re ga ma pa dha ni` | The seven shuddh swars, middle octave, 1 beat each |
| Upper octave | `sa'` | Apostrophe after the swar: one octave up (the curly `’` also works) |
| Lower octave | `.ni` | Dot before the swar: one octave down |
| Duration | `sa:2`, `re:0.5` | Length in beats; default 1; allowed 0.25 to 8 in steps of 0.25 |
| Rest | `-`, `-:2` | Silence; default 1 beat |
| Repeat | `repeat 2 { dha ni sa' }` | Plays the block N times (1–32); blocks can be nested |
| Tempo | `tempo 90` | Beats per minute; default 100; range 40–240; at most once, before any note |
| Separator | space, new line or `;` | All three are equivalent and optional |
| Comment | `# text` | Ignored to end of line |

## Grammar (EBNF)

Each rule is one function in `src/compiler/parser/parser.ts`.

```ebnf
program     = { item } EOF ;
item        = statement | ";" ;
statement   = tempo_stmt | repeat_stmt | note | rest ;
tempo_stmt  = "tempo" NUMBER ;
repeat_stmt = "repeat" NUMBER "{" { item } "}" ;
note        = [ "." ] WORD [ "'" ] [ ":" NUMBER ] ;
rest        = "-" [ ":" NUMBER ] ;
```

The grammar accepts any word as a note on purpose. The parser checks shape only; deciding whether `gaa` is a real swar is the semantic phase's job.

## Tokens

| Input | Token |
|---|---|
| letters `[A-Za-z]+` | `TEMPO`, `REPEAT`, or `WORD` (value = lowercase) |
| digits `\d+(\.\d+)?`, or `-` directly followed by a digit | `NUMBER` |
| `-` otherwise | `DASH` |
| `{ } ; . :` | `LBRACE RBRACE SEMI DOT COLON` |
| `'` or `’` | `TICK` |
| end of input | `EOF` (exactly one) |

## Swar table and frequencies

Sa is C4 (261.63 Hz), equal temperament: frequency = 261.63 × 2^((s + 12·o) / 12), where `s` is the semitone offset and `o` the octave (−1, 0, +1), rounded to 2 decimals. A beat lasts 60 / tempo seconds (0.6 s at the default tempo of 100).

| Swar | Semitones | Lower (`.x`) Hz | Middle Hz | Upper (`x'`) Hz |
|---|---|---|---|---|
| sa | 0 | 130.81 | 261.63 | 523.25 |
| re | 2 | 146.83 | 293.66 | 587.33 |
| ga | 4 | 164.81 | 329.63 | 659.26 |
| ma | 5 | 174.61 | 349.23 | 698.46 |
| pa | 7 | 196.00 | 392.00 | 783.99 |
| dha | 9 | 220.00 | 440.00 | 880.00 |
| ni | 11 | 246.94 | 493.88 | 987.77 |

## Examples

```
# 1. The professor's example
sa re ga ma pa; repeat 2 { dha ni sa' }

# 2. Aaroh and avroh
tempo 120
sa re ga ma pa dha ni sa'
sa' ni dha pa ma ga re sa:2

# 3. Nested repeats, rests and lower octave
tempo 90
repeat 2 {
  .dha .ni sa:2 -
  repeat 3 { ga re }
  sa:2 -:2
}

# 4. Optimizer demo
repeat 2 { repeat 3 { sa re } } - - -

# 5. Deliberate errors
sa re gaa ma
repeat 0 { pa }
repeat -2 { dha }
```
