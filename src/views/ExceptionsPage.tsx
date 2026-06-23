import { AlertTriangle } from 'lucide-react';
import { ModuleScaffold } from '@/components/layout/ModuleScaffold';

export default function ExceptionsPage() {
  return (
    <ModuleScaffold
      title="Exceptions"
      description="Triage invoices that failed validation, matching, or approval rules."
      icon={AlertTriangle}
    />
  );
}
