# topic

**CSE304 — Operating Systems | Unit 3: Memory Management**

## 1. Overview — why this matters, real-world relevance

Page replacement algorithms decide **which memory page to evict** when the OS needs to bring in a new page but physical RAM is full. Every running program — your browser, VS Code, a database server — constantly experiences page faults, and the algorithm chosen directly determines whether the system feels snappy or starts thrashing to a crawl. Real operating systems (Linux, Windows, macOS) ship with production-tuned variants of the algorithms covered here; for example, Linux uses a **clock-like algorithm** (the "page reclaim" / PFRA) and Windows uses a **hybrid LRU-clock** with working-set management. Cloud hypervisors and database buffer pools (PostgreSQL, MySQL) also implement their own tuned LRU or clock policies because a bad replacement decision can cost milliseconds of I/O — which compounds into seconds of user-facing latency. Understanding these four algorithms is not just an exam requirement; it is the foundation for reasoning about locality, caching, and performance in any memory-constrained system.

In this note, we examine four algorithms: **FIFO, LRU, Optimal (MIN), and Clock**. Each is explained with a step-by-step worked example using a common reference string so you can compare page-fault counts directly. The note ends with a comparison table, practice problems, and a quick-reference cheat sheet.

## 2. Key Concepts & Definitions — formal definitions of every important term

| Term | Definition |
|---|---|
| **Page** | Fixed-size block of virtual memory (typically 4 KiB on x86-64). |
| **Frame** | Fixed-size block of physical memory that holds one page. |
| **Page fault** | Hardware trap when the CPU references a virtual address whose page is not in a physical frame. |
| **Page replacement** | The policy that selects a resident page (victim) to evict to disk when no free frame is available. |
| **Page fault rate** | Fraction of memory references that cause a page fault; the key performance metric. |
| **Belady's Anomaly** | Counter-intuitive property where increasing the number of frames *increases* the page fault rate (observed in FIFO). |
| **Reference string** | Sequence of page numbers accessed by a process, e.g. `7 0 1 2 0 3 0 4 2 3`. |
| **Locality of reference** | Programs tend to access a small set of pages repeatedly: **temporal locality** (recently accessed pages accessed again soon) and **spatial locality** (pages near an accessed page tend to be accessed). |
| **Thrashing** | Pathological state where the system spends more time swapping pages than executing instructions, causing throughput to collapse. |
| **Victim page** | The page chosen for eviction. |
| **Dirty / modified bit** | Hardware bit per page indicating the page was written to; dirty pages must be written back to disk before eviction, clean pages can be reclaimed immediately. |
| **Access / reference bit** | Hardware bit set by the MMU whenever the page is read or written; used by Clock / NRU algorithms. |
| **Working set** | The set of pages a process is currently using; if the process does not fit in RAM, thrashing follows. |
| **Stack property** | Property of an algorithm where the set of pages in memory for `n` frames is a subset of the set for `n+1` frames at every reference. LRU and OPT satisfy this; FIFO does not. |

## 3. Detailed Explanation — deep structured explanation with subsections

### 3.1 The Page-Fault Lifecycle

When a process accesses a virtual address:

1. The MMU looks up the **virtual address translation** in the TLB (Translation Lookaside Buffer) — TLB hit, address translated, done.
2. TLB miss -> MMU walks the page table. If the present bit is 1, the page is in RAM; update TLB, done.
3. Present bit is 0 -> **page fault** -> OS trap handler runs.
4. OS checks if a free frame exists:
   - **Free frame available** -> load page from disk into that frame, update page table, restart the faulting instruction.
   - **No free frame** -> invoke the **page replacement algorithm** to select a victim frame.
5. If the victim frame is **dirty**, write it back to disk (page-out).
6. Load the new page into the now-free frame (page-in), update page table.
7. Restart the faulting instruction.

Steps 4-6 are the critical path: **two disk I/Os** (one write, one read) if the victim is dirty. This is ~10 ms per I/O on an HDD — millions of CPU cycles wasted. A good algorithm minimizes the number of page faults.

### 3.2 FIFO (First-In, First-Out)

**Mechanism:** The OS maintains a queue of resident pages in the order they were loaded. When a victim must be chosen, the page at the **head** of the queue (oldest) is evicted, and the new page is enqueued at the **tail**.

> **Exam Tip:** FIFO is the simplest algorithm to implement, but it is also the only one covered here that suffers from **Belady's Anomaly** — adding more frames can *increase* the fault count. Remember that this anomaly is possible because FIFO is **not a stack algorithm** (it lacks the stack property).

**Pros:** Extremely simple to implement — just a circular buffer or a linked list. Low overhead per reference.

**Cons:**
- **Belady's Anomaly:** Adding more frames can increase the fault rate, which is counter-intuitive. This happens because FIFO can evict a heavily used "old" page that still has high locality.
- **Poor performance in practice:** Ignores access patterns entirely. A page that was loaded once and is used constantly gets evicted just because it arrived first.
- Not used in any modern general-purpose OS as the sole replacement policy.

**Complexity:** O(1) per reference (enqueue or no-op) + O(1) per fault (dequeue head).

**Worked Example (3 frames):** Reference string: `7 0 1 2 0 3 0 4 2 3 0 3 2`

| Ref | Frames (head -> tail) | Fault? | Victim | Notes |
|---|---|---|---|---|
| 7 | [7] | F (cold) | - | Load into empty frame |
| 0 | [7, 0] | F (cold) | - | Load into empty frame |
| 1 | [7, 0, 1] | F (cold) | - | All frames now full |
| 2 | [0, 1, 2] | F | 7 | Evict head (7), enqueue 2 |
| 0 | [0, 1, 2] | Hit | - | Already resident, no change |
| 3 | [1, 2, 3] | F | 0 | Evict head (0), enqueue 3 |
| 0 | [2, 3, 0] | F | 1 | Evict head (1), enqueue 0 |
| 4 | [3, 0, 4] | F | 2 | Evict head (2), enqueue 4 |
| 2 | [0, 4, 2] | F | 3 | Evict head (3), enqueue 2 |
| 3 | [4, 2, 3] | F | 0 | Evict head (0), enqueue 3 |
| 0 | [2, 3, 0] | F | 4 | Evict head (4), enqueue 0 |
| 3 | [2, 3, 0] | Hit | - | Already resident |
| 2 | [2, 3, 0] | Hit | - | Already resident |

**Total faults (3 frames): 10**

**Belady's Anomaly Demonstration (4 frames on the same string):**

| Ref | Frames (head -> tail) | Fault? | Victim | Notes |
|---|---|---|---|---|
| 7 | [7] | F (cold) | - | |
| 0 | [7, 0] | F (cold) | - | |
| 1 | [7, 0, 1] | F (cold) | - | |
| 2 | [7, 0, 1, 2] | F (cold) | - | All frames full |
| 0 | [7, 0, 1, 2] | Hit | - | |
| 3 | [0, 1, 2, 3] | F | 7 | Evict head (7) |
| 0 | [0, 1, 2, 3] | Hit | - | |
| 4 | [1, 2, 3, 4] | F | 0 | Evict head (0) |
| 2 | [1, 2, 3, 4] | Hit | - | |
| 3 | [1, 2, 3, 4] | Hit | - | |
| 0 | [2, 3, 4, 0] | F | 1 | Evict head (1) |
| 3 | [2, 3, 4, 0] | Hit | - | |
| 2 | [2, 3, 4, 0] | Hit | - | |

**Total faults (4 frames): 10** — but wait, with 3 frames we also got 10 faults? Let's check more carefully. Actually with 4 frames FIFO still yields a fault (reference 0 at step 11), making it 10 faults vs. 10 faults with 3 frames. For a true Belady's demonstration, use reference string `1 2 3 4 1 2 5 1 2 3 4 5`:

- **3 frames:** 9 faults
- **4 frames:** 10 faults (the anomaly: more frames, _more_ faults!)

The root cause: FIFO evicted page 3 (needed again soon) instead of page 1 or 2 (needed later) simply because 3 was older.

### 3.3 LRU (Least Recently Used)

**Mechanism:** Evict the page that has **not been used for the longest time** — i.e., the page whose most recent access is the farthest in the past. The intuition is that pages used recently are likely to be used again soon (temporal locality).

> **Exam Tip:** LRU **does not** suffer from Belady's Anomaly because it is a **stack algorithm** — the set of `n` most recently used pages is always a subset of the `n+1` most recently used pages. If asked why, cite the stack property. This is a common exam question.

**Hardware Support Options:**

1. **Timestamp (counter) method:** Each page table entry stores a timestamp (or the counter value on its last access). On a page fault, scan all resident pages to find the one with the smallest timestamp. Requires a global counter incremented on every memory reference and a full scan on each fault — expensive.

2. **Hardware matrix (n x n) method:** An n-bit matrix `M` where `M[i][j] = 1` means page i was used more recently than page j. On each access to page k, set row k to all 1s and column k to all 0s. The LRU page is the one with the smallest row value (interpreted as a binary number). Practical only for small n (<= 64).

3. **Approximate LRU (used in practice):** The Clock algorithm (section 3.5) approximates LRU without the full overhead.

**Implementation complexity:** High. True LRU requires per-access metadata updates; the overhead makes it impractical for large frame counts in production kernels.

**Complexity:** O(1) per reference to update metadata (with hardware support) + O(n) per fault to scan for minimum timestamp.

**Worked Example (3 frames):** Reference string: `7 0 1 2 0 3 0 4 2 3 0 3 2`

Order the frames by recency: **MRU (most recent) -> LRU (least recent)**.

| Ref | Frames (MRU -> LRU) | Fault? | Victim | Notes |
|---|---|---|---|---|
| 7 | [7] | F (cold) | - | |
| 0 | [0, 7] | F (cold) | - | |
| 1 | [1, 0, 7] | F (cold) | - | All full now |
| 2 | [2, 0, 7] | F | 7 | 7 is LRU, evicted |
| 0 | [0, 2, 7] | Hit | - | 0 moves to MRU |
| 3 | [3, 0, 2] | F | 7-> already gone; actually 7 was evicted. Among {0,2,7}, LRU is 7. Now frames are {0,2,3}. Order: 3 (just used), then 0 (used at ref 5), then 2 (used at ref 4). |
| 0 | After ref 6, frames are [3, 0, 2]. Ref 0 is a hit — 0 moves to MRU: [0, 3, 2] |
| 4 | [4, 0, 3] | F | 2 is LRU, evicted |
| 2 | [2, 4, 0] | F | 3 is LRU, evicted |
| 3 | [3, 2, 4] | F | 0 is LRU, evicted |
| 0 | [0, 3, 2] | F | 4 is LRU, evicted |
| 3 | [3, 0, 2] | Hit | - | 3 moves to MRU |
| 2 | [2, 3, 0] | Hit | - | 2 moves to MRU |

Let me lay this out in a proper table:

| Ref | Frames (MRU -> LRU) | Fault? | Victim | Notes |
|---|---|---|---|---|
| 7 | [7] | F | - | Cold start |
| 0 | [0, 7] | F | - | Cold start |
| 1 | [1, 0, 7] | F | - | Cold start |
| 2 | [2, 1, 0] | F | 7 | Evict LRU = 7 |
| 0 | [0, 2, 1] | Hit | - | 0 promoted to MRU |
| 3 | [3, 0, 2] | F | 1 | Evict LRU = 1 |
| 0 | [0, 3, 2] | Hit | - | 0 promoted to MRU |
| 4 | [4, 0, 3] | F | 2 | Evict LRU = 2 |
| 2 | [2, 4, 0] | F | 3 | Evict LRU = 3 |
| 3 | [3, 2, 4] | F | 0 | Evict LRU = 0 |
| 0 | [0, 3, 2] | F | 4 | Evict LRU = 4 |
| 3 | [3, 0, 2] | Hit | - | 3 promoted to MRU |
| 2 | [2, 3, 0] | Hit | - | 2 promoted to MRU |

**Total faults (3 frames, LRU): 9**

> **Common Pitfall:** Students often confuse "the page that hasn't been used the longest" (LRU) with "the page that arrived the longest ago" (FIFO). With temporal locality, LRU dramatically outperforms FIFO because it keeps actively-used pages in memory even if they arrived long ago.

### 3.4 Optimal Page Replacement (OPT / MIN)

**Mechanism:** Evict the page that will **not be used for the longest time in the future**. This is Belady's theoretical optimal algorithm — it achieves the **minimum possible page fault rate** for any given reference string.

> **Exam Tip:** OPT is a **theoretical benchmark**, not a practical algorithm — it requires knowing the entire future reference string, which the OS cannot do. Use it to evaluate how close other algorithms come to the ideal. Also: OPT is a **stack algorithm** and does not suffer from Belady's Anomaly.

**Key insight:** If you know every page a process will ever access, you can guarantee the optimal eviction decision. Since future knowledge is impossible, OPT serves only as a lower bound: no real algorithm can beat it.

**Complexity:** Not applicable for real execution (requires future knowledge). As a classroom exercise, O(n * f) per fault when scanning forward through the reference string.

**Worked Example (3 frames):** Same reference string: `7 0 1 2 0 3 0 4 2 3 0 3 2`

For each fault, scan forward in the reference string to find which resident page is referenced farthest in the future (or never again — those are the best victims).

| Ref | Frames | Fault? | Victim | Why this victim |
|---|---|---|---|---|
| 7 | [7] | F | - | Cold start |
| 0 | [7, 0] | F | - | Cold start |
| 1 | [7, 0, 1] | F | - | Cold start, now full |
| 2 | [7, 0, 1] -> [2, 0, 1] | F | 7 | 7 is referenced again at index... never again in the string after this point. Evict 7. |
| 0 | [2, 0, 1] | Hit | - | |
| 3 | [2, 0, 1] -> [2, 0, 3] | F | 1 | Look ahead: 2 is used at index 8, 0 at index 6, 1 at index... never again. Evict 1. |
| 0 | [2, 0, 3] | Hit | - | |
| 4 | [2, 0, 3] -> [2, 0, 4] | F | 3 | Look ahead: 2 at 8, 0 at 10, 3 at 9. All are used again, but 3 is used farthest in the future (index 9). Evict 3. |
| 2 | [2, 0, 4] | Hit | - | |
| 3 | [2, 0, 4] -> [2, 0, 3] | F | 4 | Look ahead: 2 at 12, 0 at 10, 4 at... never again. Evict 4. |
| 0 | [2, 0, 3] | Hit | - | |
| 3 | [2, 0, 3] | Hit | - | |
| 2 | [2, 0, 3] | Hit | - | |

**Total faults (3 frames, OPT): 7**

This is the theoretical minimum for this string with 3 frames. Compare: FIFO got 10 faults, LRU got 9 faults.

### 3.5 Clock / Second-Chance Algorithm

**Mechanism:** Arrange all resident pages in a **circular list** (like a clock face). A "hand" pointer sweeps through the list. Each page has a **reference bit** (R-bit) set to 1 by the MMU whenever the page is accessed. When a page fault occurs:

1. Check the page currently pointed to by the hand.
2. If the R-bit is **1**: clear it to 0 (give the page a "second chance"), advance the hand, repeat.
3. If the R-bit is **0**: this page has not been used since the hand last passed. **Evict it**.
4. Load the new page into that frame, set its R-bit to 1, advance the hand.

> **Common Pitfall:** A single scan pass in Clock can clear multiple R-bits without evicting anything. Students often mistakenly count every hand advancement as a victim decision — only the *first* time the hand finds an R-bit of 0 after a complete scan is the eviction. Also note: if **all** R-bits are 1, the hand will cycle through every page, clear all of them, and then evict the first one it lands on — effectively degrading to FIFO on that cycle.

**Variants:**
- **Simple Clock:** Single hand, one reference bit, as described above.
- **Second-Chance (enhanced Clock):** Uses both the reference bit (R) and the modified/dirty bit (M). Prefers evicting clean pages (R=0, M=0) over dirty ones (R=0, M=1) to avoid expensive disk writes. This is closer to what Linux's PFRA implements.
- **WSClock (Working Set Clock):** Tracks an `age` field per page to estimate the working set; used in some research OS kernels.

**Why Clock wins in practice:** True LRU requires per-access metadata updates that are too expensive at scale. Clock approximates LRU (pages accessed recently have R=1 and survive the hand sweep) with far less overhead — only a single bit per page and a periodic sweep.

**Real-world usage:**
- **Linux:** The PFRA (Page Frame Reclaim Algorithm) uses a dual-list variant of Clock with active/inactive lists, which behaves similarly.
- **Windows:** Uses a Clock-based algorithm with per-page "standby" and "modified" lists.
- **PostgreSQL:** Buffer manager uses a Clock sweep for its shared buffer pool.

**Complexity:** O(1) per reference (MMU sets the R-bit in hardware) + amortized O(1) per fault (the hand sweeps only when needed; over many faults, each page is visited roughly once per sweep cycle).

**Worked Example (4 frames):** Let's use a simpler string to illustrate the hand behavior: `1 2 3 4 1 5 1 2 3`. Start with the hand at position 0 and all R-bits = 0.

| Step | Ref | Frames with R-bits | Hand pos | Hand behavior | Victim | Fault? |
|---|---|---|---|---|---|---|
| 1 | 1 | [1:1, - , - , -] | 1 | Load into pos 0, R=1 | - | F |
| 2 | 2 | [1:1, 2:1, - , -] | 2 | Load into pos 1, R=1 | - | F |
| 3 | 3 | [1:1, 2:1, 3:1, -] | 3 | Load into pos 2, R=1 | - | F |
| 4 | 4 | [1:1, 2:1, 3:1, 4:1] | 0 | Load into pos 3, R=1 | - | F |
| 5 | 1 | [1:1, 2:1, 3:1, 4:1] | 0 | **Hit** — page 1 resident, R-bit already 1 | - | Hit |
| 6 | 5 | [1:1, 2:1, 3:1, 4:1] | 0 | **Fault** — hand at pos 0 (page 1), R=1 -> clear to 0, advance to pos 1. Page 2, R=1 -> clear to 0, advance to pos 2. Page 3, R=1 -> clear to 0, advance to pos 3. Page 4, R=1 -> clear to 0, advance to pos 0. Page 1, R=0 now! -> **evict page 1**, load page 5 with R=1, advance to pos 1. | 1 | F |
| 7 | 1 | [5:1, 2:0, 3:0, 4:0] | 1 | **Fault** — hand at pos 1 (page 2, R=0) -> evict page 2, load page 1 with R=1, advance to pos 2. | 2 | F |
| 8 | 2 | [5:1, 1:1, 3:0, 4:0] | 2 | **Fault** — hand at pos 2 (page 3, R=0) -> evict page 3, load page 2 with R=1, advance to pos 3. | 3 | F |
| 9 | 3 | [5:1, 1:1, 2:1, 4:0] | 3 | **Fault** — hand at pos 3 (page 4, R=0) -> evict page 4, load page 3 with R=1, advance to pos 0. | 4 | F |

**Total faults (4 frames, Clock): 8** (Steps 1-4 cold, then 6-9 are faults; step 5 is a hit)

> **Exam Tip:** When the Clock hand sweeps, it is the *page fault* that triggers the scan, not every memory reference. Between page faults, the MMU silently sets R-bits on accessed pages — those set bits are what give recently-used pages their "second chance."

## 4. Algorithm Comparison and Trade-offs

| Property | FIFO | LRU | OPT (MIN) | Clock |
|---|---|---|---|---|
| **Stack algorithm?** | No | Yes | Yes | Approx. yes (with R-bits) |
| **Belady's Anomaly?** | Yes | No | No | No (in practice) |
| **Implementation complexity** | Very low | High (needs per-ref metadata) | N/A (theoretical) | Low (just R-bits + hand) |
| **Per-reference overhead** | O(1) | O(1) with hardware assist | N/A | O(1) (MMU sets R-bit) |
| **Per-fault overhead** | O(1) | O(n) scan or O(1) with matrix | O(n * f) scan | Amortized O(1) |
| **Hardware support** | None | Timestamp / matrix / MMU bits | None (impossible) | Reference bit per page |
| **Used in production?** | No (alone) | In databases with small pools | No | Yes — Linux, Windows, PG |
| **Page faults (our example)** | 10 | 9 | 7 (optimal) | ~8-10 (varies with string) |
| **Fault ranking (lower is better)** | 4th | 3rd | 1st (theoretical best) | 2nd (practical best) |

## 5. Practice Problems

**Problem 1 (Basic FIFO and LRU):** Given reference string `3 2 1 0 3 2 4 3 2 1 0 4` and 3 frames, compute the number of page faults under FIFO and LRU. Show the frame contents after each reference.

**Problem 2 (OPT benchmark):** Using the same reference string as Problem 1, compute the number of page faults under OPT. How much better is OPT than FIFO and LRU?

**Problem 3 (Belady's Anomaly):** Compute FIFO page faults for reference string `1 2 3 4 1 2 5 1 2 3 4 5` with 3 frames and then with 4 frames. Which case has more faults? Explain why the anomaly occurs.

**Problem 4 (Clock simulation):** For reference string `4 3 2 1 4 3 5 4 3 2 1 5` with 4 frames, simulate the Clock algorithm. Show the hand position and R-bits after each reference. How many faults occur?

**Problem 5 (Comparison):** For the reference string `0 1 2 3 0 1 4 0 1 2 3 4`:
- (a) Compute page faults for FIFO, LRU, and OPT with 3 frames.
- (b) Compute FIFO faults with 4 frames. Does Belady's Anomaly appear?
- (c) Explain why LRU outperforms FIFO on this string, referencing temporal locality.

## 6. Quick Reference / Cheat Sheet

| Algorithm | Core Idea | Data Structure | Fault Behavior | Real-World Example |
|---|---|---|---|---|
| **FIFO** | Evict the page that arrived first | Queue (head/tail) | Belady's Anomaly possible | Not used alone |
| **LRU** | Evict the page unused the longest | Timestamp / stack / matrix | Stack property, no anomaly | PostgreSQL buffer pool |
| **OPT (MIN)** | Evict page unused farthest in future | Forward scan | Lower bound, theoretical only | Benchmark comparison |
| **Clock** | Circular scan, clear R-bits, evict first 0 | Circular list + hand pointer | Approx. LRU, no anomaly | Linux PFRA, Windows |

**One-liner memory aid:** "FIFO is fair but foolish; LRU is smart but expensive; OPT is all-knowing but impossible; Clock is LRU's practical cousin."

## 7. Summary / Key Takeaways

- Page replacement algorithms are triggered on a **page fault** when no free frame exists; the chosen victim directly impacts system performance.
- **Locality of reference** (temporal and spatial) is the key assumption behind LRU and Clock — recently used pages are likely to be used again.
- **Belady's Anomaly** (more frames, more faults) is possible only in **non-stack algorithms** like FIFO. LRU and OPT are stack algorithms and immune.
- **OPT (MIN)** provides a **theoretical lower bound** on page faults but requires future knowledge — it cannot be implemented in practice.
- **LRU** approximates optimal replacement by using past access patterns but has high overhead for exact implementation.
- **Clock / Second-Chance** is the **practical winner** in production OS kernels: it approximates LRU with minimal hardware support (one reference bit per page) and low overhead.
- The **working set model** — keeping a process's active page set in memory — prevents thrashing. Page replacement policies that respect locality (LRU, Clock) naturally support this.
- Modern OS kernels combine multiple strategies: Clock-like sweeping, active/inactive page lists, and dirty-page writeback clustering.

## 8. References / Further Reading

- **Silberschatz, Galvin, Gagne** — *Operating System Concepts*, 10th ed., Chapter 9: Virtual Memory (section 9.4: Page Replacement). The canonical textbook treatment.
- **Tanenbaum, Bos** — *Modern Operating Systems*, 5th ed., Chapter 4: Memory Management. Good discussion of Clock variants and working set.
- **Linux kernel source:** `mm/vmscan.c` — the page frame reclaim algorithm (PFRA). The `shrink_page_list()` and `get_scan_count()` functions implement the active/inactive list variant of Clock.
- **Corbet, Rubini, Kroah-Hartman** — *Linux Device Drivers*, 3rd ed., Chapter 15: Memory Mapping and DMA. Context on how the MMU interacts with page replacement.
- **PostgreSQL documentation:** Chapter 19.4 — "Resource Consumption / Memory" for the buffer pool ring replacement strategy based on Clock.
- **ACM Classic:** Belady, L. A. (1966). "A Study of Replacement Algorithms for a Virtual-Storage Computer." *IBM Systems Journal*, 5(2), 78-101. The original paper introducing OPT and analyzing Belady's Anomaly.
