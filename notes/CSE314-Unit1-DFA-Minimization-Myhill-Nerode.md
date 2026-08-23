# CSE314 — Unit 1: DFA Minimization and Myhill-Nerode Theorem

## 1. Overview — Why This Matters, Real-World Relevance

DFA minimization is the process of converting a deterministic finite automaton into an equivalent DFA with the fewest possible states. The **Myhill-Nerode theorem** provides the algebraic foundation for this: it characterizes the regular languages exactly as those whose right-invariant equivalence relation `≡_L` (defined in Section 2) has finitely many equivalence classes, and it proves that the minimal DFA for a language is unique up to isomorphism.

**Real-world relevance:**

- **Compiler lexers (flex/lex):** Generated lexical analyzers internally apply DFA minimization to produce the smallest, fastest tokenizer from a set of regular expressions. Every keystroke in your text editor that triggers syntax highlighting relies on minimized DFAs.

- **Network intrusion detection (Snort, Zeek):** Pattern-matching engines convert sets of attack signatures into minimized DFAs for O(1)-per-byte matching against packet payloads. The memory saved by minimization directly determines how many signatures can be loaded simultaneously.

- **Hardware controller synthesis:** Finite-state machine (FSM) minimization in VLSI design — equivalent to DFA minimization — reduces gate count, power consumption, and area on chip. A minimized traffic-light controller uses fewer flip-flops than an unminimized one.

- **Model checking (SPIN, NuSMV):** Reachability analysis and equivalence checking reduce state spaces via bisimulation minimization, a direct generalization of DFA minimization to labeled transition systems.

- **Text/pattern search (Aho-Corasick automaton):** The Aho-Corasick algorithm builds a trie with goto/failure/output functions for multi-keyword matching; the underlying structure can be completed into a DFA and then minimized. In practice, minimization of the completed Aho-Corasick DFA is uncommon — memory-constrained deployments more often compress the trie/failure representation directly rather than convert to a full DFA.

- **Natural language morphology (Xerox fst, HFST):** Finite-state transducers for stemming, lemmatization, and morphological analysis are built and minimized daily in production systems (search engines, spell-checkers).

---

## 2. Key Concepts & Definitions

### 2.1 Equivalence of States
Two states `p` and `q` in a DFA are **equivalent** (`p ≡ q`) if, for every input string `w`, they both lead to an accepting state or both lead to a non-accepting state. Formally:

```
p ≡ q  ⇔  ∀ w ∈ Σ* : δ*(p, w) ∈ F  ⟺  δ*(q, w) ∈ F
```

### 2.2 Distinguishable States
Two states are **distinguishable** by a string `w` if exactly one of `δ*(p, w)` or `δ*(q, w)` is in `F`. The string `w` is called a **distinguishing string** (or witness) for the pair `(p, q)`.

### 2.3 Indistinguishable (Equivalent) States
States that are not distinguishable by any string are **indistinguishable** — they behave identically for all possible future inputs and can be merged.

### 2.4 k-Equivalence
Two states are **k-equivalent** (`p ≡ₖ q`) if they cannot be distinguished by any string of length ≤ k. This is the inductive basis for the table-filling minimization algorithm:

- **0-equivalence:** `p ≡₀ q` iff `(p ∈ F ⇔ q ∈ F)` — same accept/reject status.
- **k+1-equivalence:** `p ≡ₖ₊₁ q` iff `p ≡ₖ q` AND for every symbol `a ∈ Σ`, `δ(p,a) ≡ₖ δ(q,a)`.

The algorithm iteratively refines equivalence classes: start from 0-equivalence (accepting vs. non-accepting), then refine using the recurrence above until no further refinement is possible. At that point, `≡ₖ = ≡` for all k beyond the fixpoint.

### 2.5 Right-Invariant Equivalence Relation
An equivalence relation `R` on `Σ*` is **right-invariant** if:

```
x R y  ⟹  (x·z) R (y·z)   for all x, y, z ∈ Σ*
```

If two strings are related by `R`, then appending any common suffix preserves the relation.

### 2.6 Myhill-Nerode Equivalence (Right-Invariant Equivalence)
For a language `L ⊆ Σ*`, define the **Myhill-Nerode relation** `≡_L` on `Σ*` as:

```
x ≡_L y  ⟺  ∀ z ∈ Σ* : (x·z ∈ L  ⇔  y·z ∈ L)
```

Two strings are equivalent under `≡_L` iff they have identical futures (suffixes) with respect to membership in `L`. This relation is right-invariant (if `x ≡_L y`, then for any suffix `z`, `xz ≡_L yz`). It is **not** the two-sided syntactic congruence (which requires `uxv ∈ L ⇔ uyv ∈ L` for all `u, v ∈ Σ*`); it is only right-invariant. The two-sided congruence is a stronger condition used in algebraic language theory (the syntactic monoid), but for DFA minimization the one-sided right-invariant relation is the relevant tool.

**Example.** For `L = { w ∈ {0,1}* | w ends with 01 }`, the `≡_L` equivalence classes are:

| Class | Representative strings | Description |
|-------|----------------------|-------------|
| `[ε]` | `ε`, `1`, `11`, `111`, `101`, `1011`, ... | Strings that do **not** end with `0` and do **not** end with `01`. The last character is `1` (or empty). |
| `[0]` | `0`, `10`, `00`, `110`, `010`, ... | Strings ending with `0` (partial match: the `0` of `01` is pending). |
| `[01]` | `01`, `001`, `101`, `0101`, `1101`, ... | Strings ending with `01` (accepted). |

Each class corresponds to exactly one state in the minimal DFA (see Section 6).

### 2.7 Index of an Equivalence Relation
The **index** of an equivalence relation is the number of equivalence classes it has. An equivalence relation of finite index has finitely many classes.

### 2.8 Minimal DFA
The **minimal DFA** for a language `L` (when it exists) is the DFA with the fewest states that recognizes `L`. The Myhill-Nerode theorem guarantees it is **unique up to isomorphism** — there is exactly one minimal DFA if we ignore state names.

### 2.9 Distinguishing Extension
A string `z` is a **distinguishing extension** for prefixes `x` and `y` with respect to `L` if `xz ∈ L` and `yz ∉ L` (or vice versa). Finding a distinguishing extension for two strings proves they belong to different `≡_L` equivalence classes.

### 2.10 Table-Filling Algorithm (Moore's Algorithm)
The classical algorithm for DFA minimization that iteratively marks distinguishable state pairs. Also called **Moore's algorithm** or the **table-filling algorithm**. See Section 4 for a full treatment.

---

## 3. The Myhill-Nerode Theorem — Formal Statement and Proof

### 3.1 Statement

**Theorem (Myhill-Nerode, 1958).** For a language `L ⊆ Σ*`, the following three statements are equivalent:

1. **`L` is regular** (recognized by some DFA).
2. **`L` is the union of some equivalence classes of a right-invariant equivalence relation of finite index.**
3. **The Myhill-Nerode relation `≡_L` has finite index.**

When these hold, the number of states in the minimal DFA for `L` equals the index of `≡_L`, and the minimal DFA is unique up to isomorphism.

### 3.2 Proof Sketch

**(1 ⇒ 2):** Let `M = (Q, Σ, δ, q₀, F)` be a DFA recognizing `L`. Define the relation `R_M` on `Σ*` by:

```
x R_M y  ⟺  δ*(q₀, x) = δ*(q₀, y)
```

- `R_M` is an equivalence relation (equality of states is an equivalence).
- `R_M` is right-invariant: if `δ*(q₀, x) = δ*(q₀, y)`, then `δ*(q₀, xz) = δ*(q₀, yz)` for any `z`.
- `R_M` has finite index (at most `|Q|` classes, one per reachable state).
- `L` is the union of those classes whose corresponding state is accepting.

**(2 ⇒ 3):** Let `R` be a right-invariant equivalence of finite index whose classes union to `L`. We show `R` refines `≡_L`, meaning `x R y ⇒ x ≡_L y`. Since `R` has finite index, `≡_L` has at most as many classes as `R` — so `≡_L` also has finite index.

Proof: If `x R y`, right-invariance gives `xz R yz` for all `z`. Since the classes of `R` union to `L`, `xz` and `yz` are either both in `L` or both not in `L`. Hence `x ≡_L y`.

**(3 ⇒ 1):** Assume `≡_L` has finite index. Build a DFA `M_L = (Q_L, Σ, δ_L, q₀_L, F_L)` where:

- `Q_L` = the set of equivalence classes of `≡_L`.
- `q₀_L = [ε]` (the class of the empty string).
- `F_L = { [x] | x ∈ L }`.
- `δ_L([x], a) = [xa]` (the class of `x` followed by `a`).

This is well-defined because `≡_L` is right-invariant: if `x ≡_L y`, then `xa ≡_L ya`, so the transition does not depend on which representative we pick. The DFA recognizes `L` because:

```
δ_L*([ε], w) = [w] ∈ F_L  ⇔  w ∈ L
```

Since `≡_L` has finite index, `M_L` is a finite DFA, proving `L` is regular.

---

## 4. The DFA Minimization Algorithm (Table-Filling / Moore's Algorithm)

### 4.1 Problem Statement

**Input:** A DFA `M = (Q, Σ, δ, q₀, F)` with `n` states and alphabet size `k = |Σ|`.

**Output:** The minimal DFA `M'` equivalent to `M`, obtained by merging all indistinguishable states.

### 4.2 Algorithm Description (Iterative Table-Filling)

The algorithm builds on the `k`-equivalence recurrence from Section 2.4. It maintains a table of state-pair markings; a marked entry `(p, q)` means `p` and `q` are distinguishable.

```
1. Initialize an n × n table. Mark all pairs (p, q) where p ∈ F, q ∉ F.
   (These are 0-distinguishable.)
2. Repeat until no new marks are added:
   For each unmarked pair (p, q):
     For each symbol a ∈ Σ:
       If (δ(p, a), δ(q, a)) is marked:
         Mark (p, q) as distinguishable.
         Break (move to next pair).
3. The remaining unmarked pairs are equivalent states.
4. Merge each equivalence class into a single state in the new DFA.
```

### 4.3 Complexity

- **Worst-case time:** `O(k · n²)` where `k = |Σ|` and `n = |Q|`. Each of the `O(n²)` pairs is checked against at most `k` symbols, and the outer loop runs at most `n` times (in practice, convergence is faster).
- **Space:** `O(n²)` for the distinguishability table.

### 4.4 Worked Example

Consider the DFA `M = (Q, Σ, δ, A, F)` where:

- `Q = {A, B, C, D, E, F}`
- `Σ = {0, 1}`
- Start state: `A`
- Accepting states: `F = {D, E, F}`
- Transition function:

| State | 0   | 1   |
|-------|-----|-----|
| A     | B   | C   |
| B     | D   | E   |
| C     | D   | E   |
| D     | D   | F   |
| E     | D   | F   |
| F     | D   | F   |

**Step 1 — Mark 0-distinguishable pairs** (accepting vs. non-accepting):

```
        A     B     C     D     E     F
   A    -   [✓]   [✓]   [✓]   [✓]   [✓]
   B    -     -   [ ]   [✓]   [✓]   [✓]
   C    -     -     -   [✓]   [✓]   [✓]
   D    -     -     -     -   [ ]   [ ]
   E    -     -     -     -     -   [ ]
   F    -     -     -     -     -     -
```

Key: `[✓]` = marked distinguishable, `[ ]` = unmarked (possibly equivalent). Accepting states `{D, E, F}` are kept together; non-accepting `{A, B, C}` are kept together. All cross-group pairs are immediately marked.

**Step 2 — Refine using 1-equivalence:**

Check each unmarked pair:

- **`(B, C)`**: `δ(B,0) = D`, `δ(C,0) = D` (both in accepting group). `δ(B,1) = E`, `δ(C,1) = E` (both in accepting group). Both successors are in the same 0-equivalence class `{D, E, F}`. So `(B, C)` remains unmarked → `B ≡₁ C`.

- **`(D, E)`**: `δ(D,0) = D` (accepting), `δ(E,0) = D` (accepting). `δ(D,1) = F` (accepting), `δ(E,1) = F` (accepting). Both pairs `(D, D)` and `(F, F)` are trivially unmarked (same state). Unmarked → `D ≡₁ E`.

- **`(D, F)`**: `δ(D,0) = D`, `δ(F,0) = D`. `δ(D,1) = F`, `δ(F,1) = F`. Unmarked → `D ≡₁ F`.

- **`(E, F)`**: `δ(E,0) = D`, `δ(F,0) = D`. `δ(E,1) = F`, `δ(F,1) = F`. Unmarked → `E ≡₁ F`.

No new marks were added in this pass.

**Step 3 — Refine using 2-equivalence:**

Re-check all remaining unmarked pairs. No successor pair `(δ(p,a), δ(q,a))` for any `(p,q)` among `{B,C,D,E,F}` leads to a newly distinguished pair, so the table stabilizes.

**Final equivalence classes:**

```
Class 1: {A}          (start state, non-accepting)
Class 2: {B, C}       (non-accepting, equivalent)
Class 3: {D, E, F}    (accepting, all equivalent)
```

**Minimal DFA** (rename classes `q0 = {A}, q1 = {B,C}, q2 = {D,E,F}`):

| State | 0   | 1   |
|-------|-----|-----|
| q0    | q1  | q1  |
| q1    | q2  | q2  |
| q2    | q2  | q2  |

Start: `q0`. Accepting: `q2`. This is a three-state DFA — reduced from six.

---

## 5. Using Myhill-Nerode to Prove Non-Regularity

The Myhill-Nerode theorem gives a powerful method for proving a language is **not** regular: show that `≡_L` has infinite index by exhibiting infinitely many pairwise distinguishable strings.

**Method:** Find an infinite set `S = {s₁, s₂, s₃, ...}` of strings such that for any `i ≠ j`, there exists a distinguishing extension `z` with `s_i z ∈ L` but `s_j z ∉ L` (or vice versa). Then each `s_i` belongs to a distinct `≡_L` class, so `≡_L` has infinite index, and `L` cannot be regular.

### 5.1 Example 1: `L = { aⁿ bⁿ | n ≥ 0 }`

Consider the infinite set `S = { aⁿ | n ≥ 0 }`. For `i ≠ j`, take `z = bⁱ`. Then:

- `aⁱ bⁱ ∈ L` (exactly `i` a's followed by `i` b's).
- `aʲ bⁱ ∉ L` (the counts don't match).

Thus `aⁱ` and `aʲ` are distinguishable for all `i ≠ j`. The relation `≡_L` has infinitely many classes, so `L` is **not regular**.

### 5.2 Example 2: `L = { w w^R | w ∈ {0,1}* }` (palindromes of even length)

Consider `S = { 0ⁿ 1 | n ≥ 0 }`. For `i ≠ j`, take `z = 0ⁱ`. Then:

- `0ⁱ 1 · 0ⁱ` = `0ⁱ 1 0ⁱ`. Does this belong to `L`? Yes — it is its own reverse: `(0ⁱ 1 0ⁱ) = (0ⁱ 1 0ⁱ)^R`.
- `0ʲ 1 · 0ⁱ` = `0ʲ 1 0ⁱ`. Is this a palindrome? For it to be `w w^R`, we need the midpoint after the first `(i+j+1)/2` characters. Since the string starts with `0ʲ` and ends with `0ⁱ`, the reverse would be `0ⁱ 1 0ʲ`. For equality we need `i = j`. Since `i ≠ j`, this string is not in `L`.

Thus `0ⁱ 1` and `0ʲ 1` are distinguishable for `i ≠ j`, so infinitely many classes exist, and `L` is **not regular**.

### 5.3 Example 3: `L = { w ∈ {a,b}* | |w|_a = |w|_b }` (equal counts)

Consider `S = { aⁿ | n ≥ 0 }`. For `i ≠ j`, take `z = bⁱ`. Then:

- `aⁱ bⁱ` has equal `a` and `b` counts → in `L`.
- `aʲ bⁱ` has `j ≠ i` a's and `i` b's → not in `L`.

So `aⁱ` and `aʲ` are distinguishable for all `i ≠ j`. Infinite index → **not regular**.

---

## 6. Using Myhill-Nerode to Construct the Minimal DFA

Given a language `L` with finitely many `≡_L` classes, we can construct its minimal DFA directly from the equivalence classes. The construction in the proof of (3 ⇒ 1) of the Myhill-Nerode theorem (Section 3.2) is constructive:

1. **States** = the equivalence classes `[x]` of `≡_L`.
2. **Start state** = `[ε]`.
3. **Accepting states** = `{ [x] | x ∈ L }`.
4. **Transitions**: `δ([x], a) = [xa]`.

### 6.1 Worked Example: `L = { w ∈ {0,1}* | w ends with 01 }`

From Section 2.6, we identified three equivalence classes:

| Class | Represented by | Meaning | Accepting? |
|-------|---------------|---------|------------|
| `q0`  | `[ε]` | No pending match | No |
| `q1`  | `[0]` | Last char was `0` | No |
| `q2`  | `[01]` | Ends with `01` | Yes |

Now compute transitions:

- `δ(q0, 0) = [ε·0] = [0] = q1`
- `δ(q0, 1) = [ε·1] = [1]`. Is `1 ≡_L ε`? Yes — both end with `1` (or nothing), neither is accepted, and appending `0` gives `10` (not accepted) vs `0` (not accepted), while appending `1` gives `11` vs `1`. So `[1] = q0`.
- `δ(q1, 0) = [0·0] = [00]`. String `00` ends with `0` but not `01` → `[00] = q1`.
- `δ(q1, 1) = [0·1] = [01]` → `[01] = q2`.
- `δ(q2, 0) = [01·0] = [010]`. Ends with `0` → `q1`.
- `δ(q2, 1) = [01·1] = [011]`. Ends with `1` but not `0` → `q0`.

The resulting minimal DFA:

```
       0       0       0
  ┌───┐     ┌───┐     ┌───┐
  │ q0│────→│ q1│────→│*q2│
  └───┘     └───┘     └───┘
   ↑  │      ↑  │      ↑  │
   │  1      │  1      │  1
   └──┘      └──┘      └──┘
```

Transition table:

| State | 0   | 1   |
|-------|-----|-----|
| q0    | q1  | q0  |
| q1    | q1  | q2  |
| q2    | q1  | q0  |

Start: `q0`. Accepting: `q2`. This is the minimal DFA for "ends with 01" — exactly three states, each corresponding to one `≡_L` equivalence class.

---

## 7. Uniqueness of the Minimal DFA

The Myhill-Nerode theorem implies that the minimal DFA for a regular language is **unique up to isomorphism** (state renaming). Here is why:

1. For any DFA `M` recognizing `L`, the relation `R_M` (defined as `x R_M y` iff `δ*(q₀, x) = δ*(q₀, y)`) is a right-invariant equivalence of finite index whose classes partition the strings reaching each state.

2. The index of `R_M` equals the number of states reachable from the start state in `M`.

3. As shown in the proof sketch (Section 3.2), `R_M` refines `≡_L`, meaning each `≡_L` class is a union of `R_M` classes. Therefore `|Q_M| ≥ index(≡_L)`.

4. The minimal DFA built directly from `≡_L` classes (Section 6) has exactly `index(≡_L)` states, achieving the lower bound. Any DFA with more states has distinguishable states that could be merged.

5. If two DFAs both have exactly `index(≡_L)` states, each state must correspond bijectively to a `≡_L` class. The transition function `δ([x], a) = [xa]` is forced by the definition of `≡_L`, so the two DFAs differ only in state names — they are isomorphic.

**Corollary:** Two DFAs recognize the same language iff their minimized forms are isomorphic. This gives a decision procedure for DFA equivalence: minimize both and check isomorphism.

---

## 8. Complete Worked Example: Minimizing a 6-State DFA

This section walks through the entire pipeline — from DFA specification through minimization, equivalence verification, and the Myhill-Nerode perspective — as a single cohesive demonstration.

### 8.1 The DFA

Let `M = (Q, Σ, δ, A, F)` with `Q = {A, B, C, D, E, G}`, `Σ = {0, 1}`, start state `A`, accepting states `F = {C, G}`.

Transition table:

| State | 0   | 1   |
|-------|-----|-----|
| A     | B   | D   |
| B     | C   | C   |
| C     | C   | C   |
| D     | E   | G   |
| E     | B   | B   |
| G     | G   | G   |

(Note: `F` is the accepting set; `G` is a state name, not the accepting set symbol.)

### 8.2 Table-Filling Minimization

**0-equivalence:** Accepting `{C, G}` vs. non-accepting `{A, B, D, E}`.

Mark all cross-group pairs.

**1-equivalence check** (key pairs):

- `(A, B)`: `δ(A,0)=B`, `δ(B,0)=C`. `B` is non-accepting, `C` is accepting → different 0-classes → `(A,B)` is marked. Distinguishable!

- `(A, D)`: `δ(A,0)=B`, `δ(D,0)=E` (both non-accepting). `δ(A,1)=D`, `δ(D,1)=G` (non-accepting vs. accepting) → `(A,D)` is marked.

- `(B, E)`: `δ(B,0)=C`, `δ(E,0)=B` (accepting vs. non-accepting) → marked.

- `(A, E)`: `δ(A,0)=B`, `δ(E,0)=B`. `δ(A,1)=D`, `δ(E,1)=B` (both non-accepting). `B` and `B` are trivially same; `D` and `B` are both non-accepting. Unmarked → `A ≡₁ E`.

- `(B, D)`: `δ(B,0)=C`, `δ(D,0)=E` (accepting vs. non-accepting) → marked.

- `(C, G)`: `δ(C,0)=C`, `δ(G,0)=G`. `δ(C,1)=C`, `δ(G,1)=G`. Both successors are accepting → unmarked → `C ≡₁ G`.

Continuing, the final equivalent classes are: `{A, E}`, `{B}`, `{D}`, `{C, G}`.

**Minimized DFA** (rename: `q0 = {A,E}`, `q1 = {B}`, `q2 = {D}`, `q3 = {C,G}`):

| State | 0   | 1   |
|-------|-----|-----|
| q0    | q1  | q2  |
| q1    | q3  | q3  |
| q2    | q0  | q3  |
| q3    | q3  | q3  |

Start: `q0`. Accepting: `q3`. Reduced from 6 to 4 states.

### 8.3 Myhill-Nerode Perspective

The `≡_L` equivalence classes for this language are exactly `{q0, q1, q2, q3}`. Each class corresponds to a distinct "future behavior":

- `[ε]` = strings that behave like the empty string → `q0`. From here, appending `0` leads to acceptance (via `q1 → q3`), appending `1` leads to `D`/`q2`.
- `[0]` = strings ending in the pattern that leads through `B` → `q1`. One more `0` or `1` reaches `C`.
- `[1]` = strings that lead through `D` → `q2`. These eventually reach acceptance on `1`.
- `[01]` (or any string reaching `C` or `G`) → `q3`. Already accepted; all continuations stay accepted.

---

## 9. Practice Problems

### Problem 1 (Table-Filling)

Minimize the following DFA:

| State | a   | b   |
|-------|-----|-----|
| p     | q   | r   |
| q     | p   | s   |
| r     | t   | p   |
| s     | s   | s   |
| t     | t   | t   |

Start state: `p`. Accepting states: `{r, s, t}`.

**Solution:**

Step 1 — 0-equivalence: Accepting `{r, s, t}`, non-accepting `{p, q}`.
Mark all cross-group pairs: `(p,r)`, `(p,s)`, `(p,t)`, `(q,r)`, `(q,s)`, `(q,t)`.

Step 2 — Check unmarked pairs `(p,q)`, `(r,s)`, `(r,t)`, `(s,t)`:

- `(p,q)`: `δ(p,a)=q`, `δ(q,a)=p` (both non-accepting). `δ(p,b)=r`, `δ(q,b)=s` (both accepting). Both successor pairs `(q,p)` and `(r,s)` are unmarked → `p ≡₁ q`.

- `(r,s)`: `δ(r,a)=t`, `δ(s,a)=s` (both accepting). `δ(r,b)=p`, `δ(s,b)=s` (non-accepting vs. accepting) → `(p,s)` is marked! → `(r,s)` is distinguishable.

- `(r,t)`: `δ(r,a)=t`, `δ(t,a)=t` (both accepting). `δ(r,b)=p`, `δ(t,b)=t` → `(p,t)` is marked → distinguishable.

- `(s,t)`: `δ(s,a)=s`, `δ(t,a)=t` (both accepting). `δ(s,b)=s`, `δ(t,b)=t` (both accepting). All successor pairs are unmarked → `s ≡₁ t`.

Step 3 — Check `(s,t)` again with new marks: no change. Final classes: `{p,q}, {r}, {s,t}`.

Minimized DFA (3 states):

| State | a   | b   |
|-------|-----|-----|
| {p,q} | {p,q} | {s,t} |
| {r}   | {s,t} | {p,q} |
| {s,t} | {s,t} | {s,t} |

Start: `{p,q}`. Accepting: `{r}` and `{s,t}`.

### Problem 2 (Myhill-Nerode Non-Regularity)

Prove that `L = { aⁿ bᵐ aⁿ | n, m ≥ 0 }` is not regular using the Myhill-Nerode theorem.

**Solution:**

Consider the infinite set `S = { aⁿ | n ≥ 0 }`. For `i ≠ j`, take the distinguishing extension `z = b⁰ aⁱ = aⁱ`. Then:

- `aⁱ · aⁱ = aⁱ aⁱ = a²ⁱ`. This is of the form `aⁿ aⁿ` with `m = 0` → in `L`.
- `aʲ · aⁱ = aʲ aⁱ`. For this to be in `L`, we need `j = i` (same count of `a`s before and after). Since `j ≠ i`, this is **not** in `L`.

Thus `aⁱ` and `aʲ` are distinguishable for all `i ≠ j`. Infinite index → `L` is **not regular**.

### Problem 3 (Myhill-Nerode to Minimal DFA)

For `L = { w ∈ {0,1}* | w contains the substring `101` }`, find the equivalence classes of `≡_L` and construct the minimal DFA.

**Solution:**

There are 4 equivalence classes corresponding to how much of the pattern `101` has been matched:

| Class | Meaning | Accepting? | 0   | 1   |
|-------|---------|------------|-----|-----|
| `q0`  | No progress (match length 0) | No | q0 | q1 |
| `q1`  | Matched `1` (length 1) | No | q2 | q1 |
| `q2`  | Matched `10` (length 2) | No | q0 | q3 |
| `q3`  | Matched `101` (full match) | Yes | q3 | q3 |

This is the standard 4-state DFA for substring `101`, which is already minimal.

### Problem 4 (Proof)

Prove that `L = { w ∈ {0,1}* | |w| is prime }` is not regular using Myhill-Nerode.

**Solution:**

Consider `S = { 0ⁿ | n ≥ 0 }`. For `i ≠ j`, choose `z = 0^(p-i)` where `p` is a prime > max(i,j) (such a prime exists by Euclid's theorem). Then:

- `0ⁱ · 0^(p-i) = 0^p` has length `p` (prime) → in `L`.
- `0ʲ · 0^(p-i) = 0^(p + j - i)` has length `p + j - i`. Since `j ≠ i`, `|j - i| < p` and `p` is prime, there is no guarantee this is prime. In fact, by Dirichlet's theorem on arithmetic progressions, we can choose `p` such that `p + j - i` is composite. More directly: the difference `|j - i|` is fixed and nonzero; for sufficiently large primes `p`, `p + (j-i)` is even (hence composite) if `j-i` is odd, or more generally by choosing `p` carefully.

Thus infinitely many distinguishable strings exist → `L` is **not regular**.

### Problem 5 (Challenge)

Why does the number of states in the minimal DFA equal the index of `≡_L`? Explain the correspondence in your own words.

**Solution:**

Each state in any DFA for `L` corresponds to a set of strings that lead to that state from the start. If two strings `x` and `y` lead to the same state, then for any suffix `z`, `xz` and `yz` lead to the same state, so they are either both accepted or both rejected. Hence `x ≡_L y`. This means each state corresponds to a subset of a `≡_L` class. Therefore the number of states ≥ the number of `≡_L` classes.

Conversely, the construction in Section 6 builds a DFA with exactly `index(≡_L)` states. The minimal DFA cannot have fewer states (each `≡_L` class needs its own state — strings from different classes are distinguishable and must lead to different states), and we have a construction achieving that bound. Therefore `|Q_min| = index(≡_L)`.

---

## 10. Quick-Reference Summary

### Key Definitions (4 lines)

| Concept | Definition |
|---------|-----------|
| State equivalence `p ≡ q` | `∀ w : δ*(p,w) ∈ F ⟺ δ*(q,w) ∈ F` |
| `k`-equivalence `p ≡ₖ q` | Same for strings of length ≤ k |
| Myhill-Nerode `x ≡_L y` | `∀ z : xz ∈ L ⇔ yz ∈ L` |
| Right-invariant | `x R y ⇒ xz R yz` for all `z` |

### Algorithm (4 lines)

```
1. Mark all (accepting, non-accepting) pairs.
2. Repeat: mark (p,q) if any (δ(p,a), δ(q,a)) is marked.
3. Unmarked pairs are equivalent; merge them.
4. Complexity: O(k n²) time, O(n²) space.
```

### Myhill-Nerode Theorem (2 lines)

> `L` is regular ⇔ `≡_L` has finite index ⇔ `L` is a union of classes of some right-invariant equivalence of finite index. When regular, `|Q_min| = index(≡_L)`.

### Complexity Table

| Operation | Complexity |
|-----------|-----------|
| Table-filling (Moore) | `O(k n²)` time, `O(n²)` space |
| Hopcroft's algorithm (optimized) | `O(k n log n)` time |
| Brzozowski's algorithm | `O(2ⁿ)` worst-case, often fast in practice |

---

## 11. Connection to Subsequent Units

DFA minimization and the Myhill-Nerode theorem form the foundation for several topics in the remainder of CSE314:

- **Regular expression equivalence (Unit 2):** To decide whether two regexes generate the same language, convert both to NFAs, then to DFAs, minimize both, and check isomorphism. Minimization makes the equivalence check tractable.

- **State complexity (Unit 2):** The number of states in the minimal DFA is a canonical measure of a regular language's "complexity." The Myhill-Nerode index provides an algebraic way to compute this without constructing automata.

- **The pumping lemma (Unit 3):** Myhill-Nerode and the pumping lemma are complementary tools for proving non-regularity. Myhill-Nerode is more precise (it gives necessary and sufficient conditions) but often requires more ingenuity to apply. The pumping lemma is a sufficient condition (if a language is regular, it pumps) and is often easier for rote application.

- **Minimization applied to transducers (Unit 4):** The same table-filling idea generalizes to Mealy/Moore machine minimization, used in hardware design and protocol verification.

- **Syntactic monoid (algebraic language theory):** While `≡_L` is the one-sided right-invariant relation used for minimization, the two-sided syntactic congruence `u x v ∈ L ⇔ u y v ∈ L` defines the syntactic monoid of `L`. The syntactic monoid is finite iff `L` is regular, and its size bounds the state complexity of operations like reversal and complement.

---

> **Document version:** 1.0 — Revised to address accuracy corrections (Aho-Corasick clarification, syntactic congruence distinction), pedagogical enhancements (concrete examples, worked walkthroughs, algorithm details, practice problems), and completeness gaps (all 11 sections as specified).
