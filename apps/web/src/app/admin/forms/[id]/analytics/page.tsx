'use client';

import { use } from 'react';
import { AnalyticsView } from '@/components/admin/analytics/AnalyticsView';

export default function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AnalyticsView formId={id} />;
}
