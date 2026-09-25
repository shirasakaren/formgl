import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Experience } from '@/components/experience/Experience';
import { getPublicForm } from '@/lib/public/server';

type Params = Promise<{ slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const form = await getPublicForm(slug, sp.preview === '1');
  if (!form) return { title: 'Letter not found' };
  const description = form.settings.metaDescription || form.description || `${form.theme.envelopeSubtitle || 'A letter for you'} — open the envelope.`;
  return {
    title: form.title,
    description,
    openGraph: { title: form.title, description, images: form.settings.ogImageUrl ? [form.settings.ogImageUrl] : undefined, type: 'website' },
    twitter: { card: form.settings.ogImageUrl ? 'summary_large_image' : 'summary', title: form.title, description },
    robots: sp.preview === '1' ? { index: false, follow: false } : undefined,
  };
}

export default async function LetterPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params;
  const sp = await searchParams;
  const preview = sp.preview === '1';
  const form = await getPublicForm(slug, preview);
  if (!form) notFound();
  return <Experience form={form} preview={preview} />;
}
