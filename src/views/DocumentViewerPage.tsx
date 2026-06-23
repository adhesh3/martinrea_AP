import { FileSearch } from 'lucide-react';
import { ModuleScaffold } from '@/components/layout/ModuleScaffold';

export default function DocumentViewerPage() {
  return (
    <ModuleScaffold
      title="Document Viewer"
      description="Open the source PDF or image for any invoice alongside its captured data."
      icon={FileSearch}
    />
  );
}
