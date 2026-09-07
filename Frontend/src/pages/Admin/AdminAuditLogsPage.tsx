import { ErpPageShell } from '../../components/erp/ErpPrimitives';
import { EmptyState } from '../../components/competition/CompetitionEmptyState';

export default function AdminAuditLogsPage() {
  return (
    <ErpPageShell title="System Audit Logs" source="Placeholder" isLoading={false}>
      <EmptyState
        icon={<span aria-hidden="true">📋</span>}
        title="Audit log service is not available"
        description="This screen does not display sample data. Use the deployment logs until a backed, access-controlled audit-log service is introduced."
      />
    </ErpPageShell>
  );
}
