# 10 — Development Guide

## 10.1 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 20+ | Backend & frontend runtime |
| **npm** | 10+ | Package management |
| **Redis** | 7+ | Session/cache store (optional but recommended) |
| **Docker** | 24+ | Containerized setup (optional) |

---

## 10.2 Local Setup

### Option A: Manual Setup

```bash
# Clone the repository
git clone <repo-url>
cd University-ERP

# 1. Start Redis (Docker one-liner)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# 2. Install & start Backend
cd Backend
npm install
npm run dev
# → Backend running on http://localhost:5000

# 3. Install & start Frontend (new terminal)
cd Frontend
npm install
npm run dev
# → Frontend running on http://localhost:5173
# → API proxied to localhost:5000 via vite.config.ts
```

### Option B: Docker Compose

```bash
# From project root
docker compose up -d
# → Backend on :5000, Redis on :6379
# → Frontend needs separate npm run dev
```

### Option C: Full Infra Stack

```bash
# Start in order
docker compose -f infra/docker/compose.data.yml up -d
docker compose -f infra/docker/compose.app.yml up -d
cd Frontend && npm run build
docker compose -f infra/docker/compose.ingress.yml up -d
```

---

## 10.3 Development Workflow

### Backend Development
```bash
cd Backend
npm run dev
```
- Changes require manual restart (no hot-reload; use `nodemon` if desired)
- Logs write to `Backend/logs/backend.log` and stdout
- Health check: `curl http://localhost:5000/api/health`

### Frontend Development
```bash
cd Frontend
npm run dev
```
- Vite hot-reload enabled
- API calls proxied to `http://localhost:5000/api`
- TypeScript errors shown in terminal and browser overlay
- Access at `http://localhost:5173`

---

## 10.4 Working Without Redis

The system is designed to work without Redis. Simply don't set `REDIS_URL`:

```
SESSION_STORE_DRIVER=memory    # or leave as "auto" with no REDIS_URL
ERP_CACHE_DRIVER=memory
```

**Limitations without Redis:**
- Sessions lost on backend restart
- No distributed locking (still works single-instance)
- No shared rate limiting across instances
- Circuit breaker state is process-local
- No cache sharing between instances

---

## 10.5 Working Without ERP Access

For development without university ERP access:

1. **Use cached/dumped data:** Set `DUMP_SNAPSHOT_DIR` to point to a data dump
2. **Fallback data:** The system can serve from previously cached responses
3. **Mock mode:** Work on frontend using static JSON fixtures
4. **Content/Events:** These features work independently of ERP

---

## 10.6 Project Structure Conventions

### Backend
- **Routes:** One file per domain (`authRoutes.js`, `eventsRoutes.js`)
- **Services:** Pure business logic, no HTTP awareness
- **Utils:** Stateless helper functions
- **Config:** Environment-derived constants, frozen config objects
- **Middleware:** Express middleware functions
- **All files use CommonJS** (`require`/`module.exports`)

### Frontend
- **Pages:** One directory per section (`Academic/`, `Finance/`, etc.)
- **Components:** Shared components at top level, ERP-specific in `erp/`
- **Lib:** API clients, session management, transformers
- **Config:** Blueprint and navigation configuration
- **All files use ESM** (`import`/`export`)
- **TypeScript throughout**

### Naming Conventions
| Entity | Convention | Example |
|--------|-----------|---------|
| Route files | camelCase | `erpV2Routes.js` |
| Service files | camelCase | `erpAggregationService.js` |
| React components | PascalCase | `AttendanceDetailsPage.tsx` |
| Page directories | PascalCase | `Exams&Results/` |
| Config files | camelCase | `erpBlueprints.ts` |
| CSS files | lowercase | `styles.css` |
| Page keys | kebab-case | `academic/attendance-details` |

---

## 10.7 Debugging

### Backend Debugging

**Check health:**
```bash
curl http://localhost:5000/api/health | jq .
```

**Check readiness:**
```bash
curl http://localhost:5000/api/ready | jq .
```

**Test ERP data fetch (requires active session):**
```bash
curl -b "erp_session=YOUR_SESSION_ID" \
  http://localhost:5000/api/v2/erp/page/academic/attendance-details | jq .
```

**Force live fetch (bypass cache):**
```bash
curl -b "erp_session=YOUR_SESSION_ID" \
  "http://localhost:5000/api/v2/erp/page/academic/attendance-details?mode=live-first"
```

**View logs:**
```bash
tail -f Backend/logs/backend.log | jq .
```

### Frontend Debugging

**Browser DevTools:**
- Network tab: check API responses, look for `x-erp-source` header
- Console: transformer pipeline logs errors/warnings
- Application tab: check localStorage for sessionId, profileData

**Pipeline debugging:**
```typescript
// In any page component
import { executePipeline } from '../lib/erpTransformers';
const result = executePipeline(blueprint, rawData);
console.log('Pipeline result:', result);
// → { type, data, isValid, errors, warnings }
```

---

## 10.8 Testing

### Backend Tests
```bash
cd Backend
npm test
```
Uses Node.js built-in test runner (`node --test`).

### Load Tests
```bash
cd Backend
npm run load:cached    # Test cached mode performance
npm run load:live      # Test live mode performance
npm run load:mixed     # Test mixed mode
```
Uses k6 load testing framework.

### Frontend Linting
```bash
cd Frontend
npm run lint
```

---

## 10.9 Common Pitfalls

### `[object Object]` in UI
**Cause:** Raw ERP data object reaching the renderer without normalization.
**Fix:** Ensure the page uses `executePipeline()` or passes data through `normalizeRawValue()`. Never render `data.someField` directly without normalization.

### "Invalid or expired sessionId"
**Cause:** Session expired (30-min TTL) or Redis restarted.
**Fix:** Re-login. Check `SESSION_TTL_MS` if too short.

### "No endpoint mapping for X → Y"
**Cause:** Discovery map doesn't include this menu item, or the discovery file is outdated.
**Fix:** Run `npm run discover:endpoints` with valid ERP credentials.

### Login captcha always fails
**Cause:** Captcha has a 15-second TTL. If the user takes too long, it expires.
**Fix:** Adjust `LOGIN_PREAUTH_TTL_MS` or prompt user to refresh.

### Stale data served
**Cause:** Cache-first mode returns stale data while refreshing in background.
**Expected behavior:** The UI should update on next request. Add `?mode=live-first` to force live fetch.

### Circuit breaker stuck open
**Cause:** ERP had 5+ consecutive failures, circuit is open for 30 seconds.
**Fix:** Wait for cooldown, or manually clear via Redis: `DEL erp:circuit:<pageKey>`

### Table headers misaligned
**Cause:** ERP tables sometimes have duplicate headers or shifted columns.
**Fix:** The `uniqueHeaders()` function handles duplicates. The timetable transformer has explicit column-shift logic. Add transformer logic for new problem pages.

---

## 10.10 Recommended IDE Setup

### VS Code Extensions
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- REST Client (for testing API endpoints)

### Settings
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "typescript.preferences.importModuleSpecifier": "relative"
}
```
