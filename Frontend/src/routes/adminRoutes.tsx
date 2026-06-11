import AdminOnlyPage from "../components/AdminOnlyPage";
import ProtectedPage from "../components/ProtectedPage";
import { lazy } from "react";
import { SuspenseWrapper } from "../components/SuspenseWrapper";
import { EventProviderWrapper } from "./eventRoutes";

const AdminEventDetailPage = lazy(() => import("../pages/Admin/AdminEventDetailPage"));

export const adminRoutes = [
  {
    path: "/admin/events-management/:eventId",
    element: (
      <ProtectedPage>
        <AdminOnlyPage>
          <EventProviderWrapper>
            <SuspenseWrapper>
              <AdminEventDetailPage />
            </SuspenseWrapper>
          </EventProviderWrapper>
        </AdminOnlyPage>
      </ProtectedPage>
    ),
  },
];
