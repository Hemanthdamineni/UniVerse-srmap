# Background Update Reference

## Light mode background values

Applied via CSS variables/classes in `Frontend/src/styles.css`:

- `--app-shell-bg: #f8f8f8`
- `--app-main-bg: #f8f8f8`
- `--sidebar-bg: #f8f8f8`
- `--sidebar-accent: #0a272b`
- `--dash-bg: #f8f8f8`
- `--dash-accent: #0a272b`

Exact accent geometry mapped from reference vectors:

- Main/dashboard accent path (`M799.31 0H1159V360L79.931 800H0V330L799.31 0Z`) ->
  `clip-path: polygon(68.97% 0%, 100% 0%, 100% 45%, 6.9% 100%, 0% 100%, 0% 41.25%)`
- Sidebar accent path (`M280 0V470H0V110L280 0Z`) ->
  `clip-path: polygon(100% 41.30%, 100% 100%, 0% 100%, 0% 55.07%)`

## Dark mode background values

Applied under `[data-theme="dark"], .dark` in `Frontend/src/styles.css`:

- `--app-shell-bg: #0a262a`
- `--app-main-bg: #0a262a`
- `--sidebar-bg: #0a262a`
- `--sidebar-accent: rgba(248, 248, 248, 0.6)`
- `--dash-bg: #0a262a`
- `--dash-accent: rgba(248, 248, 248, 0.6)`

Exact accent geometry mapped from reference vectors:

- Main/dashboard accent path (`M800 0H1160V360L80 800H0V325.93L800 0Z`) ->
  `clip-path: polygon(68.97% 0%, 100% 0%, 100% 45%, 6.9% 100%, 0% 100%, 0% 40.74%)`
- Sidebar accent path (`M280 0V474.07H0V114.07L280 0Z`) ->
  `clip-path: polygon(100% 40.75%, 100% 100%, 0% 100%, 0% 55.01%)`

## Files modified (with line references)

- `Frontend/src/styles.css`
  - Variables: lines `33-49`, `66-82`
  - Body/global background: line `86`
  - Sidebar background overlay: lines `102-118`
  - Dashboard background overlay: lines `125-146`
- `Frontend/src/pages/Pagelayout.tsx`
  - Shell/main background bindings: lines `10`, `18`, `26`
- `Frontend/src/components/Sidebar.tsx`
  - Sidebar container background class: line `192`
- `Frontend/src/pages/Events/EventListPage.tsx`
  - Main wrapper background class: line `87`
- `Frontend/src/pages/Events/MyEventsPage.tsx`
  - Main wrapper background class: line `150`
- `Frontend/src/pages/Events/MyRegistrationsPage.tsx`
  - Main wrapper background class: line `24`
- `Frontend/src/pages/Events/EventDetailPage.tsx`
  - Main wrapper background class: line `38`

## Description

Backgrounds updated to exactly match the light and dark references in 'Background design reference' folder

## Notes

- Used pure CSS color layers and clip-path geometry; no raster background image assets were added.
- No noise/grain overlay was added because the provided reference export uses solid vector accent fills and transparency.
