import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import AppProviders from "./AppProviders";
import { router } from "./routes";
import { isStaticPrototype, bootstrapStaticPrototypeSession } from "./lib/core/prototype";
import { startSessionHeartbeat } from "./lib/core/session";
import { applyInitialTheme, initTheme } from "./lib/core/theme";
import { initNativePush } from "./lib/core/nativePush";

if (isStaticPrototype()) {
  bootstrapStaticPrototypeSession();
}

// Applied at module scope so the stored theme lands on <html> before React's
// first paint; the effect below only keeps the OS listener bound.
applyInitialTheme();

export default function App() {
  useEffect(() => startSessionHeartbeat(), []);
  useEffect(() => initTheme(), []);
  // No-op on web; registers for FCM/APNs inside the Capacitor shell (B13).
  useEffect(() => void initNativePush(), []);

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
