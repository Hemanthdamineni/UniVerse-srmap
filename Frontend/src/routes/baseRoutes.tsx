import { Navigate } from "react-router-dom";
import ProtectedPage from "../components/ProtectedPage";
import PageLayout from "../pages/Pagelayout";
import { lazy } from "react";
import { SuspenseWrapper } from "../components/SuspenseWrapper";
import { hasSessionAuth } from "../lib/core/session";

function RootRedirect() {
  return <Navigate to={hasSessionAuth() ? "/dashboard" : "/login"} replace />;
}

const LoginPage = lazy(() => import("../pages/Login/LoginPage"));
const ForgotPasswordPage = lazy(() => import("../pages/Login/ForgotPasswordPage"));
const Dashboard = lazy(() => import("../pages/Dashboard/Dashboard"));
const ProfilePage = lazy(() => import("../pages/Profile/ProfilePage"));
const PublicCareerProfilePage = lazy(() => import("../pages/CareerPortal/PublicCareerProfilePage"));

export const baseRoutes = [
  { path: "/", element: <RootRedirect /> },
  { path: "/Home", element: <RootRedirect /> },
  { path: "/login", element: <PageLayout><SuspenseWrapper><LoginPage /></SuspenseWrapper></PageLayout> },
  { path: "/forgot-password", element: <PageLayout><SuspenseWrapper><ForgotPasswordPage /></SuspenseWrapper></PageLayout> },
  { path: "/career/public/:userId", element: <PageLayout><SuspenseWrapper><PublicCareerProfilePage /></SuspenseWrapper></PageLayout> },
  { path: "/dashboard", element: <ProtectedPage><SuspenseWrapper><Dashboard /></SuspenseWrapper></ProtectedPage> },
  { path: "/profile", element: <ProtectedPage><SuspenseWrapper><ProfilePage /></SuspenseWrapper></ProtectedPage> },
];
