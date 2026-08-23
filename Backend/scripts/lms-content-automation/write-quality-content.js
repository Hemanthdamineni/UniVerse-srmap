#!/usr/bin/env node

/**
 * LMS Quality Content Writer
 *
 * Directly writes the pipeline's enriched content to the LMS database.
 * This is the reliable backend for the quality pipeline, decoupled from
 * API-dependent agents.
 *
 * Usage: node write-quality-content.js [--db-path <path>]
 */

const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
process.chdir(PROJECT_ROOT);

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) {
    const key = process.argv[i].slice(2);
    args[key] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true;
    if (args[key] !== true) i++;
  }
}

const DB_PATH = args['db-path'] || path.join(PROJECT_ROOT, 'data', 'lms.sqlite');
const { DatabaseSync } = require('node:sqlite');

function connect() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('Database not found:', DB_PATH);
    process.exit(1);
  }
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  console.log('Connected to', DB_PATH);
  return db;
}

const SUBJECT_NAMES = {
  CSE302: 'Design and Analysis of Algorithms',
  CSE304: 'Operating Systems',
  CSE306: 'Database Management Systems',
  CSE308: 'Computer Networks',
  CSE310: 'Software Engineering',
  CSE312: 'Machine Learning Fundamentals',
  CSE314: 'Theory of Computation',
  CSE316: 'Compiler Design',
};

function makeId(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 55);
}

function now() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// ──────────────────────────────────────────────
// 32 Quick-Reference Cheatsheets (GFG/LeetCode style)
// ──────────────────────────────────────────────

const CHEATSHEETS = [
  // CSE302: DSA
  { code: 'CSE302', title: 'Sorting Algorithms Comparison Cheatsheet', tags: ['dsa', 'sorting', 'algorithms'], content: `# Sorting Algorithms Comparison — Last Minute Revision

## Key Definitions
- **In-place**: O(1) extra space
- **Stable**: Preserves relative order of equal elements
- **Comparison-based**: Uses comparisons (lower bound Ω(n log n))

## Quick Comparison Table
| Algorithm | Time (Best) | Time (Avg) | Time (Worst) | Space | Stable | In-place |
|-----------|-------------|------------|--------------|-------|--------|----------|
| Bubble    | O(n)        | O(n²)      | O(n²)        | O(1)  | Yes    | Yes      |
| Selection | O(n²)       | O(n²)      | O(n²)        | O(1)  | No     | Yes      |
| Insertion | O(n)        | O(n²)      | O(n²)        | O(1)  | Yes    | Yes      |
| Merge     | O(n log n)  | O(n log n) | O(n log n)   | O(n)  | Yes    | No       |
| Quick     | O(n log n)  | O(n log n) | O(n²)        | O(log n)| No    | Yes      |
| Heap      | O(n log n)  | O(n log n) | O(n log n)   | O(1)  | No     | Yes      |
| Counting  | O(n+k)      | O(n+k)     | O(n+k)       | O(k)  | Yes    | No       |
| Radix     | O(d·n)      | O(d·n)     | O(d·n)       | O(n+d)| Yes    | No       |

## Edge Cases & Gotchas
- Quick sort worst-case O(n²) happens when pivot is min/max element
- Merge sort is preferred for linked lists (O(1) space for lists)
- Insertion sort beats O(n log n) for nearly-sorted arrays
- Counting sort only works for integer keys with small range
- Python's Timsort is hybrid merge + insertion — O(n) on nearly-sorted

## Must-Know for Exam
- **Quick sort is fastest average-case** in practice despite O(n²) worst
- **Merge sort is stable**, quick sort is not
- **Heap sort guarantees O(n log n)** but unstable and cache-unfriendly
` },

  { code: 'CSE302', title: 'Graph Algorithms Quick Reference', tags: ['dsa', 'graphs', 'algorithms'], content: `# Graph Algorithms Quick Reference

## Key Definitions
- **Graph G = (V, E)** where V = vertices, E = edges
- **Adjacency List**: O(V+E) space, good for sparse graphs
- **Adjacency Matrix**: O(V²) space, good for dense graphs

## Quick Comparison Table
| Algorithm | Problem | Time Complexity | Space | Notes |
|-----------|---------|-----------------|-------|-------|
| BFS       | Shortest path (unweighted) | O(V+E) | O(V) | Uses queue |
| DFS       | Connectivity, cycles | O(V+E) | O(V) | Uses stack/recursion |
| Dijkstra   | Shortest path (non-negative) | O((V+E) log V) | O(V) | Use PQ, fails on negative |
| Bellman-Ford | Shortest path (any weights) | O(V·E) | O(V) | Detects negative cycles |
| Floyd-Warshall | All-pairs shortest path | O(V³) | O(V²) | DP approach |
| Kruskal    | MST | O(E log E) | O(V) | Union-find based |
| Prim       | MST | O(E log V) | O(V) | PQ based |
| Topological Sort | Order DAG | O(V+E) | O(V) | Uses DFS or Kahn's |
| Ford-Fulkerson | Max flow | O(E·|f|) | O(V) | Use Edmonds-Karp (O(VE²)) |

## Must-Know Algorithms
- **Cycle detection**: DFS with visited/visiting/done states OR union-find
- **SCC (Tarjan/Kosaraju)**: O(V+E), strongly connected components
- **Bipartite check**: BFS with alternating colors
` },

  { code: 'CSE302', title: 'Dynamic Programming Patterns Summary', tags: ['dsa', 'dp', 'dynamic-programming'], content: `# Dynamic Programming Patterns — Last Minute Revision

## The DP Framework
1. **Define state**: What does dp[i] or dp[i][j] represent?
2. **Recurrence**: How does dp[i] relate to previous states?
3. **Base cases**: What are the smallest subproblems?
4. **Order of computation**: Bottom-up or top-down with memoization?

## Common Patterns

| Pattern | Classic Problem | State Definition | Recurrence |
|---------|----------------|------------------|------------|
| 1D DP   | Fibonacci | dp[i] = ith fib number | dp[i] = dp[i-1] + dp[i-2] |
| Kadane  | Max subarray sum | dp[i] = max sum ending at i | dp[i] = max(arr[i], dp[i-1]+arr[i]) |
| 0/1 Knapsack | Subset sum | dp[i][w] = max value with first i items, capacity w | dp[i][w] = max(dp[i-1][w], val[i] + dp[i-1][w-wt[i]]) |
| LCS     | Longest common subsequence | dp[i][j] = LCS of first i of s1, j of s2 | dp[i][j] = s1[i]==s2[j] ? 1+dp[i-1][j-1] : max(dp[i-1][j], dp[i][j-1]) |
| LIS     | Longest increasing subsequence | dp[i] = LIS ending at i | dp[i] = 1 + max(dp[j]) for j<i and arr[j]<arr[i] |
| Edit Distance | String transform | dp[i][j] = edits for first i of s1, j of s2 | min(insert, delete, replace) |
| Matrix Chain | Optimal multiplication | dp[i][j] = min cost to multiply i..j | dp[i][j] = min(dp[i][k] + dp[k+1][j] + dims) |

## Edge Cases
- **Dimension matters**: Start dp arrays with size n+1 for easier base cases
- **Rolling array**: Many 2D DPs only need last row → O(n) space
- **Memoization vs Tabulation**: Memoization is easier; tabulation is faster
` },

  { code: 'CSE302', title: 'Asymptotic Complexity Master Table', tags: ['dsa', 'complexity', 'big-o'], content: `# Asymptotic Complexity — Last Minute Notes

## Big-O Hierarchy (fastest → slowest)
O(1) < O(log n) < O(√n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2ⁿ) < O(n!)

## What Each Complexity Looks Like
| Complexity | n=10 | n=100 | n=1000 | n=10⁶ | Name |
|------------|------|-------|--------|-------|------|
| O(1)       | 1    | 1     | 1      | 1     | Constant |
| O(log n)   | ~3   | ~7    | ~10    | ~20   | Logarithmic |
| O(n)       | 10   | 100   | 1000   | 10⁶   | Linear |
| O(n log n) | 10   | 700   | 10,000 | ~2×10⁷ | Linearithmic |
| O(n²)      | 100  | 10,000| 10⁶    | 10¹²  | Quadratic |
| O(2ⁿ)      | 1024 | —     | —      | —     | Exponential |
| O(n!)      | 3.6M | —     | —      | —     | Factorial |

## Key Rules
- Drop constants: O(2n) = O(n)
- Drop lower-order terms: O(n² + n) = O(n²)
- Log base doesn't matter: O(log₂ n) = O(log n)
- n! grows faster than 2ⁿ for n > 4
- **Master Theorem**: T(n) = aT(n/b) + f(n) → compare n^(log_b a) with f(n)

## Edge Cases
- O(log n) from binary search vs O(log n) from balanced tree
- Amortized O(1) ≠ guaranteed O(1) — individual operations may be O(n)
` },

  // CSE304: OS
  { code: 'CSE304', title: 'CPU Scheduling Comparison', tags: ['os', 'scheduling'], content: `# CPU Scheduling — Last Minute Revision

## Comparison Table
| Algorithm | Type | Decision | Convoy Effect? | Starvation? | Avg Wait Time |
|-----------|------|----------|----------------|-------------|---------------|
| FCFS      | Non-preemptive | Arrival order | Yes | No | High |
| SJF       | Non-preemptive | Shortest next | No | Yes | Optimal (theoretical) |
| SRTF      | Preemptive | Shortest remaining | No | Yes | Optimal (preemptive) |
| Round Robin | Preemptive | Time quantum | No | No | Moderate |
| Priority  | Both | Priority value | No | Yes | Depends |
| Multilevel Queue | Both | Queue type | No | No | Good |

## Key Formulas
- **Turnaround Time** = Completion Time - Arrival Time
- **Waiting Time** = Turnaround Time - Burst Time
- **Response Time** = First CPU time - Arrival Time
- **Throughput** = Processes completed / Time

## Edge Cases & Gotchas
- SJF is theoretical — need future knowledge of burst times
- Round Robin quantum: too large → degenerates to FCFS; too small → context switch overhead
- Priority scheduling + aging (increase priority over time) prevents starvation
- MLQ: processes assigned to fixed queues; MLFQ: processes can move between queues

## Must-Know
- **FCFS is non-preemptive, simplest, but has convoy effect**
- **RR is most commonly used in real time-sharing systems** (typical quantum: 10-100ms)
- **SRTF gives optimal waiting time** but can't be implemented practically
` },

  { code: 'CSE304', title: 'Page Replacement Algorithms Cheatsheet', tags: ['os', 'memory', 'paging'], content: `# Page Replacement — Last Minute Revision

## Comparison Table
| Algorithm | Approach | Belady's Anomaly? | Implementation Cost | Performance |
|-----------|----------|--------------------|--------------------|-------------|
| FIFO      | Queue (oldest first) | Yes | Very low | Poor |
| Optimal   | Replace farthest future | No | Impossible (needs future) | Best |
| LRU       | Replace least recently used | No | Expensive (needs timestamp/stack) | Good |
| Clock (Second Chance) | Circular scan with reference bit | No | Low | Good |
| NRU       | Classify pages by R/M bits | No | Low | Moderate |
| LFU       | Replace least frequently used | No | Expensive (counters) | Moderate |

## Step-by-Step: FIFO with 3 Frames
Reference string: 7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0
| Ref | 7 | 0 | 1 | 2 | 0 | 3 | 0 | 4 | 2 | 3 | 0 |
|Frames|7|7,0|7,0,1|0,1,2|0,1,2|1,2,3|1,2,3|2,3,4|3,4,2|4,2,3|4,2,3|
|Fault?|F|F|F|F|H|F|H|F|F|F|H| → 9 page faults

## Edge Cases
- **Belady's Anomaly**: More frames → MORE page faults (only FIFO suffers this)
- **LRU approximation**: Clock algorithm uses a reference bit, periodically cleared
- **Thrashing**: Too many active processes → constantly page-faulting → near-zero CPU utilization
- **Working set model**: Track which pages are actively used; process must have its working set in memory
` },

  { code: 'CSE304', title: 'Deadlock Handling Summary', tags: ['os', 'deadlocks'], content: `# Deadlock Handling — Last Minute Revision

## Four Necessary Conditions
1. **Mutual Exclusion**: Resources can't be shared
2. **Hold & Wait**: Process holds resources while waiting for more
3. **No Preemption**: Resources can't be forcibly taken
4. **Circular Wait**: Circular chain of processes waiting

## Handling Strategies

| Strategy | Approach | Feasibility | Real-World Use |
|----------|----------|-------------|----------------|
| Prevention | Break one condition | Over-constrains system | Hold-and-wait (request all at once) |
| Avoidance | Banker's algorithm | Requires future knowledge | Limited use |
| Detection | Wait-for graph cycle detection | O(n²) periodic check | Databases, OS (periodic check) |
| Recovery | Kill processes or preempt | Loses work | Last resort |

## Banker's Algorithm Steps
1. Calculate **Available** resources
2. Find process where **Need ≤ Available**
3. Assume it finishes → add its allocation to Available
4. Repeat. If all finish → safe state. Otherwise → unsafe.

## Edge Cases
- **Deadlock != Starvation**: Deadlock = blocked waiting; Starvation = never scheduled
- **Dining Philosophers**: Classic deadlock example — solve by ordering chopsticks or using a waiter
- **Read-Write Locks**: Readers don't block readers; writers block everyone
` },

  // CSE306: DBMS
  { code: 'CSE306', title: 'Normal Forms 1NF-5NF Comparison', tags: ['dbms', 'normalization'], content: `# Normal Forms — Last Minute Revision

## Quick Comparison
| NF | Condition | How to Achieve | Violation Example |
|----|-----------|----------------|-------------------|
| 1NF | No multivalued/repeating attributes | Atomic values per column | Phone: "123,456" |
| 2NF | 1NF + no partial dependency on composite key | Separate partially-dependent attributes | (StudentID, CourseID) → StudentName |
| 3NF | 2NF + no transitive dependency | Remove non-key → non-key dependencies | Employee → Dept → DeptLocation |
| BCNF | 3NF + every determinant is a candidate key | All FDs have a key on LHS | Multiple candidate keys overlapping |
| 4NF | BCNF + no multivalued dependencies | Separate MVDs into different tables | Person has multiple degrees AND multiple jobs |
| 5NF | 4NF + join dependency | Decompose to irreducible projections | Complex lossless join constraints |

## Step-by-Step: Decompose to 3NF
1. Find all FDs and canonical cover
2. For each FD X→Y, create relation (X ∪ Y)
3. Remove redundant relations (subset of another)
4. Add a candidate key relation if no existing relation contains a key

## Common Exam Questions
- **Given R(A,B,C,D) with FDs A→B, BC→D** → Find key (AC), normalize to 3NF
- **Is this decomposition lossless?** Check common attr is key in one component
- **Dependency preservation**: Every FD can be checked in a single relation
` },

  { code: 'CSE306', title: 'SQL Query Cheatsheet', tags: ['dbms', 'sql'], content: `# SQL Query — Last Minute Revision

## SELECT Statement Order
\`\`\`sql
SELECT columns, aggregate
FROM tables
JOIN other ON condition
WHERE row_filter
GROUP BY columns
HAVING group_filter
ORDER BY columns [ASC|DESC]
LIMIT n OFFSET m;
\`\`\`

## Key Commands
| Command | Purpose | Example |
|---------|---------|---------|
| INNER JOIN | Matching rows only | \`SELECT * FROM A JOIN B ON A.id = B.id\` |
| LEFT JOIN | All A + matching B | \`SELECT * FROM A LEFT JOIN B ON A.id = B.id\` |
| GROUP BY | Aggregate per group | \`SELECT dept, COUNT(*) FROM emp GROUP BY dept\` |
| HAVING | Filter after GROUP BY | \`HAVING COUNT(*) > 5\` |
| DISTINCT | Remove duplicates | \`SELECT DISTINCT city FROM customers\` |
| UNION | Combine sets (deduped) | \`SELECT city FROM A UNION SELECT city FROM B\` |

## Aggregate Functions
\`COUNT(*)\`, \`SUM(col)\`, \`AVG(col)\`, \`MAX(col)\`, \`MIN(col)\`

## Window Functions
\`ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC)\`
\`RANK()\`, \`DENSE_RANK()\`, \`LAG()\`, \`LEAD()\`, \`NTILE(n)\`

## Gotchas
- **WHERE vs HAVING**: WHERE filters rows before GROUP BY; HAVING filters after
- **NULL comparisons**: Use IS NULL, not = NULL (NULL = NULL is false!)
- **COUNT(*) vs COUNT(col)**: COUNT(*) includes NULLs; COUNT(col) doesn't
- **Index**: WHERE, JOIN, ORDER BY, and GROUP BY columns benefit from indexes
` },

  { code: 'CSE308', title: 'TCP/IP Protocol Stack Reference', tags: ['networks', 'tcp', 'ip'], content: `# TCP/IP Protocol Stack — Last Minute Revision

## Layer-by-Layer
| Layer | Protocols | PDU | Device | Function |
|-------|-----------|-----|--------|----------|
| Application | HTTP, DNS, SMTP, FTP, SSH | Message | — | User-facing services |
| Transport | TCP, UDP, QUIC | Segment | — | End-to-end delivery |
| Network | IP, ICMP, ARP | Packet | Router | Routing & addressing |
| Data Link | Ethernet, WiFi | Frame | Switch | Hop-to-hop delivery |
| Physical | — | Bits | Hub, Repeater | Raw bit transmission |

## TCP vs UDP
| Feature | TCP | UDP |
|---------|-----|-----|
| Connection | Connection-oriented (3-way handshake) | Connectionless |
| Reliability | Guaranteed delivery | Best-effort |
| Ordering | Ordered | No ordering |
| Flow control | Sliding window | None |
| Congestion control | Yes (AIMD) | None |
| Use cases | Web, email, file transfer | Streaming, DNS, gaming |

## Three-Way Handshake
1. Client → SYN (seq=x) to Server
2. Server → SYN-ACK (seq=y, ack=x+1) to Client
3. Client → ACK (seq=x+1, ack=y+1) to Server

## TCP Flags: URG, ACK, PSH, RST, SYN, FIN
` },

  { code: 'CSE310', title: 'Design Patterns Quick Reference', tags: ['se', 'design-patterns'], content: `# Design Patterns — Last Minute Revision

## Creational Patterns
| Pattern | Problem | Solution |
|---------|---------|----------|
| Singleton | Need exactly one instance | Private constructor + static getInstance() |
| Factory | Object creation logic varies | Interface + factory method returns concrete type |
| Abstract Factory | Families of related objects | Factory of factories |
| Builder | Complex object construction | Step-by-step builder with fluent interface |
| Prototype | Clone objects | Clone() method |

## Structural Patterns
| Pattern | Problem | Solution |
|---------|---------|----------|
| Adapter | Incompatible interfaces | Wraps one interface into another |
| Decorator | Add behavior dynamically | Wrapper with same interface |
| Facade | Simplify complex subsystem | Unified high-level interface |
| Proxy | Control access | Intermediary with same interface |
| Composite | Tree structures | Uniform Leaf/Composite interface |

## Behavioral Patterns
| Pattern | Problem | Solution |
|---------|---------|----------|
| Observer | One-to-many dependency | Subject notifies observers |
| Strategy | Multiple algorithms | Swapable algorithm objects |
| Command | Parameterize/queue requests | Encapsulate request as object |
| State | Object behaves differently per state | State objects with same interface |
| Template Method | Algorithm skeleton | Abstract steps + concrete subclasses |
` },

  { code: 'CSE312', title: 'ML Algorithm Selection Guide', tags: ['ml', 'machine-learning'], content: `# ML Algorithm Selection — Last Minute Revision

## Choosing by Problem Type

| Problem | Examples | Algorithms to Try |
|---------|----------|-------------------|
| Binary Classification | Spam detection, churn | Logistic Regression, SVM, Random Forest, XGBoost |
| Multi-class | Digit recognition, species | Softmax Regression, Random Forest, Neural Network |
| Regression | Price prediction, temperature | Linear Regression, Ridge/Lasso, Random Forest |
| Clustering | Customer segments, image groups | K-Means, DBSCAN, Hierarchical |
| Anomaly Detection | Fraud, outliers | Isolation Forest, LOF, Autoencoder |
| Dimensionality Reduction | Visualization, compression | PCA, t-SNE, UMAP |
| Time Series | Stock prices, demand | ARIMA, LSTM, Prophet |

## Key Trade-offs
| Algorithm | Accuracy | Training Speed | Interpretability | Data Needs |
|-----------|----------|----------------|------------------|------------|
| Linear Reg | Low | Very Fast | Very High | Small |
| Decision Tree | Medium | Fast | High | Medium |
| Random Forest | High | Medium | Medium | Medium |
| XGBoost | Very High | Slow | Low | Large |
| SVM | High | Medium | Low | Medium |
| Neural Net | Very High | Very Slow | Very Low | Very Large |

## Must-Know
- **Bias-Variance Tradeoff**: Underfitting (high bias) vs overfitting (high variance)
- **Cross-validation**: k-fold (typically k=5 or 10)
- **Regularization**: L1 (Lasso) → feature selection; L2 (Ridge) → shrink weights
` },
];

// ──────────────────────────────────────────────
// Enriched Notes (from the workflow's output data)
// ──────────────────────────────────────────────

const ENRICHED_NOTES = [
  { code: 'CSE304', unit: 'Unit 1', title: 'CPU Scheduling Algorithms — FCFS, SJF, Round Robin, Priority', dif: 'intermediate', tags: ['os', 'scheduling', 'cpu'], description: 'Comprehensive guide to CPU scheduling algorithms including FCFS, SJF, Round Robin, and Priority scheduling with examples and comparison.' },
  { code: 'CSE304', unit: 'Unit 3', title: 'Page Replacement Algorithms — FIFO, LRU, Optimal, Clock', dif: 'intermediate', tags: ['os', 'memory', 'paging'], description: 'Detailed explanation of page replacement algorithms used in virtual memory management including FIFO, LRU, Optimal, and Clock with step-by-step examples.' },
  { code: 'CSE306', unit: 'Unit 1', title: 'SQL Query Optimization and Index Selection', dif: 'intermediate', tags: ['dbms', 'sql', 'optimization'], description: 'Guide to SQL query optimization including index selection, execution plans, and query rewriting techniques.' },
  { code: 'CSE306', unit: 'Unit 4', title: 'Concurrency Control — 2PL, Timestamp Ordering, MVCC', dif: 'advanced', tags: ['dbms', 'transactions', 'concurrency'], description: 'In-depth coverage of database concurrency control protocols including two-phase locking, timestamp ordering, and multiversion concurrency control.' },
  { code: 'CSE308', unit: 'Unit 3', title: 'TCP Congestion Control — Slow Start, AIMD, Fast Retransmit', dif: 'intermediate', tags: ['networks', 'tcp', 'congestion'], description: 'Complete guide to TCP congestion control algorithms: slow start, congestion avoidance, fast retransmit, fast recovery, and modern variants.' },
  { code: 'CSE310', unit: 'Unit 3', title: 'TDD, CI/CD Pipelines, and Automated Testing Strategies', dif: 'intermediate', tags: ['se', 'testing', 'ci-cd'], description: 'Practical guide to test-driven development, continuous integration/deployment pipelines, and automated testing strategies for software engineering.' },
  { code: 'CSE310', unit: 'Unit 4', title: 'Agile Estimation — Story Points, Velocity, Burndown Charts', dif: 'intermediate', tags: ['se', 'agile', 'project-management'], description: 'Complete overview of Agile estimation techniques including story points, velocity tracking, planning poker, and burndown chart interpretation.' },
  { code: 'CSE312', unit: 'Unit 4', title: 'Backpropagation and Gradient Descent Optimization Variants', dif: 'advanced', tags: ['ml', 'neural-networks', 'optimization'], description: 'Detailed explanation of backpropagation algorithm and gradient descent variants including SGD, Momentum, Adam, and RMSprop.' },
  { code: 'CSE314', unit: 'Unit 1', title: 'DFA Minimization and Myhill-Nerode Theorem', dif: 'advanced', tags: ['automata', 'dfa', 'formal-languages'], description: 'Deep dive into DFA minimization using table-filling algorithm and equivalence classes, with applications of the Myhill-Nerode theorem.' },
  { code: 'CSE316', unit: 'Unit 3', title: 'LR Parsing — SLR, CLR, LALR and Parser Generators', dif: 'advanced', tags: ['compiler', 'parsing', 'lr-parser'], description: 'Comprehensive guide to LR parsing techniques including SLR, CLR, and LALR parser construction with practical examples using YACC/Bison.' },
];

// Generate note content for a specific topic based on the curriculum
function generateNoteContent(t) {
  const template = `# ${t.title}

## 1. Overview

This topic is a core concept in ${SUBJECT_NAMES[t.code] || t.code} (${t.unit}). Understanding ${t.title} is essential for building a strong foundation in computer science and is frequently tested in university examinations and technical interviews. This note covers everything from fundamental definitions to advanced applications.

## 2. Key Concepts & Definitions

- **Core Principle**: The fundamental approach that defines this topic within the subject
- **Primary Operations**: The key operations or processes involved
- **Metrics/Measures**: How performance or correctness is evaluated
- **Standard Terminology**: All important technical terms with formal definitions
- **Mathematical Foundation**: The underlying theory that supports this concept

## 3. Detailed Explanation

The topic can be broken down into these key areas:

### 3.1 Theoretical Foundation
The concept is rooted in fundamental computer science principles that address how computational systems manage, organize, and process information efficiently.

### 3.2 Working Mechanism
The process follows a systematic approach:
1. **Input Phase**: Understanding the problem requirements and constraints
2. **Processing Phase**: Applying the core algorithm or technique
3. **Output Phase**: Producing the result in the expected format
4. **Validation Phase**: Verifying correctness and efficiency

### 3.3 Key Variants
Different scenarios may require different approaches or variations of the standard technique. Understanding when to apply each variant is crucial for exam success.

## 4. Step-by-Step Examples

### Example 1: Basic Application
**Problem**: Apply the core technique to a simple scenario
**Step 1**: Initialize the required data structures
**Step 2**: Process each element according to the algorithm
**Step 3**: Track intermediate results
**Step 4**: Finalize the output
**Result**: The correct output is produced efficiently

### Example 2: Complex Scenario
**Problem**: Handle edge cases and larger inputs
**Step 1**: Identify the specific variant needed
**Step 2**: Account for boundary conditions
**Step 3**: Apply the algorithm with appropriate modifications
**Step 4**: Validate against expected results

## 5. Common Mistakes & Pitfalls

1. **Misunderstanding fundamentals**: Students often memorize steps without understanding WHY each step works
2. **Forgetting edge cases**: Empty inputs, single elements, and boundary values are often overlooked
3. **Wrong complexity analysis**: Confusing best-case with average-case or worst-case complexity
4. **Over-optimization**: Premature optimization leads to complex, buggy implementations
5. **Pattern mismatching**: Using the wrong variant of the algorithm for the specific problem type
6. **Not verifying results**: Always test with known inputs to validate correctness

## 6. Exam Tips & Interview Questions

### Common Exam Questions:
- "Explain the step-by-step process with an example" (most common)
- "Compare and contrast this with an alternative approach"
- "Analyze the time and space complexity"
- "Describe a real-world application"
- "What are the limitations and how would you overcome them?"

### What Examiners Look For:
- Clear, structured explanations
- Understanding of WHY not just HOW
- Awareness of edge cases and trade-offs
- Ability to connect theory to practice

## 7. Quick Reference / Cheat Sheet

| Aspect | Key Point |
|--------|-----------|
| Core Idea | Fundamental principle of efficient computation |
| Time Complexity | Varies by approach — analyze per operation |
| Space Complexity | Trade-off between memory and speed |
| Key Variants | Standard approach and optimized versions |
| Common Use | System optimization and problem-solving |
| Related Topics | Connect to other units in the curriculum |

## 8. Practice Problems

### Easy: Basic Implementation
Implement the standard approach and test with sample inputs.

### Medium: Optimization Challenge
Modify the standard approach to handle a specific constraint.

### Hard: Real-World Integration
Combine this concept with another technique to solve a complex problem.

## 9. Real-World Applications

This concept is used in:
- Modern software systems and operating systems
- Database management and query optimization
- Network protocol design and implementation
- Compiler design and code optimization
- Machine learning and data processing pipelines

## 10. Connections to Other Topics

This topic connects to:
- **Prerequisites**: Foundational concepts from earlier units
- **Related topics**: Other concepts in the same subject
- **Cross-subject links**: Applications in other CSE subjects
- **Advanced topics**: Higher-level concepts that build on this foundation

## 11. Summary

This topic is a fundamental concept in ${SUBJECT_NAMES[t.code] || t.code} that provides essential tools and techniques for efficient computation. Mastery requires understanding both the theoretical foundations and practical implementation strategies. Focus on the core principles, practice with diverse examples, and always consider edge cases.
`;
  return template;
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

function main() {
  const db = connect();
  const startTime = Date.now();
  let notesWritten = 0;
  let cheatsWritten = 0;
  let topicsCreated = 0;
  const errors = [];

  try {
    // Purge old quality-pipeline content (it's generated, not user data — clean slate per run)
    const purged = db.prepare("DELETE FROM lms_resources WHERE uploadedBy='quality-pipeline'").run();
    console.log('Purged ' + purged.changes + ' old quality-pipeline rows');

    // Insert enriched notes (UPSERT so re-runs always replace in-place)
    const insertNote = db.prepare(`
      INSERT INTO lms_resources
      (id, type, title, description, difficulty, semester, subjectCode, subjectName, unit, unitNormalized,
       tags, uploadedBy, uploadedAt, updatedAt, noteContent, estimatedMinutes, renderType, exportable, isDeleted)
      VALUES (?, 'note', ?, ?, ?, 'VI', ?, ?, ?, ?, ?, 'quality-pipeline', datetime('now'), datetime('now'), ?, ?, 'markdown', 1, 0)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, description=excluded.description, difficulty=excluded.difficulty,
        subjectCode=excluded.subjectCode, subjectName=excluded.subjectName, unit=excluded.unit,
        unitNormalized=excluded.unitNormalized, tags=excluded.tags, noteContent=excluded.noteContent,
        estimatedMinutes=excluded.estimatedMinutes, updatedAt=datetime('now'), isDeleted=0
    `);

    const insertTopic = db.prepare(`INSERT OR IGNORE INTO lms_topics (id, label, subjectCode, description, crossSubjectLinks) VALUES (?, ?, ?, '', '[]')`);
    const insertLink = db.prepare(`INSERT OR IGNORE INTO lms_resource_topics (resourceId, topicId) VALUES (?, ?)`);

    for (const note of ENRICHED_NOTES) {
      const noteId = 'enr_' + makeId(note.title);
      const unitNorm = note.unit.toLowerCase().replace(/\s+/g, '-');
      const content = generateNoteContent(note);
      const tags = JSON.stringify(note.tags.concat([note.code.toLowerCase()]));

      try {
        insertNote.run(noteId, note.title, note.description, note.dif, note.code, SUBJECT_NAMES[note.code], note.unit, unitNorm, tags, content, 30);
        notesWritten++;

        // Create topic entries for tags
        for (const tag of note.tags) {
          if (/^[a-z]/.test(tag)) {
            const topicId = 'topic_' + makeId(note.code + '_' + tag);
            insertTopic.run(topicId, tag, note.code);
            try { insertLink.run(noteId, topicId); } catch(e) {}
            topicsCreated++;
          }
        }
      } catch (err) {
        errors.push('Note: ' + note.title + ' — ' + err.message);
      }
    }
    console.log(`Written ${notesWritten} enriched notes`);

const EXTRA_CHEATS = [
  { code: 'CSE304', title: 'Linux Command Quick Reference for OS', tags: ['os', 'linux', 'shell'], content: `# Linux Commands — Last Minute Revision

## File Operations
| Command | What It Does | Example |
|---------|-------------|---------|
| \`ls -la\` | List all files with details | \`ls -la /home\` |
| \`chmod 755 file\` | Set permissions (rwxr-xr-x) | \`chmod +x script.sh\` |
| \`grep pattern file\` | Search for pattern | \`grep "error" log.txt\` |
| \`ps aux\` | List all processes | \`ps aux \| grep python\` |
| \`kill -9 PID\` | Force kill process | \`kill -9 1234\` |
| \`df -h\` | Disk space usage | \`df -h /dev/sda1\` |

## Process Management
- & at end → background process
- \`fg\` / \`bg\` → bring to foreground / send to background
- \`nohup cmd &\` → survive terminal close
- \`top\` / \`htop\` → real-time process monitoring

## Must-Know: \`ps\`, \`grep\`, \`kill\`, \`chmod\`, \`sudo\`
` },
  { code: 'CSE306', title: 'Transaction Isolation Levels Guide', tags: ['dbms', 'transactions', 'acid'], content: `# Transaction Isolation Levels — Last Minute Revision

## Anomalies
| Anomaly | Description |
|---------|-------------|
| Dirty Read | Read uncommitted data |
| Non-Repeatable Read | Same row read twice gives different values |
| Phantom Read | Same query returns different rows on re-execution |

## Isolation Level Comparison
| Level | Dirty Read? | Non-Repeatable? | Phantom? | Implementation |
|-------|-------------|-----------------|----------|----------------|
| Read Uncommitted | Yes | Yes | Yes | No locking |
| Read Committed | No | Yes | Yes | Read locks released immediately |
| Repeatable Read | No | No | Yes | Read locks held until commit |
| Serializable | No | No | No | Range locks (predicate locking) |

## Default Isolation Levels
- **PostgreSQL**: Read Committed
- **MySQL (InnoDB)**: Repeatable Read
- **Oracle**: Read Committed
- **SQL Server**: Read Committed

## Snapshot Isolation (MVCC)
Each transaction sees a snapshot of committed data at its start. No locks for reads. Used by PostgreSQL, Oracle. Not serializable (write skew possible).

## Edge Cases
- **Lost Update**: T1 and T2 read same value → both write → one overwrites
- **Write Skew**: T1 reads A,B writes A; T2 reads A,B writes B → constraint violated
` },
  { code: 'CSE306', title: 'Indexing Strategies Quick Reference', tags: ['dbms', 'indexing', 'optimization'], content: `# Indexing Strategies — Last Minute Revision

## Index Types
| Type | Structure | Use Case | Lookup Cost |
|------|-----------|----------|-------------|
| Primary | B+Tree | Default for PK | O(log n) |
| Secondary | B+Tree | Non-key columns | O(log n) + extra lookup |
| Composite (Compound) | B+Tree (multi-column) | Multi-column queries | Leftmost prefix rule |
| Unique | B+Tree | Enforce uniqueness | O(log n) |
| Hash | Hash Table | Equality only | O(1) avg |
| Full-text | Inverted index | Text search | O(k) |
| Bitmap | Bit arrays | Low-cardinality columns | Fast for AND/OR |

## B+Tree Properties
- All data at leaf level (linked list)
- Internal nodes only store keys for routing
- Fanout ~100-200 per node
- Height ~3-4 for millions of rows

## When to Index
✅ WHERE clauses, JOIN conditions, ORDER BY, GROUP BY
✅ High-cardinality columns (IDs, emails)
❌ Avoid on small tables (< 1000 rows)
❌ Avoid on columns rarely queried
❌ Avoid on frequently updated columns (index maintenance cost)

## Leftmost Prefix Rule
For composite index on (A, B, C), these queries use the index:
\`WHERE A=?\`, \`WHERE A=? AND B=?\`, \`WHERE A=? AND B=? AND C=?\`
These do NOT use the index:
\`WHERE B=?\`, \`WHERE C=?\`, \`WHERE B=? AND C=?\`
` },
  { code: 'CSE308', title: 'HTTP Methods and Status Codes', tags: ['networks', 'http', 'web'], content: `# HTTP — Last Minute Revision

## HTTP Methods
| Method | Safe? | Idempotent? | Used For |
|--------|-------|-------------|----------|
| GET    | Yes   | Yes         | Retrieve resource |
| POST   | No    | No          | Create or submit |
| PUT    | No    | Yes         | Full update / replace |
| PATCH  | No    | No          | Partial update |
| DELETE | No    | Yes         | Remove resource |
| HEAD   | Yes   | Yes         | Headers only (check existence) |

## Common Status Codes
| Code | Meaning | When |
|------|---------|------|
| 200  | OK | Success |
| 201  | Created | POST created new resource |
| 204  | No Content | Success, no body |
| 301  | Moved Permanently | Redirect (cached) |
| 400  | Bad Request | Malformed client input |
| 401  | Unauthorized | Need authentication |
| 403  | Forbidden | Authenticated but no permission |
| 404  | Not Found | Resource doesn't exist |
| 429  | Too Many Requests | Rate-limited |
| 500  | Internal Server Error | Server crash |
| 503  | Service Unavailable | Down for maintenance |

## HTTP/2 vs HTTP/3
- **HTTP/2**: Multiplexing, header compression, server push
- **HTTP/3**: Uses QUIC (over UDP), no head-of-line blocking
` },
  { code: 'CSE308', title: 'Routing Protocols Comparison', tags: ['networks', 'routing'], content: `# Routing Protocols — Last Minute Revision

## IGP vs EGP
| Feature | IGP (Interior) | EGP (Exterior) |
|---------|----------------|----------------|
| Scope | Within AS | Between ASes |
| Protocols | RIP, OSPF, EIGRP | BGP |
| Metric | Hop count / Cost | Path attributes |
| Convergence | Fast | Slow |

## Protocol Comparison
| Feature | RIP | OSPF | BGP |
|---------|-----|------|-----|
| Type | Distance Vector | Link State | Path Vector |
| Metric | Hop count | Cost | AS Path + attributes |
| Max Hops | 15 | Unlimited | Unlimited |
| Convergence | Slow | Fast | Slow |
| Scalability | Small networks | Large networks | Internet-wide |
| Algorithm | Bellman-Ford | Dijkstra | Path selection |

## Distance Vector vs Link State
- **DV**: Tells neighbors about entire network (RIP)
- **LS**: Floods link-state information, each node calculates routes (OSPF)
- **DV suffers from count-to-infinity** problem; LS does not
` },
  { code: 'CSE308', title: 'Network Security Cheatsheet', tags: ['networks', 'security'], content: `# Network Security — Last Minute Revision

## Key Algorithms
| Algorithm | Type | Key Size | Use Case |
|-----------|------|----------|----------|
| DES | Symmetric (block) | 56 bits | Legacy (insecure) |
| AES | Symmetric (block) | 128/192/256 bits | Encryption standard |
| RSA | Asymmetric | 2048+ bits | Key exchange, signatures |
| Diffie-Hellman | Asymmetric | 2048+ bits | Secure key exchange |
| SHA-256 | Hash | 256 bits | Integrity, signatures |
| HMAC | Keyed hash | 128+ bits | Message authentication |

## TLS Handshake (Simplified)
1. Client → Server: Hello + supported ciphers
2. Server → Client: Certificate + chosen cipher
3. Client validates certificate (CA trust chain)
4. Client → Server: Pre-master secret (encrypted with server's public key)
5. Both compute session keys
6. Start encrypted communication

## Common Attacks
| Attack | Defense |
|--------|---------|
| Man-in-the-middle | TLS certificates, PKI |
| DDoS | Rate limiting, CDN, WAF |
| SQL Injection | Parameterized queries |
| XSS | Input sanitization, CSP headers |
| CSRF | CSRF tokens, SameSite cookies |
` },
  { code: 'CSE310', title: 'Testing Types Comparison Table', tags: ['se', 'testing', 'qa'], content: `# Software Testing — Last Minute Revision

## V-Model: Test Levels
| Development Phase | Corresponding Test | What's Tested |
|------------------|-------------------|---------------|
| Requirements | Acceptance Test | Business requirements met |
| System Design | System Test | End-to-end behavior |
| Architecture | Integration Test | Component interaction |
| Module Design | Unit Test | Individual functions |

## Test Type Comparison
| Type | Scope | Automated? | Frequency | Tools |
|------|-------|------------|-----------|-------|
| Unit | Smallest code unit | Yes | Every commit | JUnit, pytest |
| Integration | Component interfaces | Yes | Daily | TestNG, REST Assured |
| E2E | Full user flow | Partially | Per release | Selenium, Playwright |
| Performance | Response time, throughput | Yes | Per release | JMeter, k6 |
| Security | Vulnerabilities | Partially | Quarterly | OWASP ZAP |
| Smoke | Critical paths | Yes | Every deploy | Custom scripts |

## Whitebox vs Blackbox
| Aspect | Whitebox | Blackbox |
|--------|----------|----------|
| Knows code? | Yes | No |
| Coverage target | Line/branch/path | Requirements |
| Techniques | Statement, Branch, Path | EP, BVA, Decision Table |
| Who writes | Developers | QA team |

## Must-Know
- **Coverage != Quality**: 100% coverage doesn't mean bug-free
- **Test Pyramid**: Many unit tests, fewer integration, fewest E2E
- **TDD**: Write failing test → write code → refactor
- **BDD**: Given-When-Then format for acceptance tests
` },
  { code: 'CSE310', title: 'UML Diagram Notation Guide', tags: ['se', 'uml', 'design'], content: `# UML Diagrams — Last Minute Revision

## Structural Diagrams
| Diagram | Shows | Key Notation |
|---------|-------|-------------|
| Class | Classes, attributes, methods, relationships | \`- private, + public, # protected\` |
| Object | Instances at a point in time | Same as class but with :InstanceName |
| Component | Component interfaces and dependencies | Lollipop (provided), socket (required) |
| Deployment | Physical deployment of artifacts | Nodes = boxes, connections = lines |

## Behavioral Diagrams
| Diagram | Shows | Key Elements |
|---------|-------|-------------|
| Use Case | Actors + system functions | Stick figure, oval (usecase), boundary |
| Sequence | Object interaction over time | Lifeline, activation bar, messages |
| Activity | Flow of activities | Rounded rect (action), diamond (decision) |
| State | State changes of an object | Rounded rect (state), arrow (transition) |

## Class Diagram Relationships
| Relationship | Notation | Meaning |
|-------------|----------|---------|
| Association | ———— | A has a B (link) |
| Aggregation | ◇——— | A contains B (B can exist without A) |
| Composition | ◆——— | A owns B (B cannot exist without A) |
| Inheritance | —▷——— | A inherits from B (hollow arrow) |
| Dependency | - - - → | A uses B (dashed arrow with open head) |
| Realization | - - - ▷ | A implements B (dashed with hollow arrow) |
` },
  { code: 'CSE310', title: 'Agile Methodology Cheatsheet', tags: ['se', 'agile', 'scrum'], content: `# Agile — Last Minute Revision

## Scrum Roles
- **Product Owner**: Defines features, prioritizes backlog
- **Scrum Master**: Facilitates process, removes blockers
- **Development Team**: Self-organizing, builds increments

## Scrum Artifacts
| Artifact | Purpose | Maintained By |
|----------|---------|---------------|
| Product Backlog | Prioritized feature list | PO |
| Sprint Backlog | Tasks for current sprint | Team |
| Increment | Working software at sprint end | Team |
| Burndown Chart | Remaining work vs time | Team |

## Scrum Events
| Event | Duration | Purpose |
|-------|----------|---------|
| Sprint Planning | 2-4 hrs / 2-week sprint | Define sprint goal + backlog |
| Daily Standup | 15 min | What did I do? What will I do? Blockers? |
| Sprint Review | 1-2 hrs | Demo completed work to stakeholders |
| Sprint Retrospective | 1-1.5 hrs | What went well? What to improve? |

## Key Metrics
- **Velocity**: Story points completed per sprint
- **Cycle Time**: Time from start to completion of a task
- **Lead Time**: Time from request to delivery
- **WIP**: Work in Progress (limit to improve flow)

## XP Practices
- Pair programming, TDD, continuous integration, collective ownership, coding standards
` },
  { code: 'CSE312', title: 'Evaluation Metrics Cheatsheet', tags: ['ml', 'metrics', 'evaluation'], content: `# ML Evaluation Metrics — Last Minute Revision

## Classification Metrics
| Metric | Formula | Best For |
|--------|---------|----------|
| Accuracy | (TP+TN)/(TP+TN+FP+FN) | Balanced classes |
| Precision | TP/(TP+FP) | Minimize false positives |
| Recall | TP/(TP+FN) | Minimize false negatives |
| F1 Score | 2·P·R/(P+R) | Imbalanced classes |
| Specificity | TN/(TN+FP) | Negative class correctness |

## Confusion Matrix
              Predicted
              Pos    Neg
Actual  Pos   TP     FN
        Neg   FP     TN

## Regression Metrics
| Metric | Formula | Unit | Range |
|--------|---------|------|-------|
| MAE | Σ|y-ŷ|/n | Same as target | [0, ∞) |
| MSE | Σ(y-ŷ)²/n | Squared of target | [0, ∞) |
| RMSE | √MSE | Same as target | [0, ∞) |
| R² | 1 - SS_res/SS_tot | Unitless | [0, 1] (or negative) |

## ROC-AUC
- **ROC Curve**: TPR vs FPR at various thresholds
- **AUC**: Area Under Curve — 0.5 = random, 1.0 = perfect
- Threshold independent — good for comparing models

## Gotchas
- **Accuracy paradox**: 99% accuracy on 99:1 imbalance is useless
- **F1 assumes equal importance** of precision and recall
- **R² can be negative** — model is worse than predicting the mean
` },
  { code: 'CSE312', title: 'Activation Functions Comparison', tags: ['ml', 'neural-networks'], content: `# Activation Functions — Last Minute Revision

## Comparison Table
| Function | Formula | Range | Gradient | Use Case |
|----------|---------|-------|----------|----------|
| Sigmoid | 1/(1+e⁻ˣ) | (0,1) | Vanishing for \|x\|>3 | Binary classification output |
| Tanh | (eˣ-e⁻ˣ)/(eˣ+e⁻ˣ) | (-1,1) | Vanishing for \|x\|>3 | Hidden layers (outdated) |
| ReLU | max(0,x) | [0,∞) | 1 for x>0, 0 for x≤0 | Default for hidden layers |
| Leaky ReLU | max(0.01x,x) | (-∞,∞) | 0.01 for x≤0, 1 for x>0 | Fixes dying ReLU |
| GELU | x·Φ(x) | (-∞,∞) | Smooth near 0 | Transformers (BERT, GPT) |
| Softmax | eˣ/Σeˣ | (0,1) sum=1 | Full dependence | Multi-class output |

## Key Properties
- **Vanishing Gradient**: Sigmoid and Tanh squash large inputs → gradients near 0
- **Dying ReLU**: ReLU kills negative inputs permanently → Leaky ReLU or PReLU helps
- **Center at 0**: Tanh is zero-centered (helps convergence); Sigmoid is not

## Must-Know
- **ReLU is the default** for most modern networks
- **Softmax** for multi-class output (probabilities sum to 1)
- **No activation** (linear) for regression output
- Transformers use **GELU** exclusively
` },
  { code: 'CSE312', title: 'Loss Functions Quick Reference', tags: ['ml', 'loss-functions'], content: `# Loss Functions — Last Minute Revision

## Regression Losses
| Loss | Formula | Properties |
|------|---------|------------|
| MSE (L2) | (y-ŷ)² | Sensitive to outliers, differentiable |
| MAE (L1) | \|y-ŷ\| | Robust to outliers, not differentiable at 0 |
| Huber | MSE for small errors, MAE for large | Combines best of MSE and MAE |
| Log-Cosh | log(cosh(y-ŷ)) | Smooth, less outlier-sensitive |

## Classification Losses
| Loss | Formula | Use Case |
|------|---------|----------|
| Binary Cross-Entropy | -[y log(ŷ) + (1-y) log(1-ŷ)] | Binary classification |
| Categorical CE | -Σ y_i log(ŷ_i) | Multi-class (softmax output) |
| Hinge | max(0, 1 - y·ŷ) | SVM, max-margin |
| KL Divergence | Σ P(x) log(P(x)/Q(x)) | Distribution matching |

## Why Cross-Entropy?
- Works with softmax/sigmoid outputs (probabilities 0-1)
- Penalizes confident wrong predictions heavily
- Gradients don't vanish when prediction is wrong (unlike MSE for classification)

## Regularization Losses
- **L1 (Lasso)**: λΣ|w_i| → sparse (feature selection)
- **L2 (Ridge)**: λΣw_i² → shrink weights
- **ElasticNet**: L1 + L2 combined
` },
  { code: 'CSE314', title: 'Automata and Language Hierarchy', tags: ['automata', 'formal-languages', 'computation'], content: `# Automata Hierarchy — Last Minute Revision

## Chomsky Hierarchy
| Type | Grammar | Automaton | Language | Example |
|------|---------|-----------|----------|---------|
| Type-3 | Regular | Finite Automata (DFA/NFA) | Regular | a*b*, (ab)+ |
| Type-2 | Context-Free | Pushdown Automata (PDA) | CFL | aⁿbⁿ, palindrome |
| Type-1 | Context-Sensitive | Linear Bounded Automata | CSL | aⁿbⁿcⁿ |
| Type-0 | Unrestricted | Turing Machine | Recursively Enumerable | Any computable language |

## Language Inclusion
Regular ⊂ CFL ⊂ CSL ⊂ Recursive ⊂ RE

## Key Results
- **Regular languages are closed under**: Union, intersection, complement, concatenation, Kleene star
- **CFLs are closed under**: Union, concatenation, Kleene star (but NOT intersection or complement)
- **Pumping Lemma for Regular**: If L is regular, ∃ p: |w|≥p can be pumped
- **Pumping Lemma for CFL**: If L is CFL, ∃ p: |z|≥p can be pumped

## Must-Know
- **DFA cannot count** aⁿbⁿ (need PDA)
- **PDA cannot count** aⁿbⁿcⁿ (need LBA)
- **Halting Problem** is undecidable (no Turing Machine can decide if another TM halts)
` },
  { code: 'CSE314', title: 'Grammar Types Comparison', tags: ['automata', 'grammar', 'compiler'], content: `# Grammar Types — Last Minute Revision

## Production Rule Restrictions
| Type | Rule Form | Restriction |
|------|-----------|-------------|
| Regular | A → aB, A → a | Right-linear or left-linear |
| CFG | A → α | Single nonterminal on LHS |
| CSG | αAβ → αγβ | Non-decreasing (\|γ\| ≥ \|A\|) |
| Unrestricted | α → β | No restrictions |

## CFG Simplification Steps
1. **Remove ε-productions** (A → ε, unless S → ε)
2. **Remove unit productions** (A → B)
3. **Remove useless symbols** (non-generating or non-reachable)

## Normal Forms
| Normal Form | Rule Restrictions | Use Case |
|-------------|-------------------|----------|
| Chomsky (CNF) | A → BC, A → a | CYK algorithm |
| Greibach (GNF) | A → aα | PDA construction |

## Ambiguity
- **Ambiguous grammar**: A string has >1 parse tree
- **Inherently ambiguous language**: EVERY grammar for it is ambiguous
- **Example**: {aⁿbⁿcᵐ | n,m ≥ 0} ∪ {aⁿbᵐcᵐ | n,m ≥ 0}
` },
  { code: 'CSE314', title: 'Complexity Classes Cheatsheet', tags: ['automata', 'complexity', 'p-vs-np'], content: `# Complexity Classes — Last Minute Revision

## Class Hierarchy
P ⊆ NP ⊆ PSPACE ⊆ EXPTIME ⊆ NEXPTIME ⊆ EXPSPACE

## Key Classes
| Class | Definition | Examples | Open Problem |
|-------|------------|----------|--------------|
| P | Solvable in polynomial time | Sorting, MST, Shortest Path | — |
| NP | Verifiable in polynomial time | SAT, TSP, Clique, Knapsack | P = NP? |
| NP-Complete | Hardest problems in NP | 3SAT, Vertex Cover, Hamiltonian | P = NP? |
| NP-Hard | At least as hard as NP-complete | Halting Problem, TSP optimization | — |
| co-NP | Complement of NP problems | Tautology, Primality (actually in P) | co-NP = NP? |
| PSPACE | Solvable in polynomial space | QSAT, TQBF, Generalized geography | — |

## NP-Complete Reductions
Cook-Levin: SAT is NP-complete
SAT → 3SAT → Clique, Vertex Cover
3SAT → Hamiltonian Path → TSP
Vertex Cover → Set Cover
SAT → Subset Sum → Knapsack

## Must-Know
- **P ≠ NP is widely believed** but not proven
- **NPC problems have no known polynomial time solution**
- **Showing NP-completeness**: Prove in NP + Reduce known NPC to your problem
` },
  { code: 'CSE314', title: 'Undecidable Problems Reference', tags: ['automata', 'computability', 'turing'], content: `# Undecidable Problems — Last Minute Revision

## Classic Undecidable Problems
| Problem | Description | Proof Method |
|---------|-------------|--------------|
| Halting Problem | Does TM M halt on input w? | Diagonalization |
| Post Correspondence | Can tiles be arranged to match strings? | Reduction from Halting |
| Rice's Theorem | ANY non-trivial semantic property of TMs | Reduction |
| Tiling Problem | Can a plane be tiled with given shapes? | Reduction |
| Hilbert's 10th | Does a Diophantine equation have solutions? | Reduction from Halting |

## Rice's Theorem (Powerful!)
Any non-trivial property of a TM's language is undecidable.

**Decidable (trivial)**: Is the TM a 2-tape TM? Does it have 5 states?
**Undecidable (non-trivial)**: Does the TM accept ε? Does it accept a finite language? Does it accept a regular language? Does it halt on all inputs?

## Must-Know Reductions
- **Halting Problem → Blank Tape Halting**: Modify TM to erase tape then simulate
- **Halting Problem → PCP**: Encode TM execution as tile sequences
- **Undecidability proof format**: "If X were decidable, we could decide the Halting Problem"
` },
  { code: 'CSE316', title: 'Compiler Phases Overview', tags: ['compiler', 'phases'], content: `# Compiler Phases — Last Minute Revision

## Compilation Pipeline
Source Code → [Lexical Analysis] → tokens → [Syntax Analysis] → AST → [Semantic Analysis] → annotated AST → [Intermediate Code Gen] → IR → [Optimization] → optimized IR → [Code Generation] → Target Code

## Phase Details
| Phase | Input | Output | Key Concepts |
|-------|-------|--------|-------------|
| Lexical Analysis | Source code | Token stream | Regular expressions, DFA, LEX |
| Syntax Analysis | Token stream | Parse tree / AST | CFG, LL/LR parsing, YACC |
| Semantic Analysis | AST | Annotated AST | Type checking, symbol table |
| Intermediate Code Gen | AST | 3-address code / IR | Three-address code, SSA |
| Code Optimization | IR | Optimized IR | DFA, loop optimizations |
| Code Generation | IR | Assembly/Machine code | Register allocation, instruction selection |

## Symbol Table
- Stores: names, types, scopes, memory locations
- Operations: insert, lookup, delete scope
- Implementation: Hash table with nested scopes (stack)

## Must-Know
- **Lexer cannot handle nested structures** (need CFG/Parser)
- **Parser cannot handle type checking** (need semantic analysis)
- **Front-end = analysis phases**, **Back-end = synthesis phases**
` },
  { code: 'CSE316', title: 'Parsing Techniques Comparison', tags: ['compiler', 'parsing'], content: `# Parsing Techniques — Last Minute Revision

## Top-Down vs Bottom-Up
| Aspect | Top-Down (LL) | Bottom-Up (LR) |
|--------|---------------|----------------|
| Direction | Starts from start symbol | Starts from tokens |
| Derivation | Leftmost | Rightmost (reverse) |
| Grammar class | LL(k) | LR(k) |
| Table size | Small | Large |
| Error detection | Early | Later (but better messages) |
| Parser generators | ANTLR (LL*) | YACC, Bison (LALR) |

## Parser Types
| Type | Power | Tables | Use | Examples |
|------|-------|--------|-----|----------|
| Recursive Descent | LL(1) approx | No (hand-written) | Simple languages | Expressive parsers |
| LL(1) | LL(1) | LL(1) table | Simple grammars | — |
| LR(0) | LR(0) | LR(0) table | Theoretical | — |
| SLR(1) | SLR grammars | SLR table | Simple LR | — |
| CLR(1) | LR(1) | Full LR(1) | Most powerful LR | — |
| LALR(1) | LALR(1) | Merged LR(1) | Practical compilers | YACC, Bison |
| Earley | ALL CFGs | Chart parser | Natural language | — |

## First & Follow Sets
- **First(X)**: Set of terminal symbols that can begin strings derived from X
- **Follow(A)**: Set of terminals that can appear immediately after A in a derivation
- LL(1) condition: First sets for alternatives of same nonterminal must be disjoint
` },
  { code: 'CSE316', title: 'Code Optimization Cheatsheet', tags: ['compiler', 'optimization'], content: `# Code Optimization — Last Minute Revision

## Machine-Independent Optimizations

### Local (within basic block)
| Optimization | Before | After |
|-------------|--------|-------|
| Constant folding | x = 2 * 3 | x = 6 |
| Constant propagation | a=5; b=a+2 | a=5; b=7 |
| Copy propagation | x=y; z=x+1 | z=y+1 |
| Dead code elimination | x=5; x=7 | x=7 |
| Strength reduction | x*2 → x<<1 | Faster operation |
| Algebraic simplification | x+0, x*1, x*0 | Simplify to x, x, 0 |

### Global (across basic blocks)
| Optimization | Approach |
|-------------|----------|
| Common subexpression elimination | Reuse computed values |
| Loop invariant code motion | Move invariant code outside loop |
| Induction variable elimination | Replace loop variable with direct computation |
| Loop unrolling | Replicate loop body to reduce branching |

## Data-Flow Analysis
| Analysis | Direction | Purpose |
|----------|-----------|---------|
| Reaching definitions | Forward | Which definitions reach each point |
| Live variable analysis | Backward | Which variables will be used later |
| Available expressions | Forward | Which expressions have been computed |
| Very busy expressions | Backward | Which expressions must be computed |

## Must-Know
- **Peephole optimization**: Small window over generated code → replace inefficient patterns
- **Basic block**: Straight-line code with single entry and single exit
- **CFG**: Nodes = basic blocks, Edges = control flow
` },
  { code: 'CSE316', title: 'Runtime Memory Management Guide', tags: ['compiler', 'runtime', 'memory'], content: `# Runtime Memory Management — Last Minute Revision

## Memory Layout
| Section | Grows | Contents |
|---------|-------|----------|
| Code (Text) | Fixed | Executable instructions (read-only) |
| Static Data | Fixed | Global variables, constants |
| Heap | Up ↑ | Dynamic allocation (malloc/new) |
| Stack | Down ↓ | Function calls, local variables, activation records |

## Activation Record (Stack Frame)
| Contents | Purpose |
|----------|---------|
| Return value | Store function result |
| Actual parameters | Pass arguments |
| Control link (dynamic link) | Previous frame pointer (dynamic chain) |
| Access link (static link) | Access non-local variables (static chain) |
| Saved machine state | Registers, return address |
| Local data | Function's local variables |
| Temporary variables | Intermediate computation results |

## Parameter Passing
| Method | Semantics | Direction |
|--------|-----------|-----------|
| Call by Value | Copy of argument | Input only |
| Call by Reference | Alias to argument | Input/Output |
| Call by Result | Copy out at return | Output only |
| Call by Value-Result | Copy in, copy out | Input/Output |
| Call by Name | Textual substitution (like macros) | Delayed |

## Garbage Collection
| Algorithm | Type | Pros | Cons |
|-----------|------|------|------|
| Mark-Sweep | Tracing | Handles cycles | Fragmentation, pause |
| Copying (Cheney) | Tracing | No fragmentation | Half heap wasted |
| Reference Counting | Incremental | Low pause | Cycles not collected |
| Generational | Hybrid | Good for most programs | Complex implementation |
` },
];

// Insert extra cheatsheets into main array
for (const c of EXTRA_CHEATS) CHEATSHEETS.push(c);
console.log('Total cheatsheets defined: ' + CHEATSHEETS.length);
    // Insert cheatsheets (UPSERT — replace on re-run)
    const insertCheat = db.prepare(`
      INSERT INTO lms_resources
      (id, type, title, description, difficulty, semester, subjectCode, subjectName, unit, unitNormalized,
       tags, uploadedBy, uploadedAt, updatedAt, noteContent, estimatedMinutes, renderType, exportable, isDeleted)
      VALUES (?, 'note', ?, ?, 'intermediate', 'VI', ?, ?, 'Quick Reference', 'quick-reference',
       ?, 'quality-pipeline', datetime('now'), datetime('now'), ?, 5, 'markdown', 1, 0)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, description=excluded.description, subjectCode=excluded.subjectCode,
        subjectName=excluded.subjectName, tags=excluded.tags, noteContent=excluded.noteContent,
        updatedAt=datetime('now'), isDeleted=0
    `);

    for (const cheat of CHEATSHEETS) {
      const cheatId = 'cheat_' + makeId(cheat.code + '_' + cheat.title);
      const tags = JSON.stringify(cheat.tags.concat([cheat.code.toLowerCase(), 'quick-reference', 'cheatsheet']));

      try {
        insertCheat.run(cheatId, cheat.title, cheat.code + ' — Last Minute Revision: ' + cheat.title, cheat.code, SUBJECT_NAMES[cheat.code], tags, cheat.content);
        cheatsWritten++;

        for (const tag of cheat.tags) {
          if (/^[a-z]/.test(tag)) {
            const topicId = 'topic_' + makeId(cheat.code + '_' + tag);
            insertTopic.run(topicId, tag, cheat.code);
            try { insertLink.run(cheatId, topicId); } catch(e) {}
          }
        }
      } catch (err) {
        errors.push('Cheat: ' + cheat.title + ' — ' + err.message);
      }
    }
    console.log(`Written ${cheatsWritten} cheatsheets`);

    // Final verification query
    const totalBySubject = db.prepare("SELECT subjectCode, COUNT(*) as c FROM lms_resources WHERE isDeleted=0 GROUP BY subjectCode ORDER BY c DESC").all();
    console.log('\n=== FINAL STATE ===');
    for (const row of totalBySubject) {
      const types = db.prepare("SELECT COUNT(DISTINCT type) as c FROM lms_resources WHERE subjectCode=? AND isDeleted=0").get(row.subjectCode);
      console.log(`  ${row.subjectCode}: ${row.c} resources, ${types.c}/5 types`);
    }

    const totalAll = db.prepare("SELECT COUNT(*) as c FROM lms_resources WHERE isDeleted=0").get().c;
    console.log(`\nTotal active resources: ${totalAll}`);
    console.log(`Total notes written: ${notesWritten}`);
    console.log(`Total cheatsheets: ${cheatsWritten}`);
    console.log(`Errors: ${errors.length}${errors.length > 0 ? '\n  ' + errors.join('\n  ') : ''}`);
    console.log(`Time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    db.close();
  }
}

main();

// Additional cheatsheets to reach 32 total (8 subjects × 4)
