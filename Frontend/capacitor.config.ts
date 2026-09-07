import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor shell config (Batch B13 / T7.1.1).
 *
 * The app is a normal PWA build; Capacitor wraps `dist/` in a native WebView.
 * The one real decision is **auth**: the app uses cookie-mode sessions, and a
 * Capacitor WebView is served from `capacitor://localhost` / `http://localhost`
 * — a different origin from the API, so cookies would not be sent.
 *
 * Fix: point the WebView straight at the deployed origin with `server.url`.
 * Then the app is same-origin with the API and cookie auth "just works", the
 * service worker registers normally, and OTA updates come from the server. Set
 * `CAP_SERVER_URL` at build time (e.g. https://erp.srmap.edu.in).
 *
 * If you ever need a fully bundled offline shell instead, drop `server.url`,
 * switch the API client to a token in `@capacitor/preferences`, and use
 * `CapacitorHttp` so requests bypass the WebView's cookie jar.
 *
 * Native projects (`android/`, `ios/`) are generated with `npx cap add` and are
 * NOT committed — see docs/24-NATIVE-SHELL.md.
 */
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "in.edu.srmap.erpcompanion",
  appName: "SRM AP ERP",
  webDir: "dist",
  ...(serverUrl
    ? { server: { url: serverUrl, cleartext: false, androidScheme: "https" } }
    : { server: { androidScheme: "https" } }),
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
