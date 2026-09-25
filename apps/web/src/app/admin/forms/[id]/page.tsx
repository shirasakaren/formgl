'use client';

import { use } from 'react';
import { FormEditor } from '@/components/admin/editor/FormEditor';

export default function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <FormEditor id={id} />;
}
