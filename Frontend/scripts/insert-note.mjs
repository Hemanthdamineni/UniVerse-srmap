import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("/home/zorro-omarchy/Desktop/Projects/Personal/00_Active/University-ERP/Backend/data/lms.sqlite");

const title = "Deterministic Finite Automata (DFA) — Formal Definition & Applications";

const description = "A comprehensive study note on Deterministic Finite Automata covering formal definition, transition functions, extended transition functions, language acceptance, and step-by-step construction techniques for CSE314 Unit 1.";

const noteContent = `# Deterministic Finite Automata (DFA) — Formal Definition & Applications

## 1. Overview

A Deterministic Finite Automaton (DFA) is the simplest and most foundational model of computation in automata theory. It is an abstract machine that reads a string of symbols one at a time and, based on its current state and the symbol read, deterministically transitions to exactly one next state. The word "deterministic" means that for every state and every input symbol, there is exactly one transition defined — no choices, no ambiguity.

DFAs are central to CSE314 because they establish the baseline for what "computable" means with finite memory. Every regular language can be recognized by some DFA, and conversely, every DFA recognizes a regular language. This equivalence (DFA = regular language) is the cornerstone of Unit 1.

## 2. Key Concepts

- **Finite set of states (Q):** A DFA has a finite number of states representing all possible configurations of the machine's finite memory.
- **Alphabet (Σ):** A finite, non-empty set of input symbols (e.g., Σ = {0, 1}).
- **Transition function (δ):** A function δ: Q × Σ → Q that maps a state and an input symbol to exactly one next state.
- **Start state (q₀):** The state the DFA begins in before reading any input (q₀ ∈ Q).
- **Accept states (F):** A subset of Q; if the DFA ends in an accept state after processing the entire input, the string is accepted.
- **Language acceptance:** The set of all strings that the DFA accepts.
- **Extended transition function (δ̂):** Extends δ from single symbols to entire strings, defining the state reached after processing a sequence of inputs.

## 3. Detailed Explanation

### 3.1 Formal Definition

A DFA is a 5-tuple: **M = (Q, Σ, δ, q₀, F)** where:

1. **Q** — a finite set of states.
2. **Σ** — a finite set of input symbols (alphabet).
3. **δ: Q × Σ → Q** — the transition function.
4. **q₀ ∈ Q** — the start (initial) state.
5. **F ⊆ Q** — the set of final (accepting) states.

### 3.2 How a DFA Processes Input

The DFA begins in state q₀. It reads the input string w = w₁w₂...wₙ from left to right, one symbol at a time. For each symbol wᵢ, the DFA applies δ to its current state and wᵢ, moving to the next state. After the last symbol is consumed, if the current state belongs to F, the string is **accepted**; otherwise, it is **rejected**.

### 3.3 Extended Transition Function

The extended transition function δ̂: Q × Σ* → Q is defined recursively:

- **Base case:** δ̂(q, ε) = q (reading no input leaves you in the same state).
- **Inductive step:** For any string w = xa (where a is the last symbol), δ̂(q, w) = δ(δ̂(q, x), a).

A string w is accepted by the DFA iff δ̂(q₀, w) ∈ F.

### 3.4 Language of a DFA

The language recognized (or accepted) by a DFA M is:

**L(M) = { w ∈ Σ* | δ̂(q₀, w) ∈ F }**

That is, the set of all strings over Σ that drive the DFA from the start state into an accept state.

## 4. Examples

### Example 1: Binary strings ending with "00"

Construct a DFA over Σ = {0, 1} that accepts all binary strings ending with "00".

**States (Q):** {q₀, q₁, q₂}
**Start state:** q₀
**Accept state:** q₂

**Transition table:**

| State | Input 0 | Input 1 |
|-------|---------|---------|
| q₀    | q₁      | q₀      |
| q₁    | q₂      | q₀      |
| q₂    | q₂      | q₀      |

**Explanation:** q₀ remembers "no trailing zero yet"; q₁ remembers "last symbol was 0" (one trailing zero); q₂ remembers "last two symbols were 00" (two trailing zeros). Once in q₂, the string is accepted. Reading more 0s stays in q₂; reading a 1 resets to q₀.

**Test strings:**
- "00" → q₀ → q₁ → q₂ ✅ Accept
- "100" → q₀ → q₀ → q₁ → q₂ ✅ Accept
- "101" → q₀ → q₀ → q₁ → q₀ ❌ Reject
- "010" → q₀ → q₁ → q₂ → q₀ ❌ Reject
- "000" → q₀ → q₁ → q₂ → q₂ ✅ Accept

### Example 2: Odd number of 1s

Construct a DFA over Σ = {0, 1} that accepts strings with an odd number of 1s.

**States (Q):** {even, odd}
**Start state:** even
**Accept state:** odd

**Transition table:**

| State | Input 0 | Input 1 |
|-------|---------|---------|
| even  | even    | odd     |
| odd   | odd     | even    |

**Explanation:** Reading 0 doesn't change the parity of 1s; reading 1 flips the parity. The DFA accepts precisely when the count of 1s is odd.

**Test strings:**
- "1" → even → odd ✅ Accept
- "111" → even → odd → even → odd ✅ Accept (three 1s is odd)
- "00" → even → even → even ❌ Reject (zero 1s is even)
- "0101" → even → even → odd → odd → even ❌ Reject (two 1s is even)

### Example 3: Strings that begin with "a" and end with "b" over {a, b}

Construct a DFA that accepts strings starting with 'a' and ending with 'b'.

**States (Q):** {q₀, q₁, q₂, q₃}
**Start state:** q₀
**Accept state:** q₂

**Transition table:**

| State | Input a | Input b |
|-------|---------|---------|
| q₀    | q₁      | q₃      |
| q₁    | q₁      | q₂      |
| q₂    | q₁      | q₂      |
| q₃    | q₃      | q₃      |

**Explanation:** q₀ — start, first symbol not yet read. q₁ — first symbol was 'a' (valid start), still reading. q₂ — valid string (started with 'a' and ends with 'b'). q₃ — trap state (started with 'b', can never be accepted).

**Test strings:**
- "ab" → q₀ → q₁ → q₂ ✅ Accept
- "aab" → q₀ → q₁ → q₁ → q₂ ✅ Accept
- "b" → q₀ → q₃ ❌ Reject
- "aba" → q₀ → q₁ → q₂ → q₁ ❌ Reject (does not end with 'b')
- "abb" → q₀ → q₁ → q₂ → q₂ ✅ Accept

## 5. Common Mistakes

1. **Missing transitions:** Every DFA must define a transition for every state×symbol pair. Missing transitions mean it is not a valid DFA (it would be a partial DFA, which is not a proper DFA).
2. **Multiple outgoing transitions for the same symbol:** A DFA cannot have two different transitions from the same state on the same input symbol — that would be non-deterministic.
3. **Forgetting the trap state:** If a prefix makes acceptance impossible, the DFA must still have a defined transition — typically into a trap (dead) state that loops to itself on all remaining input.
4. **Confusing start and accept states:** The start state is the initial configuration before any input; accept states are where the DFA must land after the **entire** input.
5. **Empty string (ε) acceptance:** If the start state is not an accept state, the empty string is rejected. Check this condition explicitly when designing a DFA.
6. **Using "even length" vs "odd length" incorrectly:** A DFA that accepts strings of even length needs exactly two states; a common error is mis-counting the starting position (q₀ is length 0, which is even).

## 6. Quick Reference

| Concept | Definition |
|---------|-----------|
| DFA formal definition | M = (Q, Σ, δ, q₀, F) |
| Determinism | δ(q, a) is defined for all q∈Q, a∈Σ, and yields exactly one state |
| Extended transition | δ̂(q, ε) = q; δ̂(q, xa) = δ(δ̂(q, x), a) |
| Acceptance condition | δ̂(q₀, w) ∈ F |
| Language of DFA | L(M) = { w ∈ Σ* : δ̂(q₀, w) ∈ F } |
| Trap state | A non-accepting state that loops to itself on all symbols; used when a prefix makes acceptance impossible |
| Minimal DFA | Unique (up to isomorphism) for every regular language; found by merging indistinguishable states |

**Construction checklist:**
1. Identify what information the DFA must "remember" → this determines the states.
2. Define transitions for every state and every symbol.
3. Mark accept states.
4. Verify with sample strings (both accepted and rejected).
5. Check empty string behavior.

## 7. Practice Questions

1. Construct a DFA over Σ = {0, 1} that accepts strings where every occurrence of "00" is immediately followed by a "1" (i.e., no isolated "00" substring).
2. Construct a DFA over Σ = {a, b} that accepts strings where the number of 'a's is divisible by 3.
3. Design a DFA that accepts binary strings that contain "101" as a substring.
4. Construct a DFA for the language L = { w ∈ {0,1}* : w has an equal number of "01" and "10" substrings }.
5. Prove or disprove: For any DFA with n states, there exists a string of length at most n that is accepted iff the language is non-empty.
6. Build a DFA over Σ = {x, y} that accepts strings where every prefix has at least as many x's as y's (like a balanced parentheses check with x = '(' and y = ')').
7. Minimize the following DFA: states {A,B,C,D,E,F}, Σ={0,1}, start=A, accept={C,E}. Transitions: δ(A,0)=B, δ(A,1)=C, δ(B,0)=A, δ(B,1)=D, δ(C,0)=E, δ(C,1)=F, δ(D,0)=E, δ(D,1)=F, δ(E,0)=E, δ(E,1)=F, δ(F,0)=F, δ(F,1)=F.

## 8. Summary

- A DFA is a 5-tuple (Q, Σ, δ, q₀, F) that processes input deterministically.
- For every state and every input symbol, exactly one transition exists — this is the "deterministic" guarantee.
- The extended transition function δ̂ generalizes δ over strings, and a string is accepted if δ̂(q₀, w) lands in an accept state.
- DFAs recognize exactly the class of **regular languages**, which include finite languages, languages describable by regular expressions, and languages generated by right-linear grammars.
- The number of states reflects the amount of finite memory required — each state captures a distinct "pattern" the machine needs to remember about the input seen so far.
- Many natural languages (those requiring counting beyond a fixed bound, or matching nested parentheses) are **not** regular and cannot be recognized by any DFA — this motivates the study of more powerful models (NFA, PDA, Turing Machines) in later units.

**Key takeaway:** DFAs are the simplest computational model with practical applications in lexical analysis, network protocol validation, pattern matching, and digital circuit design. Mastery of DFA construction and the pumping lemma (proving non-regularity) is essential for the CSE314 exam.`;

const tags = JSON.stringify(["cse314", "theory-of-computation", "automata", "dfa", "unit-1", "finite-automata"]);
const id = "auto_note_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);

const nowISO = new Date().toISOString().replace("T", " ").split(".")[0];
// e.g. "2026-07-25 12:34:56"

try {
  const stmt = db.prepare(`
    INSERT INTO lms_resources(
      id, type, title, description, difficulty, semester,
      subjectCode, subjectName, unit, unitNormalized, tags,
      uploadedBy, uploadedAt, updatedAt, noteContent,
      estimatedMinutes, renderType, exportable, isDeleted
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 30, 'markdown', 1, 0)
  `);

  stmt.run(
    id,
    "note",
    title,
    description,
    "intermediate",
    "VI",
    "CSE314",
    "Theory of Computation",
    "Unit 1: Finite Automata",
    "unit-1",
    tags,
    "populator-bot",
    nowISO,
    nowISO,
    noteContent
  );

  const row = db.prepare("SELECT id, title, subjectCode, unit FROM lms_resources WHERE id = ?").get(id);
  const inserted = row !== undefined;
  console.log(JSON.stringify({ id, title, topic: "Deterministic Finite Automata (DFA)", inserted }));
} catch (e) {
  console.error("Insertion failed:", e.message);
  console.log(JSON.stringify({ id: "", title, topic: "Deterministic Finite Automata (DFA)", inserted: false }));
}