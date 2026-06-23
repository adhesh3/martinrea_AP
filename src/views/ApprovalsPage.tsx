import { CheckCircle2 } from 'lucide-react';
import { ModuleScaffold } from '@/components/layout/ModuleScaffold';

export default function ApprovalsPage() {
  return (
    <ModuleScaffold
      title="Approval Workflow"
      description="Track invoices routed for approval and act on items assigned to you."
      icon={CheckCircle2}
    />
  );
}
