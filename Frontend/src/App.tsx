import { RouterProvider } from "react-router-dom";
import AppProviders from "./AppProviders";
import { router } from "./routes";
import { isStaticPrototype } from "./lib/prototype/staticPrototypeEnv";
import { bootstrapStaticPrototypeSession } from "./lib/prototype/staticPrototypeSession";

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
