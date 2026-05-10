export const APP_BREAKPOINTS = {
  mobile: 640,
  tablet: 900,
  desktop: 1200,
  wide: 1536,
} as const;

export const SPACING_SCALE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const TYPOGRAPHY_ROLES = {
  display: "text-3xl font-semibold tracking-tight",
  title: "text-2xl font-semibold",
  section: "text-lg font-semibold",
  body: "text-sm font-normal",
  caption: "text-xs font-medium",
} as const;

export const ASYNC_STATE_VARIANTS = {
  loading: "loading",
  empty: "empty",
  error: "error",
  ready: "ready",
} as const;

export const PAGE_LAYOUT_TYPES = {
  dashboard: "dashboard",
  data: "data",
  detail: "detail",
  form: "form",
  reading: "reading",
} as const;
