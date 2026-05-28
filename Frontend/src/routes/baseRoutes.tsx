import { Navigate } from "react-router-dom";
import ProtectedPage from "../components/ProtectedPage";
import PageLayout from "../pages/Pagelayout";
import HomePage from "../pages/Home/HomePage";
import LoginPage from "../pages/Login/LoginPage";
import ForgotPasswordPage from "../pages/Login/ForgotPasswordPage";
import Dashboard from "../pages/Dashboard/Dashboard";
import ProfilePage from "../pages/Profile/ProfilePage";

export const baseRoutes = [
  { path: "/", element: <PageLayout><HomePage /></PageLayout> },
  { path: "/Home", element: <Navigate to="/" replace /> },
  { path: "/login", element: <PageLayout><LoginPage /></PageLayout> },
  { path: "/forgot-password", element: <PageLayout><ForgotPasswordPage /></PageLayout> },
  { path: "/dashboard", element: <ProtectedPage><Dashboard /></ProtectedPage> },
  { path: "/profile", element: <ProtectedPage><ProfilePage /></ProtectedPage> },
];
