import { Navigate } from "react-router-dom";
import { useAdminMode } from "../contexts/AdminModeContext";

export default function AdminOnlyPage({ children }: { children: React.ReactNode }) {
  const admin = useAdminMode();
  if (!admin.isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
