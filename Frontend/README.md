# University-ERP Frontend Structure & Guidelines

This project uses React + TypeScript + Vite. Below is the recommended file structure for maximum flexibility, maintainability, and scalable routing.

---

## 📁 Recommended File Tree

```
Frontend/
  ├── public/                # Static assets (favicon, images, etc.)
  ├── src/
  │   ├── assets/            # Images, icons, fonts, etc.
  │   │   └── Icons/
  │   ├── components/        # Reusable UI components (buttons, modals, etc.)
  │   │   └── shared/        # Shared components used across features
  │   ├── layouts/           # Layout components (MainLayout, AuthLayout, etc.)
  │   ├── pages/             # Route-level components (one per route/feature)
  │   │   ├── Academic/
  │   │   ├── Dashboard/
  │   │   ├── Events/
  │   │   ├── ExamsAndResults/
  │   │   ├── Finance/
  │   │   ├── Login/
  │   │   ├── Notifications/
  │   │   ├── Registration/
  │   │   ├── Settings/
  │   │   └── ...            # More feature folders as needed
  │   ├── routes/            # Centralized route definitions (optional)
  │   ├── api/               # API utilities and hooks (fetchers, axios, etc.)
  │   ├── hooks/             # Custom React hooks
  │   ├── context/           # React context providers
  │   ├── utils/             # Utility functions/helpers
  │   ├── styles/            # Global and modular CSS/SCSS files
  │   ├── App.tsx            # Main app component (with router)
  │   ├── main.tsx           # Entry point
  │   └── vite-env.d.ts
  ├── package.json
  ├── tsconfig.json
  └── ...                    # Other config files
```

---

## 📄 What Each Folder/File Should Contain

### public/
- Static files served as-is (e.g., favicon, robots.txt, static images).

### src/
- **assets/**: All static assets (images, icons, fonts). Use subfolders for organization (e.g., `Icons/`).
- **components/**: Reusable UI components (buttons, modals, form fields, etc.).
  - **shared/**: Components used across multiple features/pages (Sidebar, Header, Footer, etc.).
- **layouts/**: Layout wrappers for pages (e.g., MainLayout, AuthLayout). Use to provide consistent structure (sidebar, header, etc.).
- **pages/**: Route-level components. Each folder = a route/feature. Place all logic/UI for that route here. Subfolders for nested routes.
  - Example: `pages/Academic/AttendanceDetails.tsx` for `/academic/attendance-details` route.
- **routes/** (optional): Centralized route definitions/configs if you want to keep routing logic separate from `App.tsx`.
- **api/**: API call logic, fetchers, and data hooks. Organize by feature if needed.
- **hooks/**: Custom React hooks for logic reuse (e.g., `useAuth`, `useFetch`).
- **context/**: React context providers for global state (e.g., AuthContext, ThemeContext).
- **utils/**: Pure utility/helper functions (formatters, validators, etc.).
- **styles/**: Global CSS/SCSS files and shared style modules.
- **App.tsx**: Main app component. Sets up router and global providers.
- **main.tsx**: Entry point. Renders `<App />` into the DOM.
- **vite-env.d.ts**: Vite/TypeScript environment declarations.

### Root Files
- **package.json**: Project dependencies and scripts.
- **tsconfig.json**: TypeScript configuration.
- **Other config files**: ESLint, Prettier, Vite, etc.

---

## 🧭 Routing & Flexibility
- **pages/** structure mirrors your route structure. Add a new folder/file for each new route.
- Use React Router (or similar) in `App.tsx` to map routes to `pages/` components.
- For nested routes, use subfolders in `pages/`.
- Shared logic/UI goes in `hooks/`, `context/`, `utils/`, or `components/`.

---

## 📝 Example: Adding a New Route
1. Create `src/pages/Profile/Profile.tsx` for `/profile` route.
2. Add the route in your router (in `App.tsx` or `routes/`).

---

**This structure is scalable, easy to navigate, and supports both simple and complex routing.**