import { ErpPageShell } from "../../components/erp/ErpPrimitives";

export default function AcademicProgressPage() {
  return (
    <ErpPageShell title="Academic Progress" source="Internal API">
      <p className="body-text">
        View your semester-wise progress, credits, and performance.
      </p>
    </ErpPageShell>
  );
}
