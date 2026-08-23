#!/usr/bin/env bash
# =============================================================================
# LMS Content Automation Pipeline
# Full end-to-end workflow: Plan → Generate → Verify → Critique → Report
#
# Usage:
#   ./run-pipeline.sh                   # Run full pipeline
#   ./run-pipeline.sh --dry-run         # Dry run (no DB writes)
#   ./run-pipeline.sh --verify-only     # Only run verification
#   ./run-pipeline.sh --critique-only   # Only run critique
#   ./run-pipeline.sh --db-path <path>  # Custom DB path
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TIMESTAMP=$(date +"%Y-%m-%dT%H-%M-%S")
DB_PATH="${PROJECT_ROOT}/data/lms.sqlite"
DRY_RUN=""
MODE="full"

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="--dry-run true"; shift ;;
    --verify-only) MODE="verify"; shift ;;
    --critique-only) MODE="critique"; shift ;;
    --db-path) DB_PATH="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║       LMS Content Automation Pipeline                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Pipeline ID:   ${TIMESTAMP}"
echo "  Project Root:  ${PROJECT_ROOT}"
echo "  Database:      ${DB_PATH}"
echo "  Mode:          ${MODE}"
echo "  Dry Run:       ${DRY_RUN:+yes}"
echo ""

# Validate prerequisites
if [ ! -f "${DB_PATH}" ]; then
    echo "[FATAL] Database not found at: ${DB_PATH}"
    echo "        Is the backend running? Try starting with: docker compose up -d"
    echo "        Or specify a custom path: --db-path <path>"
    exit 1
fi

# Validate node_modules (need DatabaseSync)
NODE_MAJOR=$(node -e "console.log(process.version.slice(1).split('.')[0])" 2>/dev/null || echo "0")
if [ "$NODE_MAJOR" -lt 22 ]; then
    echo "[FATAL] Node.js >= v22 required for built-in SQLite (node:sqlite)"
    echo "        Current version: $(node --version)"
    exit 1
fi

# Log file
LOG_FILE="${SCRIPT_DIR}/pipeline-${TIMESTAMP}.log"
exec > >(tee -a "${LOG_FILE}") 2>&1

# =============================================================================
# PHASE 0: Planning — Content Roadmap
# =============================================================================
plan_phase() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  PHASE 0: Planning — Content Roadmap Definition"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    if [ -f "${SCRIPT_DIR}/contentCurriculum.js" ]; then
        local subject_count=$(node -e "
            const { CORE_CSE_SUBJECTS, SKILL_ROADMAPS } = require('${SCRIPT_DIR}/contentCurriculum');
            console.log('Subjects: ' + CORE_CSE_SUBJECTS.length);
            console.log('Total Units: ' + CORE_CSE_SUBJECTS.reduce((s,sub) => s + sub.units.length, 0));
            console.log('Skill Roadmaps: ' + SKILL_ROADMAPS.length);
        ")
        echo "  ✓ Curriculum definition loaded"
        echo "  ${subject_count}"
        echo ""
        echo "  Validating curriculum..."
        node -e "
            const { CORE_CSE_SUBJECTS, SKILL_ROADMAPS } = require('${SCRIPT_DIR}/contentCurriculum');
            let errors = [];
            for (const s of CORE_CSE_SUBJECTS) {
                if (!s.subjectCode) errors.push('Missing subjectCode');
                if (!s.subjectName) errors.push('Missing subjectName');
                if (!s.units || s.units.length === 0) errors.push('No units defined');
                for (const u of (s.units || [])) {
                    if (!u.unit) errors.push('Missing unit name');
                    if (!u.title) errors.push('Missing unit title');
                    if (!u.topics || u.topics.length === 0) errors.push('No topics in ' + u.unit);
                    if (!u.resourceMix) errors.push('No resourceMix in ' + u.unit);
                }
            }
            for (const r of SKILL_ROADMAPS) {
                if (!r.skill) errors.push('Missing skill name');
                if (!r.nodes || r.nodes.length === 0) errors.push('No nodes in ' + r.skill);
            }
            if (errors.length > 0) {
                console.log('  ⚠ Validation issues:');
                errors.forEach(e => console.log('    - ' + e));
                process.exit(1);
            }
            console.log('  ✓ Curriculum validation passed');
        "
    else
        echo "  [ERROR] contentCurriculum.js not found!"
        exit 1
    fi

    echo ""
    echo "  Planning complete. Ready to generate."
}

# =============================================================================
# PHASE 1: Content Generation
# =============================================================================
generate_phase() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  PHASE 1: Content Generation (Writing Phase)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    if [ -n "${DRY_RUN}" ]; then
        echo "  [DRY RUN] Would execute:"
        echo "    node ${SCRIPT_DIR}/generate.js --db-path ${DB_PATH} ${DRY_RUN}"
    else
        echo "  Running content generation..."
        node "${SCRIPT_DIR}/generate.js" --db-path "${DB_PATH}"
        local exit_code=$?
        if [ $exit_code -ne 0 ]; then
            echo "  [ERROR] Generation phase failed with exit code ${exit_code}"
            exit $exit_code
        fi
    fi
    echo ""
    echo "  Generation complete."
}

# =============================================================================
# PHASE 2: Verification
# =============================================================================
verify_phase() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  PHASE 2: Content Verification (Quality Assurance)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    node "${SCRIPT_DIR}/verify.js" --db-path="${DB_PATH}" --report
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo "  [ERROR] Verification phase failed with exit code ${exit_code}"
        exit $exit_code
    fi
    echo ""
    echo "  Verification complete."
}

# =============================================================================
# PHASE 3: Critique
# =============================================================================
critique_phase() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  PHASE 3: Content Critique & Gap Analysis (Refinement)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    node "${SCRIPT_DIR}/critique.js" --db-path="${DB_PATH}" --report
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo "  [ERROR] Critique phase failed with exit code ${exit_code}"
        exit $exit_code
    fi
    echo ""
    echo "  Critique complete."
}

# =============================================================================
# PIPELINE EXECUTION
# =============================================================================

START_TIME=$(date +%s)

case "${MODE}" in
    full)
        plan_phase
        generate_phase
        verify_phase
        critique_phase
        ;;
    verify)
        verify_phase
        ;;
    critique)
        critique_phase
        ;;
esac

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  Pipeline Complete                                           ║"
echo "║  Duration: ${DURATION}s                                         ║"
echo "║  Log:     pipeline-${TIMESTAMP}.log"
echo "║  Reports: content-report-${TIMESTAMP}.json (verify, critique)"
echo "╚═══════════════════════════════════════════════════════════════╝"
