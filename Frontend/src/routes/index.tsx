import { Navigate, createBrowserRouter } from "react-router-dom";
import { adminRoutes } from "./adminRoutes";
import { baseRoutes } from "./baseRoutes";
import { erpRoutes } from "./erpRoutes";
import { eventRoutes } from "./eventRoutes";
import { lmsRoutes } from "./lmsRoutes";

export const router = createBrowserRouter([
  ...baseRoutes,
  ...eventRoutes,
  ...lmsRoutes,
  ...erpRoutes,
  ...adminRoutes,
  { path: "*", element: <Navigate to="/" replace /> },
]);
