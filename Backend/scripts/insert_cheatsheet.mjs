import { DatabaseSync } from "node:sqlite";

const CHEATSHEET_TITLE = "Last Minute Revision: CSE316 Compiler Design";
const SUBJECT_CODE = "CSE316";
const SUBJECT_NAME = "Compiler Design";

// ── Cheatsheet content (under 300 words) ──────────────────────────────
const noteContent = `# Last Minute Revision: CSE316 Compiler Design

## Key Definitions / Formulas
- **Lexical Analysis**: Converts source code into tokens using DFA/NFA (lex/flex).
- **FIRST(X)**: Set of terminals that begin strings derivable from X.
- **FOLLOW(A)**: Set of terminals that can appear immediately to the right of A in a sentential form.
- **LR(1) item**: [A → α·β, a] where 'a' is the lookahead terminal.
- **Syntax-Directed Translation**: Attach semantic actions (S-attributed or L-attributed) to grammar productions.

## Quick Comparison Table
| Phase | Input | Output | Key Tool |
|-------|-------|--------|----------|
| Lexical Analysis | Source code | Token stream | RE / DFA |
| Syntax Analysis | Token stream | Parse tree | CFG / LL(1) or LR(1) |
| Semantic Analysis | Parse tree | Annotated AST | SDT / Symbol Table |
| Intermediate Code Gen | AST | Three-address code (TAC) | Translation schemes |
| Code Optimisation | TAC | Optimised TAC | DAG / Basic blocks |
| Code Generation | Optimised TAC | Target code | Register allocation |

## Step-by-Step Process: Top-Down Predictive Parsing (LL(1))
1. Eliminate left recursion and left-factor the grammar.
2. Compute FIRST sets for all non-terminals.
3. Compute FOLLOW sets for all non-terminals.
4. Build the LL(1) parsing table: \`M[A, a] = A → α\` where \`a ∈ FIRST(α)\` or \`a ∈ FOLLOW(A)\` if \`α ⇒* ε\`.
5. Use a stack-driven parser: push start symbol, match top-of-stack against input, and expand using table entries.
6. Accept when stack and input both reduce to \`$\`.

## Edge Cases & Gotchas
- **Left recursion** breaks LL(1) — must eliminate before parsing.
- **Nullable non-terminals**: If \`A ⇒* ε\`, FOLLOW(A) is used in LL(1) table construction — easily missed.
- **LR conflicts**: Shift/reduce or reduce/reduce in LR(1) means the grammar is not LR(1); check ambiguous productions.
- **Dangling-else problem**: Classic shift/reduce conflict in Pascal/C — resolve by preferring shift (longest match).
- **Backpatching**: Used for forward jumps in one-pass code generation — pointers to labels that are filled in later.
- **Type coercion in semantic analysis**: Expression \`int + float\` inserts an implicit \`int→float\` conversion node — forgetting this changes runtime semantics.`;

const db = new DatabaseSync(
  "/home/zorro-omarchy/Desktop/Projects/Personal/00_Active/University-ERP/Backend/data/lms.sqlite"
);

const id = "auto_cheat_" + Date.now();

const stmt = db.prepare(`
  INSERT OR IGNORE INTO lms_resources(
    id, type, title, description, difficulty, semester,
    subjectCode, subjectName, unit, unitNormalized, tags,
    uploadedBy, uploadedAt, updatedAt, noteContent,
    estimatedMinutes, renderType, exportable, isDeleted
  ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, 5, 'markdown', 1, 0)
`);

const result = stmt.run(
  id,                          // id
  "note",                      // type
  CHEATSHEET_TITLE,            // title
  "Quick revision cheatsheet covering all units of Compiler Design, tailored for last-minute exam prep.",  // description
  "advanced",                  // difficulty
  "VI",                        // semester
  SUBJECT_CODE,                // subjectCode
  SUBJECT_NAME,                // subjectName
  "revision",                  // unit
  "revision",                  // unitNormalized
  JSON.stringify(["compiler-design", "cse316", "revision", "cheatsheet", "last-minute"]),  // tags
  "populator-bot",             // uploadedBy
  // uploadedAt -> datetime('now') hardcoded
  // updatedAt -> datetime('now') hardcoded
  noteContent,                 // noteContent
  // estimatedMinutes -> 5 hardcoded
  // renderType -> 'markdown' hardcoded
  // exportable -> 1 hardcoded
  // isDeleted -> 0 hardcoded
);

const inserted = result.changes > 0;

console.log(JSON.stringify({
  id,
  title: CHEATSHEET_TITLE,
  subjectCode: SUBJECT_CODE,
  inserted,
}));

db.close();
