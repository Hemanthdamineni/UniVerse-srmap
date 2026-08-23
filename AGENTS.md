## Design Context

### Users
**Primary**: University students at SRM AP University — digital natives who access the platform primarily on mobile and laptop. Their job is to quickly check attendance, marks, fees, timetable, and academic records from the legacy ERP, plus engage with platform-native features (events, resources, career portal, helpdesk).

**Secondary**: Event organizers (student leaders), content admins, and system operators. They need management tools for events, content, and infrastructure.

**Emotional goal**: The interface should evoke **confidence and calm** — academic data is stressful enough; the UI should make it feel manageable, clear, and even pleasant to interact with.

### Brand Personality
- **3 words**: Modern, Trustworthy, Sharp
- **Voice**: Clear, direct, helpful — never patronizing or overly casual
- **Tone**: Professional but not corporate; polished but not cold
- **Emotional goals**: Reduce anxiety around academic data, build trust through clarity and consistency, delight through micro-interactions and thoughtful details

### Aesthetic Direction
- **North Star**: "The Digital Curator" — a sophisticated lens that organizes, highlights, and facilitates academic and social excellence
- **Visual tone**: Hybrid "High-Density ERP + Premium SaaS" — data-dense where needed (tables, attendance stats), but with SaaS-grade polish (motion, typography, depth)
- **References**: Linear/Notion (minimal chrome, command palette, card layouts, clean typography) + Google Material/MUI sensibilities for familiar enterprise patterns
- **Anti-references**: Over-designed/artsy — avoid decorative flourishes that distract from data; prioritize clarity and utility over ornamentation
- **Theme**: Full light + dark mode support. Light mode is "Pristine Studio" (clean, energetic), dark mode is "Deep Command" (focused, premium)
- **Primary palette**: Deep teal (`#0A3035`), teal accent (`#34AEBE`), white/light surfaces (`#FFFFFF`, `#F8F8F8`). Dark mode inverts to dark teal surfaces with light text. Status colors use green/amber/red semantic system.

### Design Principles

1. **Clarity over decoration** — Every visual element must earn its place. Data density is respected; decorative excess is eliminated. The UI gets out of the user's way.

2. **Consistency through tokens** — All spacing, color, typography, elevation, and radius decisions come from a single source of truth (CSS variables + TS tokens). No magic values.

3. **Dual-nature harmony** — The system serves both high-density ERP data (tables, stats) and flowing SaaS experiences (events, onboarding). These two modes should feel like one cohesive product, not two apps stitched together.

4. **Accessibility is not optional** — Target WCAG 2.1 AA. Provide proper contrast, focus indicators, skip navigation, keyboard shortcuts, command palette, and reduced motion support. The interface should work for everyone.

5. **Delight through purpose** — Animations and micro-interactions serve a purpose: providing feedback, orienting the user, or smoothing transitions. Never animate for animation's sake. The spring curve (`cubic-bezier(0.16, 1, 0.3, 1)`) defines the motion personality — responsive, natural, not bouncy.

6. **Theme-native thinking** — Every component is designed for both light and dark mode from the start. Use CSS variables with `color-mix()` for adaptive surfaces. Never hardcode a color that only works in one theme.

## Development Architecture Rules

### File Size Limits
- No file should exceed **500 LOC** without a split plan documented here.
- God files currently being split are tracked in `implementation_plan.md`.

### Folder Conventions
- All React contexts live in `src/contexts/` (plural), never `src/context/`.
- Route modules live in `src/routes/`; do not put route tables in `main.tsx`.
- CSS lives in `src/styles/`, split by feature and imported through `styles/index.css`.
- LMS pages live in `src/pages/LMS/` with an `index.ts` barrel.
- Static prototype and debug utilities live in `src/lib/prototype/`.

### LMS Barrel Pattern
- Use one `.tsx` file per LMS page when it has its own state, data fetching, or meaningful UI.
- Re-export LMS pages from `src/pages/LMS/index.ts` to keep route imports readable.

### No-Go Rules
- Do not create scratch files in the project root; use `/tmp` or an intentional tracked location.
- Do not create empty placeholder directories without a `TODO.md`.
- Do not track generated output such as `graphify-out/` or build `dist/` folders.
- Do not add runtime backend dependencies for tools that only run in scripts.

### Static Prototype Mode
- `isStaticPrototype()` is controlled by `VITE_STATIC_PROTOTYPE=true`.
- API modules intentionally return fixture data in prototype mode.
- Prototype utilities belong in `src/lib/prototype/`; they are infrastructure, not dead code.

### Backend LMS Micro-Services
The LMS services (`lmsModerationService`, `lmsRevisionScheduler`, `lmsInteractionTracker`, `lmsInteractionQueue`, `lmsDuplicateDetector`, `lmsExamFeedbackService`, `lmsFeatureFlagService`, and `lmsReadingTimeEstimator`) are real implementations wired through `server.js` dependency injection. Do not delete them as stubs.

### Analytics
`analytics.ts` is intentionally a no-op in production. Tracking calls are already placed to avoid future refactoring; wire a real provider by replacing the current development logging path.
