import { Navigate } from "react-router-dom";
import PageLayout from "../pages/Pagelayout";
import { hasSessionAuth } from "../lib/session";

export default function ProtectedPage({ children }: { children: React.ReactNode }) {
  if (!hasSessionAuth()) {
    return <Navigate to="/login" replace />;
  }

  return <PageLayout>{children}</PageLayout>;
}
