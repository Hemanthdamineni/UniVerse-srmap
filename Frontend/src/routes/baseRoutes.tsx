import { Navigate } from "react-router-dom";
import ProtectedPage from "../components/ProtectedPage";
import PageLayout from "../pages/Pagelayout";
import { lazy } from "react";
import { SuspenseWrapper } from "../components/SuspenseWrapper";

const HomePage = lazy(() => import("../pages/Home/HomePage"));
const LoginPage = lazy(() => import("../pages/Login/LoginPage"));
const ForgotPasswordPage = lazy(() => import("../pages/Login/ForgotPasswordPage"));
const Dashboard = lazy(() => import("../pages/Dashboard/Dashboard"));
const ProfilePage = lazy(() => import("../pages/Profile/ProfilePage"));
const PublicCareerProfilePage = lazy(() => import("../pages/CareerPortal/PublicCareerProfilePage"));

export const baseRoutes = [
  { path: "/", element: <PageLayout><SuspenseWrapper><HomePage /></SuspenseWrapper></PageLayout> },
  { path: "/Home", element: <Navigate to="/" replace /> },
  { path: "/login", element: <PageLayout><SuspenseWrapper><LoginPage /></SuspenseWrapper></PageLayout> },
  { path: "/forgot-password", element: <PageLayout><SuspenseWrapper><ForgotPasswordPage /></SuspenseWrapper></PageLayout> },
  { path: "/career/public/:userId", element: <PageLayout><SuspenseWrapper><PublicCareerProfilePage /></SuspenseWrapper></PageLayout> },
  { path: "/dashboard", element: <ProtectedPage><SuspenseWrapper><Dashboard /></SuspenseWrapper></ProtectedPage> },
  { path: "/profile", element: <ProtectedPage><SuspenseWrapper><ProfilePage /></SuspenseWrapper></ProtectedPage> },
];
