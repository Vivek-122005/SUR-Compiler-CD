# 3-minute demo script

**Before you start:** open the app, choose *Examples ▾ → Professor's example*. Make sure sound is on.

### Part A — the compiler view (`#/`)

1. **Phase bar (15 s).** "This is the professor's line. Six green phases across the top — each one ran, with its time in milliseconds."
2. **Tabs 1–4 (45 s).**
   - *Tokens*: "The lexer turned characters into 15 tokens; hover a row and the editor highlights it."
   - *Tree*: "The parser built this tree: five notes and a Repeat ×2 containing dha, ni, upper sa."
   - *Symbols*: "The semantic phase checked every swar and every repeat count — here are the ✓ marks — and built the symbol table."
   - *IR*: "Twelve symbolic instructions with a LOOP."
3. **Tab 5 — Optimizer (20 s).** "The small loop was unrolled and every frequency was folded in at compile time. Green lines are what changed." Optionally load *Optimizer demo* to show 2 × 3 collapsing into 6 and three rests merging.
4. **Tab 6 — JS and Play (20 s).** "This is the generated program. Press ▶ Play" — notes light up in the editor and on the timeline as they sound.
5. **Errors (30 s).** Load *Errors demo*: "Three errors at once, each underlined, with 'did you mean ga?'. Phase 3 is red; 4–6 are grey — skipped."
6. **Fix it live (20 s).** Change `gaa` → `ga`, `0` → `2`, `-2` → `2`. The bar turns green; press Play.

### Part B — the workflow dashboard (`#/workflow`)

Click **Workflow dashboard →**, then **⛶ Present**. Use → to move.

1. *The pipeline:* the six boxes with live output sizes and times.
2. *Phase slides:* for each phase — what it does, the algorithm, its error codes, and its live output.
3. *Trace one note:* pick `sa'` and follow it from characters → tokens → AST → semantic → IR → folded constants → JavaScript → sound.
4. *Error handling:* type a mistake into the box and watch the diagnostics and the mini phase bar update.
