import AdminOnlyPage from "../components/AdminOnlyPage";
import ProtectedPage from "../components/ProtectedPage";
import AdminEventDetailPage from "../pages/Admin/AdminEventDetailPage";
import { EventProviderWrapper } from "./eventRoutes";

export const adminRoutes = [
  {
    path: "/admin/events-management/:eventId",
    element: (
      <ProtectedPage>
        <AdminOnlyPage>
          <EventProviderWrapper>
            <AdminEventDetailPage />
          </EventProviderWrapper>
        </AdminOnlyPage>
      </ProtectedPage>
    ),
  },
];
