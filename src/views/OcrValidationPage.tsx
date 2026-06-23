import { ScanLine } from 'lucide-react';
import { ModuleScaffold } from '@/components/layout/ModuleScaffold';

export default function OcrValidationPage() {
  return (
    <ModuleScaffold
      title="OCR Validation"
      description="Review and correct OCR-extracted fields before invoices move into matching."
      icon={ScanLine}
    />
  );
}
