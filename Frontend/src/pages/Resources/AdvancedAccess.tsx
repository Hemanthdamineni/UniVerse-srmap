// Re-export wrapper — actual routing is handled in main.tsx
// This file exists as a module boundary but is not directly used by the router.
import { ErpPageShell, EmptyStateCard } from "../../components/erp/ErpPrimitives";

export default function AdvancedAccess() {
  return (
    <ErpPageShell title="Advanced Access" source="Internal API">
      <EmptyStateCard message="Navigate to Advanced Access from the sidebar to view resources." />
    </ErpPageShell>
  );
}
