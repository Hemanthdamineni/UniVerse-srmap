# Contributor Cleanup — How and Why

## What was done

A `git filter-repo` rewrite was run on `2026-08-29` to clean up the
repository so only `Hemanth Damineni <hemanthdamineni@gmail.com>` shows
up in GitHub's Contributors list. Before the rewrite, the Contributors
list showed:

- `@Hemanthdamineni` (real author on the bulk of the commits)
- `HemanthdamineniZorro` (same person, GitHub web UI author on a few)
- `@claude` (from `Co-Authored-By: Claude` trailers)
- `claudeClaude` (from `Co-Authored-By: Claude Opus 4.8` trailers)
- `@CommandCodeBot` (from the trailer I added + 4 commits actually
  authored by it)
- `CommandCodeBotnpm i -g cmd` (same source, weird GitHub UI rendering)
- `@qwencoder` (from `Co-authored-by: Qwen-Coder` trailers)
- `qwencoderQwen-Coder` (same source)

After the rewrite, only `Hemanth Damineni` remains.

## What was rewritten

- **Commit messages** — every `Co-Authored-By: ...` and
  `Co-authored-by: ...` trailer was stripped (26 commits cleaned).
- **Commit author** — the 4 commits that were actually authored by
  `CommandCodeBot <noreply@commandcode.ai>` were rewritten so the
  author is `Hemanth Damineni <hemanthdamineni@gmail.com>`.
- **Commit author** — the 2 commits that were authored by
  `Zorro <144988690+Hemanthdamineni@users.noreply.github.com>` (which
  is GitHub's display name for your web-UI commits) were rewritten
  to the canonical author.
- **Attribution + leak lines** — every `🤖 Generated with [Claude Code]`
  attribution line and the shell commands (e.g.
  `git push ... 2>&1 | tail -3`) that the agent ran for verification
  were stripped from commit message bodies (10 leaks cleaned).

## What was NOT rewritten

- The actual code, file contents, and commit graph.
- The two `pre-*` snapshot tags (`pre-score-redesign-recovery`,
  `pre-external-prod-snapshot`) — these predate this session and
  were left alone.
- Your local working copy (working tree was clean, so nothing to
  rewrite there).

## How to re-run the same cleanup

The rewrite was driven by `.git/filter_callback.py` in the local
repo (not committed, since it's in `.git/`). To re-run the same
cleanup on a fresh clone:

```bash
# 1. Take a snapshot first (REQUIRED — filter-repo is destructive)
git tag pre-rewrite-cleanup HEAD

# 2. Save the callback (it lives in .git/ of the snapshot above; if
#    starting from a clean clone, recreate it from the docstring
#    in this file's history)
cat > /tmp/filter_callback.py <<'PYEOF'
# ... (callback body — see the docstring of filter_callback.py in
#      the snapshot's .git/ for the full implementation) ...
PYEOF

# 3. Run the rewrite
git filter-repo --force \
  --message-callback "
import sys
sys.path.insert(0, '/tmp')
from filter_callback import clean_message
return clean_message(message)
" \
  --name-callback "
import sys
sys.path.insert(0, '/tmp')
from filter_callback import clean_author
return clean_author(name)
" \
  --email-callback "
import sys
sys.path.insert(0, '/tmp')
from filter_callback import clean_email
return clean_email(email)
"

# 4. Verify before force-push
git log --format='%an <%ae>' | sort -u
git log --format='%B' | grep -ciE 'co-?authored-by'  # should be 0

# 5. Force-push
git push --force --set-upstream origin main
```

## What this means for clones

Every commit hash changed. Anyone with a clone of this repository
will need to re-clone (or `git fetch origin && git reset --hard
origin/main`). The old commit hashes are not reachable from any
local ref in this repository anymore.

## Verification

```bash
git log origin/main --format='%an <%ae>' | sort -u
# -> Hemanth Damineni <hemanthdamineni@gmail.com>

git log origin/main --format='%B' | grep -ciE 'co-?authored-by'
# -> 0

git log origin/main --format='%B' | grep -ciE 'Generated with \[Claude Code\]'
# -> 0
```

The GitHub Contributors tab now shows only `Hemanthdamineni`.
