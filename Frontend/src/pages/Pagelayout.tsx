import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Footer from "../components/Footer";
import NavigationCommandPalette from "../components/NavigationCommandPalette";
import AppContentChrome from "../components/shell/AppContentChrome";
import AppKeyboardShortcuts from "../components/AppKeyboardShortcuts";
import AdminAccessPrompt from "../components/admin/AdminAccessPrompt";
import { AdminModeProvider } from "../context/AdminModeContext";

const PUBLIC_ROUTES = new Set(["/", "/Home", "/login", "/forgot-password"]);

export default function PageLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isPublicRoute = PUBLIC_ROUTES.has(location.pathname);

  if (isPublicRoute) {
    return (
      <div style={{ display: "flex", height: "100vh", flexDirection: "column", backgroundColor: "var(--background)" }}>
        <Header />
        <main style={{ flex: 1, flexGrow: 1, alignItems: "center", justifyContent: "center", backgroundColor: "var(--background)" }}>
          {children}
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <AdminModeProvider>
    <div style={{ display: "flex", height: "100vh", flexDirection: "column", backgroundColor: "var(--background)" }}>
      <div style={{ display: "flex", flex: 1, height: "100vh", overflow: "hidden" }}>
        <div className="dashboard-background" style={{ flex: 1, position: "relative", display: "flex", height: "100vh", minHeight: "100vh", overflow: "hidden" }}>
          <Sidebar />
          <main
            style={{
              flex: 1,
              position: "relative",
              overflow: "auto",
              zIndex: 1,
              minHeight: "100vh",
            }}
          >
            <a
              href="#main-content"
              className="fixed left-4 top-2 z-[60] -translate-y-24 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-md transition focus:translate-y-0 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent-blue)]"
            >
              Skip to main content
            </a>
            <NavigationCommandPalette />
            <AppKeyboardShortcuts />
            <AppContentChrome>{children}</AppContentChrome>
          </main>
        </div>
      </div>
      <AdminAccessPrompt />
    </div>
    </AdminModeProvider>
  );
}
