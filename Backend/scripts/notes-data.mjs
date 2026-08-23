// Auto-generated notes data
const notes = [
  {
    topicId: "complexity-analysis",
    title: "Complexity Analysis",
    description: "Big O notation, time complexity, space complexity, and amortized analysis.",
    estimatedMinutes: 20,
    difficulty: "beginner",
    tags: ["algorithms","data-structures","complexity-analysis","big-o","time-complexity","space-complexity"],
    noteContent: `# Complexity Analysis

## Overview

Complexity analysis is the mathematical framework for evaluating how an algorithm's resource consumption (time and memory) grows as input size increases. It provides a language-independent, machine-independent way to compare algorithms, predict performance at scale, and identify bottlenecks before they surface in production. Without complexity analysis, choosing between algorithms reduces to guesswork — with it, you can reason rigorously about efficiency.

---

## Key Concepts

### Big O Notation (O)

Big O describes the **upper bound** of an algorithm's growth rate — the worst-case scenario. It answers: "How does this algorithm behave when input size gets very large?" Formally, \`f(n) = O(g(n))\` means there exist constants \`c\` and \`n₀\` such that \`f(n) ≤ c · g(n)\` for all \`n ≥ n₀\`. Constant factors and lower-order terms are dropped.

**Common growth rates (fastest to slowest):**

| Notation | Name | Example |
|----------|------|---------|
| O(1) | Constant | Array lookup by index |
| O(log n) | Logarithmic | Binary search |
| O(n) | Linear | Scanning an array |
| O(n log n) | Linearithmic | Merge sort, heap sort |
| O(n²) | Quadratic | Nested loops over the same array |
| O(2ⁿ) | Exponential | Naive Fibonacci recursion |
| O(n!) | Factorial | Brute-force traveling salesman |

### Big Omega (Ω) and Big Theta (Θ)

- **Ω (Omega)**: Lower bound — best-case performance. An algorithm that is Ω(n) will take at least linear time in the best case.
- **Θ (Theta)**: Tight bound — the function grows at exactly this rate. If \`f(n) = O(g(n))\` and \`f(n) = Ω(g(n))\`, then \`f(n) = Θ(g(n))\`.

### Space Complexity

The amount of memory an algorithm requires relative to input size. Includes both the input storage and any auxiliary data structures. A recursive algorithm's call stack depth counts toward space complexity.

**Tip:** If an algorithm uses O(n) auxiliary space, it may be unsuitable for memory-constrained environments even if its time complexity is excellent.

### Amortized Analysis

Amortized analysis examines the **average cost per operation** over a worst-case sequence of operations. A single operation may occasionally be expensive (e.g., resizing a dynamic array), but those costs are spread across many cheap operations so the average remains low.

**Example:** Dynamic array (e.g., \`ArrayList\`, \`std::vector\`) append operations are O(1) amortized, even though an individual resize costs O(n). The resizing doubling strategy ensures that the total cost across \`n\` appends is O(n), not O(n²).

**Three techniques:**
1. **Aggregate method** — compute total cost across a sequence, divide by number of operations.
2. **Accounting (banker's) method** — overcharge cheap operations and save credit for expensive ones.
3. **Potential (physicist's) method** — define a potential function that captures prepaid work.

---

## Pattern Recognition

Use these patterns to identify which complexity class applies to a problem:

| When you see... | Suspect... |
|----------------|------------|
| Need to compare algorithm efficiency | Time complexity analysis is required |
| Large input size concerns | Focus on dominant term — constants become irrelevant at scale |
| Optimization required | Compute current complexity, then target a lower class (e.g., O(n²) → O(n log n)) |
| Time vs space trade-offs | A faster algorithm may use more memory (e.g., memoization, hash tables) |
| Worst-case vs average-case analysis | Distinguish between typical inputs and adversarial ones |
| Amortized analysis for dynamic structures | Occasional expensive operations are spread over a sequence of cheap ones |

---

## Common Mistakes to Avoid

1. **Confusing O(2n) with O(n).** Constant factors are dropped. O(2n) is still O(n). Writing \`O(2n)\` is technically redundant — always simplify.

2. **Ignoring constant factors in practice.** Big O ignores constants, but real-world performance depends on them heavily. An O(n²) algorithm with tight inner loops and good cache locality can outperform an O(n log n) algorithm with heavy overhead for small to medium inputs.

3. **Not considering space complexity.** Many problems constrain memory. An O(1) space solution may be preferred over an O(n) space one, even if the latter is faster.

4. **Forgetting about input size dependence.** An algorithm that runs in O(n) on a 100-element array is negligible — the same algorithm on a billion-element array may be infeasible. The same growth rate, different conclusion.

5. **Assuming all O(n log n) sorts are equal.** Merge sort, heap sort, and quicksort all have O(n log n) average time, but constants differ: quicksort is often 2-3x faster in practice due to cache behavior.

---

## When to Use / When Not to Use

### Use complexity analysis when:

- Comparing two or more algorithms for the same problem.
- Estimating runtime for a known input size (e.g., \`5 × 10⁷\` operations at \`10⁸ ops/s\` → ~0.5 s).
- Designing APIs or libraries that others will call with unknown input sizes.
- Preparing for technical interviews — complexity analysis is universally expected.

### Avoid over-indexing on complexity when:

- Input size is guaranteed small and fixed (e.g., sorting 10 integers — constant factors dominate).
- The algorithm runs once and correctness is far more important than speed.
- Premature optimization would harm code clarity or maintainability.

---

## Implementation Guide

*N/A — Complexity analysis is a conceptual tool, not an algorithm to implement. However, here is the systematic process:*

1. **Identify the input size parameter** \`n\` — what variable drives growth?
2. **Count dominant operations** — find the operation that executes the most times (usually inside the deepest loop or recursion).
3. **Write a summation** — express the operation count as a function of \`n\` using loops as sums, recursion as recurrence relations.
4. **Drop constants and lower-order terms** — keep only the fastest-growing term.
5. **Name the complexity class** — map the result to O(1), O(log n), O(n), etc.

**Recurrence trees:** For recursive algorithms (e.g., merge sort: \`T(n) = 2T(n/2) + O(n)\`), draw a tree where each node represents a recursive call's cost. Sum across levels; the depth × per-level cost gives the total.

---

## Complexity Analysis

This study note itself requires no runtime analysis — it is reference material. The analysis required of *you* for any algorithm costs:

| Dimension | Cost |
|-----------|------|
| Time | O(1) — applying the rules above is a constant-time judgment |
| Space | O(1) — no auxiliary structures needed |

---

## Practice Problems

1. **Analyze Time Complexity (Easy)** — Given a simple nested-loop function, determine its O notation.
2. **Space Complexity Analysis (Easy)** — Identify the auxiliary space used by a recursive function.
3. **Amortized Analysis (Medium)** — Prove that a dynamic table's insert operations run in O(1) amortized time.
4. **Big O Ranking (Easy)** — Sort a list of functions by growth rate (e.g., n, n², n log n, log n, 2ⁿ).
5. **Recursion Tree Analysis (Medium)** — Solve \`T(n) = 3T(n/4) + O(n²)\` using a recursion tree and derive the complexity.

---

## Review Questions

1. Why do we drop constant factors in Big O notation?
2. What is the difference between worst-case and amortized analysis?
3. Give an example where the O(n log n) sort with the smallest constant factor is not merge sort.
4. How does space complexity differ from time complexity in recursive algorithms?
5. When would you prefer an O(n²) algorithm over an O(n log n) one?

---

## Summary

Complexity analysis is the foundational skill of algorithm design. Big O notation lets you classify algorithms by their growth rate, ignoring constants and lower-order terms. Always consider both time **and** space complexity. Amortized analysis provides a realistic average-cost picture when operations vary in cost. Mastery comes from practice — work through the recurrence trees, rank functions by growth rate, and make the habit of asking "What is the complexity?" before writing any loop.
`
  },
  {
    topicId: "arrays-fundamentals",
    title: "Arrays: The Fundamental Data Structure",
    description: "The most fundamental data structure. Arrays are contiguous memory blocks that store elements of the same type. Nearly every algorithmic problem starts here.",
    estimatedMinutes: 45,
    difficulty: "beginner",
    tags: ["arrays","data-structures","unit-1","dsa","fundamentals"],
    noteContent: `# Arrays: The Fundamental Data Structure

## Overview

Arrays are the bedrock of data structures -- a contiguous block of memory that stores elements of the same type at evenly spaced offsets. Every programming language provides them, and nearly every algorithmic problem builds on array operations. An array gives you a fixed collection of elements where each element is identified by its index (position). In most languages, indexing starts at 0, meaning the first element lives at position 0, the second at position 1, and so on.

Think of an array as a row of numbered lockers in a hallway. Each locker has a fixed number (0, 1, 2...) and holds exactly one value. If you know the number, you can open that locker instantly -- no searching required.

## Key Concepts

- **Contiguous memory**: All elements sit next to each other in memory. This locality is what makes arrays fast: accessing arr[5] is a simple arithmetic computation (base address + 5 x element size), not a pointer chase.
- **Zero-based indexing**: arr[0] is the first element, arr[n-1] is the last. Off-by-one errors are the single most common array mistake.
- **Fixed vs. dynamic size**: Static arrays have a compile-time fixed capacity. Dynamic arrays (like Python lists, Java ArrayList, or C++ std::vector) double their capacity on overflow, giving amortized O(1) append.
- **Random access**: Any element can be read or written in O(1) time using its index.
- **In-place modification**: Because elements occupy fixed slots, you can swap, overwrite, or reorder elements within the same memory block without allocating new storage.

## Pattern Recognition

Arrays are the right tool when you see these patterns in a problem:

- **Elements stored in contiguous memory** -- the problem statement mentions sequences, lists, or ordered collections.
- **Index-based access required** -- you need to fetch or update elements at specific positions, not by value.
- **In-place modification needed** -- the problem asks you to rearrange elements without using extra space.
- **Multiple passes over data acceptable** -- solving the problem in two or more linear scans is allowed.
- **Sliding window or two-pointer technique** -- problems involving subarrays, contiguous sums, or pairs often yield to pointer-based traversal.

## Common Mistakes to Avoid

- **Off-by-one errors in indexing**: Iterating past the last element (arr[n] instead of arr[n-1]) or stopping one element too early. Always double-check loop bounds.
- **Modifying an array while iterating**: Inserting or deleting elements during a forward loop shifts indices, causing skipped or re-processed elements. Iterate backward or use a separate index.
- **Not handling empty arrays or single-element edge cases**: Code that assumes at least two elements will crash on an empty input. Always guard for n == 0 and n == 1.
- **Using O(n) space when an O(1) in-place solution is possible**: Many problems (reverse, rotate, deduplicate sorted arrays) can be solved with constant extra space. Reach for this before allocating a second array.
- **Forgetting that array indices start at 0**: Confusing 1-based intuition with 0-based reality leads to subtle bugs.
- **Assuming the array is sorted without confirming**: Many algorithms (binary search, two-pointer pairs) depend on sorted input. Never assume -- sort explicitly if needed.

## When to Use / When Not to Use

**Use arrays when** you need fast indexed access, cache-friendly iteration, or a lightweight sequential collection. They excel for implementing stacks, buffers, hash table buckets, adjacency lists, and dynamic programming tables.

**Avoid arrays when** you need frequent insertions or deletions in the middle (linked lists or balanced trees are better), when the collection size is unknown and grows erratically (a dynamic array still works but may waste space with over-allocation), or when you need associative lookup by key (use a hash map instead).

## Implementation Guide

Start with a fixed-size array and implement the four core operations:

1. **get(index)**: Return arr[index] after bounds-checking. O(1).
2. **set(index, value)**: Overwrite arr[index]. O(1).
3. **insert(index, value)**: Shift all elements from index to the end right by one, then write at the freed slot. O(n) worst case.
4. **delete(index)**: Shift all elements after index left by one. O(n) worst case.

Once these work, upgrade to **dynamic resizing**: when the array is full and a new element arrives, allocate a new array of double the capacity, copy all elements, then append the new element. This makes the amortized cost of an append O(1) -- the occasional expensive copy is spread across many cheap operations.

## Complexity Analysis

| Operation | Time Complexity | Space Complexity |
|-----------|----------------|-----------------|
| Access by index | O(1) | O(1) |
| Search (unsorted) | O(n) | O(1) |
| Search (sorted, binary search) | O(log n) | O(1) |
| Insert / delete at end (dynamic array) | O(1) amortized | O(1) |
| Insert / delete at middle | O(n) | O(1) |
| Traversal | O(n) | O(1) |

## Practice Problems

1. **Two Sum (Easy)** -- Find two numbers in an array that add up to a target. Tests hash-map-augmented search.
2. **Best Time to Buy/Sell Stock (Easy)** -- Find the maximum profit from a single buy-sell pair. Classic running-minimum pattern.
3. **Contains Duplicate (Easy)** -- Detect if any value appears more than once. Tests set-based or sorting approaches.
4. **Product of Array Except Self (Medium)** -- Compute product of all elements except the current one without division. Tests prefix/suffix pass technique.
5. **Maximum Subarray / Kadane's Algorithm (Medium)** -- Find the contiguous subarray with the largest sum. The canonical linear DP on arrays.

## Review Questions

1. Why is array access O(1)? What hardware property makes this possible?
2. What happens to indices when you insert an element in the middle of an array?
3. How does a dynamic array achieve amortized O(1) append despite occasional O(n) copies?
4. Why does modifying an array while iterating forward cause bugs? How do you fix it?
5. When would you choose a linked list over an array? When would you choose the opposite?

## Summary

Arrays are the simplest and most performant data structure for sequential, indexable data. Master them thoroughly: learn to think in terms of indices, two-pointer traversals, sliding windows, and in-place transformations. Most hard algorithmic problems decompose into clever array manipulations once you strip away the abstraction. If you understand arrays deeply -- their memory model, their edge cases, their patterns -- you have a foundation that serves every other data structure you will learn.
`
  },
  {
    topicId: "dsa-hashing-001",
    title: "Hashing",
    description: "Hashing provides O(1) average-time lookups, insertions, and deletions. It is the single most important optimization technique in algorithmic problem solving.",
    estimatedMinutes: 45,
    difficulty: "beginner",
    tags: ["DSA","Hashing","Unit-1","Hash-Table","Data-Structures","Algorithms"],
    noteContent: `# Hashing

## Overview

Hashing is a technique that maps data of arbitrary size to fixed-size values using a hash function. It is the single most important optimization technique in algorithmic problem solving because it enables **O(1) average-time** lookups, insertions, and deletions. Without hashing, nearly every problem that requires fast value-based retrieval would degrade to O(n) linear scans.

At its core, hashing transforms a key into an array index, giving you direct access to the associated value. This fundamental operation underpins hash tables, hash sets, hash maps, and dictionary data structures across every modern programming language.

## Key Concepts

- **Hash Function**: A deterministic function that converts a key into an integer (the hash code), then maps it to an index within the backing array, typically via modulo arithmetic (\`hash % array_size\`). A good hash function distributes keys uniformly to minimize collisions.

- **Collision**: When two distinct keys produce the same array index. Collisions are inevitable due to the pigeonhole principle — there are more possible keys than array slots.

- **Separate Chaining**: Each array slot holds a linked list (or another container). Colliding keys are appended to the same list. Lookup traverses the list at the computed index.

- **Open Addressing**: On collision, probe for the next available slot using a deterministic sequence (linear probing, quadratic probing, double hashing). No extra memory per slot, but deletion is trickier.

- **Load Factor**: The ratio \`n / m\` (number of entries / array capacity). When this exceeds a threshold (typically 0.75), the table resizes and rehashes all entries to maintain performance.

- **Perfect Hashing**: A hash function with zero collisions for a given static set of keys. Used in compilers, spell checkers, and database internals where the key set is known in advance.

## Pattern Recognition

Recognizing when hashing applies is a skill that develops with practice. These are the dominant patterns:

- **Need O(1) Lookup by Value**: You have a collection and need to answer "does this value exist?" or "what is associated with this value?" repeatedly. This is the primary signal for a hash set or hash map.

- **Counting Frequencies**: You need to count how many times each element appears. A hash map from element to integer count is the standard solution. Examples: word frequency, character frequency, vote tallying.

- **Finding Complements or Pairs**: You need to find two elements that sum to a target, or otherwise satisfy a pairwise condition. Store complements (target - current) as you iterate, enabling single-pass O(n) solutions.

- **Detecting Duplicates**: As you iterate, insert each element into a hash set. If an element already exists in the set, a duplicate has been found. O(n) time instead of O(n log n) with sorting.

- **Caching Results**: Store computed results keyed by their inputs (memoization). When the same input is encountered again, return the cached value in O(1) instead of recomputing. This is the core idea behind dynamic programming with memoization.

## Common Mistakes to Avoid

1. **Forgetting to handle hash collisions conceptually**: Every hash table implementation must handle collisions. Assuming a hash function guarantees uniqueness leads to silent data loss or corruption.

2. **Using the wrong hash function for custom objects**: The default \`GetHashCode()\` / \`hashCode()\` / \`__hash__()\` on a mutable object may change when fields mutate. If the hash changes after insertion, the key is lost in the table — never use mutable objects as keys.

3. **Not considering worst-case O(n) time**: In the worst case (all keys collide), every operation degrades to O(n). This can be exploited in denial-of-service attacks. Use a well-distributed hash function and a randomized seed in production.

4. **Overusing hashing when sorting would be cleaner**: If you need ordered traversal, range queries, or nearest-neighbor lookups, a balanced BST or sorted array is more appropriate. Hashing destroys ordering information.

5. **Using mutable objects as keys without proper hashing**: A mutable object whose equality can change is a ticking time bomb as a hash key. If you must use a mutable object, ensure its hash code depends only on immutable fields, or use a copy on insertion.

## When to Use / When Not to Use

### Use Hashing When
- You need O(1) average lookup, insertion, or deletion by key.
- The data has no meaningful ordering requirement.
- You are counting, grouping, or deduplicating elements.
- You need a cache or memoization structure.
- The key space is sparse relative to the value range (e.g., storing data for 10,000 students among a possible 10 million IDs).

### Do Not Use Hashing When
- You need ordered iteration, range queries (\`find all keys between X and Y\`), or sorted output.
- The dataset is small (a linear scan or array lookup may be faster with less overhead).
- You need guaranteed worst-case performance (use balanced BSTs or sorted arrays instead).
- Memory is extremely constrained and you cannot load the full table.
- The keys are not efficiently hashable (e.g., very large strings hashed repeatedly in a hot loop with no caching).

## Implementation Guide

Below is a minimal hash table implementation using separate chaining. This demonstrates the core mechanics without language-specific STL wrappers.

\`\`\`
class HashTable:
    def __init__(self, capacity=16):
        self.capacity = capacity
        self.size = 0
        self.buckets = [[] for _ in range(capacity)]

    def _hash(self, key):
        return hash(key) % self.capacity

    def insert(self, key, value):
        idx = self._hash(key)
        bucket = self.buckets[idx]
        for i, (k, v) in enumerate(bucket):
            if k == key:
                bucket[i] = (key, value)
                return
        bucket.append((key, value))
        self.size += 1

    def search(self, key):
        idx = self._hash(key)
        for k, v in self.buckets[idx]:
            if k == key:
                return v
        return None

    def delete(self, key):
        idx = self._hash(key)
        bucket = self.buckets[idx]
        for i, (k, v) in enumerate(bucket):
            if k == key:
                bucket.pop(i)
                self.size -= 1
                return True
        return False
\`\`\`

## Complexity Analysis

| Operation | Average Case | Worst Case |
|-----------|-------------|------------|
| Insert    | O(1)        | O(n)       |
| Search    | O(1)        | O(n)       |
| Delete    | O(1)        | O(n)       |
| Space     | O(n)        | O(n)       |

## Practice Problems

1. **Two Sum** (Easy)
2. **Valid Anagram** (Easy)
3. **Group Anagrams** (Medium)
4. **Top K Frequent Elements** (Medium)
5. **Longest Consecutive Sequence** (Medium)

## Review Questions

1. Why does a hash table achieve O(1) average time?
2. What is a collision, and what are the two main strategies for handling collisions?
3. Why should you never use a mutable object as a hash key?
4. When would you choose a sorted array or BST over a hash table?
5. What is load factor, and why does it matter for performance?

## Summary

Hashing is the foundational technique for O(1) average-time lookups, insertions, and deletions by key. Recognize the pattern whenever you need to count frequencies, find complements, detect duplicates, or cache results.
`
  },
  {
    topicId: "two-pointers",
    title: "Two Pointers",
    description: "Two Pointers is a pattern where two pointers iterate through a data structure in a coordinated way. It often reduces O(n^2) brute-force solutions to O(n).",
    estimatedMinutes: 25,
    difficulty: "beginner",
    tags: ["two-pointers","arrays","algorithms","dsa","beginner","strings"],
    noteContent: `# Two Pointers

## Overview

The Two Pointers technique is a fundamental algorithmic pattern where two pointer variables traverse a data structure -- typically an array or string -- in a coordinated fashion. Instead of nesting loops (which yields O(n^2) time), two pointers exploit structure like sortedness or linearity to solve problems in a single pass (O(n) time with O(1) space).

## Key Concepts

Three primary pointer patterns arise in practice:

**1. Opposite-Direction (Left and Right)**
Start at opposite ends and move toward each other.

**2. Same-Direction (Slow and Fast / Sliding Window)**
Both start at the same end and move forward at different speeds.

**3. Fast/Slow for Cycle Detection (Floyd's Tortoise and Hare)**
One pointer moves one step, the other two steps. Detects cycles in linked lists.

## Pattern Recognition

- **Sorted array involved** — strongest signal for opposite-direction two pointers.
- **Need to find a pair satisfying a condition**
- **Comparing elements from both ends**
- **Partitioning or rearranging elements** — slow/fast pointer.
- **Detecting cycles** — Floyd's algorithm.

## Common Mistakes

- Not handling when pointers cross.
- Forgetting to move both pointers when condition is met.
- Incorrect pointer initialization (off-by-one).
- Infinite loops due to wrong increment logic.

## When to Use

Use when you have a sorted array, need palindrome checks, in-place partitioning, or cycle detection.

Avoid when data is unsorted and sorting would change the answer, or when dealing with tree/graph structures.

## Complexity Analysis

- **Time:** O(n) — each pointer traverses at most once.
- **Space:** O(1) — only a few integer variables.

## Practice Problems

1. **Valid Palindrome** (Easy)
2. **Two Sum II (Sorted Array)** (Medium)
3. **3Sum** (Medium)
4. **Container With Most Water** (Medium)
5. **Trapping Rain Water** (Hard)

## Summary

Two Pointers replaces nested loops with coordinated pointer movement. The three variants — opposite-direction, same-direction, and cycle-detection — cover palindromes, pair-search, partitioning, and cycle detection. With O(n) time and O(1) space, it is often the most efficient solution available.
`
  },
  {
    topicId: "lms-unit1-sliding-window",
    title: "Sliding Window Technique",
    description: "Sliding Window is a technique for finding a subarray or substring that satisfies a condition. It optimizes brute-force O(n^2) or O(n^3) approaches to O(n).",
    estimatedMinutes: 45,
    difficulty: "intermediate",
    tags: ["sliding-window","two-pointers","arrays","strings","algorithms","dsa","unit-1"],
    noteContent: `# Sliding Window Technique

## Overview

The Sliding Window technique reduces nested loops that iterate over contiguous subsequences into a single pass. Instead of recalculating from scratch for every subarray, you slide a "window" of fixed or variable size across the sequence and update only the elements entering and leaving the window.

## Key Concepts

- **Window**: A contiguous segment defined by left and right pointers.
- **Fixed-size window**: Window length is constant.
- **Dynamic-size window**: Window expands and contracts based on a condition.
- **Window state**: A data structure tracking relevant window contents.

## Pattern Recognition

- "Contiguous subarray or substring"
- "Maximum sum of any subarray of size k" — fixed window.
- "Longest substring without repeating characters" — dynamic window.

## Common Mistakes

1. Forgetting to shrink the window when condition is violated.
2. Not tracking window contents correctly.
3. Confusing fixed-size vs. dynamic-size.
4. Off-by-one in boundary calculations (length = right - left + 1).

## Implementation Guide

**Fixed-size window:**
\`\`\`
left = 0; current = 0; best = 0
for right in range(len(arr)):
    current += arr[right]
    if right - left + 1 == k:
        best = max(best, current)
        current -= arr[left]
        left += 1
\`\`\`

**Dynamic-size window:**
\`\`\`
left = 0; best = 0
for right in range(len(arr)):
    add arr[right] to tracking
    while not condition(tracking):
        remove arr[left] from tracking
        left += 1
    update best
\`\`\`

## Complexity Analysis

- **Time:** O(n) — each element added once, removed at most once.
- **Space:** O(1) or O(k) where k is the charset size.

## Practice Problems

1. Best Time to Buy and Sell Stock (Easy)
2. Longest Substring Without Repeating Characters (Medium)
3. Minimum Size Subarray Sum (Medium)
4. Permutation in String (Medium)
5. Longest Repeating Character Replacement (Medium)

## Summary

Sliding Window replaces brute-force nested loops over contiguous subsequences with a single pass. Two flavors: fixed-size (constant length) and dynamic-size (expand/contract based on condition).
`
  },
  {
    topicId: "prefix-sum",
    title: "Prefix Sum",
    description: "Prefix Sum (or cumulative sum) precomputes running totals to answer range sum queries in O(1) time after O(n) preprocessing.",
    estimatedMinutes: 35,
    difficulty: "beginner",
    tags: ["prefix-sum","cumulative-sum","range-query","array","subarray","unit-1"],
    noteContent: `# Prefix Sum

## Overview

Prefix Sum (also called cumulative sum) precomputes running totals of an array so that range sum queries can be answered in constant O(1) time.

## Key Concepts

- **Prefix array**: \`prefix[0] = 0\`, \`prefix[i+1] = prefix[i] + arr[i]\`
- **Range sum**: \`sum(i..j) = prefix[j+1] - prefix[i]\`
- **2D Prefix Sum**: Uses inclusion-exclusion for matrix range sums.
- **Hash map extension**: Solves "subarray sum equals K" problems.

## Pattern Recognition

- Range sum queries on a static array.
- Subarray sum equals target.
- Finding pivot/equilibrium indices.
- 2D range queries on a fixed matrix.

## Common Mistakes

1. Off-by-one in range queries (prefix[j+1] - prefix[i]).
2. Forgetting prefix[0] = 0 initialization.
3. Not handling negative prefix sums.

## When to Use

Use when array is static and you need fast repeated range sum queries.

Avoid when array changes frequently (use Fenwick tree / segment tree).

## Implementation Guide

\`\`\`
prefix[0] = 0
for i in range(n):
    prefix[i+1] = prefix[i] + arr[i]

def range_sum(i, j):
    return prefix[j+1] - prefix[i]
\`\`\`

## Complexity Analysis

- **Time:** O(n) preprocessing, O(1) per query.
- **Space:** O(n).

## Practice Problems

1. Range Sum Query - Immutable (Easy)
2. Find Pivot Index (Easy)
3. Subarray Sum Equals K (Medium)
4. Continuous Subarray Sum (Medium)
5. Range Sum Query 2D - Immutable (Medium)

## Summary

Prefix Sum trades O(n) space for O(1) range sum queries. Core technique for 1D and 2D range queries and subarray-target problems via hash map augmentation.
`
  },
  {
    topicId: "kadanes-algorithm",
    title: "Kadane's Algorithm",
    description: "Kadane's Algorithm finds the maximum sum subarray in O(n) time by tracking the best subarray ending at each position. It is a foundational DP/greedy pattern.",
    estimatedMinutes: 35,
    difficulty: "intermediate",
    tags: ["Kadane's Algorithm","Dynamic Programming","Greedy","Maximum Subarray","Array","Unit 1","DSA"],
    noteContent: `# Kadane's Algorithm

## Overview

Kadane's Algorithm finds the **maximum sum of a contiguous subarray** in O(n) time and O(1) space. It processes the array in a single pass by deciding at each position whether to extend the best subarray ending at the previous index or start fresh at the current element.

## Key Concepts

- **Local optimum (current_max):** Best sum ending at current index i.
- **Global optimum (global_max):** Best sum seen so far.
- **Restart decision:** \`current_max = max(arr[i], current_max + arr[i])\`
- Works correctly even when all elements are negative (returns the largest/least negative).

## Pattern Recognition

- "Maximum / minimum subarray sum"
- "Contiguous subarray with the best value"
- "Stock profit with one transaction"
- "Array with both positive and negative numbers"
- "Circular array" — use complement: total - min subarray

## Common Mistakes

1. Resetting to 0 instead of the current element on all-negative arrays.
2. Forgetting the all-negative edge case.
3. Confusing Kadane with Sliding Window.
4. Initializing with 0 instead of arr[0].

## Implementation

\`\`\`
function kadane(arr) {
    if (arr.length === 0) return 0;
    let currentMax = arr[0];
    let globalMax = arr[0];
    for (let i = 1; i < arr.length; i++) {
        currentMax = Math.max(arr[i], currentMax + arr[i]);
        globalMax = Math.max(globalMax, currentMax);
    }
    return globalMax;
}
\`\`\`

## Complexity Analysis

- **Time:** O(n) — single linear pass.
- **Space:** O(1) — two scalar variables.

## Practice Problems

1. Maximum Subarray (Medium)
2. Maximum Product Subarray (Medium)
3. Maximum Sum Circular Subarray (Medium)
4. Best Time to Buy and Sell Stock (Easy)

## Summary

Kadane's Algorithm solves the maximum subarray problem in O(n) time and O(1) space. The key insight: at each element, the optimal decision is to extend the running subarray or start fresh.
`
  },
  {
    topicId: "lms-dsa-unit1-binary-search",
    title: "Binary Search",
    description: "Binary Search reduces search space by half each iteration, achieving O(log n) time. One of the most important and commonly misimplemented algorithms.",
    estimatedMinutes: 25,
    difficulty: "intermediate",
    tags: ["DSA","Binary Search","Unit 1","Divide and Conquer","Algorithms"],
    noteContent: `# Binary Search

## Overview

Binary Search locates a target value within a **sorted array** by repeatedly dividing the search interval in half. Each step cuts the remaining search space in half, providing exponential speedup over linear scanning.

## Key Concepts

- **Sorted precondition**: Input must be sorted.
- **Midpoint**: \`mid = left + Math.floor((right - left) / 2)\` — avoids overflow.
- **Loop invariant**: All elements before left are < target; elements at or after right are >= target.
- **Divide and conquer**: Reduces problem of size n to n/2 in constant time.

## Pattern Recognition

| Pattern | Example |
|---------|---------|
| Exact match | Standard Binary Search |
| Boundary / first-last | Search Insert Position |
| Rotated search | Search in Rotated Sorted Array |
| Monotonic predicate | Capacity To Ship Packages |

## Common Mistakes

1. Off-by-one errors with \`<\` vs \`<=\`.
2. Infinite loops when left and right become adjacent.
3. Not handling empty arrays.
4. Using \`(left + right) / 2\` which overflows for large arrays.

## Lower Bound Template

\`\`\`
function lowerBound(arr, target) {
    let left = 0, right = arr.length;
    while (left < right) {
        const mid = left + Math.floor((right - left) / 2);
        if (arr[mid] < target) left = mid + 1;
        else right = mid;
    }
    return left;
}
\`\`\`

## Complexity Analysis

- **Time:** O(log n).
- **Space:** O(1) iterative.

## Practice Problems

1. Binary Search (Easy)
2. Search Insert Position (Easy)
3. Find Minimum in Rotated Sorted Array (Medium)
4. Search in Rotated Sorted Array (Medium)
5. Find First and Last Position (Medium)

## Summary

Binary Search exploits data ordering for exponential performance gains. The three pillars: sorted precondition, monotonic predicate, and clear loop invariant.
`
  },
  {
    topicId: "bit-manipulation",
    title: "Bit Manipulation",
    description: "Bit Manipulation uses bitwise operations to solve problems efficiently. Enables O(1) space solutions, state compression, and elegant mathematical tricks.",
    estimatedMinutes: 35,
    difficulty: "intermediate",
    tags: ["bit-manipulation","bitwise-operations","state-compression","dsa","unit-1"],
    noteContent: `# Bit Manipulation

## Overview

Bit manipulation operates directly on binary representation using bitwise operators. These are the fastest CPU instructions available. Mastery unlocks constant-space solutions, state compression DP, and elegant mathematical shortcuts.

## Key Operators

| Operator | Name | Behavior |
|----------|------|----------|
| & | AND | 1 if both bits are 1 |
| | | OR | 1 if at least one bit is 1 |
| ^ | XOR | 1 if bits differ |
| ~ | NOT | Flips every bit |
| << | Left shift | Multiply by 2^k |
| >> | Right shift | Divide by 2^k (sign-extending) |

## Key Techniques

- **Brian Kernighan's popcount**: \`n &= n - 1\` clears lowest set bit.
- **Isolate lowest set bit**: \`n & -n\`.
- **Power of two**: \`n > 0 && (n & (n - 1)) === 0\`.
- **XOR properties**: \`x ^ x = 0\`, \`x ^ 0 = x\`, commutative.

## Common Mistakes

1. Operator precedence: \`n & (1 << i) === 0\` evaluates wrong — parenthesize!
2. Sign bit in right shifts — use unsigned types.
3. \`~n\` is not \`-n\`; it's \`-n - 1\`.

## Complexity Analysis

- Each bitwise operation: O(1), 1 CPU cycle.
- Popcount: O(number of 1 bits) for Kernighan, O(1) for CPU intrinsic.

## Practice Problems

1. Single Number (Easy)
2. Number of 1 Bits (Easy)
3. Counting Bits (Easy)
4. Missing Number (Easy)
5. Reverse Bits (Easy)

## Summary

Six operators combine for ultra-efficient constant-space solutions. Key patterns: power-of-two checks, XOR cancellation, subset masks, and parity operations.
`
  },
  {
    topicId: "layer-1-review-core-patterns",
    title: "Layer 1 Review: Core Patterns",
    description: "Mixed pattern problems drawing from all Layer 1 topics: arrays, hashing, two pointers, sliding window, prefix sum, Kadane, binary search, and bit manipulation.",
    estimatedMinutes: 45,
    difficulty: "intermediate",
    tags: ["arrays","hashing","two-pointers","sliding-window","prefix-sum","kadane","binary-search","bit-manipulation","dsa","layer-1","review"],
    noteContent: `# Layer 1 Review: Core Patterns

## Overview

This review consolidates every foundational pattern from Layer 1. Unlike earlier units where the topic was given, here you must identify the correct technique from the problem statement alone.

## Key Concepts

- **Pattern-first analysis**: Classify the problem by its constraints before writing code.
- **Multi-pattern composition**: A problem may require layering multiple techniques.
- **Constraint-driven decision tree**: Each constraint eliminates certain approaches.
- **Optimization trajectory**: Brute force -> identify bottleneck -> apply the matching pattern.

## Decision Framework

| Clue in Problem | Likely Pattern |
|---|---|
| Input is sorted | Binary search or Two pointers |
| Need subarray or substring | Sliding window or Prefix sum |
| Find max/min subarray sum | Kadane's algorithm |
| O(1) space + unsorted | Bit manipulation |
| Count pairs or triplets | Two pointers (after sorting) or Hashing |
| "Contiguous" + "sum equals k" | Prefix sum + hash map |

## Common Mistakes

- Jumping to a solution without analyzing problem structure.
- Overcomplicating when a simple pattern suffices.
- Misidentifying due to surface-level features.
- Not considering constraints before choosing an approach.

## Complexity Comparison

| Pattern | Time | Space |
|---------|------|-------|
| Hashing | O(n) avg | O(n) |
| Two Pointers | O(n) | O(1) |
| Sliding Window | O(n) | O(1) or O(k) |
| Prefix Sum | O(n) pre / O(1) query | O(n) |
| Kadane | O(n) | O(1) |
| Binary Search | O(log n) | O(1) |
| Bit Manipulation | O(n) | O(1) |

## Summary

Classify before coding. Constraints are the fastest path to the right pattern. Start simple, then optimize. Every pattern has a "when not to use" rule.
`
  },
  {
    topicId: "unit-1-core-problem-solving",
    title: "Core Problem Solving",
    description: "Master the fundamental patterns that appear in 70% of interview problems. Build mental models for array manipulation, fast lookup, and efficient searching.",
    estimatedMinutes: 30,
    difficulty: "beginner",
    tags: ["array-manipulation","hash-map","two-pointer","binary-search","sliding-window","problem-solving-patterns","interview-preparation"],
    noteContent: `# Core Problem Solving

## Overview

Core Problem Solving is the foundation of technical interviews. Roughly 70% of coding interview problems reduce to a handful of recurring patterns: array traversal, hash-map lookups, and two-pointer techniques.

## Key Concepts

### Array Manipulation
- Traversal and sliding window
- In-place modification
- Prefix sums

### Fast Lookup with Hash Maps
- Complement / two-sum pattern
- Frequency counting
- Caching computed results

### Efficient Searching
- Binary search — requires sorted array
- Two-pointer technique

## Pattern Recognition Flow

1. **Can I use a hash map?** — existence, frequency, complements.
2. **Is the input sorted?** — binary search or two pointers.
3. **Is it a contiguous subarray?** — sliding window.

## Common Mistakes

- Forgetting edge cases (empty arrays, single element).
- Off-by-one errors in binary search.
- Modifying an array while iterating.
- Overlooking constraints (e.g., O(1) space).

## Implementation Examples

**Two-Sum (Hash Map):**
\`\`\`
map = {}
for i in range(len(nums)):
    complement = target - nums[i]
    if complement in map: return [map[complement], i]
    map[nums[i]] = i
\`\`\`

**Binary Search:**
\`\`\`
while left <= right:
    mid = left + (right - left) // 2
    if arr[mid] == target: return mid
    else if arr[mid] < target: left = mid + 1
    else: right = mid - 1
\`\`\`

## Practice Problems

1. Two Sum (LeetCode 1)
2. Valid Palindrome (LeetCode 125)
3. Best Time to Buy and Sell Stock (LeetCode 121)
4. Contains Duplicate (LeetCode 217)
5. Binary Search (LeetCode 704)

## Summary

Three foundational patterns — hash maps, two pointers, binary search — cover the majority of beginner-to-intermediate interview problems. Always start by asking: can I use a hash map? Is the data sorted? Is it a contiguous subarray problem?
`
  },
  {
    topicId: "recursion-unit2",
    title: "Recursion",
    description: "Recursion is a function calling itself to solve smaller instances of the same problem. It is the foundation of all divide-and-conquer and backtracking algorithms.",
    estimatedMinutes: 25,
    difficulty: "beginner",
    tags: ["recursion","divide-and-conquer","backtracking","call-stack","memoization"],
    noteContent: `# Recursion

## Overview

Recursion is a programming technique where a function calls itself to solve smaller instances of the same problem. It is the conceptual foundation of divide-and-conquer algorithms, backtracking, tree and graph traversals, and dynamic programming.

## Key Concepts

- **Base Case**: Condition under which the function returns directly without recursing.
- **Recursive Case**: The function calls itself with a modified argument moving toward the base case.
- **Call Stack**: Each call pushes a frame; when base case is reached, frames pop in reverse order.
- **Memoization**: Caching results of expensive recursive calls to avoid recomputation.

## Pattern Recognition

1. Problem can be broken into smaller identical subproblems.
2. Tree-like structure involved.
3. Need to explore all combinations.
4. Base case and recursive case are natural.

## Common Mistakes

- Missing or incorrect base case.
- No progress toward the base case.
- Not understanding call stack depth limits.
- Confusing recursion with iteration.

## Implementation Guide

\`\`\`
function recursiveSolution(input) {
    // Step 1: Base case
    if (input is trivial) return knownAnswer;

    // Step 2: Recursive case
    const smallerInput = reduce(input);
    const partialResult = recursiveSolution(smallerInput);
    return combine(partialResult, input);
}
\`\`\`

## Complexity Analysis

- **Time**: Varies. Without memoization, exponential for overlapping subproblems.
- **Space**: O(d) where d is max recursion depth.

## Practice Problems

1. Climbing Stairs (Easy)
2. Fibonacci Number (Easy)
3. Reverse Linked List (Recursive) (Easy)
4. Pow(x, n) (Medium)
5. Merge Two Sorted Lists (Easy)

## Summary

Recursion solves problems by calling itself on smaller instances. The two pillars are base case (termination) and recursive case (decomposition). Master it to unlock divide-and-conquer, backtracking, and dynamic programming.
`
  },
  {
    topicId: "backtracking",
    title: "Backtracking",
    description: "Backtracking is a systematic way of trying out different sequences of decisions until a solution is found. It prunes paths that cannot lead to valid solutions.",
    estimatedMinutes: 30,
    difficulty: "intermediate",
    tags: ["DSA","Algorithms","Backtracking","Recursion","Combinatorial Search","Unit 2"],
    noteContent: `# Backtracking

## Overview

Backtracking solves problems incrementally by trying partial solutions and abandoning them the moment they are determined to be invalid. It is a depth-first search over a state-space tree that prunes branches which cannot lead to a valid solution.

## Key Concepts

- **State (Path):** The partial solution built so far.
- **Choices:** Candidates available at each decision point.
- **Constraints:** Rules the solution must satisfy. Prune if violated.
- **Goal / Base Case:** Complete valid solution found.
- **Undo (Backtrack):** Revert state after exploring a choice.

## Pattern Recognition

| Clue | Example |
|------|---------|
| "Find all combinations / permutations / subsets" | Generate every subset |
| "Constraint satisfaction" | N-Queens, Sudoku |
| "Need to explore a decision tree" | Include or exclude each element |
| "Can prune invalid branches early" | Sum exceeding target |

## Common Mistakes

1. Not undoing changes after the recursive call.
2. Missing the base case.
3. Not pruning early enough.
4. Using mutable state without careful push/pop discipline.

## Implementation Template

\`\`\`
function backtrack(path, remaining) {
    if (isValidSolution(path)) {
        result.push([...path]);
        return;
    }
    for (const choice of remaining) {
        if (!isValidPartial(path, choice)) continue;
        path.push(choice);
        backtrack(path, remaining.filter(c => c !== choice));
        path.pop();
    }
}
\`\`\`

## Complexity Analysis

- **Time:** O(branches^depth) worst case.
- **Space:** O(depth) for call stack + path.

## Practice Problems

1. Subsets (Medium)
2. Permutations (Medium)
3. Combination Sum (Medium)
4. Combination Sum II (Medium)
5. N-Queens (Hard)

## Summary

Backtracking is DFS over a decision tree with pruning. Three pillars: state, choices, constraints. Always pair a choice with its undo, define a clear base case, and prune as early as possible.
`
  },
  {
    topicId: "dsa-unit2-divide-and-conquer",
    title: "Divide and Conquer",
    description: "Divide and Conquer breaks a problem into independent subproblems, solves each recursively, and combines the results. Classic examples include Merge Sort and Quick Sort.",
    estimatedMinutes: 25,
    difficulty: "intermediate",
    tags: ["divide-and-conquer","sorting","recursion","merge-sort","quick-sort","algorithms","complexity-analysis"],
    noteContent: `# Divide and Conquer

## Overview

Divide and Conquer solves a problem by breaking it into smaller, independent subproblems, solving each recursively, and combining results. It powers Merge Sort, Quick Sort, and binary search.

## Key Concepts

1. **Divide** — Split input into independent subproblems.
2. **Conquer** — Recursively solve each subproblem.
3. **Combine** — Merge subproblem solutions into the final answer.

**Stability**: Merge Sort is stable; Quick Sort is not.

## Pattern Recognition

- Problem can be split into independent halves.
- Subproblems do not overlap (otherwise use DP).
- Ordering or sorting is the core operation.
- Operation is amenable to parallel processing.

## Common Mistakes

- Incorrect split point (off-by-one in midpoint).
- Not handling base case for small arrays.
- Off-by-one in merge step (draining both halves).
- Assuming Quick Sort is stable.

## Merge Sort Implementation

1. Divide: Split at midpoint.
2. Conquer: Recursively sort both halves.
3. Combine: Two-pointer merge into temporary array.

## Complexity Analysis

| Metric | Value |
|--------|-------|
| Time (typical) | O(n log n) |
| Time (worst) | O(n^2) for naive Quick Sort; O(n log n) for Merge Sort |
| Space (stack) | O(log n) for balanced D&C |
| Space (aux) | O(n) for Merge Sort; O(1) for in-place Quick Sort |

## Summary

Divide and Conquer achieves O(n log n) performance by decomposing problems into independent subproblems. Key: recognize the independence pattern — if subproblems share data, use Dynamic Programming instead.
`
  },
  {
    topicId: "dsa-sorting-algorithms",
    title: "Sorting Algorithms",
    description: "Sorting arranges elements in a defined order. Covers comparison-based sorts (Merge, Quick, Heap) and linear-time sorts (Counting, Radix, Bucket).",
    estimatedMinutes: 55,
    difficulty: "intermediate",
    tags: ["sorting","algorithms","merge-sort","quick-sort","heap-sort","counting-sort","radix-sort","quick-select","dsa"],
    noteContent: `# Sorting Algorithms

## Overview

Sorting arranges elements in a defined order. Mastering sorting means understanding the tradeoff between generality (comparison-based sorts) and efficiency (linear-time sorts exploiting data structure).

## Key Concepts

- **Comparison-based sorting**: Lower bound is O(n log n).
- **Linear-time sorting**: Counting, Radix, Bucket sorts achieve O(n + k).
- **Stability**: Preserves relative order of equal elements.
- **In-place vs. out-of-place**: Quick Sort uses O(log n) space; Merge Sort uses O(n).

## Pattern Recognition

| Pattern | Approach |
|---------|----------|
| General ordering | Built-in sort (Timsort) |
| Custom comparator | Lambda to built-in sort |
| Small integer range | Counting Sort O(n + k) |
| Top k elements | Quick Select O(n) avg |
| 2-3 distinct values | Dutch national flag (3-way partition) |

## Common Mistakes

1. Defaulting to O(n log n) when linear-time sort is optimal.
2. Not considering stability requirements.
3. Implementing sort from scratch when built-in suffices.
4. Bad pivot selection in Quick Sort.

## Complexity Comparison

| Sort | Average | Worst | Space | Stable |
|------|---------|-------|-------|--------|
| Merge Sort | O(n log n) | O(n log n) | O(n) | Yes |
| Quick Sort | O(n log n) | O(n^2) | O(log n) | No |
| Heap Sort | O(n log n) | O(n log n) | O(1) | No |
| Counting Sort | O(n + k) | O(n + k) | O(k) | Yes |
| Radix Sort | O(d(n+k)) | O(d(n+k)) | O(n+k) | Yes |

## Summary

Choose sort based on constraints: built-in for general ordering; Counting/Radix when data has structure; Merge Sort for stability; Quick Select for order statistics.
`
  },
  {
    topicId: "l2-recursive-thinking-review",
    title: "Layer 2 Review: Recursive Thinking",
    description: "Mixed pattern problems from recursion, backtracking, divide-and-conquer, and sorting algorithms.",
    estimatedMinutes: 50,
    difficulty: "intermediate",
    tags: ["recursion","backtracking","divide-and-conquer","sorting","dsa","unit-2"],
    noteContent: `# Layer 2 Review: Recursive Thinking

## Overview

This review synthesizes recursion, backtracking, divide-and-conquer, and sorting into a unified framework. The ability to classify a problem into the correct pattern is the gatekeeper skill for the rest of your DSA journey.

## Key Concepts

- **Recursion**: Function calls itself with reduced input (factorial, tree traversal).
- **Backtracking**: Stateful recursion with choose-explore-unchoose pattern.
- **Divide-and-Conquer**: Split, solve independently, combine (merge sort, binary search).
- **Sorting**: Partition/merge focused on ordering elements.

## Pattern Recognition

| Signal | Pattern |
|--------|---------|
| "All possible..." or "Find all ways" | Backtracking |
| Single output, no branching | Basic recursion |
| Split input, combine result | Divide-and-conquer |
| Inversions, ordering constraints | Sorting (modified merge) |

## Common Mistakes

- Using backtracking when D&C suffices.
- Forgetting the unchoose step.
- Wrong base case for D&C.
- Modifying shared mutable state in recursion.
- Confusing partition indices.

## Complexity Comparison

| Pattern | Time | Space |
|---------|------|-------|
| Basic recursion (linear) | O(n) per chain | O(n) stack |
| Backtracking (exhaustive) | O(branches^depth) | O(depth) + O(path) |
| D&C (balanced) | O(n log n) | O(log n) + O(n) combine |
| Sorting (comparison) | O(n log n) | O(n) for merge |

## Summary

Key is pattern recognition: scan for signals (exhaustive enumeration, independent subproblems, ordering constraints) before reaching for a solution.
`
  },
  {
    topicId: "dsa-unit2-recursive-thinking",
    title: "Recursive Thinking",
    description: "Develop the ability to think recursively and explore solution spaces systematically. The gateway to backtracking, divide-and-conquer, and dynamic programming.",
    estimatedMinutes: 45,
    difficulty: "intermediate",
    tags: ["recursion","backtracking","divide-and-conquer","dynamic-programming","call-stack","algorithmic-paradigms","unit-2"],
    noteContent: `# Recursive Thinking

## Overview

Recursive thinking solves a problem by reducing it to smaller instances of the same problem. It is the foundational paradigm for backtracking, divide-and-conquer, and dynamic programming.

## Key Concepts

- **Base Case and Recursive Case**: Every recursive definition has both.
- **The Recursive Leap of Faith**: Assume the recursive call returns the correct answer.
- **Call Stack and Frames**: Deep recursion can exhaust memory.
- **Problem Decomposition Patterns**: Linear recursion, tree recursion, mutual recursion.

## Pattern Recognition

- Problem is defined in terms of itself.
- Data structure is recursively defined (lists, trees).
- Solution can be expressed as a recurrence relation.
- Multiple branches of a decision tree need exploration.
- Overlapping subproblems exist (dynamic programming).

## Common Mistakes

- Forgetting the base case or making it unreachable.
- Returning wrong type or forgetting to combine results.
- Modifying shared mutable state across frames unintentionally.
- Attempting to trace every frame.

## Implementation Guide

\`\`\`
function recursiveSolve(problem) {
    if (problem is minimal) return directAnswer(problem);
    const subproblem = reduce(problem);
    const subResult = recursiveSolve(subproblem);
    return combine(subResult, problem);
}
\`\`\`

## Complexity Analysis

Use Master Theorem: T(n) = a * T(n/b) + f(n).

Space complexity is at least O(d) where d is max recursion depth.

## Summary

Recursive thinking requires: (1) identifying base case and reduction step; (2) trusting the recursive call; (3) understanding call stack implications.
`
  },
  {
    topicId: "linked-lists",
    title: "Linked Lists",
    description: "A linked list is a linear data structure where elements are stored in nodes, each pointing to the next. Unlike arrays, elements are not stored contiguously.",
    estimatedMinutes: 35,
    difficulty: "beginner",
    tags: ["linked-lists","data-structures","dsa","unit-3","linear-data-structures"],
    noteContent: `# Linked Lists

## Overview

A linked list stores elements in nodes, each holding data and a pointer to the next node. Unlike arrays, nodes are non-contiguous in memory. This trades direct-index access for O(1) insertions and deletions.

## Key Concepts

- **Node**: Data + next pointer (and prev for doubly linked).
- **Head**: Reference to first node.
- **Tail**: Last node, next is null.
- **Dummy (Sentinel) Node**: Eliminates special-case logic for boundary operations.

## Pattern Recognition

- Frequent insertions and deletions at arbitrary positions.
- Unknown or dynamic size.
- Frequent rearrangement (reversal, partitioning, merging).
- Building stacks, queues, adjacency lists.

## Common Mistakes

1. Forgetting to update next pointers.
2. Losing reference to the rest of the list.
3. Not handling head as a special case.
4. Infinite loops from cycles.

## Implementation (Reversal)

\`\`\`
prev = null, curr = head
while curr:
    next = curr.next
    curr.next = prev
    prev = curr
    curr = next
return prev
\`\`\`

## Complexity Analysis

| Operation | Time | Notes |
|-----------|------|-------|
| Access by index | O(n) | Must traverse |
| Insert at head | O(1) | |
| Insert at tail | O(n) | O(1) with tail pointer |
| Delete at head | O(1) | |
| Space | O(n) | Per-node overhead |

## Practice Problems

1. Reverse Linked List (Easy)
2. Merge Two Sorted Lists (Easy)
3. Linked List Cycle (Easy)
4. Linked List Cycle II (Medium)
5. Remove Nth Node From End (Medium)

## Summary

Linked lists excel where frequent insertions/deletions are needed and size is unknown. Weakness: O(n) access time. Master pointer manipulation and dummy nodes for clean code.
`
  },
  {
    topicId: "stack-unit3",
    title: "Stack & Monotonic Stack",
    description: "A Stack is a LIFO (Last-In-First-Out) data structure. Elements are added and removed from the same end. The monotonic stack variant is particularly powerful.",
    estimatedMinutes: 30,
    difficulty: "beginner",
    tags: ["stack","data-structures","lifo","monotonic-stack","algorithms","dsa","unit-3"],
    noteContent: `# Stack & Monotonic Stack

## Overview

A Stack follows Last-In-First-Out (LIFO). The most recently added element is the first removed. The monotonic stack extends this with an ordering invariant for range-query problems.

## Key Concepts

- **Push** — Add to top.
- **Pop** — Remove from top.
- **Peek** — View top without removing.
- **Monotonic Increasing Stack**: Elements in non-decreasing order. Find next/previous smaller.
- **Monotonic Decreasing Stack**: Elements in non-increasing order. Find next/previous greater.

## Pattern Recognition

| Pattern | Example |
|---------|---------|
| LIFO ordering needed | Undo, browser back |
| Expression evaluation | Infix to postfix |
| Parentheses matching | Valid Parentheses |
| Next greater/smaller element | Daily Temperatures |
| Monotonic stack | Largest Rectangle in Histogram |

## Common Mistakes

1. Stack underflow — guard with isEmpty().
2. Not using monotonic stack when applicable.
3. Confusing stack with queue.

## Monotonic Stack Template

\`\`\`
function nextGreaterElement(nums) {
    const result = new Array(nums.length).fill(-1);
    const stack = [];
    for (let i = 0; i < nums.length; i++) {
        while (stack.length && nums[i] > nums[stack[stack.length - 1]]) {
            const idx = stack.pop();
            result[idx] = nums[i];
        }
        stack.push(i);
    }
    return result;
}
\`\`\`

## Complexity Analysis

- All operations: O(1) amortized.
- Space: O(n).

## Practice Problems

1. Valid Parentheses (Easy)
2. Min Stack (Medium)
3. Evaluate Reverse Polish Notation (Medium)
4. Daily Temperatures (Medium)
5. Next Greater Element I (Easy)

## Summary

Stack = LIFO. Use for nested structures, reversal, and "most recent" state. Monotonic variant solves nearest-neighbor comparison problems in O(n) time.
`
  },
  {
    topicId: "queue-fifo-data-structure",
    title: "Queue: FIFO Data Structure",
    description: "A Queue is a FIFO (First-In-First-Out) data structure. Includes Queue, Circular Queue, Deque, and Monotonic Queue.",
    estimatedMinutes: 25,
    difficulty: "beginner",
    tags: ["Queue","FIFO","Circular Queue","Deque","Monotonic Queue","DSA","Data Structures","Unit 3"],
    noteContent: `# Queue: FIFO Data Structure

## Overview

A Queue follows First-In-First-Out (FIFO). The first element inserted is the first removed. Four variants: Simple Queue, Circular Queue, Deque, and Monotonic Queue.

## Key Concepts

- **Enqueue**: Add to rear.
- **Dequeue**: Remove from front.
- **Front (Peek)**: View front element.

| Variant | Property | Use Case |
|---------|----------|----------|
| Simple Queue | Unlimited capacity | General FIFO |
| Circular Queue | Fixed capacity, wraps around | Bounded buffers |
| Deque | Insert/remove both ends | Palindrome, undo/redo |
| Monotonic Queue | Maintains sorted order | Sliding Window Maximum |

## Pattern Recognition

- "FIFO ordering needed"
- "BFS traversal"
- "Task scheduling"
- "Sliding window maximum" (monotonic queue)
- "Producer-consumer pattern"

## Circular Queue Implementation

\`\`\`
class CircularQueue {
    constructor(k) {
        this.queue = new Array(k);
        this.capacity = k;
        this.front = 0;
        this.rear = 0;
        this.size = 0;
    }
    enqueue(value) {
        if (this.isFull()) return false;
        this.queue[this.rear] = value;
        this.rear = (this.rear + 1) % this.capacity;
        this.size++;
        return true;
    }
    dequeue() {
        if (this.isEmpty()) return false;
        this.front = (this.front + 1) % this.capacity;
        this.size--;
        return true;
    }
}
\`\`\`

## Monotonic Queue (Sliding Window Maximum)

\`\`\`
const dq = [];
for (let i = 0; i < nums.length; i++) {
    while (dq.length && dq[0] <= i - k) dq.shift();
    while (dq.length && nums[dq[dq.length - 1]] < nums[i]) dq.pop();
    dq.push(i);
    if (i >= k - 1) result.push(nums[dq[0]]);
}
\`\`\`

## Complexity Analysis

- All operations: O(1) amortized.
- Space: O(k) for monotonic queue.

## Practice Problems

1. Implement Queue using Stacks (Easy)
2. Number of Recent Calls (Easy)
3. Design Circular Queue (Medium)
4. Sliding Window Maximum (Hard)

## Summary

Queue = FIFO. Circular queue reuses memory. Deque allows double-ended access. Monotonic queue solves sliding window extremum problems in O(n) time.
`
  },
];

export default notes;
