import { RouterProvider } from "react-router-dom";
import AppProviders from "./AppProviders";
import { router } from "./routes";
import { isStaticPrototype, bootstrapStaticPrototypeSession } from "./lib/core/prototype";

if (isStaticPrototype()) {
  bootstrapStaticPrototypeSession();
}

export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
