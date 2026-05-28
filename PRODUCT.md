# Impeccable Design Context

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
