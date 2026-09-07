import { ErpPageShell } from '../../components/erp/ErpPrimitives';
import { EmptyState } from '../../components/competition/CompetitionEmptyState';

export default function AdminCertTemplatesPage() {
  return (
    <ErpPageShell title="Certificate Templates" source="Placeholder" isLoading={false}>
      <EmptyState
        icon={<span aria-hidden="true">📜</span>}
        title="Global certificate templates are not available"
        description="Certificate templates are managed within each competition. This screen intentionally does not present fabricated template data."
      />
    </ErpPageShell>
  );
}
