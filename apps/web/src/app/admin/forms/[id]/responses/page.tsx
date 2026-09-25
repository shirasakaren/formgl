'use client';

import { use } from 'react';
import { ResponsesView } from '@/components/admin/responses/ResponsesView';

export default function ResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ResponsesView formId={id} />;
}
