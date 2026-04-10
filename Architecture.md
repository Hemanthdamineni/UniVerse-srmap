# University ERP Companion Platform

## Architecture Document

---

# 1. System Overview

The system is a **middleware platform that integrates with the university ERP**, enhances its usability, and adds additional services.

The platform performs three main functions:

* Provides a **modern frontend interface** for ERP data
* Acts as a **proxy layer that integrates with the ERP**
* Hosts **additional services** not provided by the ERP (events, resources, trackers)

The platform interacts with multiple data sources and aggregates them into a single application interface.

---

# 2. High-Level Architecture

The system follows a **layered architecture**.

```
Users
   ↓
React Frontend
   ↓
Nginx Reverse Proxy
   ↓
Express API Server
   ↓
Service Layer
 ├ ERP Integration
 ├ Redis Cache
 ├ Application Data
 └ Content Storage
```

Each layer has a clearly defined responsibility.

---

# 3. Frontend Layer

The frontend is implemented as a **React single-page application (SPA)**.

Responsibilities:

* page routing
* UI rendering
* calling backend APIs
* minimal data shaping for UI presentation
* displaying content from multiple sources
* schema-driven ERP rendering using backend-provided UI schema blocks (`table`, `form`, `card`, `list`, `stats`)

The frontend never communicates directly with the ERP.

All requests go through the backend API.

---

# 4. Reverse Proxy Layer (Nginx)

Nginx acts as the **edge server** of the platform.

Responsibilities:

* reverse proxy for backend API
* serving static frontend assets
* serving static files from the filesystem
* HTTPS termination
* request compression
* request buffering

Nginx isolates the backend server from direct internet exposure.

---

# 5. Backend API Layer

The backend is implemented using **Node.js with Express**.

This layer acts as the **central coordinator of the system**.

Responsibilities:

* authentication and session validation
* API routing
* cache interaction
* ERP integration orchestration
* file upload handling
* application module APIs
* error handling

The backend exposes a REST-style API used by the frontend.

---

# 6. ERP Integration Layer

The ERP integration layer connects the platform to the university ERP system.

ERP pages are accessed using **Playwright’s request API**, which provides:

* cookie-based session handling
* browser-like HTTP behavior
* form submission support
* redirect handling

Playwright is used strictly as an **ERP request client**, not as a browser automation engine during runtime.

The workflow for ERP requests:

```
API request
↓
check Redis cache
↓
cache miss
↓
fetch ERP endpoint using Playwright request context
↓
receive HTML response
↓
parse HTML using Cheerio
↓
extract structured data
↓
attach UI render schema
↓
store parsed response in Redis
↓
return JSON response
```

This approach ensures reliable session handling while avoiding the overhead of launching full browsers.

---

# 7. HTML Parsing Layer

ERP responses are returned as HTML.

The system parses HTML responses using **Cheerio**.

Responsibilities:

* extracting tables
* extracting forms
* extracting structured values
* filtering unnecessary rows
* converting HTML into structured JSON

This layer transforms ERP content into API responses usable by the frontend.

---

# 7.1 ERP UI Schema Layer

The backend exposes ERP responses as:

* normalized ERP data
* UI schema blocks describing rendering intent

The schema layer maps ERP endpoints into reusable rendering blocks:

* `stats`
* `card`
* `form`
* `table`
* `list`

This avoids creating one React page component per ERP endpoint and keeps frontend growth manageable as ERP endpoints expand.

---

# 8. Redis Operational Layer

Redis serves as the **operational data store** for the system.

Redis is used for temporary data required for system performance and reliability.

Primary uses:

### Session Storage

User sessions are stored in Redis.

Sessions expire automatically using TTL.

---

### ERP Response Cache

Parsed ERP responses are cached in Redis.

This reduces repeated ERP scraping.

Each dataset has its own expiration policy.

Examples:

| Data       | Typical TTL  |
| ---------- | ------------ |
| Attendance | 5–10 minutes |
| Profile    | 1 hour       |
| Timetable  | 12–24 hours  |

---

### Request Deduplication

Redis ensures that multiple simultaneous requests do not trigger duplicate ERP fetches.

Example:

```
multiple requests
↓
single ERP request executed
↓
cached response reused
```

---

### Rate Limiting

Redis tracks request counts to prevent excessive ERP requests.

---

### Circuit Breaker

If ERP becomes unavailable, Redis stores the failure state so the system can temporarily serve cached responses instead of repeatedly calling ERP.

---

# 9. Application Data Layer

Some modules require persistent structured data that is not provided by the ERP.

Examples include:

* events
* event registrations
* announcements
* notifications
* academic trackers
* user-generated content

This data is stored in a **lightweight database**.

The backend exposes APIs for managing this data.

---

# 10. Filesystem Content Storage

Static resources are stored directly on the server filesystem.

Examples:

* PDFs
* PPTs
* images
* learning materials
* event posters
* documentation

Workflow:

```
user uploads file
↓
backend validates file
↓
file stored on disk
↓
file URL returned
↓
frontend displays or downloads file
```

Files are served directly through the web server for efficient delivery.

---

# 11. Endpoint Discovery System

ERP endpoints are discovered using **offline Playwright browser automation scripts**.

These scripts:

* analyze the ERP UI
* extract JavaScript menu mappings
* identify hidden endpoints
* generate endpoint mapping files

The generated mapping is stored and used by the runtime backend to determine how to fetch ERP data.

This separates discovery logic from runtime scraping.

---

# 12. Request Lifecycle

Example request: **Attendance page**

```
User opens attendance page
↓
Frontend sends API request
↓
Backend checks Redis cache
↓
cache hit → return response
cache miss → call ERP
↓
Playwright request fetches HTML
↓
Cheerio parses HTML
↓
structured JSON generated
↓
response stored in Redis
↓
JSON returned to frontend
↓
UI rendered
```

---

# 13. File Access Lifecycle

Example: **Learning materials**

```
user opens resources page
↓
frontend requests file list
↓
backend reads filesystem directory
↓
file metadata returned
↓
frontend renders file links
↓
user downloads file
```

Static file delivery bypasses backend processing.

---

# 14. Event Lifecycle

Example: **Event registration**

```
admin creates event
↓
event stored in database
↓
event listing fetched by frontend
↓
user registers for event
↓
registration stored in database
```

Event functionality operates independently of ERP integration.

---

# 15. Observability

Basic observability mechanisms include:

* API request logging
* ERP request latency tracking
* error logging
* cache hit/miss metrics

Logs help detect:

* ERP failures
* parsing errors
* authentication issues
* performance bottlenecks

Advanced monitoring can be added later if necessary.

---

# 16. Security Considerations

Security controls include:

* session validation
* cookie security
* input sanitization
* file upload validation
* request rate limiting
* ERP credential protection

Sensitive data such as user passwords is never stored.

---

# 17. Deployment Architecture

Typical deployment layout:

```
Internet
   ↓
Nginx
   ↓
React Static Frontend
   ↓
Express Backend
   ↓
Redis
   ↓
ERP Integration
```

Additional services:

```
Filesystem → static resources
Database → application modules
```

All components can run on a single server initially.

---

# 18. Scalability Strategy

The architecture supports gradual scaling.

Future improvements may include:

* distributed Redis
* dedicated scraping workers
* CDN for static files
* object storage for large content
* multi-instance backend deployment

These improvements can be added without major architectural changes.

---

# 19. Core Design Principles

The system is built on the following principles:

1. ERP integration remains **backend-only**.
2. The frontend focuses strictly on **UI rendering**.
3. Redis provides **fast operational caching**.
4. Filesystem storage handles **static resources**.
5. Application modules remain **independent from ERP**.
6. Endpoint discovery is separated from runtime operations.
7. ERP page rendering is **schema-driven** wherever custom interaction is not required.

---

# 20. Final System Model

```
Users
   ↓
React Frontend
   ↓
Nginx
   ↓
Express API
   ↓
Redis
   ↓
ERP Integration (Playwright Request + Cheerio)
   ↓
University ERP
```

Additional subsystems:

```
Filesystem → static content
Database → application modules
Discovery scripts → endpoint mapping
```
