export const meta = {
  name: 'lms-full-audit',
  description: 'Multi-dimensional LMS audit: quality, completeness, compliance, utilization, broken links, readability — with severity scoring, reports, and remediation',
  phases: [
    { title: 'Init Audit DB', detail: 'Create schema, seed checks' },
    { title: 'Inventory Resources', detail: 'Catalog all resources by type, subject, unit' },
    { title: 'Content Quality Checks', detail: 'Readability, broken URLs, duplicates, file integrity' },
    { title: 'Completeness Checks', detail: 'Missing units, modules, assessments' },
    { title: 'Compliance Checks', detail: 'Metadata, accessibility, privacy' },
    { title: 'Utilization Checks', detail: 'View counts, stale content, storage' },
    { title: 'Aggregate & Score', detail: 'Collate all findings, assign severity weights' },
    { title: 'Report & Remediation', detail: 'Generate report, create remediation tickets' },
  ],
}

var ROOT = '/home/zorro-omarchy/Desktop/Projects/Personal/00_Active/University-ERP'
var DB_PATH = ROOT + '/Backend/data/lms.sqlite'
var AUDIT_DB_PATH = ROOT + '/Backend/data/lms-audit.sqlite'
var CORE = ROOT + '/Backend/scripts/lms-content-automation/audit-core.js'

function shell(cmd) { return agent('Run this shell command and return the full stdout:\n' + cmd, { model: 'haiku' }) }

// ──────────────────────────────────────────────
// PHASE 1: Init
// ──────────────────────────────────────────────
phase('Init Audit DB')

log('Initializing audit database schema...')
var initResult = await shell('node ' + CORE + ' init --lms-db="' + DB_PATH + '" --audit-db="' + AUDIT_DB_PATH + '"')
log('Audit DB initialized')

// ──────────────────────────────────────────────
// PHASE 2: Inventory
// ──────────────────────────────────────────────
phase('Inventory Resources')

log('Pulling full resource inventory...')
var inventoryOutput = await shell('node ' + CORE + ' inventory --lms-db="' + DB_PATH + '" --audit-db="' + AUDIT_DB_PATH + '" --format json')
var inventory = JSON.parse(inventoryOutput)
log('Found ' + inventory.totalResources + ' resources across ' + inventory.subjects + ' subjects, ' + inventory.users + ' uploaders')
log('Distribution: ' + inventory.byType.map(function(t) { return t.type + '=' + t.c }).join(', '))
log('Date range: ' + inventory.dateRange.first + ' to ' + inventory.dateRange.last)

// ──────────────────────────────────────────────
// PHASE 3: Content Quality Checks (parallel)
// ──────────────────────────────────────────────
phase('Content Quality Checks')

log('Running content quality audit checks in parallel...')

var qualityResults = await parallel([
  function() { return shell('node "' + CORE + '" run "Content Readability Score" --lms-db="' + DB_PATH + '" --audit-db="' + AUDIT_DB_PATH + '"') },
  function() { return shell('node "' + CORE + '" run "Broken URL Detection" --lms-db="' + DB_PATH + '" --audit-db="' + AUDIT_DB_PATH + '"') },
  function() { return shell('node "' + CORE + '" run "Content Duplicate Detection" --lms-db="' + DB_PATH + '" --audit-db="' + AUDIT_DB_PATH + '"') },
])

log('Quality checks complete')

// ──────────────────────────────────────────────
// PHASE 4: Completeness Checks (parallel)
// ──────────────────────────────────────────────
phase('Completeness Checks')

log('Running completeness checks...')

var completenessResults = await parallel([
  function() { return shell('node "' + CORE + '" run "Missing Unit Coverage" --lms-db="' + DB_PATH + '" --audit-db="' + AUDIT_DB_PATH + '"') },
  function() { return shell('node "' + CORE + '" run "Incomplete Module Detection" --lms-db="' + DB_PATH + '" --audit-db="' + AUDIT_DB_PATH + '"') },
  function() { return shell('node "' + CORE + '" run "Missing Assessment Materials" --lms-db="' + DB_PATH + '" --audit-db="' + AUDIT_DB_PATH + '"') },
])

log('Completeness checks complete')

// ──────────────────────────────────────────────
// PHASE 5: Compliance Checks (parallel)
// ──────────────────────────────────────────────
phase('Compliance Checks')

log('Running compliance checks...')

var complianceResults = await parallel([
  function() { return shell('node "' + CORE + '" run "Metadata Accuracy Check" --lms-db="' + DB_PATH + '" --audit-db="' + AUDIT_DB_PATH + '"') },
  function() { return shell('node "' + CORE + '" run "Accessibility Compliance" --lms-db="' + DB_PATH + '" --audit-db="' + AUDIT_DB_PATH + '"') },
])

log('Compliance checks complete')

// ──────────────────────────────────────────────
// PHASE 6: Utilization Checks (parallel)
// ──────────────────────────────────────────────
phase('Utilization Checks')

log('Running utilization analysis...')

var utilizationResults = await parallel([
  function() { return shell('node "' + CORE + '" run "Resource Utilization Analysis" --lms-db="' + DB_PATH + '" --audit-db="' + AUDIT_DB_PATH + '"') },
  function() { return shell('node "' + CORE + '" run "Stale Resource Detection" --lms-db="' + DB_PATH + '" --audit-db="' + AUDIT_DB_PATH + '"') },
])

log('Utilization checks complete')

// ──────────────────────────────────────────────
// PHASE 7: Aggregate & Score
// ──────────────────────────────────────────────
phase('Aggregate & Score')

log('Aggregating all findings and assigning severity...')

var aggResult = await agent('Query the audit database at ' + AUDIT_DB_PATH + ' using node:sqlite.\n\nRun these queries and return JSON:\n\n1. SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN severity="critical" THEN 1 ELSE 0 END),0) as critical, COALESCE(SUM(CASE WHEN severity="high" THEN 1 ELSE 0 END),0) as high, COALESCE(SUM(CASE WHEN severity="medium" THEN 1 ELSE 0 END),0) as medium, COALESCE(SUM(CASE WHEN severity="low" THEN 1 ELSE 0 END),0) as low, COALESCE(SUM(CASE WHEN severity="info" THEN 1 ELSE 0 END),0) as info FROM audit_findings WHERE status="open"\n\n2. SELECT category, COUNT(*) as c FROM audit_findings WHERE status="open" GROUP BY category ORDER BY c DESC\n\n3. SELECT checkName, COUNT(*) as c FROM audit_findings WHERE status="open" GROUP BY checkName ORDER BY c DESC\n\n4. SELECT subjectCode, COUNT(*) as c FROM audit_findings WHERE status="open" AND subjectCode IS NOT NULL GROUP BY subjectCode ORDER BY c DESC\n\nReturn as: { totals: {}, byCategory: [{category, c}], byCheck: [{checkName, c}], bySubject: [{subjectCode, c}] }', { schema: { type: 'object', properties: {
  totals: { type: 'object' },
  byCategory: { type: 'array', items: { type: 'object' } },
  byCheck: { type: 'array', items: { type: 'object' } },
  bySubject: { type: 'array', items: { type: 'object' } },
}, required: ['totals', 'byCategory', 'byCheck', 'bySubject'] } })

var totalFindings = aggResult.totals.total || 0
log('Total open findings: ' + totalFindings)
log('  Critical: ' + (aggResult.totals.critical || 0) + ' | High: ' + (aggResult.totals.high || 0) + ' | Medium: ' + (aggResult.totals.medium || 0) + ' | Low: ' + (aggResult.totals.low || 0))

if (aggResult.byCategory && aggResult.byCategory.length > 0) {
  log('By category:')
  aggResult.byCategory.forEach(function(c) { log('  ' + c.category + ': ' + c.c) })
}

// Calculate overall health score
var weightedScore = 0
var maxWeight = totalFindings * 5
if (totalFindings > 0) {
  weightedScore = (
    (aggResult.totals.critical || 0) * 5 +
    (aggResult.totals.high || 0) * 4 +
    (aggResult.totals.medium || 0) * 3 +
    (aggResult.totals.low || 0) * 2
  )
}
var healthScore = totalFindings > 0 ? Math.round(100 - (weightedScore / maxWeight) * 100) : 100
log('LMS Health Score: ' + healthScore + '%')

// ──────────────────────────────────────────────
// PHASE 8: Report & Remediation
// ──────────────────────────────────────────────
phase('Report & Remediation')

log('Generating audit report...')
var reportResult = await shell('node ' + CORE + ' report --lms-db="' + DB_PATH + '" --audit-db="' + AUDIT_DB_PATH + '"')
log('Report generated')

log('Creating remediation tickets for critical and high findings...')
var remediationResult = await agent('Query the audit DB at ' + AUDIT_DB_PATH + ' and generate remediation actions.\n\n1. For findings with severity="critical" or severity="high" and status="open", INSERT into audit_remediation: id=uid("rem"), findingId, action=recommendation text, status="pending", createdAt=datetime("now")\n\n2. After inserting, SELECT f.id, f.title, f.severity, f.recommendation, r.id as remediationId FROM audit_findings f LEFT JOIN audit_remediation r ON r.findingId=f.id WHERE f.severity IN ("critical","high") AND f.status="open" ORDER BY f.severity\n\nReturn: { ticketsCreated: number, tickets: [{findingId, title, severity, action, remediationId}] }', { schema: { type: 'object', properties: {
  ticketsCreated: { type: 'number' },
  tickets: { type: 'array', items: { type: 'object', properties: { findingId: { type: 'string' }, title: { type: 'string' }, severity: { type: 'string' }, action: { type: 'string' }, remediationId: { type: 'string' } }, required: ['findingId', 'title', 'severity'] } }
}, required: ['ticketsCreated', 'tickets'] } })

log('Created ' + remediationResult.ticketsCreated + ' remediation tickets')

// Generate export files
log('Generating exportable reports (JSON, CSV)...')

var exportsResult = await agent('Generate audit reports from ' + AUDIT_DB_PATH + '.\n\n1. Export all open findings as JSON array to:\n' + ROOT + '/scripts/lms-content-automation/audit-export-findings.json\n\n2. Export CSV with header: id,severity,category,resourceTitle,subjectCode,title,recommendation,status,createdAt to:\n' + ROOT + '/scripts/lms-content-automation/audit-export-findings.csv\n\nUse node:sqlite. The CSV should use comma delimiters and quote fields containing commas.\n\nReturn: { jsonPath: string, csvPath: string, rowsExported: number }', { schema: { type: 'object', properties: { jsonPath: { type: 'string' }, csvPath: { type: 'string' }, rowsExported: { type: 'number' } }, required: ['jsonPath', 'csvPath', 'rowsExported'] } })

log('Exports: ' + exportsResult.rowsExported + ' rows to ' + exportsResult.jsonPath + ' and ' + exportsResult.csvPath)

// ──────────────────────────────────────────────
// FINAL OUTPUT
// ──────────────────────────────────────────────

return {
  pipeline: 'lms-full-audit',
  status: 'complete',
  timestamp: new Date().toISOString(),
  inventory: {
    totalResources: inventory.totalResources,
    subjects: inventory.subjects,
    users: inventory.users,
    byType: inventory.byType,
    bySubject: inventory.bySubject,
  },
  findings: {
    totalOpen: totalFindings,
    critical: aggResult.totals.critical || 0,
    high: aggResult.totals.high || 0,
    medium: aggResult.totals.medium || 0,
    low: aggResult.totals.low || 0,
    byCategory: aggResult.byCategory || [],
    byCheck: aggResult.byCheck || [],
    bySubject: aggResult.bySubject || [],
  },
  healthScore: healthScore + '%',
  remediation: {
    ticketsCreated: remediationResult.ticketsCreated,
    tickets: (remediationResult.tickets || []).slice(0, 5),
  },
  exports: {
    jsonPath: exportsResult.jsonPath,
    csvPath: exportsResult.csvPath,
    rowsExported: exportsResult.rowsExported,
  },
  recommendations: (aggResult.byCheck || []).slice(0, 5).map(function(c) { return 'Address "' + c.checkName + '" (' + c.c + ' findings)' }),
}
