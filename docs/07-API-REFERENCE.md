# 07 — API Reference

## 7.1 Common Conventions

### Base URL
```
Development: http://localhost:5000/api
Production:  https://your-domain.com/api (proxied via Nginx)
```

### Authentication
All authenticated endpoints require the `erp_session` cookie (set automatically during login):
```
Cookie: erp_session=<uuid>
```

Legacy fallback (being phased out, cutoff date: `2026-05-15`):
- Header: `x-session-id: <uuid>`
- Query: `?sessionId=<uuid>`
- Body: `{ "sessionId": "<uuid>" }`

### Response Envelope

**Success:**
```json
{
  "success": true,
  "pageKey": "academic/attendance-details",
  "source": "cache-fresh",
  "fetchedAt": "2026-04-06T12:00:00.000Z",
  "staleAt": "2026-04-06T12:01:00.000Z",
  "policyMode": "cached-first",
  "data": { ... },
  "warnings": []
}
```

**Error (with FEATURE_ERP_ERROR_ENVELOPE=1):**
```json
{
  "success": false,
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "Invalid or expired sessionId. Fetch captcha again.",
    "retryable": false
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Standard Response Headers
| Header | Value |
|--------|-------|
| `x-request-id` | UUID for request tracing |
| `x-erp-source` | `cache-fresh`, `cache-stale`, `live` |
| `x-erp-policy` | `cached-first`, `live-first` |
| `x-ratelimit-limit` | Max requests per window |
| `x-ratelimit-remaining` | Remaining requests |
| `x-ratelimit-reset` | Seconds until window resets |

### Error Codes
| Code | HTTP Status | Retryable | Meaning |
|------|-------------|-----------|---------|
| `BAD_REQUEST` | 400 | No | Missing or invalid parameters |
| `UNAUTHORIZED` | 401 | No | Missing/expired session |
| `SESSION_EXPIRED` | 401 | No | Session TTL exceeded |
| `FORBIDDEN` | 403 | No | Insufficient permissions |
| `NOT_FOUND` | 404 | No | Page key or resource not found |
| `RATE_LIMITED` | 429 | Yes | Too many requests |
| `TIMEOUT` | 408/504 | Yes | ERP request timed out |
| `CIRCUIT_OPEN` | 503 | Yes | ERP temporarily unavailable |
| `UPSTREAM_UNAVAILABLE` | 500+ | Yes | ERP returned error |
| `UPSTREAM_SATURATED` | 503 | Yes | Max concurrent ERP requests reached |
| `INVALID_UPSTREAM_PAYLOAD` | 502 | No | ERP returned login page or invalid data |
| `PAYLOAD_CONTRACT_MISMATCH` | 502 | No | Response missing expected sections |
| `MISSING_ENDPOINT_MAPPING` | 502 | No | No discovery mapping for this menu item |
| `LOCK_TIMEOUT` | 503 | Yes | Distributed lock acquisition failed |
| `UI_MAP_UNAVAILABLE` | 503 | No | UI map not loaded |

---

## 7.2 Authentication Endpoints

### GET `/api/auth/captcha`
Fetch a captcha image and create a pre-authentication session.

**Response:**
```json
{
  "success": true,
  "sessionId": "a1b2c3d4-...",
  "captchaBase64": "data:image/png;base64,...",
  "issuedAt": "2026-04-06T12:00:00.000Z",
  "expiresInMs": 15000,
  "expiresAt": "2026-04-06T12:00:15.000Z",
  "loginAttemptId": "uuid"
}
```

**Side Effects:**
- Sets `erp_session` cookie
- Creates session with Playwright storageState

---

### POST `/api/auth/login`
Authenticate with ERP.

**Request Body:**
```json
{
  "username": "AP12345678",
  "password": "myPassword",
  "captcha": "abc123"
}
```

**Success Response:**
```json
{
  "success": true,
  "sessionId": "a1b2c3d4-...",
  "profileData": {
    "TableContent": {
      "Student Name": "John Doe",
      "Register No.": "AP12345678",
      "Program / Section": "B.Tech CSE / A"
    }
  },
  "profileStatus": "ready",
  "loginAttemptId": "uuid"
}
```

**Error Codes:** `BAD_REQUEST` (missing fields), `UNAUTHORIZED` (invalid credentials)

---

### GET `/api/auth/profile`
Fetch or refresh the current user's profile.

**Response:** Profile data object with `TableContent` key-value pairs.

---

### POST `/api/auth/logout`
Clear session and cookies.

---

## 7.3 ERP Data Endpoints (V2)

### GET `/api/v2/erp/page/:category/:page`
Fetch a single ERP page.

**Example:** `GET /api/v2/erp/page/academic/attendance-details`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `mode` | `string` | — | Override fetch mode: `cached-first` or `live-first` |

**Response:** Standard ERP page response with `data` containing grouped ERP sections.

---

### POST `/api/v2/erp/batch`
Fetch multiple ERP pages in one request. **This is the primary data-fetching endpoint** used by the frontend.

**Request Body:**
```json
{
  "pageKeys": [
    "academic/attendance-details",
    "academic/od-ml-details",
    "academic/student-attendance"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "academic/attendance-details": {
      "success": true,
      "pageKey": "academic/attendance-details",
      "source": "cache-fresh",
      "data": { "Academic": { "Attendance Details": { ... } } }
    },
    "academic/od-ml-details": {
      "success": true,
      "pageKey": "academic/od-ml-details",
      "source": "live",
      "data": { "Academic": { "OD/ML Details": { ... } } }
    }
  }
}
```

---

### GET `/api/v2/erp/ui/:category/:page`
Get UI enhancement hints (forms, actions) for an ERP page.

**Response:**
```json
{
  "success": true,
  "pageKey": "examination/exam-registration",
  "sections": [
    {
      "sourcePageKey": "examination/exam-registration",
      "forms": [ { "id": "form1", "fields": [...], "method": "POST" } ],
      "actions": [ { "id": "submit", "label": "Register", "kind": "submit" } ]
    }
  ]
}
```

---

### GET `/api/v2/erp/schema/:category/:page`
Get render schema blocks for a page (tells frontend how to lay out the data).

---

### POST `/api/v2/erp/action/execute`
Execute an ERP form action (submit registration, etc.).

**Request Body:**
```json
{
  "pageKey": "examination/exam-registration",
  "actionId": "submit",
  "payload": { "courseId": "CSE304" },
  "method": "POST",
  "url": "students/transaction/..."
}
```

---

## 7.4 Legacy/Scrape Endpoints

### GET `/api/scrape/:category/:page`
Same as V2 page endpoint but returns only `data` (no envelope).

### GET `/api/scrape/examination/earlier-internal-marks/semester/:semester`
Fetch internal marks for a specific past semester.

**Params:** `:semester` — integer (1, 2, 3, etc.)

---

## 7.5 Events Endpoints

### GET `/api/events`
List events with filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `query` | string | Full-text search |
| `category` | string | Category filter |
| `department` | string | Department filter |
| `status` | string | `draft`, `published`, `cancelled`, `completed` |
| `visibility` | string | Visibility filter |
| `type` | string | Event type |
| `startDate` | ISO string | Range start |
| `endDate` | ISO string | Range end |
| `myEvents` | `"true"` | Only user's events |

### POST `/api/events`
Create an event.

### GET `/api/events/:eventId`
Get event details.

### PUT `/api/events/:eventId`
Update event (creator or admin).

### DELETE `/api/events/:eventId`
Delete event (creator or admin).

### POST `/api/events/:eventId/register`
Register for an event.

### POST `/api/events/:eventId/check-in`
Check into an event (requires check-in code).

### GET `/api/events/:eventId/attendees.csv`
Download attendee list as CSV (organizer only).

### GET `/api/events/:eventId/ical`
Download iCal file for the event.

---

## 7.6 Content Endpoints

### GET `/api/content`
List content items.

**Query Parameters:** `type`, `category`

### POST `/api/content`
Create content (requires `x-admin-password` header).

### GET `/api/content/:id`
Get content by ID.

### GET `/api/content/:id/resources`
List attached resources.

---

## 7.7 Health Endpoints

### GET `/api/health`
Comprehensive system health.

**Response:**
```json
{
  "ok": true,
  "now": "2026-04-06T12:00:00.000Z",
  "sessions": 42,
  "discovery": { "loaded": true, "filePath": "...", "itemCount": 36 },
  "policy": { "defaultMode": "cached-first", "overrideCount": 11 },
  "integrity": { "ok": true, "checks": [...] },
  "redis": "configured"
}
```

### GET `/api/live`
Simple liveness probe. Always returns `{ ok: true }`.

### GET `/api/ready`
Readiness probe. Returns `503` if any dependency is unhealthy.

### GET `/api/metrics`
Prometheus metrics endpoint (text format).
