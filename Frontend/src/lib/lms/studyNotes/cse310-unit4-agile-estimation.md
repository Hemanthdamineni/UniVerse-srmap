# CSE310 -- Software Engineering | Unit 4: Agile Estimation

---

## Section 1: Overview -- Why This Matters, Real-World Relevance

Traditional software estimation (lines of code, function points) fails on modern projects because requirements change weekly. Agile estimation solves this by measuring **relative effort** instead of absolute time, letting teams predict delivery dates even when the backlog shifts. In industry, every Scrum team uses story points and velocity -- knowing these concepts cold separates a developer who can estimate their own work from one who cannot. Tools like Jira, Linear, Azure Boards, and Clubhouse all have built-in velocity tracking and burndown charts; you will see them on day one of most product-team engineering jobs that follow Scrum, Shape Up, or any iterative methodology.

**Why this matters for your exam:** Estimation questions appear in virtually every software engineering exam (GATE, university finals, industry certifications like PSM I). The ability to calculate velocity, interpret a burndown chart, and explain why teams use relative estimation over hours is a core competency.

---

## Section 2: Key Concepts & Definitions

All terms in this unit are organised into two categories: the techniques teams use to estimate work, and the metrics they use to plan and track progress.

### 2.1 Estimation Techniques

| Term | Definition |
|---|---|
| **Story Point** | A unitless measure of the *relative* effort required to implement a user story. Story points intentionally avoid direct mapping to wall-clock hours because they factor in complexity, risk, and effort holistically -- teams should resist the urge to convert points into hours, though some organisations back-correlate for capacity planning. |
| **Relative Estimation** | Comparing a new story against a known reference story rather than guessing absolute hours. |
| **Planning Poker** | A structured estimation game where team members play numbered cards (modified Fibonacci sequence) to vote on story size, then discuss discrepancies and re-vote until consensus is reached. |
| **Affinity Estimation** | Sorting stories into buckets (XS, S, M, L, XL) in a single pass -- faster than Planning Poker for large backlogs (50+ items). |
| **T-shirt Sizing** | A coarse estimation technique using T-shirt sizes (XS through XXL) before refining into points during sprint planning. |
| **Reference Story** | A baseline story the team agrees is, say, 3 points; all other stories are compared against it during estimation sessions. |
| **Ideal Person-Hour** | A fictitious hour with zero interruptions -- the unit Agile deliberately avoids because it creates false precision in an environment where interruptions are the norm. |

### 2.2 Planning & Tracking Metrics

| Term | Definition |
|---|---|
| **Velocity** | The average number of story points a team completes per sprint (iteration). Used to forecast how much work future sprints can absorb. |
| **Burndown Chart** | A line chart showing remaining work (y-axis: remaining story points or effort units) vs. time (x-axis: days in the sprint). The ideal burndown is a straight line from total work to zero. |
| **Burnup Chart** | Shows both total scope (upper line) and completed work (lower line) over time; useful when scope changes mid-sprint because the widening gap between the two lines signals scope growth. |
| **Task-Hour Burndown** | A variant of the burndown chart that plots remaining task hours rather than story points. Common on task boards but not a substitute for a story-point burndown at the sprint level. |
| **Yesterday's Weather** | The simple rule: assume this sprint's velocity will match last sprint's velocity (no over-optimism). Named after the observation that tomorrow's weather is best predicted by today's weather. |
| **Sprint Goal** | A short, high-level objective that gives coherence to the sprint's selected stories -- success is measured against the goal, not individual story points. |
| **Capacity** | The team's available person-hours for a sprint after subtracting meetings, PTO, and ceremonies. Velocity must be adjusted for capacity changes using the ratio (current capacity / reference capacity). |

---

## Section 3: Detailed Explanation -- Deep Structured Explanation with Subsections

### 3.1 Why Not Hours?

Newcomers always ask: *Why not just estimate in hours?* The short answer: humans are terrible at absolute estimation but surprisingly good at relative estimation. Ask someone "how long will this take?" and they guess. Ask "is this bigger or smaller than *that thing we did last week*?" and they converge with the team. Story points also absorb non-linear factors (a 2-hour meeting, a sick teammate, production outage) into velocity over time -- hours force you to predict the unpredictable.

Moreover, hours create a false sense of precision. If a developer estimates 14 hours for a task, stakeholders treat that as a commitment. If the same work is estimated as 5 story points, the team's historical velocity absorbs the variance naturally. Points flex; hours break.

### 3.2 The Fibonacci Scale

Most teams use the modified Fibonacci sequence for story points:

```
1, 2, 3, 5, 8, 13, 21, 40, 100
```

The gaps widen as numbers grow because uncertainty compounds -- a 40-point story is not 5 times more work than an 8-point story; it is simply too large to estimate reliably and should be decomposed into smaller stories (epics) before being pulled into a sprint. A debate between 3 and 5 points is productive -- it surfaces differences in how the team interprets complexity. A debate between 24 and 25 points is noise: the story is too large for anyone to tell the difference, and the energy spent debating would be better spent splitting the work.

**Rule of thumb:** Any story above 13 points is an epic that must be split before it enters a sprint.

### 3.3 Velocity Calculation

Velocity is not a target -- it is an *observed metric*. After each sprint:

```
Velocity(N) = Sum of story points on all stories that met the Definition of Done in Sprint N
```

A rolling average over the last 3 sprints smooths outliers:

```
Forecast Velocity = (V(N-2) + V(N-1) + V(N)) / 3
```

**Important rules:**
- Partial credit is not awarded. A story that is 90% done counts as 0 points until it meets the Definition of Done.
- A sprint with zero completed stories yields velocity = 0. This is valuable data -- it signals a systemic problem (overcommitment, blockers, poor scope).
- Velocity is never "assigned" or "promised" -- it emerges from historical data.
- Always recompute velocity from completed points, not committed points.

### 3.4 Burndown Chart Construction & Interpretation

Every day (or every stand-up), the team answers: *How many points of remaining work are left on the sprint board?*

```
Day 0:  Remaining = total points committed
Day N:  Remaining = sum of points on all "To Do" + "In Progress" columns
```

The **ideal line** draws from (Day 0, total points) to (last day, 0). It represents perfect, even progress.

```
Remaining
Points
   ^
   |  T x
   |  T   x
   |  T     x
   |  T       x  *  *
   |  T           *     *
   |  T                    *
   +---------------------------> Days
   0   1   2   3   4   5   6   7

   T = Total points committed (start)
   x = Ideal burndown line (straight from T to 0)
   * = Actual burndown line (starts near ideal, drifts above mid-sprint, then accelerates)
```

**What to look for:**
- **Actual line consistently above ideal:** Team overcommitted. Future sprints should pull fewer points.
- **Actual line consistently below ideal:** Team is ahead (or underestimated). Can they pull in more work?
- **Line goes up mid-sprint:** New work was added. The team must negotiate with the Product Owner to remove equivalent scope (or re-baseline the ideal line).
- **Flat line (no movement for days):** A blocker is stalled. Investigate immediately.
- **Vertical drop near the end:** Stories were completed in a batch rather than incrementally -- or the team marked everything done just before the review. Neither is ideal.

### 3.5 Linking Estimation to Sprint Planning

Estimation feeds directly into sprint planning:

1. **Capacity check:** Compute available person-days for the sprint.
2. **Velocity-based pull:** The Product Owner proposes stories whose total points match the forecast velocity, adjusted for capacity changes.
3. **Task breakdown (optional):** The team decomposes each story into tasks (hours) if needed for the task board.
4. **Commitment:** The team selects stories it is confident it can complete -- the Sprint Goal provides the "why."
5. **Daily tracking:** The burndown chart tracks progress against the plan.

**Key insight:** The team owns the *how many* (velocity) and the Product Owner owns the *how much business value* (priority). These two forces negotiate scope each sprint.

---

## Section 4: Worked Examples & Walkthroughs

### Example 1: Velocity Calculation

**Scenario:** Team Beta completes the following stories across three sprints.

| Sprint | Stories Completed (points) | Total |
|---|---|---|
| 1 | Login page (5), Password reset (3), Profile view (8), Email validation (2) | 18 |
| 2 | Search results (5), Filter by date (5), Export CSV (3), Unit test suite (8) | 21 |
| 3 | Dashboard widget (8), Notification prefs (3), Dark mode toggle (2), API rate limiter (5) | 18 |

**Step 1:** Compute each sprint's velocity.
- Sprint 1: 18 points
- Sprint 2: 21 points
- Sprint 3: 18 points

**Step 2:** Compute rolling average (3-sprint).

```
Forecast Velocity = (18 + 21 + 18) / 3 = 19 points per sprint
```

**Step 3:** Forecast.

The Product Owner wants to know how many sprints are needed for a backlog of 60 points.

```
Sprints needed = 60 / 19 ≈ 3.16 sprints (realistically: 4 sprints with the understanding that the team will likely finish early or pull in more work)
```

**Answer:** The PO communicates "approximately 4 sprints" to leadership -- confident guidance, not a hard deadline.

### Example 2: Sprint Forecasting with Capacity Change

**Scenario:** Sprint 4 has a team member on vacation (reducing capacity by 20%). Sprint 3 velocity was 18 points.

**Step 1:** Adjust for capacity.

```
Adjusted forecast = 18 × (1.0 - 0.20) = 14.4 points
```

**Step 2:** Pull no more than 14 points from the backlog. The team selects 13 points to leave a buffer.

### Example 3: Interpreting a Burndown Chart

A team committed to 30 points. The burndown shows:

- Day 0: 30 remaining
- Day 3: 25 remaining (ideal is ~21)
- Day 5: 22 remaining (ideal is ~15) -- *scope added? A 5-point story was pulled in mid-sprint.*
- Day 7 (sprint end): 8 remaining -- *sprint failure. Only 22 out of 30+5 points completed.*

**Diagnosis:** The team overcommitted AND accepted mid-sprint scope without removing equivalent work. Corrective actions: cap pull at velocity next sprint, and enforce the rule that any new story requires removing equal points.

---

## Section 5: Common Pitfalls & Anti-Patterns

### 5.1 Converting Story Points to Hours

The most common mistake. A team that says "3 points = 1 day" has missed the point of relative estimation. If the team's velocity fluctuates, the conversion breaks. If the team's composition changes, historical hour-per-point ratios become meaningless.

**Fix:** Treat points as unitless. If leadership demands hour estimates, provide a separate task-hour breakdown without anchoring it to the story-point estimate.

### 5.2 Velocity as a Performance Metric

Management that rewards higher velocity encourages point inflation -- teams will give 8-point stories 13 points to "look good." Velocity is a planning tool, not a productivity score.

**Fix:** Never compare velocity across teams. Only compare a team's velocity to its own historical average.

### 5.3 Estimation by Averages

A team that always estimates at 3 or 5 points because "most stories are medium" is not estimating -- they are guessing. True estimation involves genuine uncertainty and debate.

**Fix:** Use Planning Poker to force individual thinking before group discussion. If all stories land on the same number, the team has lost the habit of relative comparison.

### 5.4 Ignoring Capacity Changes

Using raw velocity without adjusting for team member availability, holidays, or sprint length changes.

**Fix:** Always scale: `adjusted capacity = velocity × (current available hours / reference sprint hours)`.

### 5.5 Mid-Sprint Scope Creep

Adding stories without removing equivalent points destroys the burndown chart as a tracking tool and guarantees overwork.

**Fix:** Enforce the sprint scope rule: no addition without equivalent removal, negotiated with the Product Owner at stand-up.

### 5.6 Estimating Partially Done Work

Counting a story as complete when it is "almost done" pollutes velocity data and erodes trust in forecasts.

**Fix:** The Definition of Done is binary. No partial credit.

---

## Section 6: Exam Tips & Mnemonics

### Mnemonics

| Concept | Mnemonic |
|---|---|
| Fibonacci sequence | **1 2 3 5 8 13 21 40 100** -- "One, Two, Three, Five, Eight, Teen, Twenty-One, Forty, Century" |
| Why relative > absolute | **RACE** -- Relative beats Absolute because of Context and Experience |
| Velocity formula | **V = Done / Sprint** -- only count stories that met the Definition of Done |
| Burndown ideal line | **S.T.R.A.I.G.H.T.** -- Starts at Total, ends at zero, Rate is Average, Is a straight line, Guides daily tracking, Has no mid-sprint increase, Team watches it |

### Exam Tips

1. **Story points are unitless.** Any exam question that asks you to convert points to hours is testing whether you know this is wrong.
2. **Velocity is observed, not set.** If a question asks "what should the team's velocity be?" the answer is always "compute from historical data."
3. **Burndown charts track remaining work.** Read the y-axis carefully -- if it goes up, scope was added.
4. **Fibonacci numbers force discrimination.** Small numbers (1, 2, 3) for small stories; large gaps (13, 21, 40) signal "too big -- split this."
5. **Three-sprint rolling average is the industry standard.** Two sprints is too noisy; four or more is too slow to react.
6. **The Sprint Goal outranks points.** A team that achieves the goal but falls short on total points is more successful than a team that completes all points but misses the goal.

### Common Exam Question Types

- "Calculate velocity from a table of completed stories" (direct formula application)
- "Why is a burndown chart flat for 3 days?" (blocker or team is not updating status)
- "Should the team re-estimate a partially complete story or re-scope the sprint?" (re-scope -- never re-estimate mid-sprint)
- "Explain why story points are preferable to hours." (relative accuracy, absorbs uncertainty, non-linear factors)

---

## Section 7: Practice Problems with Solutions

### Problem 1: Velocity Calculation

The table shows stories completed by Team Gamma across four sprints.

| Sprint | Stories (points) | Total |
|---|---|---|
| 1 | 5, 3, 8, 2 | 18 |
| 2 | 3, 5, 5, 3, 2 | 18 |
| 3 | 8, 8, 3 | 19 |
| 4 | 5, 3, 2, 2 | 12 |

**(a)** Compute the 3-sprint rolling average velocity after Sprint 4.
**(b)** The backlog contains 50 points. How many sprints should the team forecast?

<details>
<summary><strong>Solution (click to expand)</strong></summary>

**(a)** Rolling average uses sprints 2, 3, and 4:
``` (18 + 19 + 12) / 3 = 49 / 3 = 16.33 points per sprint ```

**(b)** Sprints needed = 50 / 16.33 = 3.06. Forecast: **4 sprints** (communicate with confidence margin).
</details>

---

### Problem 2: Burndown Interpretation

A team committed to 25 points. The burndown shows:

| Day | Remaining Points |
|---|---|
| 0 | 25 |
| 1 | 23 |
| 2 | 22 |
| 3 | 24 |
| 4 | 20 |
| 5 | 18 |
| 6 | 10 |
| 7 | 0 |

**(a)** What happened on Day 3?
**(b)** Is this a healthy burndown pattern? Why or why not?

<details>
<summary><strong>Solution (click to expand)</strong></summary>

**(a)** Remaining points increased from 22 to 24, meaning **scope was added** (2 more points of work entered the sprint).

**(b)** Partially healthy. The team finished on time (Day 7, 0 remaining) and the late acceleration (Day 5-7: 18 to 0) shows strong completion. However, the mid-sprint scope increase is a red flag -- the team accepted new work without removing equivalent scope. If this becomes a pattern, the team will consistently overwork. Ideally they would have removed 2 points when the new story was added, keeping the burndown line smooth.
</details>

---

### Problem 3: When to Re-Estimate vs. Re-Scope

A story estimated at 8 points is 60% complete mid-sprint but clearly has as much work remaining as a typical 5-point story. The sprint is at risk.

Should the team re-estimate the story to 5 points, or leave it at 8 and re-scope the sprint? Explain.

<details>
<summary><strong>Solution (click to expand)</strong></summary>

**Never re-estimate mid-sprint.** Story points are a commitment for the sprint -- changing the estimate after work has started invalidates the burndown chart and the sprint plan. The team should leave the estimate at 8 points and negotiate with the Product Owner to either:

- Remove an equivalent amount of scope (remove one 5-point and one 3-point story) to keep the sprint load manageable, or
- Accept that the burndown will show incomplete work and use that data in the retrospective.

Rule: **Re-estimation is for the next sprint; re-scoping is for the current sprint.**
</details>

---

### Problem 4: Capacity-Adjusted Forecast

Team Delta has a velocity of 24 points per sprint with 5 developers (full capacity). Next sprint, one developer is on holiday (2 days of a 10-day sprint) and the team has a 4-hour sprint review + 2-hour retro that are normally counted in capacity.

**(a)** What is the adjusted velocity?
**(b)** How many points should the team pull?

<details>
<summary><strong>Solution (click to expand)</strong></summary>

**(a)** Base capacity: 5 devs x 10 days = 50 person-days. Adjust: 1 dev missing for 2 days = -2 person-days. Ceremonies are already accounted for in the team's normal capacity (they happen every sprint), so no further adjustment needed for those.

Adjusted capacity = (50 - 2) / 50 = 0.96 = 96% of normal.

Adjusted velocity = 24 x 0.96 = 23.04 points.

**(b)** As a guide, the team should pull no more than 23 points. In practice, they might pull 20-21 points to maintain a buffer (the "not more than velocity" rule with a safety margin).
</details>

---

## Section 8: Comparison of Estimation Techniques

| Criterion | Planning Poker | Affinity Estimation | T-shirt Sizing |
|---|---|---|---|
| **Best for** | Sprint-level backlog (10-30 stories) | Large backlogs (50-200 items) | Early-stage or very coarse sizing |
| **Time per item** | 3-5 minutes per story | 10-30 seconds per item | 15-20 seconds per item |
| **Precision** | High (uses Fibonacci points) | Medium (buckets map to ranges) | Low (converts to points later) |
| **Team involvement** | Full team required | Small group can sort; team validates | Anyone can do a first pass |
| **Key risk** | Fatigue for large backlogs | Borderline items may be miscategorised | Loses value if not refined before sprint planning |
| **Output** | Story-level point values | Stories grouped by bucket (XS, S, M, L, XL) | T-shirt sizes; needs point mapping later |

**When to use each:**
- **Start of a new project:** T-shirt sizing to quickly scope the entire product backlog.
- **Pre-release or quarterly planning:** Affinity estimation to organise and prioritise 100+ items in a single workshop session.
- **Sprint planning:** Planning Poker for precise, consensus-driven point assignment on the top 10-30 stories.

**Hybrid approach:** Many teams use T-shirt sizing for epics, then Affinity estimation to group stories into buckets, then Planning Poker for the final sprint-level estimates.

---

## Section 9: Relationship Between Velocity and Capacity

### The Core Relationship

```
Forecast Velocity = Historical Velocity x (Current Capacity / Reference Capacity)
```

- **Historical Velocity:** The team's rolling average (3-sprint).
- **Reference Capacity:** The team's available hours during those historical sprints (assumed constant).
- **Current Capacity:** Available hours this sprint (after subtracting PTO, holidays, ceremonies, support rotation).

### Key Scenarios

| Scenario | Impact on Velocity | Action |
|---|---|---|
| Team member on vacation | Decreased | Reduce points pulled proportionally |
| Sprint shortened (e.g., 2-week to 1-week) | Decreased by ~50% | Recompute from 1-week historical data if available |
| Team adds a new member | Initially flat or slight decrease (ramp-up cost) | Expect velocity improvement after 2-3 sprints |
| Team member becomes more skilled | Gradual increase over sprints | Let velocity emerge; do not "assign" a higher number |
| Removal of tech debt backlog item | Temporary dip while team learns new patterns | Accept the dip -- long-term velocity improves |

### Common Misconception

**"If we all work more hours, velocity goes up."** In the short term, maybe. Over time, burnout destroys accuracy and quality. Velocity assumes a sustainable pace. If a team consistently works overtime, the velocity number is inflated relative to a normal week and forecasts will be wrong.

### Velocity Normalisation

For cross-team portfolio planning (e.g., two teams building features for the same product), do not compare raw velocities. Instead, use **normalised velocity**: each team estimates against its own reference stories, so a 5-point story for Team Alpha is not the same size as a 5-point story for Team Beta. Normalise by mapping each team's stories to a shared outcome (e.g., "features delivered per quarter") rather than comparing point totals directly.

---

## Section 10: Interpreting Burndown Charts (Troubleshooting)

### Common Burndown Patterns

```
PATTERN 1: TEXTBOOK BURNDOWN
Remaining
  T |x
    | x
    |  x
    |   x
    |    x
   0|_____x____ Days
    0    1  ... 10

Interpretation: Healthy. Team is making steady progress.
```

```
PATTERN 2: PLATEAU (FLAT LINE)
Remaining
  T |x-------
    |        x
    |         x
    |          x
   0|___________x_ Days
    0    1  ... 10

Interpretation: Blocker hit around Day 2, resolved around Day 6. 
Investigate the blocker cause in retro. Was it a dependency?
```

```
PATTERN 3: SCOPE INCREASE (LINE GOES UP)
Remaining
  T |x
    | x
    |  x -- x (scope added here)
    |        x
   0|_________x_ Days
    0    1  ... 10

Interpretation: New work was added mid-sprint. Remaining points 
jumped up. Team must negotiate equivalent scope removal.
```

```
PATTERN 4: LATE BATCH
Remaining
  T |x----------------
   0|_________________x Days
    0    1  ... 10

Interpretation: Almost nothing was done until Day 7-8, then 
everything was marked complete. Possible causes: team did the work 
but didn't update the board, or procrastinated and rushed. 
Either way, data quality is poor -- the burndown is not useful for 
early intervention.
```

```
PATTERN 5: SCOPE TOO SMALL (BELOW THE LINE)
Remaining
  T |x
    |  x (team is always below ideal)
    |    x
    |      x
   0|________x____ Days
    0    1  ... 10

Interpretation: Team consistently finishes early. They may be 
holding back from pulling more work (sandbagging) or consistently 
undercommitting. Experiment with pulling 1-2 more points next sprint.
```

### Troubleshooting Checklist

| Symptom | Likely Cause | Action |
|---|---|---|
| Flat line >2 days | Blocker not escalated | Stand-up: ask "what's stuck?" immediately |
| Line goes up | Scope added mid-sprint | Enforce sprint scope; negotiate removal |
| Vertical drop at end | Batch completion or late status updates | Update board daily; enforce "done = demoable" |
| Always above ideal | Chronic overcommitment | Reduce planned points next sprint |
| Always below ideal | Sandbagging or high-performing team | Experiment with 10% more points next sprint |
| Erratic zigzag | Frequent scope changes or poor daily updates | Stabilise backlog; improve board hygiene |

---

## Section 11: Quick-Reference Summary (Exam Cramming)

### Fibonacci Sequence (Modified)
```
1 -- 2 -- 3 -- 5 -- 8 -- 13 -- 21 -- 40 -- 100
```
Above 13 = epic, must be split.

### Core Formula
```
Velocity = Sum of points on Done stories
Rolling Forecast (3 sprints) = (V1 + V2 + V3) / 3
Adjusted Velocity = Historical Velocity x (Current Capacity / Reference Capacity)
```

### Burndown Chart Essentials
- **Y-axis:** Remaining story points (or effort units)
- **X-axis:** Days in the sprint
- **Ideal line:** Straight diagonal from (day 0, total) to (last day, 0)
- **Actual line:** Daily remaining points from the board (To Do + In Progress)
- **Goes up:** Scope added -- negotiate removal
- **Flat:** Blocker -- investigate immediately

### Key Principles (Remember These)

1. **Points are unitless.** Never convert to hours. If asked to choose in an exam between "hours" and "story points" for estimation, pick story points.
2. **Velocity is observed, not assigned.** Always computed from completed work.
3. **No partial credit.** A story is either Done (full points) or Not Done (0 points).
4. **Never re-estimate mid-sprint.** Re-scope instead.
5. **Don't compare velocity across teams.** Each team calibrates against its own reference story.
6. **Use a 3-sprint rolling average.** Smooths outliers without being too slow to react.
7. **Capacity adjusts velocity.** PTO, holidays, and shortened sprints all affect how many points a team can pull.

### Estimation Technique Quick-Pick

| Situation | Technique |
|---|---|
| Sprint planning (10-30 stories) | Planning Poker |
| Large backlog (50-200 items) | Affinity Estimation |
| Early / high-level scoping | T-shirt Sizing |
| First sprint with no history | Use a reference story, revisit after 3 sprints |

### Common Anti-Patterns (Don't Do These)

- Turning velocity into a KPI
- Allowing mid-sprint scope creep without removal
- Awarding partial credit for "almost done" stories
- Converting points to hours
- Comparing story points across teams
- Estimating in hours for sprint planning

---

*End of Unit 4 study note. Pair with the CSE310 lecture slides and the Scrum Guide (2020) for complete coverage.*
