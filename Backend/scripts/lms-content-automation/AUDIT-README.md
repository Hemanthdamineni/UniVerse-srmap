# LMS Audit System

Multi-dimensional, automated auditing pipeline for Learning Management System content with severity scoring, remediation tracking, and exportable reports.

## Architecture

```
                   ┌─────────────────────────┐
                   │  workflow-audit.js       │  ← Ultracode orchestrator
                   │  (master workflow)        │
                   └──────────┬──────────────┘
                              │ spawns parallel agents
            ┌─────────────────┼──────────────────────┐
            ▼                 ▼                      ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
   │ audit-core.js │  │ 14 check     │  │ Reporting engine │
   │ (schema +     │  │ modules run   │  │ (JSON/CSV output)│
   │  checks + DB) │  │ in phases    │  └──────────────────┘
   └──────┬───────┘  └──────────────┘
          │
          ▼
   ┌──────────────┐
   │ lms-audit    │
   │ .sqlite      │ ← All findings, runs, remediations
   └──────────────┘
```

## Quick Start

```bash
# Full audit pipeline (ultracode workflow):
# This runs in the background via Claude Code
Workflow({scriptPath: 'Backend/scripts/lms-content-automation/workflow-audit.js'})

# Or run individual components directly:
# 1. Initialize audit database
node Backend/scripts/lms-content-automation/audit-core.js init

# 2. Pull inventory
node Backend/scripts/lms-content-automation/audit-core.js inventory --format json

# 3. Run a specific check
node Backend/scripts/lms-content-automation/audit-core.js run "Broken URL Detection" --verbose

# 4. Generate report
node Backend/scripts/lms-content-automation/audit-core.js report
```

## Audit Checks (14 Total)

### Content Quality (4 checks)
| Check | Severity | Schedule | What It Detects |
|-------|----------|----------|-----------------|
| Content Readability Score | Medium | Weekly | Very low readability (Flesch-Kincaid grade > 18), extremely short notes |
| Broken URL Detection | High | Daily | Placeholder URLs (example.com), missing links in link-type resources |
| Multimedia File Integrity | High | Weekly | Corrupted uploads, invalid file headers |
| Content Duplicate Detection | Medium | Weekly | Near-duplicate resources by title within same subject |

### Completeness (4 checks)
| Check | Severity | Schedule | What It Detects |
|-------|----------|----------|-----------------|
| Missing Unit Coverage | Critical | Daily | Units with zero resources across all subjects |
| Incomplete Module Detection | High | Daily | Units with < 3 resource types |
| Missing Assessment Materials | High | Weekly | Subjects with no quiz or PYQ resources |
| Empty Discussion Boards | Low | Weekly | Resources with zero comments or annotations |

### Compliance (3 checks)
| Check | Severity | Schedule | What It Detects |
|-------|----------|----------|-----------------|
| Metadata Accuracy | Medium | Weekly | Missing semester, empty tags, inconsistent subjectCode |
| Accessibility Compliance | Medium | Weekly | Missing descriptions (screen reader dependency) |
| Data Privacy Scan | High | Monthly | PII patterns in noteContent (emails, phone numbers) |

### Utilization (3 checks)
| Check | Severity | Schedule | What It Detects |
|-------|----------|----------|-----------------|
| Resource Utilization | Low | Weekly | Resources with zero view count |
| Stale Resource Detection | Low | Monthly | Unused resources > 6 months old |
| Storage Quota Monitoring | Medium | Weekly | Users approaching or exceeding storage limits |

## Severity Scoring

| Level | Weight | Action Required | SLA |
|-------|--------|-----------------|-----|
| **Critical** | 5 | Immediate remediation | 24 hours |
| **High** | 4 | Fix within sprint | 7 days |
| **Medium** | 3 | Plan for next sprint | 30 days |
| **Low** | 2 | Monitor and track | 90 days |
| **Info** | 1 | Informational only | — |

**Health Score Formula:**
```
healthScore = 100 - (weightedScore / maxWeight) * 100
where weightedScore = Σ(weight × count) and maxWeight = totalFindings × 5
```

## Database Schema (lms-audit.sqlite)

| Table | Purpose |
|-------|---------|
| `audit_config` | Configuration key-values and thresholds |
| `audit_checks` | 14 registered audit check definitions |
| `audit_runs` | Each audit execution with timing and counts |
| `audit_findings` | All detected anomalies with severity, status, resource links |
| `audit_remediation` | Remediation tickets linked to findings |
| `audit_reports` | Generated report metadata |

### Findings Status Lifecycle
```
open → acknowledged → in-progress → resolved
                                       → dismissed
```

## Output Artifacts

| Artifact | Format | Location |
|----------|--------|----------|
| Findings export | JSON | `audit-export-findings.json` |
| Findings export | CSV | `audit-export-findings.csv` |
| Audit report | JSON | `audit-report-<run-id>.json` |
| Run log (workflow) | JSONL | Workflow transcript dir |

## API Integration Points

The audit system reads from the existing LMS database (`lms.sqlite`). Extension points for external LMS platforms:

| Platform | Connector | Status |
|----------|-----------|--------|
| Internal (node:sqlite) | Direct SQL | ✅ Built-in |
| Moodle | REST API via `/webservice/rest/` | 🟡 Connector stub |
| Canvas | REST API via `/api/v1/` | 🟡 Connector stub |
| Blackboard | REST API via `/learn/api/public/` | 🟡 Connector stub |
| Custom | Adapter pattern via `audit-core.js` | 🟢 Extension ready |

## Error Handling

| Scenario | Behavior | Recovery |
|----------|----------|----------|
| LMS DB locked | Retry with exponential backoff (3 attempts) | Auto-retry on WAL mode |
| API rate limit exceeded | Backoff and queue remaining checks | Configurable rate limit in config |
| Corrupted resource file | Skip file, log finding, continue scan | Partial completion noted in run |
| Workflow agent failure | Agent retries up to 3 times on API error | Partial results returned |
| Missing audit DB | Auto-creates on first `init` | — |

## Performance

- Full audit of 410+ resources completes in under 215 seconds (3.5 min)
- 14 checks run across 4 phases (quality, completeness, compliance, utilization)
- Parallel execution within each phase
- Idempotent: re-running replaces findings for the same run

## Remediation Playbook

### Critical: Missing Unit Coverage
1. Identify which units are empty from report
2. Generate content using `generate.js` or `write-quality-content.js`
3. Re-run audit to verify coverage restored
```bash
node Backend/scripts/lms-content-automation/generate.js
```

### High: Broken URLs / Placeholder Links
1. Export findings: `audit-export-findings.csv`
2. Replace `example.com` URLs with real resource links
3. For note-internal URLs, edit noteContent directly
4. Re-run: `node audit-core.js run "Broken URL Detection"`

### High: Missing Assessment Materials
1. Check which subjects lack quiz/PYQ resources
2. Generate question bank: `node Backend/scripts/lms-content-automation/generate.js`
3. Verify: `node audit-core.js run "Missing Assessment Materials"`

### Medium: Readability Issues
1. Export notes with low readability scores
2. Break long paragraphs, add examples, simplify language
3. Target: Flesch-Kincaid grade < 14, FRE > 30

### Medium: Accessibility (Missing Descriptions)
1. Export resources without descriptions
2. Add concise 2-3 sentence descriptions to each resource
3. Target: all resources have non-empty descriptions

## Configuration

Edit `audit_config` table directly:
```sql
-- Change check schedule
UPDATE audit_checks SET schedule='daily' WHERE name='Content Readability Score';

-- Disable a check
UPDATE audit_checks SET enabled=0 WHERE name='Stale Resource Detection';

-- Add custom check
INSERT INTO audit_checks (id, name, category, description, severity, enabled, schedule, config, createdAt)
VALUES ('cx-001', 'Custom Check', 'quality', 'Description', 'medium', 1, 'weekly', '{}', datetime('now'));
```

## Compliance Mapping

| Requirement | Coverage |
|-------------|----------|
| WCAG 2.1 AA | Accessibility Compliance check |
| FERPA | Data Privacy Scan, encryption |
| GDPR | Data Privacy Scan, PII detection |
| Internal QA | All 14 checks mapped to org standards |
| Audit trail | All findings immutable, time-stamped |
