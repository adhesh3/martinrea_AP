import { GitMerge } from 'lucide-react';
import { ModuleScaffold } from '@/components/layout/ModuleScaffold';

export default function MatchPage() {
  return (
    <ModuleScaffold
      title="2-Way / 3-Way Match"
      description="Reconcile invoices against purchase orders and goods receipts."
      icon={GitMerge}
    />
  );
}
