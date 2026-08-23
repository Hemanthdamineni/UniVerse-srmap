# TCP Congestion Control — Slow Start, AIMD, Fast Retransmit

## 1. Overview — Why This Matters, Real-World Relevance

Congestion control is the single most important algorithm that keeps the Internet from collapsing under its own traffic. Without it, senders would blindly pump packets into the network, routers would experience bufferbloat (excessively large buffers filling up, causing high latency) and eventually overflow, dropping packets. Packet loss would cascade, and throughput for *everyone* would plummet to near zero — a condition called **congestion collapse**, which actually happened in the mid-1980s. TCP congestion control was the fix, and it is why the Internet scales to billions of devices today.

**Real-world relevance:**
- Every time you stream Netflix, download a file, or load a web page, TCP congestion control governs how fast those packets arrive.
- Cloud providers (AWS, GCP) tune TCP parameters (initial window, pacing) to shave milliseconds off latency — worth millions in revenue.
- Congestion control variants such as CUBIC (the default Linux CC for nearly two decades) and BBR (a more recent model-based variant from Google) show how the field evolves; knowing classic TCP Reno / Van Jacobson congestion control is the prerequisite.
- Interviewers at FAANG+ ask about Slow Start / AIMD / Fast Retransmit in every networking round — it is the canonical example of a **distributed, additive-increase multiplicative-decrease (AIMD) control loop**.

The bottom line: this topic bridges **math (control theory)**, **systems (OS kernel networking stack)**, and **real-world performance (throughput vs. latency tradeoffs)**.

---

## 2. Prerequisites & Background Knowledge

Before studying congestion control, you should be comfortable with:
- **TCP segment structure** — sequence numbers, acknowledgment numbers, header flags
- **Sliding window / flow control** — how the receiver window (`rwnd`) prevents sender overflow
- **ACK mechanism** — cumulative ACKs, why duplicate ACKs occur (out-of-order delivery)
- **Packet loss** — the difference between detected loss via timeout vs. via duplicate ACKs

If any of these are unfamiliar, review those topics first. Congestion control builds directly on them.

---

## 3. Key Concepts & Definitions

| Term | Formal Definition |
|---|---|
| **Congestion Window (cwnd)** | Sender-side variable (in segments or bytes) that limits how much data can be in-flight before an ACK arrives. The sender can send `min(cwnd, rwnd)` unacknowledged bytes at any time. |
| **Receiver Window (rwnd)** | Advertised by the receiver in TCP headers — the receiver's available buffer space. Flow control, not congestion control. |
| **Slow Start** | Phase where `cwnd` grows **exponentially**: for every ACK received, `cwnd` increases by 1 MSS, effectively doubling per RTT. Begins after connection setup or after a timeout. |
| **Congestion Avoidance (AIMD)** | Phase entered after `cwnd >= ssthresh`. Growth switches to **linear** (additive increase): `cwnd += MSS * (MSS / cwnd)` per ACK, i.e., +1 MSS per RTT. On loss, `cwnd` is cut multiplicatively (usually halved). |
| **Slow Start Threshold (ssthresh)** | Boundary between Slow Start and Congestion Avoidance. Initialized to a high value (e.g., 65,535 bytes). After a loss event, `ssthresh = max(FlightSize/2, 2*MSS)`, where FlightSize is the number of bytes outstanding at the time of loss (in practice, approximately equal to `cwnd`). The `2*MSS` floor prevents the window from collapsing below two segments, ensuring the connection can still make progress. |
| **Fast Retransmit** | If a sender receives **3 duplicate ACKs** (same ACK# repeated 3 times), it infers a packet loss *without waiting for a timeout*. The segment at that sequence number is retransmitted immediately. |
| **Fast Recovery** | After Fast Retransmit, the sender enters Fast Recovery instead of Slow Start (details in Section 7). |
| **Additive Increase / Multiplicative Decrease (AIMD)** | The core control law: increase `cwnd` gently (+1 MSS per RTT) to probe for available bandwidth; upon detecting loss, decrease sharply (halve `cwnd`) to relieve congestion. |
| **Retransmission Timeout (RTO)** | A timer that triggers when an ACK is not received within an estimated interval (typically computed from smoothed RTT and RTT variance). On RTO expiry: `ssthresh` is set to `max(FlightSize/2, 2*MSS)`, `cwnd` is reset to the initial window (IW, typically 10 MSS on modern Linux, or 1 MSS in classic TCP), and the sender re-enters Slow Start. This is the most severe loss reaction — it assumes all in-flight data may be lost. |
| **Duplicate ACK** | An ACK with the same acknowledgment number as the previous one, indicating the receiver got an out-of-order segment and expects the missing one. |
| **MSS (Maximum Segment Size)** | The largest TCP segment payload (usually 1460 bytes for Ethernet). `cwnd` is often expressed in units of MSS. |
| **Bufferbloat** | Excessively large router buffers that cause high latency without necessarily dropping packets, fooling TCP into thinking the path is fine when it is actually congested. This delays the loss signal that TCP relies on. |

---

## 4. The Congestion Problem

TCP is a **self-clocking** protocol — the arrival of ACKs paces the sending of new data. But in a shared network (the Internet), multiple senders compete for router buffer and link capacity. If all senders transmit at their maximum rate, router queues overflow, packets are dropped, and retransmissions add even more traffic — a **positive feedback loop** that leads to congestion collapse.

Van Jacobson (1988) solved this by introducing four interlocking mechanisms into TCP: **Slow Start, Congestion Avoidance, Fast Retransmit, and Fast Recovery** (collectively called **TCP Tahoe** and later **TCP Reno**). These mechanisms form a distributed control loop where each sender independently probes for available capacity and reacts to loss signals, without requiring centralized coordination.

The key insight: **packet loss is used as an implicit congestion signal**. In a lossless network, the sender keeps increasing its rate. When loss occurs, the sender interprets it as "the network is congested" and backs off.

---

## 5. Slow Start — Exponential Growth

**Goal:** Quickly discover the available bandwidth without prior knowledge.

**How it works:**
1. After connection setup (or after a timeout), `cwnd` is initialized to 1 MSS (or 10 MSS in modern Linux — RFC 6928).
2. For **each ACK** received, `cwnd` increases by 1 MSS. Because one ACK typically arrives per segment delivered, this effectively doubles `cwnd` every round-trip time (RTT).
3. This exponential growth continues until `cwnd >= ssthresh`, at which point the sender transitions to Congestion Avoidance (Section 6).

### Numerical Example — Slow Start

Assume `ssthresh = 64` initially, initial `cwnd = 1` MSS:

| RTT | cwnd (MSS) | Total segments sent this RTT | Cumulative segments delivered |
|-----|------------|------------------------------|-------------------------------|
| 1   | 1          | 1                            | 1                             |
| 2   | 2          | 2                            | 3                             |
| 3   | 4          | 4                            | 7                             |
| 4   | 8          | 8                            | 15                            |
| 5   | 16         | 16                           | 31                            |
| 6   | 32         | 32                           | 63                            |
| 7   | 64         | 64                           | 127                           |
| 8   | **enter Congestion Avoidance** | —                | —                             |

After RTT 7, `cwnd = 64 == ssthresh`, so at RTT 8 the sender switches to linear (additive) growth. The exponential ramp from 1 to 64 segments in just 7 RTTs is the power of Slow Start — it reaches available capacity quickly without prior knowledge.

---

## 6. Congestion Avoidance — AIMD (Linear Growth)

**Goal:** Probe gently for additional bandwidth after the rough capacity is found, while reacting decisively when congestion is detected.

**How it works:**
- **Additive Increase:** For each ACK, `cwnd += MSS * (MSS / cwnd)`. This adds roughly 1 MSS per RTT, giving linear growth.
- **Multiplicative Decrease:** When a loss is detected (3 duplicate ACKs), `ssthresh = cwnd / 2` and `cwnd = ssthresh`. The window is halved.
- After a timeout, the response is more severe: `ssthresh = cwnd / 2`, `cwnd` resets to the initial window, and Slow Start begins again.

### Numerical Example — AIMD After Slow Start

Continuing from the Slow Start example above, suppose `cwnd = 64` when Congestion Avoidance begins, and a loss occurs at `cwnd = 80`:

| RTT | cwnd (MSS) before loss | Action | cwnd after loss | ssthresh after loss |
|-----|------------------------|--------|-----------------|---------------------|
| 8   | 65 → 66 → ...         | AI     | 80 (peak)       | —                   |
| ... | ...                    | AI     | ...             | —                   |
| Loss detected | 80           | MD     | 40              | 40                  |
| Loss+1 | 41                    | AI (+1 per RTT) | — | — |
| Loss+2 | 42                    | AI     | —               | —                   |
| ...   | ...                    | AI     | ...             | ...                 |

Contrast this with Slow Start: reaching 80 segments took 7 RTTs in exponential mode, but recovering from 80 to 80 again after halving takes 40 RTTs in AIMD mode. This asymmetry is deliberate — it punishes congestion aggressively while probing cautiously.

### Why AIMD Converges to Fairness

If two connections sharing a bottleneck both follow AIMD, their throughput converges to equal shares over time. The intuition: multiplicative decrease shrinks both windows proportionally (preserving their ratio), while additive increase adds the same absolute amount to each (shrinking the ratio gap). Repeated cycles push both connections toward the same equilibrium point.

---

## 7. Fast Retransmit & Fast Recovery

### 7.1 Fast Retransmit

In classic TCP (Tahoe), the only way to detect loss was the retransmission timeout (RTO), which could take hundreds of milliseconds. Fast Retransmit is an optimization: the sender detects loss sooner using duplicate ACKs.

**Why 3 duplicate ACKs?** The first duplicate ACK could be caused by packet reordering rather than loss. Using 3 duplicates as the threshold gives high confidence that the segment is genuinely lost without being too conservative. (Using 1 would cause spurious retransmits on reordering; using 10 would delay recovery unnecessarily.)

### 7.2 Fast Recovery — Intuition

When the sender receives 3 duplicate ACKs, it knows:
- The missing segment did not arrive.
- **But 3 segments did arrive** at the receiver (each duplicate ACK was triggered by a new out-of-order segment). Those 3 segments have left the network — they consumed buffer space at the receiver and were acknowledged.

This means the sender can safely inject **3 new segments** into the network without exceeding the previous window size, because 3 segments just departed. That is the reason for the `+3*MSS` adjustment.

Each subsequent duplicate ACK means another segment has left the network, allowing one more segment to be sent (the per-duplicate-ACK increment of `cwnd` by 1 MSS).

### 7.3 Fast Recovery — Step-by-Step Procedure

1. **On detecting loss** (3rd duplicate ACK received):
   - Set `ssthresh = max(FlightSize / 2, 2 * MSS)`. (FlightSize is roughly `cwnd` at loss time.)
   - Retransmit the missing segment (Fast Retransmit).
   - Set `cwnd = ssthresh + 3 * MSS`. (The +3 accounts for the 3 segments that left the network.)

2. **For each additional duplicate ACK** received while in Fast Recovery:
   - Increment `cwnd` by 1 MSS.
   - If permitted by the updated `cwnd`, transmit a new data segment (if available).

3. **When a new ACK arrives** (acknowledging the retransmitted data):
   - Exit Fast Recovery.
   - Set `cwnd = ssthresh` (the halved value from step 1).
   - Enter Congestion Avoidance.

The critical difference from a timeout: the sender never resets `cwnd` to the initial window, so throughput recovers much faster. The pipe was still delivering data during the loss event — Fast Recovery reflects that.

---

## 8. TCP Tahoe vs TCP Reno

The two classic variants differ in their response to 3 duplicate ACKs:

| Variant | On 3 duplicate ACKs | Throughput Impact |
|---------|---------------------|-------------------|
| **TCP Tahoe** | Sets `cwnd = 1 MSS`, `ssthresh = cwnd/2`, enters **Slow Start**. | Severe — the exponential ramp must re-discover the available bandwidth from scratch. |
| **TCP Reno** | Enter **Fast Recovery** instead (Section 7). `cwnd` is halved but not reset to 1. | Significantly better — the connection stays in Congestion Avoidance after recovery. |

Tahoe's approach is simpler but wastes capacity after a single packet loss, which is common on modern networks. Reno's Fast Recovery is the more practical algorithm and is the basis for most subsequent work. Many exam questions ask you to compare the two — the key takeaway is that Reno avoids restarting Slow Start for isolated packet losses.

---

## 9. State Machine & Event Transitions

Below is the TCP congestion control state machine (Reno variant):

```
                    ┌───────────────┐
                    │               │
        ┌──────────►│   Slow Start  │◄────────────┐
        │           │  (exponential) │             │
        │           │               │             │
        │           └───────┬───────┘             │
        │                   │                     │
        │          cwnd >= ssthresh               │
        │                   │                     │
        │                   ▼                     │
        │           ┌───────────────┐             │
        │           │               │             │
        │           │ Congestion    │─────────────┤
        ├───────────│ Avoidance     │  3 dupACK  │
        │   RTO     │  (AIMD)      │             │
        │           │               │◄────────────┘
        │           └───────┬───────┘
        │                   │
        │                   │  3 dupACK
        │                   ▼
        │           ┌───────────────┐
        │           │               │
        │           │ Fast Recovery │──► new ACK (exit) → Congestion Avoidance
        │           │               │
        │           └───────────────┘
        │
        └─────────────────────────────────── RTO (reset cwnd to IW)

Transitions:
─────────────────────────────────────────────────────
Event                         │  Action
─────────────────────────────────────────────────────
Connection setup / RTO expiry │ Enter Slow Start (cwnd = IW, ssthresh = initial high value)
cwnd >= ssthresh (Slow Start) │ Enter Congestion Avoidance
3 duplicate ACKs (Avoidance)  │ Fast Retransmit + Fast Recovery (Reno) OR Slow Start (Tahoe)
3 duplicate ACKs (Recovery)   │ Stay in Recovery, increment cwnd per dupACK
New ACK (Recovery)            │ Exit to Congestion Avoidance (cwnd = ssthresh)
RTO expiry (any state)        │ ssthresh = max(FlightSize/2, 2*MSS), cwnd = IW, enter Slow Start
─────────────────────────────────────────────────────
```

---

## 10. Advanced Topics — CUBIC, BBR, ECN

### CUBIC (Default Linux CC since kernel 2.6.19, 2006)
CUBIC replaces the linear "additive increase" of AIMD with a cubic function: after a loss, `cwnd` grows slowly near the previous loss point (the "plateau") and then accelerates. This is because the network has already shown it can sustain that window before loss. CUBIC is particularly effective on high-bandwidth, high-latency paths ("long-fat pipes") where AIMD's linear recovery would be painfully slow.

### BBR (Bottleneck Bandwidth and Round-trip propagation time)
Developed by Google, BBR is a **model-based** approach rather than a loss-based one. Instead of waiting for packet loss as a congestion signal, BBR estimates the bottleneck bandwidth and minimum RTT directly, then paces at the estimated rate. BBR avoids the bufferbloat problem entirely — it does not need to fill buffers to find capacity. BBR is deployed on Google's B4 and YouTube servers.

### ECN (Explicit Congestion Notification)
An optional extension that lets routers mark packets (instead of dropping them) when queues are growing. The receiver echoes the ECN mark back to the sender via the ACK. The sender treats an ECN mark the same as a packet loss (halves `cwnd`). ECN avoids the retransmission overhead of dropped packets, but requires end-to-end support (router + both hosts).

### At a Glance

| Algorithm | Type | Loss Signal | Bufferbloat Tolerance | Best For |
|-----------|------|-------------|----------------------|----------|
| Tahoe / Reno | Loss-based | Packet drop | Poor | Classic networks, exams |
| CUBIC | Loss-based (cubic) | Packet drop | Moderate | High-BW, high-latency |
| BBR | Model-based | BW/RTT estimation | Excellent | Modern internet, video |

---

## 11. Practice Problems & Quick Reference

### Practice Problems

**Problem 1 — cwnd Trace**
A TCP Reno connection starts with `cwnd = 1` MSS, `ssthresh = 64`. After 6 RTTs of Slow Start, a loss is detected via 3 duplicate ACKs.
- (a) What is `cwnd` just before the loss?
- (b) What is `ssthresh` after the loss?
- (c) What is `cwnd` after Fast Recovery completes?
- (d) How many RTTs will it take to reach `cwnd = 32` again?

<details>
<summary>Solution</summary>

- (a) Slow Start doubles each RTT: RTT 1: 1, RTT 2: 2, RTT 3: 4, RTT 4: 8, RTT 5: 16, RTT 6: 32. So `cwnd = 32` just before loss.
- (b) `ssthresh = max(FlightSize/2, 2) = max(32/2, 2) = 16`.
- (c) After Fast Recovery: `cwnd = ssthresh = 16`.
- (d) In Congestion Avoidance (+1 MSS per RTT): 16 RTTs (from 16 to 32).
</details>

**Problem 2 — Tahoe vs Reno Throughput**
A TCP connection at `cwnd = 50` detects loss via 3 duplicate ACKs. Compare `cwnd` immediately after recovery for Tahoe vs Reno.
- Tahoe: `cwnd = 1` (returns to Slow Start).
- Reno: `cwnd = ssthresh = 25` (enters Congestion Avoidance via Fast Recovery).

Which recovers faster and by how much? (Consider how many RTTs Tahoe needs to reach `cwnd = 25` again.)

<details>
<summary>Solution</summary>

- Tahoe must Slow Start from 1 to 25: starts at 1, then 2, 4, 8, 16, 32 — hits `ssthresh=25` after 5 RTTs (reaches cwnd=16 at RTT 4, then enters CA and grows linearly from there). Reno is already at cwnd=25 immediately after recovery, saving approximately 5 RTTs. For a 100ms RTT, that is 500ms of lost throughput — significant for interactive applications.
</details>

**Problem 3 — ssthresh after Timeout**
A TCP connection has `cwnd = 48` when an RTO expires. What are `ssthresh` and `cwnd` after the timeout?

<details>
<summary>Solution</summary>
`ssthresh = max(48/2, 2) = 24`. `cwnd = IW` (1 MSS in classic TCP, 10 MSS in modern Linux — specify which convention you are using in your answer). The connection re-enters Slow Start.
</details>

**Problem 4 — Why 3 Duplicate ACKs?**
Explain why Fast Retransmit uses 3 duplicate ACKs rather than 1 or 10.

<details>
<summary>Solution</summary>
- **1 duplicate ACK** is too few: packet reordering can easily cause a single duplicate ACK, triggering false retransmits.
- **10 duplicate ACKs** is too many: it delays loss detection, reducing throughput. The sender would have to wait for 10 more segments to arrive, wasting capacity on a congested link.
- **3 duplicates** balances these concerns — it is unlikely from reordering alone (especially in Reno's era) but still provides fast loss detection.
</details>

**Problem 5 — AIMD Fairness (Short Answer)**
Two TCP Reno connections, A and B, share a bottleneck link. A currently has `cwnd = 100`, B has `cwnd = 20`. After one loss event followed by several RTTs without loss, explain why their windows converge toward equality.

<details>
<summary>Solution</summary>
On loss, both halve: A to 50, B to 10. Then additive increase adds +1 MSS per RTT to both. A goes from 50→51→52..., B from 10→11→12... The absolute gap shrinks from 40 to... After MD the gap goes from 80 to 40 immediately, then AI adds equal absolute increments, so the *ratio* gap (A/B) shrinks each RTT. Over multiple loss cycles, both converge to the fair share.
</details>

### Quick Reference Summary

| Mechanism | Growth Rate | Trigger | Key Formula |
|-----------|------------|---------|-------------|
| Slow Start | Exponential (double per RTT) | Connection start / RTO | `cwnd += MSS` per ACK |
| Congestion Avoidance | Linear (+1 MSS per RTT) | `cwnd >= ssthresh` | `cwnd += MSS²/cwnd` per ACK |
| Fast Retransmit | — | 3 duplicate ACKs | Retransmit missing segment immediately |
| Fast Recovery | Inflated window per dupACK | After Fast Retransmit | `cwnd = ssthresh + 3*MSS`, +1 per dupACK, then `cwnd = ssthresh` on new ACK |
| Timeout Reaction | Reset to IW | RTO expiry | `ssthresh = max(FlightSize/2, 2*MSS)`, `cwnd = IW` |

### Key Formulas to Memorize

1. **Slow Start:** `cwnd_new = cwnd + MSS` per ACK (≈ doubles per RTT)
2. **Congestion Avoidance (AIMD):** `cwnd += MSS * (MSS / cwnd)` per ACK (≈ +1 MSS per RTT)
3. **ssthresh after loss:** `ssthresh = max(FlightSize / 2, 2 * MSS)`
4. **Fast Recovery entry:** `cwnd = ssthresh + 3 * MSS`
5. **Fast Recovery exit:** `cwnd = ssthresh`

---

*References: Jacobson (1988) "Congestion Avoidance and Control", RFC 5681 (TCP Congestion Control), RFC 6928 (Increasing TCP's Initial Window), RFC 8312 (CUBIC), draft-cardwell-iccrg-bbr-congestion-control (BBR).*
