import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import AppProviders from "./AppProviders";
import { router } from "./routes";
import { isStaticPrototype, bootstrapStaticPrototypeSession } from "./lib/core/prototype";
import { startSessionHeartbeat } from "./lib/core/session";

if (isStaticPrototype()) {
  bootstrapStaticPrototypeSession();
}

export default function App() {
  useEffect(() => startSessionHeartbeat(), []);

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
