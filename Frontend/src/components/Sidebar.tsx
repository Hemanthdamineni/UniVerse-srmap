import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { BOTTOM_NAV } from "../config/erpBlueprints";
import { getMainNavSections } from "../config/navigationRegistry";
import ThemeToggle from "./ThemeToggle";
import { fetchSessionProfile, getSessionId, logoutSession, readStoredProfileData } from "../lib/session";
import { useAdminMode } from "../contexts/AdminModeContext";

function SidebarContrastText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={className} aria-label={text}>
      {Array.from(text).map((char, index) => (
        <span
          key={`${text}-${index}`}
          aria-hidden="true"
          data-page-contrast="true"
          className="sidebar-contrast-char"
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </span>
  );
}

function normalizeRoute(route: string) {
  const normalized = String(route || "").replace(/\/+$/, "");
  return normalized || "/";
}

export default function Sidebar() {
  const admin = useAdminMode();
  const [sidebarClosed, setSidebarClosed] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 900 : false
  );
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = normalizeRoute(location.pathname);
  const isActiveRoute = useCallback((route: string) => normalizeRoute(route) === currentPath, [currentPath]);

  const navSections = useMemo(() => getMainNavSections({ isAdmin: admin.isAdmin }), [admin.isAdmin]);

  const activeGroupKey = useMemo(() => {
    for (const section of navSections) {
      for (const item of section.items) {
        if (item.type === "group" && item.children.some((child) => isActiveRoute(child.route))) {
          return `${section.section}:${item.label}`;
        }
      }
    }
    return null;
  }, [isActiveRoute, navSections]);

  useEffect(() => {
    if (activeGroupKey) {
      setOpenGroup(activeGroupKey);
    }
  }, [activeGroupKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      if (window.innerWidth < 900) {
        setSidebarClosed(true);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const storedProfile = readStoredProfileData();
    if (storedProfile) {
      setProfileData(storedProfile);
    }
  }, []);

  useEffect(() => {
    let active = true;

    if (!getSessionId()) {
      setProfileData(null);
      return () => {
        active = false;
      };
    }

    fetchSessionProfile()
      .then((profile) => {
        if (!active) return;
        setProfileData(profile);
      })
      .catch(() => {
        if (!active) return;
        setProfileData(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = useCallback(async () => {
    await logoutSession();
    navigate("/login");
  }, [navigate]);

  const profilePhoto =
    typeof profileData?.photo === "string"
      ? profileData.photo
      : "https://cdn.builder.io/api/v1/image/assets/TEMP/fe2259c93f68b89dfbd7622fc3b2505b0f165279?placeholderIfAbsent=true";
  const tableContent =
    profileData && typeof profileData.TableContent === "object" && profileData.TableContent
      ? (profileData.TableContent as Record<string, unknown>)
      : null;
  const profileName =
    typeof profileData?.name === "string"
      ? profileData.name
      : typeof tableContent?.["Student Name"] === "string"
        ? tableContent["Student Name"]
        : typeof tableContent?.Name === "string"
          ? tableContent.Name
          : typeof tableContent?.["Register No."] === "string"
            ? tableContent["Register No."]
          : "Student Portal";
  const profileRegNo =
    typeof tableContent?.["Register No."] === "string"
      ? tableContent["Register No."]
      : typeof profileData?.regNo === "string"
        ? profileData.regNo
        : typeof profileData?.registerNo === "string"
          ? profileData.registerNo
          : "";

  return (
    <div
      ref={sidebarRef}
      className={`sidebar relative flex h-full flex-col border-r transition-all duration-300 ${
        sidebarClosed ? "w-16" : "w-64"
      }`}
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--sidebar-bg)",
        boxShadow: "var(--sidebar-shadow)",
      }}
    >
      <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--border)" }}>
        {!sidebarClosed ? (
          <div className="text-[1.15rem] font-bold tracking-[0.01em]">
            <SidebarContrastText text="UniVerse — SRMAP Edition" className="sidebar-item" />
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setSidebarClosed((prev) => !prev);
            setOpenGroup(null);
          }}
          className="absolute -right-3 top-7 z-10 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-shadow hover:shadow-md"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
        >
          {sidebarClosed ? (
            <ChevronRightIcon className="h-4 w-4 text-[var(--text-primary)]" />
          ) : (
            <ChevronLeftIcon className="h-4 w-4 text-[var(--text-primary)]" />
          )}
        </button>
      </div>

      <div className="sidebar-scroll-area flex-1 overflow-y-auto pt-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/25">
        <nav className={`${sidebarClosed ? "px-4 pl-2" : "px-4"} space-y-4`}>
          {navSections.map((section) => (
            <div key={section.section} className="space-y-3">
              <div className="flex items-center gap-2 px-2 text-[0.68rem] uppercase tracking-[0.24em]">
                {!sidebarClosed ? (
                  <SidebarContrastText text={section.section} className="sidebar-item-muted" />
                ) : (
                  <span className="sr-only">{section.section}</span>
                )}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  if (item.type === "link") {
                    return (
                      <Link
                        key={item.label}
                        data-page-contrast="true"
                        to={item.route}
                        className={`sidebar-item sidebar-item-hover flex w-full items-center gap-3 rounded-lg px-2 py-2 font-semibold transition ${
                          sidebarClosed ? "justify-center" : ""
                        } ${isActiveRoute(item.route) ? "sidebar-item-active" : ""}`}
                      >
                        <img
                          src={item.icon ?? "/src/assets/Icons/Dashboard.png"}
                          alt=""
                          className="sidebar-icon h-6 w-6"
                        />
                        {!sidebarClosed && <SidebarContrastText text={item.label} />}
                      </Link>
                    );
                  }

                  const groupKey = `${section.section}:${item.label}`;
                  const isOpen = openGroup === groupKey;
                  const activeChild = item.children.some((child) => isActiveRoute(child.route));

                  return (
                    <div key={item.label} className="m-0 p-0">
                      <button
                        id={`${groupKey}-header`}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`${groupKey}-panel`}
                        data-page-contrast="true"
                        className={`sidebar-item sidebar-item-hover flex w-full items-center gap-3 rounded-md px-2 py-2 transition-colors ${
                          (isOpen || activeChild) ? "sidebar-item-active font-semibold" : ""
                        }`}
                        onClick={() => {
                          setOpenGroup((prev) => (prev === groupKey ? null : groupKey));
                          if (sidebarClosed) setSidebarClosed(false);
                        }}
                      >
                        <img
                          src={item.icon ?? "/src/assets/Icons/Dashboard.png"}
                          alt=""
                          className="sidebar-icon h-6 w-6"
                        />
                        {!sidebarClosed ? <SidebarContrastText text={item.label} /> : null}
                        {!sidebarClosed ? (
                          <ChevronDownIcon
                            className={`sidebar-item-muted ml-auto h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                        ) : null}
                      </button>

                      <div
                        id={`${groupKey}-panel`}
                        role="region"
                        aria-labelledby={`${groupKey}-header`}
                        className={`ml-8 mt-1 overflow-hidden transition-all duration-300 ${
                          isOpen && !sidebarClosed ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="space-y-1">
                          {item.children
                            .filter((child) => showAdvanced || child.access === "B")
                            .map((child) => (
                              <Link
                                data-page-contrast="true"
                                key={child.route}
                                to={child.route}
                                className={`sidebar-item-muted sidebar-item-hover block rounded px-2 py-1 text-left text-sm ${
                                  isActiveRoute(child.route) ? "sidebar-item sidebar-item-active font-semibold" : ""
                                }`}
                              >
                                <SidebarContrastText text={child.label} />
                              </Link>
                            ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mx-6 my-6 border-t" style={{ borderColor: "var(--border)" }} />

        <nav className={`${sidebarClosed ? "px-4 pl-2" : "px-4"} space-y-1`}>
          <div data-page-contrast="true" className="sidebar-segment-shell rounded-xl border p-2" style={{ borderColor: "var(--border)" }}>
            {!sidebarClosed ? (
              <div className="sidebar-segment-track flex w-full overflow-hidden rounded-md">
                <button
                  type="button"
                  data-page-contrast="true"
                  onClick={() => setShowAdvanced(false)}
                  className={`flex-1 py-2 text-sm font-medium transition ${
                    !showAdvanced
                      ? "sidebar-segment-active shadow"
                      : "sidebar-item-muted sidebar-item-hover"
                  }`}
                >
                  <SidebarContrastText text="Basic" />
                </button>
                <button
                  type="button"
                  data-page-contrast="true"
                  onClick={() => setShowAdvanced(true)}
                  className={`flex-1 py-2 text-sm font-medium transition ${
                    showAdvanced
                      ? "sidebar-segment-active shadow"
                      : "sidebar-item-muted sidebar-item-hover"
                  }`}
                >
                  <SidebarContrastText text="Advanced" />
                </button>
              </div>
            ) : null}
          </div>

          {BOTTOM_NAV.map((item) =>
            item.label === "Logout" ? (
              <button
                key={item.label}
                type="button"
                data-page-contrast="true"
                onClick={handleLogout}
                className={`sidebar-item sidebar-item-hover flex w-full items-center rounded-lg px-2 py-2 font-medium transition ${
                  sidebarClosed ? "justify-center" : ""
                } ${isActiveRoute(item.route) ? "sidebar-item-active" : ""}`}
              >
                <img src={item.icon} alt="" className="sidebar-icon mr-3 h-6 w-6" loading="lazy" />
                {!sidebarClosed && <SidebarContrastText text={item.label} />}
              </button>
            ) : (
              <Link
                key={item.label}
                to={item.route}
                data-page-contrast="true"
                className={`sidebar-item sidebar-item-hover flex w-full items-center rounded-lg px-2 py-2 font-medium transition ${
                  sidebarClosed ? "justify-center" : ""
                }`}
              >
                <img src={item.icon} alt="" className="sidebar-icon mr-3 h-6 w-6" loading="lazy" />
                {!sidebarClosed && <SidebarContrastText text={item.label} />}
              </Link>
            )
          )}
        </nav>
      </div>

      <div className={`border-t p-2 flex ${sidebarClosed ? "flex-col items-center gap-2" : "items-center justify-between"}`} style={{ borderColor: "var(--border)" }}>
        <div
          data-page-contrast="true"
          className="sidebar-item-hover flex cursor-pointer items-center gap-3 rounded-lg p-1 transition-colors flex-1 min-w-0"
          onClick={() => navigate("/profile")}
        >
          <img src={profilePhoto} alt="User avatar" className="h-10 w-10 shrink-0 rounded-full" loading="lazy" />
          {!sidebarClosed ? (
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="sidebar-item-muted text-xs truncate">
                <SidebarContrastText text="Welcome back 👋" />
              </p>
              <p className="sidebar-item text-sm font-medium truncate" title={profileName}>
                <SidebarContrastText text={profileName} />
              </p>
              {profileRegNo ? (
                <p className="sidebar-item-muted text-xs truncate" title={profileRegNo}>
                  <SidebarContrastText text={profileRegNo} />
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className={sidebarClosed ? "mt-2 flex justify-center w-full shrink-0" : "ml-2 shrink-0"}>
          <ThemeToggle />
        </div>
      </div>
      {!sidebarClosed && admin.potentialAdmin ? (
        <div className="px-3 pb-2">
          {admin.isAdmin ? (
            <div className="rounded-lg border border-[var(--status-open-border)] bg-[var(--status-open-bg)] px-3 py-2 text-xs font-semibold text-[var(--status-open-text)]">
              Admin Mode Enabled
            </div>
          ) : (
            <button
              type="button"
              onClick={admin.openPrompt}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
            >
              Enable Admin Mode
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
